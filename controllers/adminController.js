import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";
import { sendResponse, signToken } from "../middleware/auth.js";
import Student from "../models/Student.js"; 




export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendResponse(res, 400, false, "email & password required");
    const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
    if (!admin) return sendResponse(res, 404, false, "Admin not found");

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return sendResponse(res, 401, false, "Invalid credentials");

    const token = signToken({ id: admin._id.toString(), role: "admin", email: admin.email }, "7d");
   res.cookie("auth_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 3600 * 1000,
});

    return sendResponse(res, 200, true, "Admin logged in", { email: admin.email });
  } catch (err) {
    console.error("admin login err", err);
    return sendResponse(res, 500, false, "Server error");
  }
};






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