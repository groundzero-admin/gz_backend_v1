import Student from "../models/Student.js";
import { sendResponse } from "../middleware/auth.js";
 // Adjust path as needed
export const updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.authPayload.id; // Extracted from Auth Middleware
    const { name, class: studentClass } = req.body;

    // 1. Prepare the update object
    const updates = {};

    // Only update name if provided
    if (name && name.trim() !== "") {
      updates.name = name.trim();
    }

    // Only update class if provided
    if (studentClass !== undefined && studentClass !== null) {
      updates.class = Number(studentClass);
    }

    // 2. Check if there is anything to update
    if (Object.keys(updates).length === 0) {
      return sendResponse(res, 400, false, "No valid fields provided for update.");
    }

    // 3. Perform the update
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password -password_text"); // Exclude password from response

    if (!updatedStudent) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    return sendResponse(res, 200, true, "Profile updated successfully.", updatedStudent);

  } catch (err) {
    console.error("updateStudentProfile error:", err);
    return sendResponse(res, 500, false, "Server error updating profile.");
  }
};
