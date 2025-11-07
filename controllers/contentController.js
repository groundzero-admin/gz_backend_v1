import Course from "../models/Course.js";
import CourseContent from "../models/CourseContent.js";
import { sendResponse } from "../middleware/auth.js";

export const createCourseContent = async (req, res) => {
  try {
    const { courseId, title, description, isReadingMaterial, offset, actualContent } = req.body;
    if (!courseId || offset === undefined || !title)
      return sendResponse(res, 400, false, "courseId, offset, title required");

    const course = await Course.findById(courseId);
    if (!course) return sendResponse(res, 404, false, "Invalid courseId");

    const existingOffset = await CourseContent.findOne({ courseId, offset });
    if (existingOffset) return sendResponse(res, 409, false, "Offset already exists for this course");

    const content = await CourseContent.create({ courseId, title, description, isReadingMaterial, offset, actualContent });
    sendResponse(res, 201, true, "Course content added", { contentId: content._id });
  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
};