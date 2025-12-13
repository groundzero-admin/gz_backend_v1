import Attendance from "../models/Attendance.js"; // Adjust path if needed
import { sendResponse } from "../middleware/auth.js";
import StudentCredit from "../models/StudentCredit.js";
import BatchSession from "../models/BatchSession.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";




/**
 * Controller: markAttendance
 * Input: { student_obj_id, session_obj_id, status }
 * Behavior: Creates entry if new, Updates if exists (Upsert)
 */
export const markAttendance = async (req, res) => {
  try {
    const { student_obj_id, session_obj_id, status } = req.body;

    // 1. Basic Validation
    if (!student_obj_id || !session_obj_id || !status) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }
    if (!["PRESENT", "ABSENT"].includes(status)) {
      return sendResponse(res, 400, false, "Status must be 'PRESENT' or 'ABSENT'.");
    }

    // 2. Fetch Session to determine Cost
    const session = await BatchSession.findById(session_obj_id);
    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    let amountToChange = 0;
    if (session.sessionType === 'ONLINE') amountToChange = 1000;
    else if (session.sessionType === 'OFFLINE') amountToChange = 1500;

    // 3. Fetch Existing Attendance Record
    const existingRecord = await Attendance.findOne({ 
      student_obj_id, 
      session_obj_id 
    });

    const studentCredit = await StudentCredit.findOne({ student_obj_id });
    let warningMsg = null;
    let action = "NONE"; // NONE, DEDUCT, REFUND

    // --- 4. DETERMINE ACTION ---
    
    if (!existingRecord) {
      // CASE A: First time marking
      if (status === "PRESENT") action = "DEDUCT";
    } else {
      // CASE B: Correction / Update
      if (existingRecord.status === "ABSENT" && status === "PRESENT") {
        action = "DEDUCT"; // Was absent, now marked present -> Charge them
      } else if (existingRecord.status === "PRESENT" && status === "ABSENT") {
        action = "REFUND"; // Mistakenly marked present, now absent -> Give money back
      }
    }

    // --- 5. EXECUTE FINANCIAL TRANSACTION ---
    if (action !== "NONE") {
      if (!studentCredit) {
        warningMsg = "Student has no credit wallet.";
      } else {
        if (action === "DEDUCT") {
          // Check balance before deducting
          if (studentCredit.amount < amountToChange) {
            studentCredit.amount = 0; // "Fishy" logic: Clamp to 0
            warningMsg = "Student seems to be fishy (Insufficient Balance). Credits set to 0.";
          } else {
            studentCredit.amount -= amountToChange;
          }
        } else if (action === "REFUND") {
          // Simply add the amount back
          studentCredit.amount += amountToChange;
        }
        await studentCredit.save();
      }
    }

    // 6. Update Attendance Record (Upsert)
    const updatedRecord = await Attendance.findOneAndUpdate(
      { student_obj_id, session_obj_id },
      { $set: { status: status, markedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 7. Response
    let message = "Attendance updated successfully.";
    if (action === "DEDUCT") message += " Credits deducted.";
    if (action === "REFUND") message += " Credits refunded.";
    if (warningMsg) message += ` WARNING: ${warningMsg}`;

    return sendResponse(res, 200, true, message, updatedRecord);

  } catch (err) {
    console.error("markAttendance error:", err);
    return sendResponse(res, 500, false, "Server error marking attendance.");
  }
};




/**
 * Controller: attendanceStatusPerSession
 * Input: { session_obj_id }
 * Output: List of all students in that batch with their attendance status for that session
 */
export const attendanceStatusPerSession = async (req, res) => {
  try {
    const { session_obj_id } = req.body;

    if (!session_obj_id) {
      return sendResponse(res, 400, false, "session_obj_id is required.");
    }

    // 1. Find the Session to get the Batch ID
    const session = await BatchSession.findById(session_obj_id).select("batch_obj_id");
    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    // 2. Get all students enrolled in this Batch
    const relations = await BatchStudentRelation.find({ 
      batch_obj_id: session.batch_obj_id 
    }).select("student_obj_id");

    if (!relations.length) {
      return sendResponse(res, 200, true, "No students enrolled in this batch.", []);
    }

    const studentIds = relations.map(r => r.student_obj_id);

    // 3. Fetch Student details (Name, Roll No, etc.)
    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name email student_number")
      .lean();

    // 4. Fetch existing Attendance records for this specific session
    const attendanceRecords = await Attendance.find({ 
      session_obj_id: session_obj_id 
    }).lean();

    // Create a map for quick lookup: { studentId: "PRESENT" | "ABSENT" }
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.student_obj_id.toString()] = record.status;
    });

    // 5. Merge Data
    const result = students.map(student => {
      const dbStatus = attendanceMap[student._id.toString()];
      
      return {
        session_obj_id: session_obj_id,
        student_obj_id: student._id,
        name: student.name,
        student_number: student.student_number,
        
        // LOGIC: If entry exists, use it. If not, default to "ABSENT".
        status: dbStatus ? dbStatus : "UNMARKED" 
      };
    });

    return sendResponse(res, 200, true, "Attendance status retrieved.", result);

  } catch (err) {
    console.error("attendanceStatusPerSession error:", err);
    return sendResponse(res, 500, false, "Server error fetching attendance status.");
  }
};

















/**
 * Controller: attendanceStatusPerStudent
 * Input: { student_obj_id }
 * Output: History of all attendance records for this student with Batch & Session context.
 */
export const attendanceStatusPerStudent = async (req, res) => {
  try {
    const { student_obj_id } = req.body;

    if (!student_obj_id) {
      return sendResponse(res, 400, false, "student_obj_id is required.");
    }

    // 1. Verify Student Exists (Optional, but good for error clarity)
    const student = await Student.findById(student_obj_id).select("name student_number");
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    // 2. Find Attendance Records & Deep Populate
    // Path: Attendance -> Session -> Batch
    const records = await Attendance.find({ student_obj_id: student_obj_id })
      .populate({
        path: "session_obj_id", // 1. Go to Session
        select: "batch_obj_id session_number title date startTime", 
        populate: {
          path: "batch_obj_id", // 2. Go from Session to Batch
          select: "batchId cohort level"
        }
      })
      .sort({ markedAt: -1 }) // Show most recently marked first
      .lean();

    if (!records.length) {
      return sendResponse(res, 200, true, "No attendance records found for this student.", []);
    }

    // 3. Format the Data
    const formattedHistory = records.map(record => {
      const session = record.session_obj_id;
      // Handle cases where session/batch might have been deleted
      const batch = session ? session.batch_obj_id : null;

      return {
        _id: record._id, // Attendance Record ID
        status: record.status, // "PRESENT" or "ABSENT"
        markedAt: record.markedAt,
        
        // Session Info
        session_obj_id: session ? session._id : "N/A",
        session_number: session ? session.session_number : "N/A",
        session_date: session ? new Date(session.date).toDateString() : "N/A",
        session_title: session ? session.title : "N/A",

        // Batch Info
        batchId: batch ? batch.batchId : "Unknown Batch",
        batch_obj_id: batch ? batch._id : null,
        batchName: batch ? `${batch.cohort} (${batch.level})` : "N/A"
      };
    });

    return sendResponse(res, 200, true, "Student attendance history retrieved.", {
      student: {
        name: student.name,
        student_number: student.student_number
      },
      history: formattedHistory
    });

  } catch (err) {
    console.error("attendanceStatusPerStudent error:", err);
    return sendResponse(res, 500, false, "Server error fetching student attendance.");
  }
};