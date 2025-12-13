import { sendResponse  } from "../middleware/auth.js";
import Student from "../models/Student.js"; 







// export const getAllStudentDetails = async (req, res) => {
//   try {
//     // Find all students and select only the required fields
//     const students = await Student.find({})
//       .select("name email class _id student_number")
//       .lean(); // Use .lean() for faster, plain JS objects

//     // Rename 'name' to 'username' in the response
//     const formattedStudents = students.map(student => ({
//       _id: student._id,
//       username: student.name, // Rename 'name' to 'username'
//       email: student.email,
//       class: student.class,
//       student_number : student.student_number
//     }));

//     return sendResponse(res, 200, true, "Students retrieved successfully.", formattedStudents);

//   } catch (err) {
//     console.error("getAllStudentDetails err", err);
//     return sendResponse(res, 500, false, "Server error retrieving students.");
//   }
// };












// import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import StudentCredit from "../models/StudentCredit.js";
// import sendResponse from "../utils/sendResponse.js";


export const getAllStudentDetails = async (req, res) => {
  try {
    // Fetch all students
    const students = await Student.find({})
      .select("name email class _id student_number")
      .lean();

    const formattedStudents = [];

    for (const student of students) {
      
      // ================================
      // FETCH STUDENT CREDIT DETAILS
      // ================================
      const creditTransactions = await StudentCredit.find({
        studentEmail: student.email,
        student_obj_id: student._id
      })
        .select("amount currency source createdAt -_id")
        .lean();

      const totalCredit = creditTransactions.reduce(
        (sum, tx) => sum + (tx.amount || 0),
        0
      );

      // ================================
      // BUILD FINAL RESPONSE OBJECT
      // ================================
      formattedStudents.push({
        _id: student._id,
        username: student.name,
        email: student.email,
        class: student.class,
        student_number: student.student_number,

        credit: {
          total: totalCredit,
         
        }
      });
    }

    return sendResponse(res, 200, true, "Students retrieved successfully.", formattedStudents);

  } catch (err) {
    console.error("getAllStudentDetails err", err);
    return sendResponse(res, 500, false, "Server error retrieving students.");
  }
};
