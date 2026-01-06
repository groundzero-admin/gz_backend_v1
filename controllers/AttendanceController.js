import Attendance from "../models/Attendance.js";
import { sendResponse } from "../middleware/auth.js";
import StudentCredit from "../models/StudentCredit.js";
import BatchSession from "../models/BatchSession.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";

/**
 * ---------------------------------------------------
 * MARK ATTENDANCE (UPSERT)
 * Input: { student_obj_id, session_obj_id, status }
 * ---------------------------------------------------
 */

export const markAttendance = async (req, res) => {
  try {
    const { student_obj_id, session_obj_id, status } = req.body;

    // 1. Validation
    if (!student_obj_id || !session_obj_id || !status) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }
    if (!["PRESENT", "ABSENT"].includes(status)) {
      return sendResponse(res, 400, false, "Invalid status.");
    }

    // 2. Fetch Session (To know if it's ONLINE or OFFLINE)
    const session = await BatchSession.findById(session_obj_id);
    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    const isOnline = session.sessionType === "ONLINE";
    const cost = isOnline ? 1500 : 1500;

    // 3. Determine Action (Deduct vs Refund)
    const existing = await Attendance.findOne({ student_obj_id, session_obj_id });
    let action = "NONE"; 

    if (!existing) {
      if (status === "PRESENT") action = "DEDUCT";
    } else {
      if (existing.status === "ABSENT" && status === "PRESENT") action = "DEDUCT";
      else if (existing.status === "PRESENT" && status === "ABSENT") action = "REFUND";
    }

    // 4. Financial Logic (Split Wallet)
    let warning = null;
    const wallet = await StudentCredit.findOne({ student_obj_id });

    if (action !== "NONE") {
      if (!wallet) {
        warning = "No credit wallet found.";
      } else {
        // --- DEDUCT LOGIC ---
        if (action === "DEDUCT") {
          if (isOnline) {
            // Check Online Balance
            if (wallet.amount_for_online < cost) {
              wallet.amount_for_online = 0;
              warning = "Insufficient ONLINE balance. Reset to 0.";
            } else {
              wallet.amount_for_online -= cost;
            }
          } else {
            // Check Offline Balance
            if (wallet.amount_for_offline < cost) {
              wallet.amount_for_offline = 0;
              warning = "Insufficient OFFLINE balance. Reset to 0.";
            } else {
              wallet.amount_for_offline -= cost;
            }
          }
        } 
        
        // --- REFUND LOGIC ---
        else if (action === "REFUND") {
          if (isOnline) {
            wallet.amount_for_online += cost;
          } else {
            wallet.amount_for_offline += cost;
          }
        }

        await wallet.save();
      }
    }

    // 5. Update Attendance
    const record = await Attendance.findOneAndUpdate(
      { student_obj_id, session_obj_id },
      { status, markedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 6. Response
    let message = `Attendance updated to ${status}.`;
    if (action !== "NONE") message += ` (${action}ED ${cost})`;
    if (warning) message += ` WARNING: ${warning}`;

    return sendResponse(res, 200, true, message, record);

  } catch (err) {
    console.error("markAttendance error:", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};



/**
 * ---------------------------------------------------
 * ATTENDANCE STATUS PER SESSION
 * Input: { session_obj_id }
 * ---------------------------------------------------
 */
export const attendanceStatusPerSession = async (req, res) => {
  try {
    const { session_obj_id } = req.body;

    if (!session_obj_id) {
      return sendResponse(res, 400, false, "session_obj_id required.");
    }

    const session = await BatchSession.findById(session_obj_id).select("batch_obj_id");
    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    const relations = await BatchStudentRelation.find({
      batch_obj_id: session.batch_obj_id
    }).select("student_obj_id");

    const studentIds = relations.map(r => r.student_obj_id);

    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name student_number")
      .lean();

    const attendance = await Attendance.find({ session_obj_id }).lean();
    const map = {};

    attendance.forEach(a => {
      map[a.student_obj_id.toString()] = a.status;
    });

    const result = students.map(s => ({
      session_obj_id,
      student_obj_id: s._id,
      name: s.name,
      student_number: s.student_number,
      status: map[s._id.toString()] || "UNMARKED"
    }));

    return sendResponse(res, 200, true, "Attendance retrieved.", result);

  } catch (err) {
    console.error("attendanceStatusPerSession error:", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};

/**
 * ---------------------------------------------------
 * ATTENDANCE STATUS PER STUDENT
 * Input: { student_obj_id }
 * ---------------------------------------------------
 */
export const attendanceStatusPerStudent = async (req, res) => {
  try {
    const { student_obj_id } = req.body;

    if (!student_obj_id) {
      return sendResponse(res, 400, false, "student_obj_id required.");
    }

    const student = await Student.findById(student_obj_id)
      .select("name student_number")
      .lean();

    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    const records = await Attendance.find({ student_obj_id })
      .populate({
        path: "session_obj_id",
        select: "session_number title date startTime batch_obj_id",
        populate: {
          path: "batch_obj_id",
          select: "batchName batchType"
        }
      })
      .sort({ markedAt: -1 })
      .lean();

    const history = records.map(r => {
      const session = r.session_obj_id;
      const batch = session?.batch_obj_id;

      return {
        attendance_id: r._id,
        status: r.status,
        markedAt: r.markedAt,

        session_obj_id: session?._id,
        session_number: session?.session_number,
        session_title: session?.title,
        session_date: session?.date,

        batch_obj_id: batch?._id,
        batchName: batch?.batchName,
        batchType: batch?.batchType
      };
    });

    return sendResponse(res, 200, true, "Attendance history retrieved.", {
      student,
      history
    });

  } catch (err) {
    console.error("attendanceStatusPerStudent error:", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};
