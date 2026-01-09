import bcrypt from 'bcrypt';
import Student from '../models/Student.js'; // Adjust path as necessary
import { sendResponse } from "../middleware/auth.js";





// only accessed by admin 
export const updateStudentPassword = async (req, res) => {
  try {
    const { student_obj_id, new_password } = req.body;

    // 1. Validation
    if (!student_obj_id || !new_password) {
      return sendResponse(res, 400, false, "Student ID and new password are required.");
    }

    // 2. Hash the new password
    // We use 10 salt rounds, same as your registration logic
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // 3. Update the student record
    // We update both 'password' (for login auth) and 'password_text' (for admin view)
    const updatedStudent = await Student.findByIdAndUpdate(
      student_obj_id,
      {
        password: hashedPassword,     
        password_text: new_password   
      },
      { new: true } // Return the updated document
    );

    if (!updatedStudent) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    return sendResponse(res, 200, true, "Password updated successfully.");

  } catch (err) {
    console.error("updateStudentPassword error:", err);
    return sendResponse(res, 500, false, "Server error updating password.");
  }
};