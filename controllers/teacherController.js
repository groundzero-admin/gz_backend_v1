
import Teacher from "../models/Teacher.js"; // <-- 1. IMPORT THE TEACHER MODEL
import { sendResponse, signToken } from "../middleware/auth.js";




import CourseTeacherRelation from "../models/CourseTeacherRelation.js";
import Enrollment from "../models/Enrollment.js"; // <-- 1. IMPORT ENROLLMENT
import Student from "../models/Student.js";       // <-- 2. IMPORT STUDENT













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













export const listMyStudents = async (req, res) => {
  try {
    // 1. Get the teacher's ID from the auth token
    const teacherId = req.authPayload.id;

    // 2. Find all course IDs taught by this teacher
    const courseRelations = await CourseTeacherRelation.find({ 
      teacherId: teacherId 
    }).select("courseId"); // Only get the courseId field

    if (!courseRelations || courseRelations.length === 0) {
      return sendResponse(res, 200, true, "You are not assigned to any courses.", []);
    }

    // 3. Extract all courseId's into an array
    const courseIds = courseRelations.map(rel => rel.courseId);

    // 4. Find all enrollments for *any* of those courses
    const enrollments = await Enrollment.find({
      courseId: { $in: courseIds }
    }).select("studentId"); // Only get the studentId field

    if (!enrollments || enrollments.length === 0) {
      return sendResponse(res, 200, true, "No students are enrolled in your courses.", []);
    }

    // 5. Extract all *unique* studentId's
    // A Set prevents duplicates if a student is in two of your courses
    const studentIds = [...new Set(enrollments.map(e => e.studentId.toString()))];

    // 6. Find all student details for those IDs
    const students = await Student.find({
      _id: { $in: studentIds }
    }).select("name email age _id"); // Select the fields you requested

    // 7. Return the list of students
    return sendResponse(res, 200, true, "Students retrieved successfully.", students);

  } catch (err) {
    console.error("listMyStudents err", err);
    return sendResponse(res, 500, false, "Server error retrieving students.");
  }
};