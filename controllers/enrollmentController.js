import mongoose from "mongoose";
import Student from "../models/Student.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { sendResponse } from "../middleware/auth.js";

export const enrollStudent = async (req, res) => {
  try {
    const auth = req.authPayload;
    const studentId = auth.id;
    if (!studentId) return sendResponse(res, 401, false, "Invalid auth payload");

    // ensure the auth token's role matches database (extra safety)
    const student = await Student.findById(studentId);
    if (!student) return sendResponse(res, 404, false, "Student account not found");

    const { courseId, courseIds } = req.body;
    const courseList = Array.isArray(courseIds) ? courseIds : (courseId ? [courseId] : []);
    if (courseList.length === 0) return sendResponse(res, 400, false, "courseId or courseIds required");

    const created = [];
    const skipped = [];

    for (const cid of courseList) {
      if (!mongoose.Types.ObjectId.isValid(cid)) { skipped.push({ cid, reason: "invalid id" }); continue; }
      const course = await Course.findById(cid);
      if (!course) { skipped.push({ cid, reason: "course not found" }); continue; }

      // try to create Enrollment
      try {
        await Enrollment.create({ studentId: student._id, courseId: course._id });
        created.push(cid);
      } catch (e) {
        skipped.push({ cid, reason: "already enrolled or error" });
      }
    }

    return sendResponse(res, 200, true, "Enrollment processed", { created, skipped });
  } catch (err) {
    console.error("enrollment err", err);
    return sendResponse(res, 500, false, "Server error enrolling");
  }
};