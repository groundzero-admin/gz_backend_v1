import Course from "../models/Course.js";
import Teacher from "../models/Teacher.js";
import CourseTeacherRelation from "../models/CourseTeacherRelation.js";
import { sendResponse } from "../middleware/auth.js";

export const createCourse = async (req, res) => {
  try {
    const { name, title, description, forWhichClass, teacherEmails = [] } = req.body;
    if (!name || !title || forWhichClass === undefined || forWhichClass === null) return sendResponse(res, 400, false, "Missing required fields: name, title, forWhichClass");

    if (isNaN(Number(forWhichClass))) return sendResponse(res, 400, false, "forWhichClass must be a number");

    const course = new Course({ name, title, description, forWhichClass: Number(forWhichClass) });
    await course.save();

    // link teachers
    const teacherEmailsArr = Array.isArray(teacherEmails) ? teacherEmails.map(e => String(e).toLowerCase().trim()) : [];
    const teacherDocs = [];
    for (const te of teacherEmailsArr) {
      const tdoc = await Teacher.findOne({ email: te });
      if (tdoc) teacherDocs.push(tdoc);
    }
    // create relations
    for (const tdoc of teacherDocs) {
      try {
        await CourseTeacherRelation.create({ courseId: course._id, teacherId: tdoc._id });
      } catch (e) {
        // ignore duplicate key errors
      }
    }

    return sendResponse(res, 201, true, "Course created", { courseId: course._id });
  } catch (err) {
    console.error("createcourse err", err);
    return sendResponse(res, 500, false, "Server error creating course");
  }
};