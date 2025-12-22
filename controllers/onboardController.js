import bcrypt from "bcrypt";
import TeacherStudentCounter from "../models/TeacherStudentCounter.js"; 
import NewJoineeInvitation from "../models/NewJoineeInvitation.js";
import CourseOrder from "../models/CourseOrder.js";
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import StudentCredit from "../models/StudentCredit.js";
import { sendResponse } from "../middleware/auth.js";
import crypto from "crypto";
import BatchStudentRelation from "../models/BatchStudentRelation.js";




// --- Helper: Generate Auto-Incrementing Student Number ---
const getNextNumber = async (key, prefix) => {
  let counter = await TeacherStudentCounter.findOne({ key });
  if (!counter) {
    counter = new TeacherStudentCounter({ key, count: 0 });
  }
  counter.count += 1;
  await counter.save();
  const padded = String(counter.count).padStart(3, "0");
  return prefix + padded;
};



/**
 * Controller: completeStudentRegistration
 * Input: { token, otp, password, name, mobile, schoolName, board }
 */


export const completeStudentRegistration = async (req, res) => {
  try {
    const { token, otp, password, name, mobile, schoolName, board } = req.body;

    if (!token || !otp || !password) {
      return sendResponse(res, 400, false, "Token, OTP, and Password are required.");
    }

    // 1. Verify Invitation
    const invitation = await NewJoineeInvitation.findOne({ magicLinkToken: token });
    if (!invitation) return sendResponse(res, 404, false, "Invalid or expired invitation.");
    if (String(invitation.otp) !== String(otp)) return sendResponse(res, 401, false, "Incorrect OTP.");

    // 2. Check Order & Exists
    const order = await CourseOrder.findById(invitation.course_order_id);
    if (!order) return sendResponse(res, 404, false, "Original order not found.");

    const existingStudent = await Student.findOne({ email: invitation.studentEmail });
    if (existingStudent) {
      await NewJoineeInvitation.findByIdAndDelete(invitation._id);
      return sendResponse(res, 409, false, "Student account already exists.");
    }

    // 3. Create Student
    const student_number = await getNextNumber("student", "GZST");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = await Student.create({
      name: name || order.studentName,
      email: invitation.studentEmail,
      password: hashedPassword,
      role: "student",
      mobile: mobile || "",
      schoolName: schoolName || order.schoolName,
      board: board || order.board,
      class: Number(order.classGrade) || null, 
      student_number: student_number 
    });

    // 4. Link Parent
    await StudentParentRelation.create({
      studentEmail: newStudent.email,
      parentEmail: order.parentEmail
    });

    // 5. Add Credits (Wallet)
    let amountOnline = 0;
    let amountOffline = 0;
    if (order.batchType === 'ONLINE') amountOnline = order.amount;
    else if (order.batchType === 'OFFLINE') amountOffline = order.amount;

    await StudentCredit.create({
      student_obj_id: newStudent._id,
      studentEmail: newStudent.email,
      amount_for_online: amountOnline,
      amount_for_offline: amountOffline
    });

    // ============================================================
    // 6. AUTO-ENROLLMENT IN BATCHES (NEW LOGIC)
    // ============================================================
    
    // Check if there are batches stored in the invitation
    if (invitation.enroll_batches && invitation.enroll_batches.length > 0) {
      console.log(`[Auto-Enroll] Enrolling ${student_number} in ${invitation.enroll_batches.length} batches...`);
      
      const enrollPromises = invitation.enroll_batches.map(async (batch) => {
        try {
          // Use findOneAndUpdate with upsert to prevent duplicate key errors safely
          await BatchStudentRelation.findOneAndUpdate(
            { 
              batch_obj_id: batch.batch_obj_id, 
              student_obj_id: newStudent._id 
            },
            { 
              student_number: newStudent.student_number,
              joinedAt: new Date()
            },
            { upsert: true, new: true }
          );
        } catch (enrollError) {
          console.error(`Failed to enroll in batch ${batch.batchName}:`, enrollError);
          // Continue loop even if one fails
        }
      });

      await Promise.all(enrollPromises);
    }
    // ============================================================

    // 7. Cleanup
    await NewJoineeInvitation.findByIdAndDelete(invitation._id);

    return sendResponse(res, 201, true, "Student registration and batch enrollment successful!", {
      studentId: newStudent._id,
      student_number: student_number
    });

  } catch (err) {
    console.error("completeStudentRegistration error:", err);
    return sendResponse(res, 500, false, "Server error during registration.");
  }
};