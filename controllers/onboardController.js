import bcrypt from "bcrypt";
import TeacherStudentCounter from "../models/TeacherStudentCounter.js"; // Import your schema
import NewJoineeInvitation from "../models/NewJoineeInvitation.js";
import CourseOrder from "../models/CourseOrder.js";
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import StudentCredit from "../models/StudentCredit.js";
import { sendResponse } from "../middleware/auth.js";



// --- Helper: Generate Auto-Incrementing Student Number ---
// This uses the schema you provided: { key: "student", count: 0 }
const getNextNumber = async (key, prefix) => {
  let counter = await TeacherStudentCounter.findOne({ key });

  // If this is the first student ever, create the counter entry
  if (!counter) {
    counter = new TeacherStudentCounter({ key, count: 0 });
  }

  // Increment and save
  counter.count += 1;
  await counter.save();

  // Format: If count is 5, result is "GZST005"
  const padded = String(counter.count).padStart(3, "0");
  return prefix + padded;
};

/**
 * Controller: completeStudentRegistration
 * Input: { token, otp, password, name, mobile , schoolName, board }
 * Logic: Verifies OTP -> Creates Student (with Auto ID) -> Links Parent -> Adds Credits
 */
export const completeStudentRegistration = async (req, res) => {
  try {
    const { 
      token, 
      otp, 
      password,
      // Optional: User can override these, otherwise we take from CourseOrder
      name, mobile , schoolName, board 
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

    // 3. Fetch Original Order Data (we need this for credits & parent info)
    const order = await CourseOrder.findById(invitation.course_order_id);
    if (!order) {
      return sendResponse(res, 404, false, "Original course order not found.");
    }

    // 4. Check if student already exists (Edge case protection)
    const existingStudent = await Student.findOne({ email: invitation.studentEmail });
    if (existingStudent) {
      // Security: delete invite so it can't be reused
      await NewJoineeInvitation.findByIdAndDelete(invitation._id);
      return sendResponse(res, 409, false, "Student account already exists.");
    }

    // --- 5. Generate Student Number (e.g., GZST001) ---
    const student_number = await getNextNumber("student", "GZST");

    // 6. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Create Student 
    // (Note: 'class' is removed as requested)
    const newStudent = await Student.create({
      name: name || order.studentName,
      email: invitation.studentEmail,
      password: hashedPassword,
      role: "student",
      
      mobile: mobile || "",
      schoolName: schoolName || order.schoolName,
      board: board || order.board,
      class : order.classGrade , 
      student_number: student_number // <--- Auto-incremented ID saved here
    });

    // 8. Link Parent (Create Relation)
    await StudentParentRelation.create({
      studentEmail: newStudent.email,
      parentEmail: order.parentEmail
    });

    // 9. Add Student Credits (from CourseOrder amount)
    await StudentCredit.create({
      student_obj_id: newStudent._id,
      studentEmail: newStudent.email,
      amount: order.amount,
      source: `COURSE_ENROLLMENT - ${order.purchaseType}`,
      course_order_id: order._id
    });

    // 10. Cleanup: Delete the used invitation
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