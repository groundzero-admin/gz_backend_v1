
import Teacher from "../models/Teacher.js"; // <-- 1. IMPORT THE TEACHER MODEL
import { sendResponse } from "../middleware/auth.js";

import BatchStatus from "../models/BatchStatus.js";
import Batch from "../models/Batch.js";

import BatchWeek from "../models/BatchWeek.js";


import BatchStudentRelation from "../models/BatchStudentRelation.js"; // <-- Import Relation
import Student from "../models/Student.js";







/////////////////////////////////////////////////////////////////   for admin 
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



















/**
 * ---------------------------------------------------
 * NEW FUNCTION: Get Live Batch Info (Teacher)
 * GET /api/teacher/getlivebatchinfo?details=minor|major
 * Fetches ALL live batches (Teachers have global access)
 * ---------------------------------------------------
 */


/**
 minor query resp 
 {
  "success": true,
  "message": "Live batches (minor) retrieved.",
  "data": [
    {
      "_id": "651a2b3c4d5e6f7g8h9i0j1k", 
      "batchId": "SPA001"
    },
    {
      "_id": "651a2b3c4d5e6f7g8h9i0j2l", 
      "batchId": "BZB005"
    }
  ]
}


major q resp 
{
  "success": true,
  "message": "Live batches (major) retrieved.",
  "data": [
    {
      "_id": "651a2b3c4d5e6f7g8h9i0j1k",
      "batchId": "SPA001",
      "cohort": "spark",
      "level": "alpha",
      "classLocation": "Room 304, Main Building",
      "cityCode": "110022",
      "startDate": "2023-11-20T00:00:00.000Z",
      "type": "S",
      "description": "Morning batch for beginners.",
      "createdAt": "2023-11-10T10:00:00.000Z",
      "status": "LIVE"
    },
    {
      "_id": "651a2b3c4d5e6f7g8h9i0j2l",
      "batchId": "BZB005",
      "cohort": "blaze",
      "level": "beta",
      "classLocation": "Lab 2",
      "cityCode": "440010",
      "startDate": "2023-12-04T00:00:00.000Z",
      "type": "C",
      "description": "Advanced physics group.",
      "createdAt": "2023-11-15T14:30:00.000Z",
      "status": "LIVE"
    }
  ]
}


 */
export const getLiveBatchInfoTeacher = async (req, res) => {
  try {
    const { details } = req.query;

    if (!details || (details !== 'minor' && details !== 'major')) {
      return sendResponse(res, 400, false, "Query param 'details' must be 'minor' or 'major'.");
    }

    // 1. Find all batches marked as "LIVE" in the status table
    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();

    if (!liveStatuses || liveStatuses.length === 0) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    // --- CASE 1: MINOR DETAILS ---
    // Just return Object ID and String ID.
    // We can get this directly from BatchStatus without querying the Batch table.
    if (details === 'minor') {
      const minorData = liveStatuses.map(status => ({
        _id: status.batch_obj_id, // The Batch Object ID
        batchId: status.batchId    // The String ID (e.g., SPA001)
      }));
      
      return sendResponse(res, 200, true, "Live batches (minor) retrieved.", minorData);
    }

    // --- CASE 2: MAJOR DETAILS ---
    // Return full batch info (Location, Cohort, etc.)
    if (details === 'major') {
      const batchObjIds = liveStatuses.map(s => s.batch_obj_id);

      // Query the main Batch table
      const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();

      // (Optional) We can attach the status "LIVE" explicitly if needed, 
      // but the frontend knows they are live because of the API call.
      const majorData = batches.map(b => ({
        ...b,
        status: "LIVE" // Explicitly stating it's live
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
 * NEW FUNCTION: Get Today's Schedule for ALL Live Batches (Teacher)
 * GET /api/teacher/todayslivebatchinfo
 * ---------------------------------------------------
 


   {
  "success": true,
  "message": "Today's live batch info retrieved.",
  "data": [
    {
      "batchId": "SPA001",
      "classLocation": "Room 304",
      "weekNumber": 5,
      "hasClassToday": true,
      "timing": "6:30 am - 8:30 am",
      "nextClassDate": "Wed Nov 22 2025"
    },
    {
      "batchId": "IGB002",
      "classLocation": "Lab 1",
      "weekNumber": 2,
      "hasClassToday": false,
      "timing": "No class today",
      "nextClassDate": "Tue Nov 21 2025"
    }
  ]
}


 */
export const getTodaysLiveBatchesForTeacher = async (req, res) => {
  try {
    // 1. Find all batches marked as "LIVE"
    const liveStatuses = await BatchStatus.find({ status: "LIVE" }).lean();

    if (!liveStatuses || liveStatuses.length === 0) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    const batchObjIds = liveStatuses.map(s => s.batch_obj_id);

    // 2. Fetch full batch details
    const batches = await Batch.find({ _id: { $in: batchObjIds } }).lean();

    // 3. Process each batch (Calculate dates, weeks, and next class)
    // We use Promise.all to run these calculations in parallel for speed
    const processedBatches = await Promise.all(batches.map(async (batch) => {
      
      // --- A. Date Math Setup ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(batch.startDate);
      start.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // --- B. Calculate Shift & Current Week ---
      let startDayIndex = start.getDay(); 
      if (startDayIndex === 0) startDayIndex = 7; 
      const shift = startDayIndex - 1;

      // Handle future batches or calculated week
      let currentWeekNumber = 1;
      if (diffDays >= 0) {
        currentWeekNumber = 1 + Math.floor((diffDays + shift) / 7);
      }

      let currentDayNumber = today.getDay();
      if (currentDayNumber === 0) currentDayNumber = 7;

      // --- C. Fetch Week Data for Current Week ---
      // We need this to check if there is a class *today*
      const weekData = await BatchWeek.findOne({
        batch_obj_id: batch._id,
        week_number: currentWeekNumber
      });

      // --- D. Check Today's Class ---
      let hasClassToday = false;
      let timing = null;
      
      // Only true if batch has started AND week exists AND today is in class_days
      if (diffDays >= 0 && weekData && weekData.class_days.includes(currentDayNumber)) {
        hasClassToday = true;
        timing = `${weekData.startTime} - ${weekData.endTime}`;
      }

      // --- E. Calculate Next Class Date ---
      let nextClassDate = null;
      let daysToCheck = 1; 
      let maxDaysLookahead = 30;
      
      // Cache current week data so we don't refetch it in the loop
      const weekDataCache = {}; 
      if (weekData) weekDataCache[currentWeekNumber] = weekData;

      while (daysToCheck <= maxDaysLookahead) {
        const futureTotalDays = diffDays + daysToCheck;
        
        // Skip logic if batch hasn't started yet (look for first day of week 1)
        if (futureTotalDays < 0) {
           daysToCheck++;
           continue; 
        }

        const futureWeekNum = 1 + Math.floor((futureTotalDays + shift) / 7);
        
        const futureDateObj = new Date(today);
        futureDateObj.setDate(today.getDate() + daysToCheck);
        let futureDayNum = futureDateObj.getDay();
        if (futureDayNum === 0) futureDayNum = 7;

        let futureWeekData = weekDataCache[futureWeekNum];
        if (futureWeekData === undefined) {
          futureWeekData = await BatchWeek.findOne({
            batch_obj_id: batch._id,
            week_number: futureWeekNum
          });
          weekDataCache[futureWeekNum] = futureWeekData;
        }

        if (futureWeekData && futureWeekData.class_days.includes(futureDayNum)) {
          nextClassDate = futureDateObj.toDateString();
          break;
        }
        daysToCheck++;
      }

      // --- F. Return Constructed Object ---
      return {
        batchId: batch.batchId,
        classLocation: batch.classLocation,
        weekNumber: currentWeekNumber,
        
        // Today's specific info
        hasClassToday: hasClassToday,
        timing: hasClassToday ? timing : "No class today",
        
        // Future info
        nextClassDate: nextClassDate || "Not scheduled"
      };
    }));

    return sendResponse(res, 200, true, "Today's live batch info retrieved.", processedBatches);

  } catch (err) {
    console.error("getTodaysLiveBatchesForTeacher err", err);
    return sendResponse(res, 500, false, "Server error retrieving batch info.");
  }
};




















/** 
 {
  "success": true,
  "message": "Batch details retrieved successfully.",
  "data": {
    "weeks": [
      {
        "_id": "week_obj_id_1",
        "week_number": 1,
        "week_title": "Intro to Physics",
        "week_description": "Basics of motion",
        "class_days": [1, 3, 5],
        "startTime": "6:30 am",
        "endTime": "8:30 am"
      }
    ],
    "students": [
      {
        "student_obj_id": "student_obj_id_A",
        "name": "Adarsh Dwivedi",
        "email": "student@example.com",
        "student_number": "GZST004"
      },
      {
        "student_obj_id": "student_obj_id_B",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "student_number": "GZST005"
      }
    ]
  }
}

 */


export const getBatchAndWeekDetailsForTeacher = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id is required in the query.");
    }

    // --- PART A: Fetch Weeks Info ---
    const weeksPromise = BatchWeek.find({ batch_obj_id: batch_obj_id })
      .sort({ week_number: 1 })
      .select("week_number week_title week_description class_days startTime endTime")
      .lean();

    // --- PART B: Fetch Students Info (Relations) ---
    const relationsPromise = BatchStudentRelation.find({ 
      batch_obj_id: batch_obj_id 
    }).select("student_obj_id").lean();

    // --- PART C: Fetch Batch Basic Info (NEW) ---
    // We need this to get the readable 'batchId' string (e.g., SPA001)
    const batchPromise = Batch.findById(batch_obj_id).select("batchId").lean();

    // Execute all 3 queries in parallel
    const [weeks, relations, batchDoc] = await Promise.all([
      weeksPromise, 
      relationsPromise, 
      batchPromise
    ]);

    if (!batchDoc) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // Process Students
    const studentIds = relations.map(r => r.student_obj_id);

    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name email student_number _id")
      .lean();

    const formattedStudents = students.map(s => ({
      student_obj_id: s._id,
      name: s.name,
      email: s.email,
      student_number: s.student_number
    }));

    // --- PART D: Return Combined Response ---
    return sendResponse(res, 200, true, "Batch details retrieved successfully.", {
      batchId: batchDoc.batchId, // <--- Added here at the root
      weeks: weeks,
      students: formattedStudents
    });

  } catch (err) {
    console.error("getBatchAndWeekDetailsForTeacher err", err);
    return sendResponse(res, 500, false, "Server error retrieving batch details.");
  }
};