import { sendResponse  } from "../middleware/auth.js";
import Student from "../models/Student.js"; 







export const getAllStudentDetails = async (req, res) => {
  try {
    // Find all students and select only the required fields
    const students = await Student.find({})
      .select("name email class _id")
      .lean(); // Use .lean() for faster, plain JS objects

    // Rename 'name' to 'username' in the response
    const formattedStudents = students.map(student => ({
      _id: student._id,
      username: student.name, // Rename 'name' to 'username'
      email: student.email,
      class: student.class
    }));

    return sendResponse(res, 200, true, "Students retrieved successfully.", formattedStudents);

  } catch (err) {
    console.error("getAllStudentDetails err", err);
    return sendResponse(res, 500, false, "Server error retrieving students.");
  }
};