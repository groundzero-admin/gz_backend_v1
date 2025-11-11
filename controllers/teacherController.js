
import Teacher from "../models/Teacher.js"; // <-- 1. IMPORT THE TEACHER MODEL
import { sendResponse, signToken } from "../middleware/auth.js";
















export const listAllTeachers = async (req, res) => {
  try {
    // Find all documents in the Teacher collection
    // .select() specifies which fields to return
    const teachers = await Teacher.find({}).select("name email mobile");

    return sendResponse(res, 200, true, "Teachers retrieved successfully.", teachers);

  } catch (err) {
    console.error("listAllTeachers err", err);
    return sendResponse(res, 500, false, "Server error retrieving teachers.");
  }
};