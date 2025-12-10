import Teacher from "../models/Teacher.js";
import { sendResponse } from "../middleware/auth.js";
import BatchStatus from "../models/BatchStatus.js";
import Batch from "../models/Batch.js";
import BatchSession from "../models/BatchSession.js"; // Correct Model Name
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";

/**
 * ---------------------------------------------------
 * 1. ADMIN: List All Teachers
 * ---------------------------------------------------
 */
export const listAllTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({}).select("name email mobile");
    return sendResponse(res, 200, true, "Teachers retrieved successfully.", teachers);
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

    if (!details || (details !== 'minor' && details !== 'major')) {
      return sendResponse(res, 400, false, "Query param 'details' must be 'minor' or 'major'.");
    }

    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();

    if (!liveStatuses || liveStatuses.length === 0) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    // --- CASE 1: MINOR DETAILS ---
    if (details === 'minor') {
      const minorData = liveStatuses.map(status => ({
        _id: status.batch_obj_id,
        batchId: status.batchId
      }));
      return sendResponse(res, 200, true, "Live batches (minor) retrieved.", minorData);
    }

    // --- CASE 2: MAJOR DETAILS ---
    if (details === 'major') {
      const batchObjIds = liveStatuses.map(s => s.batch_obj_id);
      
      // Fetch specific fields from Batch model
      const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();
      
      const majorData = batches.map(b => ({
        ...b,
        status: "LIVE" // Explicitly adding status for frontend convenience
      }));
      return sendResponse(res, 200, true, "Live batches (major) retrieved.", majorData);
    }

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
    // 1. Find all batches marked as "LIVE"
    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();

    if (!liveStatuses || liveStatuses.length === 0) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    const batchObjIds = liveStatuses.map(s => s.batch_obj_id);

    // 2. Fetch Batch details (we need classLocation and batchType for fallbacks)
    const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();

    // 3. Process each batch
    const processedBatches = await Promise.all(batches.map(async (batch) => {
      
      // Define Today's Time Range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // --- A. Check for Class TODAY ---
      const todaysSession = await BatchSession.findOne({
        batch_obj_id: batch._id,
        date: { $gte: todayStart, $lte: todayEnd }
      }).lean();

      let hasClassToday = false;
      let timing = "No class today";
      
      // Default to Batch settings
      let currentMode = batch.batchType; // "ONLINE" or "OFFLINE"
      let connectionInfo = null;

      if (todaysSession) {
        hasClassToday = true;
        timing = `${todaysSession.startTime} - ${todaysSession.endTime}`;
        
        // Use Session specific type if available, else fallback to batch
        currentMode = todaysSession.sessionType || batch.batchType;

        // --- Logic: Link vs Location ---
        if (currentMode === 'ONLINE') {
          // If Online, get the link from the session
          connectionInfo = todaysSession.meetingLinkOrLocation || "Link not available";
        } else {
          // If Offline, try session specific location, otherwise Batch default location
          connectionInfo = todaysSession.meetingLinkOrLocation || batch.classLocation || "Location not assigned";
        }
      }

      // --- B. Find Next Class Date ---
      const nextSession = await BatchSession.findOne({
        batch_obj_id: batch._id,
        date: { $gt: todayEnd }
      })
      .sort({ date: 1 })
      .select("date")
      .lean();

      const nextClassDate = nextSession 
        ? new Date(nextSession.date).toDateString() 
        : "Not scheduled";

      return {
        batchId: batch.batchId,
        hasClassToday: hasClassToday,
        timing: timing,
        nextClassDate: nextClassDate,
        mode: currentMode,
        connectionInfo: connectionInfo
      };
    }));

    return sendResponse(res, 200, true, "Today's live batch info retrieved.", processedBatches);

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
 */export const getBatchAndSessionDetailsForTeacher = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id is required in the query.");
    }

    // --- 1. Fetch Batch Metadata ---
    // Added 'startDate', 'batchType', 'classLocation', 'meetingLink' etc.
    const batch = await Batch.findById(batch_obj_id)
      .select("batchId batchType startDate classLocation description cohort level cityCode")
      .lean();

    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // --- 2. Fetch All Sessions (Sorted by Date) ---
    const sessions = await BatchSession.find({ batch_obj_id: batch._id })
      .sort({ date: 1 }) // Chronological order
      .lean();

    // --- 3. Fetch Enrolled Students ---
    const relations = await BatchStudentRelation.find({ batch_obj_id: batch._id })
      .select("student_obj_id joinedAt")
      .lean();

    const studentIds = relations.map(r => r.student_obj_id);
    
    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name email student_number mobile")
      .lean();

    // Combine student details with their join date
    const formattedStudents = students.map(student => {
      const rel = relations.find(r => r.student_obj_id.toString() === student._id.toString());
      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        student_number: student.student_number,
        mobile: student.mobile,
        joinedAt: rel ? rel.joinedAt : null
      };
    });

    // --- 4. Construct Final Response ---
    const responseData = {
      // --- Batch Metadata ---
      _id: batch._id,
      batchId: batch.batchId,
      batchType: batch.batchType, // "ONLINE" or "OFFLINE"
      startDate: batch.startDate,
      classLocation: batch.classLocation || "N/A", // Only relevant if OFFLINE
      cohort: batch.cohort,
      level: batch.level,
      description: batch.description,

      // --- Arrays ---
      sessions: sessions, 
      students: formattedStudents
    };

    return sendResponse(res, 200, true, "Batch details fetched successfully.", responseData);

  } catch (err) {
    console.error("getBatchAndSessionDetailsForTeacher error:", err);
    return sendResponse(res, 500, false, "Server error fetching batch details.");
  }
};