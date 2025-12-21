import bcrypt from "bcrypt";
import TeacherStudentCounter from "../models/TeacherStudentCounter.js"; 
import NewJoineeInvitation from "../models/NewJoineeInvitation.js";
import CourseOrder from "../models/CourseOrder.js";
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import StudentCredit from "../models/StudentCredit.js";
import { sendResponse } from "../middleware/auth.js";

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
    const { 
      token, 
      otp, 
      password,
      // Optional overrides
      name, mobile, schoolName, board 
    } = req.body;

    // 1. Basic Input Validation
    if (!token || !otp || !password) {
      return sendResponse(res, 400, false, "Token, OTP, and Password are required.");
    }

    // 2. Verify Invitation & OTP
    const invitation = await NewJoineeInvitation.findOne({ magicLinkToken: token });
    
    if (!invitation) {
      return sendResponse(res, 404, false, "Invalid or expired invitation link.");
    }

    if (String(invitation.otp) !== String(otp)) {
      return sendResponse(res, 401, false, "Incorrect OTP.");
    }

    // 3. Fetch Original Order Data
    const order = await CourseOrder.findById(invitation.course_order_id);
    if (!order) {
      return sendResponse(res, 404, false, "Original course order not found.");
    }

    // 4. Check if student already exists
    const existingStudent = await Student.findOne({ email: invitation.studentEmail });
    if (existingStudent) {
      await NewJoineeInvitation.findByIdAndDelete(invitation._id);
      return sendResponse(res, 409, false, "Student account already exists.");
    }

    // 5. Generate Student Number
    const student_number = await getNextNumber("student", "GZST");

    // 6. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Create Student
    const newStudent = await Student.create({
      name: name || order.studentName,
      email: invitation.studentEmail,
      password: hashedPassword,
      role: "student",
      
      mobile: mobile || "",
      schoolName: schoolName || order.schoolName,
      board: board || order.board,
      
      // Ensure class is stored as a number if your schema requires it
      class: Number(order.classGrade) || null, 
      
      student_number: student_number 
    });

    // 8. Link Parent
    await StudentParentRelation.create({
      studentEmail: newStudent.email,
      parentEmail: order.parentEmail
    });

    // --- 9. Add Student Credits (UPDATED LOGIC) ---
    // We check the Batch Type and assign funds to the correct wallet bucket.
    
    let amountOnline = 0;
    let amountOffline = 0;

    if (order.batchType === 'ONLINE') {
      amountOnline = order.amount; // Add to Online Bucket
    } else if (order.batchType === 'OFFLINE') {
      amountOffline = order.amount; // Add to Offline Bucket
    }

    await StudentCredit.create({
      student_obj_id: newStudent._id,
      studentEmail: newStudent.email,
      
      // New Schema Fields
      amount_for_online: amountOnline,
      amount_for_offline: amountOffline
      
      // Note: Removed 'amount', 'source', 'course_order_id' as per new schema
    });

    // 10. Cleanup
    await NewJoineeInvitation.findByIdAndDelete(invitation._id);

    return sendResponse(res, 201, true, "Student registration successful!", {
      studentId: newStudent._id,
      student_number: student_number
    });

  } catch (err) {
    console.error("completeStudentRegistration error:", err);
    return sendResponse(res, 500, false, "Server error during registration.");
  }
};