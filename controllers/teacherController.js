import Teacher from "../models/Teacher.js";
import { sendResponse } from "../middleware/auth.js";
import BatchStatus from "../models/BatchStatus.js";
import Batch from "../models/Batch.js";
import BatchSession from "../models/BatchSession.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";

/**
 * ---------------------------------------------------
 * 1. ADMIN: List All Teachers
 * ---------------------------------------------------
 */
export const listAllTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({})
      .select("name email mobile")
      .lean();

    return sendResponse(
      res,
      200,
      true,
      "Teachers retrieved successfully.",
      teachers
    );
  } catch (err) {
    console.error("listAllTeachers err", err);
    return sendResponse(res, 500, false, "Server error retrieving teachers.");
  }
};

/**
 * ---------------------------------------------------
 * 2. TEACHER: Get Live Batch Info
 * GET /api/teacher/getlivebatchinfo?details=minor|major
 * ---------------------------------------------------
 */
export const getLiveBatchInfoTeacher = async (req, res) => {
  try {
    const { details } = req.query;

    if (!details || !["minor", "major"].includes(details)) {
      return sendResponse(
        res,
        400,
        false,
        "Query param 'details' must be 'minor' or 'major'."
      );
    }

    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();

    if (!liveStatuses.length) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    // ---------------- MINOR ----------------
    if (details === "minor") {
      const minorData = liveStatuses.map((s) => ({
        batch_obj_id: s.batch_obj_id , 
        batch_name : s.batchName
      }));

      return sendResponse(
        res,
        200,
        true,
        "Live batches (minor) retrieved.",
        minorData
      );
    }

    // ---------------- MAJOR ----------------
    const batchObjIds = liveStatuses.map((s) => s.batch_obj_id);

    const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();

    const majorData = batches.map((b) => ({
      batch_obj_id: b._id,
      batchName: b.batchName,
      batchType: b.batchType,
      level: b.level,
      startDate: b.startDate,
      description: b.description,
      classLocation:
        b.batchType === "OFFLINE" ? b.classLocation : undefined,
      cityCode: b.batchType === "OFFLINE" ? b.cityCode : undefined,
      status: "LIVE"
    }));

    return sendResponse(
      res,
      200,
      true,
      "Live batches (major) retrieved.",
      majorData
    );

  } catch (err) {
    console.error("getLiveBatchInfoTeacher err", err);
    return sendResponse(res, 500, false, "Server error retrieving live batch info.");
  }
};

/**
 * ---------------------------------------------------
 * 3. TEACHER: Get Today's Schedule
 * GET /api/teacher/todayslivebatchinfo
 * ---------------------------------------------------
 */
export const getTodaysLiveBatchesForTeacher = async (req, res) => {
  try {
    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();
    if (!liveStatuses.length) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    const batchObjIds = liveStatuses.map((s) => s.batch_obj_id);
    const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const processedBatches = await Promise.all(
      batches.map(async (batch) => {
        const todaysSession = await BatchSession.findOne({
          batch_obj_id: batch._id,
          date: { $gte: todayStart, $lte: todayEnd }
        }).lean();

        let hasClassToday = false;
        let timing = "No class today";
        let mode = batch.batchType;
        let connectionInfo = null;

        if (todaysSession) {
          hasClassToday = true;
          timing = `${todaysSession.startTime} - ${todaysSession.endTime}`;
          mode = todaysSession.sessionType || batch.batchType;

          if (mode === "ONLINE") {
            connectionInfo =
              todaysSession.meetingLinkOrLocation || "Link not available";
          } else {
            connectionInfo =
              todaysSession.meetingLinkOrLocation ||
              batch.classLocation ||
              "Location not assigned";
          }
        }

        const nextSession = await BatchSession.findOne({
          batch_obj_id: batch._id,
          date: { $gt: todayEnd }
        })
          .sort({ date: 1 })
          .select("date")
          .lean();

        return {
          batch_obj_id: batch._id,
          batchName: batch.batchName,
          hasClassToday,
          timing,
          nextClassDate: nextSession
            ? new Date(nextSession.date).toDateString()
            : "Not scheduled",
          mode,
          connectionInfo
        };
      })
    );

    return sendResponse(
      res,
      200,
      true,
      "Today's live batch info retrieved.",
      processedBatches
    );

  } catch (err) {
    console.error("getTodaysLiveBatchesForTeacher err", err);
    return sendResponse(res, 500, false, "Server error retrieving batch info.");
  }
};

/**
 * ---------------------------------------------------
 * 4. TEACHER: Get Batch & Session Details
 * GET /api/teacher/batch-sessions?batch_obj_id=...
 * ---------------------------------------------------
 */
export const getBatchAndSessionDetailsForTeacher = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;

    if (!batch_obj_id) {
      return sendResponse(
        res,
        400,
        false,
        "batch_obj_id is required in the query."
      );
    }

    // ---------------- Batch ----------------
    const batch = await Batch.findById(batch_obj_id).lean();
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // ---------------- Sessions ----------------
    const sessions = await BatchSession.find({ batch_obj_id })
      .sort({ date: 1 })
      .lean();

    // ---------------- Students ----------------
    const relations = await BatchStudentRelation.find({ batch_obj_id })
      .select("student_obj_id joinedAt")
      .lean();

    const studentIds = relations.map((r) => r.student_obj_id);

    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name email student_number mobile")
      .lean();

    const formattedStudents = students.map((student) => {
      const rel = relations.find(
        (r) => r.student_obj_id.toString() === student._id.toString()
      );
      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        student_number: student.student_number,
        mobile: student.mobile,
        joinedAt: rel ? rel.joinedAt : null
      };
    });

    // ---------------- Response ----------------
    return sendResponse(res, 200, true, "Batch details fetched successfully.", {
      batch_obj_id: batch._id,
      batchName: batch.batchName,
      batchType: batch.batchType,
      startDate: batch.startDate,
      level: batch.level,
      description: batch.description,
      classLocation:
        batch.batchType === "OFFLINE" ? batch.classLocation : undefined,
      cityCode:
        batch.batchType === "OFFLINE" ? batch.cityCode : undefined,
      sessions,
      students: formattedStudents
    });

  } catch (err) {
    console.error("getBatchAndSessionDetailsForTeacher error:", err);
    return sendResponse(res, 500, false, "Server error fetching batch details.");
  }
};
