// controllers/courseController.js
import Course from "../models/Course.js"; // Make sure this path is correct
import Teacher from "../models/Teacher.js";
import CourseTeacherRelation from "../models/CourseTeacherRelation.js";
import { sendResponse } from "../middleware/auth.js";
import Enrollment from "../models/Enrollment.js";
import Student from "../models/Student.js";
/**
 * POST /api/admin/createcourse
 * Admin-only.
 * Creates a new course and links optional teacher emails.
 */


// export const createCourse = async (req, res) => {
//   try {
//     // 1. Get data from body. Use 'courseClass' to avoid JS keyword 'class'.
//     const { title, description, class: courseClass, teacherEmails = [] } = req.body;

//     // 2. Validate required fields
//     if (!title || !description || courseClass === undefined) {
//       return sendResponse(res, 400, false, "title, description, and class are required.");
//     }

//     if (isNaN(Number(courseClass))) {
//       return sendResponse(res, 400, false, "class must be a number.");
//     }

//     // 3. Create and save the new course
//     const newCourse = new Course({
//       title,
//       description,
//       class: Number(courseClass)
//     });
//     await newCourse.save();

//     const linkResults = [];

//     // 4. If teacherEmails are provided, find and link them
//     if (Array.isArray(teacherEmails) && teacherEmails.length > 0) {
//       for (const email of teacherEmails) {
//         const emailClean = String(email).toLowerCase().trim();
        
//         // Find the teacher by email to get their ID
//         const teacher = await Teacher.findOne({ email: emailClean }).select("_id");

//         if (teacher) {
//           // 5. If teacher exists, try to create the relation
//           try {
//             await CourseTeacherRelation.create({
//               courseId: newCourse._id,
//               teacherId: teacher._id
//             });
//             linkResults.push({ email, status: "Linked" });
//           } catch (e) {
//             // This catches the 'unique: true' error (code 11000)
//             if (e.code === 11000) {
//               linkResults.push({ email, status: "Relation already exists" });
//             } else {
//               linkResults.push({ email, status: `Error: ${e.message}` });
//             }
//           }
//         } else {
//           linkResults.push({ email, status: "Teacher not found" });
//         }
//       }
//     }

//     // 6. Send the final success response
//     return sendResponse(res, 201, true, "Course created successfully.", {
//       courseId: newCourse._id,
//       title: newCourse.title,
//       description: newCourse.description,
//       class: newCourse.class,
//       teacherLinks: linkResults // Send a report of what happened
//     });

//   } catch (err) {
//     console.error("createCourse err", err);
//     return sendResponse(res, 500, false, "Server error creating course.");
//   }
// };










// export const listAllCourses = async (req, res) => {
//   try {
//     // Find all courses and select only the fields you want
//     const courses = await Course.find({}).select("title description class");

//     return sendResponse(res, 200, true, "Courses retrieved successfully.", courses);

//   } catch (err) {
//     console.error("listAllCourses err", err);
//     return sendResponse(res, 500, false, "Server error retrieving courses.");
//   }
// };








// export const listStudentsCourses = async (req, res) => {
//   try {
//     // 1. Get the student's ID from the auth token
//     const studentId = req.authPayload.id;
//     console.log("aaa")
//     // 2. Find the student to get their class
//     const student = await Student.findById(studentId).select("class");
//     if (!student) {
//       return sendResponse(res, 404, false, "Student not found.");
//     }
    
//     const studentClass = student.class;

//     // 3. Find all courses for that student's class
//     const coursesForClass = await Course.find({ class: studentClass }).lean(); // .lean() for faster, plain JS objects

//     // 4. Find all of this student's enrollments
//     const studentEnrollments = await Enrollment.find({ studentId: studentId }).lean();
    
//     // 5. Create a Set of enrolled course IDs for a fast O(1) lookup
//     const enrolledCourseIds = new Set(
//       studentEnrollments.map(e => e.courseId.toString())
//     );

//     // 6. Combine the data
//     const finalCourseList = coursesForClass.map(course => {
//       // Check if the course's ID is in the Set of enrolled IDs
//       const isEnrolled = enrolledCourseIds.has(course._id.toString());
      
//       return {
//         courseId: course._id, // Renamed from _id
//         title: course.title,
//         description: course.description,
//         class: course.class,
//         isEnrolled: isEnrolled // Add the new field
//       };
//     });

//     // 7. Send the final list
//     return sendResponse(res, 200, true, "Courses retrieved successfully.", finalCourseList);

//   } catch (err) {
//     console.error("listMyCourses err", err);
//     return sendResponse(res, 500, false, "Server error retrieving courses.");
//   }
// };












// export const listTeachersCourses = async (req, res) => {
//   try {
//     // 1. Get the teacher's ID from the auth token
//     const teacherId = req.authPayload.id;

//     // 2. Find all relation entries for this teacher
//     const relations = await CourseTeacherRelation.find({ 
//       teacherId: teacherId 
//     }).lean();

//     if (!relations || relations.length === 0) {
//       // This teacher is not linked to any courses
//       return sendResponse(res, 200, true, "No assigned courses found.", []);
//     }

//     // 3. Extract all the course IDs from the relations
//     const courseIds = relations.map(rel => rel.courseId);

//     // 4. Find all course documents that match those IDs
//     const courses = await Course.find({
//       _id: { $in: courseIds }
//     }).select("title description class").lean(); // Get lean objects

//     // 5. Format the final list
//     const finalCourseList = courses.map(course => ({
//       courseId: course._id,
//       title: course.title,
//       description: course.description,
//       class: course.class
//     }));

//     // 6. Return the list of courses
//     return sendResponse(res, 200, true, "Courses retrieved successfully.", finalCourseList);

//   } catch (err) {
//     console.error("listMyTaughtCourses err", err);
//     return sendResponse(res, 500, false, "Server error retrieving courses.");
//   }
// };