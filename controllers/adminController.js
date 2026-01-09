import { sendResponse  } from "../middleware/auth.js";
import Student from "../models/Student.js"; 

import StudentCredit from "../models/StudentCredit.js";





// export const getAllStudentDetails = async (req, res) => {
//   try {
//     // Find all students and select only the required fields
//     const students = await Student.find({})
//       .select("name email class _id student_number")
//       .lean(); // Use .lean() for faster, plain JS objects

//     // Rename 'name' to 'username' in the response
//     const formattedStudents = students.map(student => ({
//       _id: student._id,
//       username: student.name, // Rename 'name' to 'username'
//       email: student.email,
//       class: student.class,
//       student_number : student.student_number
//     }));

//     return sendResponse(res, 200, true, "Students retrieved successfully.", formattedStudents);

//   } catch (err) {
//     console.error("getAllStudentDetails err", err);
//     return sendResponse(res, 500, false, "Server error retrieving students.");
//   }
// };












// import Student from "../models/Student.js";
// import Parent from "../models/Parent.js";
// import StudentParentRelation from "../models/StudentParentRelation.js";
// import StudentCredit from "../models/StudentCredit.js";
// import sendResponse from "../utils/sendResponse.js";



export const getAllStudentDetails = async (req, res) => {
  try {
    // 1. Fetch all students
    const students = await Student.find({})
      .select("name email class _id student_number password_text")
      .lean();

    const formattedStudents = [];

    for (const student of students) {
      
      // ================================
      // FETCH STUDENT CREDIT DETAILS
      // ================================
      // We use findOne because the schema enforces one wallet per student
      const studentWallet = await StudentCredit.findOne({
        student_obj_id: student._id
      })
      .select("amount_for_online amount_for_offline")
      .lean();

      // Handle case where wallet might not exist yet (default to 0)
      const onlineCredit = studentWallet ? studentWallet.amount_for_online : 0;
      const offlineCredit = studentWallet ? studentWallet.amount_for_offline : 0;

      // ================================
      // BUILD FINAL RESPONSE OBJECT
      // ================================
      formattedStudents.push({
        _id: student._id,
        username: student.name,
        email: student.email,
        class: student.class,
        student_number: student.student_number,
        password_text : student.password_text || "some issues - contact developer" , 

        credit: {
          online: onlineCredit,
          offline: offlineCredit,
          // Optional: You can still calculate a grand total if you want
          total: onlineCredit + offlineCredit
        }
      });
    }

    return sendResponse(res, 200, true, "Students retrieved successfully.", formattedStudents);

  } catch (err) {
    console.error("getAllStudentDetails err", err);
    return sendResponse(res, 500, false, "Server error retrieving students.");
  }
};







export const updateStudentCredits = async (req, res) => {
  try {
    const { 
      student_obj_id, 
      student_number, 
      online_amount, 
      offline_amount 
    } = req.body;

    // 1. Basic Validation
    if (!student_obj_id || !student_number) {
      return sendResponse(res, 400, false, "Student ID and Roll Number (GZST...) are required.");
    }

    if (online_amount === undefined || offline_amount === undefined) {
      return sendResponse(res, 400, false, "Both Online and Offline amounts are required (can be 0).");
    }

    // 2. Verify Student Exists & Roll Number Matches (Safety Check)
    const student = await Student.findById(student_obj_id);
    
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    if (student.student_number !== student_number) {
      return sendResponse(res, 400, false, "Roll number mismatch! Please verify the student details.");
    }

    // 3. Find and Update the Credit Wallet
    // We use findOneAndUpdate with upsert: true just in case the wallet was missing
    const updatedWallet = await StudentCredit.findOneAndUpdate(
      { student_obj_id: student._id },
      { 
        $set: {
          studentEmail: student.email, // Ensure email is consistent
          amount_for_online: Number(online_amount),
          amount_for_offline: Number(offline_amount)
        }
      },
      { 
        new: true,   // Return the updated document
        upsert: true // Create if it doesn't exist
      }
    );

    return sendResponse(res, 200, true, "Credits updated successfully.", {
      student: student.name,
      student_number: student.student_number,
      new_credits: {
        online: updatedWallet.amount_for_online,
        offline: updatedWallet.amount_for_offline
      }
    });

  } catch (err) {
    console.error("updateStudentCredits err", err);
    return sendResponse(res, 500, false, "Server error updating credits.");
  }
};