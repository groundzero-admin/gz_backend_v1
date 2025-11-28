import Batch from "../models/Batch.js";
import BatchCounter from "../models/BatchCounter.js";
import BatchStatus from "../models/BatchStatus.js"; // <-- IMPORT NEW MODEL
import Student from "../models/Student.js"; 
import BatchStudentRelation from "../models/BatchStudentRelation.js"; 
import { sendResponse } from "../middleware/auth.js";
import BatchWeek from "../models/BatchWeek.js";





// --- Helper to generate ID ---
const getNextbatchId = async (cohortCode, levelCode) => {
  const key = `${cohortCode}${levelCode}`;
  const counter = await BatchCounter.findOneAndUpdate(
    { key: key },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );
  const paddedCount = String(counter.count).padStart(3, "0");
  return `${key}${paddedCount}`;
};

// ---------------------------------------------------------
// 1. UPDATED CREATE BATCH (Creates Batch + BatchStatus)
// ---------------------------------------------------------
export const createBatch = async (req, res) => {
  try {
    const { 
      cohort, 
      level, 
      description, 
      citycode, 
      type, 
      startDate, 
      classLocation 
    } = req.body;

    if (!cohort || !level || !citycode || !type || !startDate || !classLocation) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }

    const dateObj = new Date(startDate);
    // if (dateObj.getDay() !== 1) {
    //   return sendResponse(res, 400, false, "Start Date must be a Monday.");
    // }

    const cohortLower = String(cohort).toLowerCase().trim();
    const levelLower = String(level).toLowerCase().trim();
    const typeInput = String(type).toLowerCase().trim();

    let cohortCode = "";
    if (cohortLower === "spark") cohortCode = "SP";
    else if (cohortLower === "blaze") cohortCode = "BZ";
    else if (cohortLower === "ignite") cohortCode = "IG";
    else if (cohortLower === "inferno") cohortCode = "IN";
    else return sendResponse(res, 400, false, "Invalid cohort name.");

    let levelCode = "";
    if (levelLower === "alpha") levelCode = "A";
    else if (levelLower === "beta") levelCode = "B";
    else if (levelLower === "gamma") levelCode = "C";
    else return sendResponse(res, 400, false, "Invalid level name.");

    let typeChar = "";
    if (typeInput === "society") typeChar = "C";
    else if (typeInput === "school") typeChar = "S";
    else if (typeInput === "individual") typeChar = "I";
    else if (['s', 'c', 'i'].includes(typeInput)) typeChar = typeInput.toUpperCase(); 
    else return sendResponse(res, 400, false, "Invalid type. Use Society, School, or Individual.");

    const batchId = await getNextbatchId(cohortCode, levelCode);

    // --- A. Create the Batch ---
    const newBatch = await Batch.create({
      batchId,
      cohort: cohortLower,
      level: levelLower,
      classLocation,
      cityCode: citycode,
      startDate: dateObj,
      type: typeChar,
      description: description || ""
    });

    // --- B. Create the BatchStatus (Default: UPCOMING) ---
    const batchStatus = await BatchStatus.create({
      batch_obj_id: newBatch._id,
      batchId: newBatch.batchId,
      status: "UPCOMING"
    });

    // --- C. Return full combined data for frontend card ---
    const responseData = {
      ...newBatch.toObject(),
      status: batchStatus.status,
      statusId: batchStatus._id,
      batchStatus: batchStatus, // if you need entire batchStatus doc
    };

    return sendResponse(res, 201, true, "Batch created successfully.", responseData);

  } catch (err) {
    console.error("createBatch err", err);
    return sendResponse(res, 500, false, "Server error creating batch.");
  }
};






export const updateBatchStatus = async (req, res) => {
  try {
    const { batchId, status } = req.body;

    if (!batchId || !status) {
      return sendResponse(res, 400, false, "batchId and status are required.");
    }

    // Normalize inputs
    const batchIdClean = String(batchId).toUpperCase().trim();
    const statusClean = String(status).toUpperCase().trim();

    // Validate Status Enum
    const validStatuses = ["UPCOMING", "LIVE", "ENDED"];
    if (!validStatuses.includes(statusClean)) {
      return sendResponse(res, 400, false, "Invalid status. Use UPCOMING, LIVE, or ENDED.");
    }

    // 1. Find the Status Document
    const statusDoc = await BatchStatus.findOne({ batchId: batchIdClean });

    if (!statusDoc) {
      return sendResponse(res, 404, false, "Batch status entry not found.");
    }

    // 2. Update the status
    statusDoc.status = statusClean;
    statusDoc.lastUpdated = new Date();
    await statusDoc.save();

    return sendResponse(res, 200, true, `Batch status updated to ${statusClean}.`, statusDoc);

  } catch (err) {
    console.error("updateBatchStatus err", err);
    return sendResponse(res, 500, false, "Server error updating batch status.");
  }
};

















export const linkStudentToBatch = async (req, res) => {
  try {
    const { batchId, student_number } = req.body;

    if (!batchId || !student_number) {
      return sendResponse(res, 400, false, "batchId and student_number are required.");
    }

    // --- FIX: Convert to Uppercase and Trim ---
    const batchIdClean = String(batchId).toUpperCase().trim();
    const studentNumberClean = String(student_number).toUpperCase().trim();

    // 1. Find the Batch object to get its _id
    const batch = await Batch.findOne({ batchId: batchIdClean });
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // 2. Find the Student object to get its _id
    const student = await Student.findOne({ student_number: studentNumberClean });
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    // 3. Check if link already exists
    const existingLink = await BatchStudentRelation.findOne({
      batch_obj_id: batch._id,
      student_obj_id: student._id
    });

    if (existingLink) {
      return sendResponse(res, 409, false, "Student is already added to this batch.");
    }

    // 4. Create the Relation
    const newLink = new BatchStudentRelation({
      batch_obj_id: batch._id,
      batchId: batchIdClean,          // Save the clean, uppercase ID
      student_obj_id: student._id,
      student_number: studentNumberClean // Save the clean, uppercase ID
    });

    await newLink.save();

    return sendResponse(res, 200, true, "Student successfully added to batch.", newLink);

  } catch (err) {
    console.error("linkStudentToBatch err", err);
    return sendResponse(res, 500, false, "Server error linking student to batch.");
  }
};















export const createBatchWeek = async (req, res) => {
  try {
    const { 
      batchId, 
      week_number, 
      title, 
      description, 
      class_days,
      startTime, // <-- Input
      endTime    // <-- Input
    } = req.body;

    // 1. Basic Validation (Added startTime and endTime)
    if (!batchId || week_number === undefined || !title || !class_days || !startTime || !endTime) {
      return sendResponse(res, 400, false, "batchId, week_number, title, class_days, startTime, and endTime are required.");
    }

    if (!Array.isArray(class_days) || class_days.length === 0) {
      return sendResponse(res, 400, false, "class_days must be a non-empty array of numbers.");
    }

    const batchIdClean = String(batchId).toUpperCase().trim();

    // 2. Find the Batch
    const batch = await Batch.findOne({ batchId: batchIdClean });
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // 3. Check for Duplicate Week
    const existingWeek = await BatchWeek.findOne({
      batch_obj_id: batch._id,
      week_number: Number(week_number)
    });

    if (existingWeek) {
      return sendResponse(res, 409, false, `Week ${week_number} already exists for batch ${batchIdClean}.`);
    }

    // 4. Create the BatchWeek entry
    const newWeek = new BatchWeek({
      batch_obj_id: batch._id,
      batchId: batchIdClean,
      week_number: Number(week_number),
      week_title: title,
      week_description: description || "",
      class_days: class_days,
      startTime: startTime, // <-- Saved
      endTime: endTime      // <-- Saved
    });

    await newWeek.save();

    return sendResponse(res, 201, true, "Batch week created successfully.", newWeek);

  } catch (err) {
    console.error("createBatchWeek err", err);
    if (err.code === 11000) {
      return sendResponse(res, 409, false, "This week number already exists for this batch.");
    }
    return sendResponse(res, 500, false, "Server error creating batch week.");
  }
};















export const listAllActiveBatches = async (req, res) => {
  try {
    // 1. Find all BatchStatus entries that are NOT 'ENDED'
    const activeStatuses = await BatchStatus.find({
      status: { $in: ["LIVE", "UPCOMING"] }
    }).lean();

    if (!activeStatuses || activeStatuses.length === 0) {
      return sendResponse(res, 200, true, "No active batches found.", []);
    }

    // 2. Extract the batch object IDs
    const batchIds = activeStatuses.map(s => s.batch_obj_id);

    // 3. Fetch the details for these batches from the Batch table
    const batches = await Batch.find({ _id: { $in: batchIds } }).lean();

    // 4. Create a Map for quick status lookup
    // Key: batch_obj_id (string), Value: status string
    const statusMap = new Map();
    activeStatuses.forEach(s => {
      statusMap.set(s.batch_obj_id.toString(), s.status);
    });

    // 5. Merge the data into the final response format
    const responseList = batches.map(batch => {
      const currentStatus = statusMap.get(batch._id.toString());
      return {
        _id: batch._id,
        batchId: batch.batchId,
        cohort: batch.cohort,
        level: batch.level,
        startDate: batch.startDate,
        classLocation: batch.classLocation,
        cityCode: batch.cityCode,
        type: batch.type,
        status: currentStatus, // "LIVE" or "UPCOMING"
        isLive: currentStatus === "LIVE",         // Boolean flag
        isUpcoming: currentStatus === "UPCOMING"  // Boolean flag
      };
    });

    return sendResponse(res, 200, true, "Active batches retrieved.", responseList);

  } catch (err) {
    console.error("listAllActiveBatches err", err);
    return sendResponse(res, 500, false, "Server error retrieving batches.");
  }
};





export const getWeeksForABatch = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id is required in the query.");
    }

    // Find weeks, sort by week_number ascending
    const weeks = await BatchWeek.find({ batch_obj_id: batch_obj_id })
      .sort({ week_number: 1 })
      .select("week_number week_title week_description class_days")
      .lean();

    // Rename keys to match your exact request (title, description)
    const formattedWeeks = weeks.map(week => ({
      week_number: week.week_number,
      title: week.week_title,
      description: week.week_description,
      class_days: week.class_days
    }));

    return sendResponse(res, 200, true, "Batch weeks retrieved.", formattedWeeks);

  } catch (err) {
    console.error("getWeeksForBatch err", err);
    return sendResponse(res, 500, false, "Server error retrieving batch weeks.");
  }
};
















////////////////// for a student 
export const getMyLiveBatches = async (req, res) => {
  try {
    // 1. Get studentId from token
    const studentId = req.authPayload.id;

    // 2. Find all batches this student is linked to
    const relations = await BatchStudentRelation.find({ 
      student_obj_id: studentId 
    }).select("batch_obj_id");

    if (!relations || relations.length === 0) {
      return sendResponse(res, 200, true, "You are not enrolled in any batches.", []);
    }

    // Extract the ObjectIds
    const batchObjIds = relations.map(r => r.batch_obj_id);

    // 3. Find which of these batches are currently "LIVE"
    const liveBatches = await BatchStatus.find({
      batch_obj_id: { $in: batchObjIds },
      status: "LIVE"
    }).select("batchId batch_obj_id"); // Select specific fields

    // 4. Format the response
    const responseList = liveBatches.map(b => ({
      batchId: b.batchId,       // String ID (e.g., SPA004)
      batch_obj_id: b.batch_obj_id // Database ObjectId
    }));

    return sendResponse(res, 200, true, "Live batches retrieved.", responseList);

  } catch (err) {
    console.error("getMyLiveBatches err", err);
    return sendResponse(res, 500, false, "Server error retrieving batches.");
  }
};















///// only for student 

export const getMyEnrolledBatches = async (req, res) => {
  try {
    // 1. Get studentId from token
    const studentId = req.authPayload.id;

    // 2. Find all relation entries (Batches the student is linked to)
    const relations = await BatchStudentRelation.find({ 
      student_obj_id: studentId 
    }).lean();

    if (!relations || relations.length === 0) {
      return sendResponse(res, 200, true, "You are not enrolled in any batches.", []);
    }

    // Extract Batch Object IDs
    const batchObjIds = relations.map(r => r.batch_obj_id);

    // 3. Fetch Batch Details (Title, Start Date, etc.)
    const batches = await Batch.find({ 
      _id: { $in: batchObjIds } 
    }).lean();

    // 4. Fetch Batch Statuses
    const statuses = await BatchStatus.find({
      batch_obj_id: { $in: batchObjIds }
    }).lean();

    // 5. Create a Map for O(1) status lookup
    const statusMap = {};
    statuses.forEach(s => {
      statusMap[s.batch_obj_id.toString()] = s.status;
    });

    // 6. Merge Data and Format Response
    const responseList = batches.map(batch => {
      const currentStatus = statusMap[batch._id.toString()] || "UNKNOWN";
      
      return {
        _id: batch._id,
        batchId: batch.batchId,
        startDate: batch.startDate,
        classLocation: batch.classLocation,
        cohort: batch.cohort,
        level: batch.level,
        description: batch.description,
        
        // Status Fields
        status: currentStatus,
        isLive: currentStatus === "LIVE",
        isUpcoming: currentStatus === "UPCOMING",
        isEnded: currentStatus === "ENDED"
      };
    })
    // 7. FILTER: Only keep LIVE or UPCOMING (Remove ENDED)
    .filter(batch => !batch.isEnded); 

    return sendResponse(res, 200, true, "Enrolled batches retrieved.", responseList);

  } catch (err) {
    console.error("getMyEnrolledBatches err", err);
    return sendResponse(res, 500, false, "Server error retrieving enrolled batches.");
  }
};










////// srudent checking all batches + ishe enrolled or not also both 

export const getAllBatchesForStudent = async (req, res) => {
  try {
    // 1. Get studentId from token
    const studentId = req.authPayload.id;

    // 2. Find ALL active statuses (LIVE or UPCOMING)
    const activeStatuses = await BatchStatus.find({
      status: { $in: ["LIVE", "UPCOMING"] }
    }).lean();

    if (!activeStatuses || activeStatuses.length === 0) {
      return sendResponse(res, 200, true, "No active batches found.", []);
    }

    // Extract batch Object IDs
    const activeBatchIds = activeStatuses.map(s => s.batch_obj_id);

    // 3. Fetch Batch Details for these active batches
    const batches = await Batch.find({ 
      _id: { $in: activeBatchIds } 
    }).lean();

    // 4. Find which of these the STUDENT is enrolled in
    const myEnrollments = await BatchStudentRelation.find({
      student_obj_id: studentId,
      batch_obj_id: { $in: activeBatchIds }
    }).select("batch_obj_id").lean();

    // 5. Create Lookups (Maps/Sets) for O(1) access
    
    // Status Map: BatchID -> Status
    const statusMap = {};
    activeStatuses.forEach(s => {
      statusMap[s.batch_obj_id.toString()] = s.status;
    });

    // Enrollment Set: Set of BatchIDs the student has joined
    const enrolledSet = new Set(
      myEnrollments.map(e => e.batch_obj_id.toString())
    );

    // 6. Merge and Format Response
    const responseList = batches.map(batch => {
      const bIdString = batch._id.toString();
      const currentStatus = statusMap[bIdString] || "UNKNOWN";
      
      return {
        _id: batch._id,
        batchId: batch.batchId,
        startDate: batch.startDate,
        classLocation: batch.classLocation,
        cohort: batch.cohort,
        level: batch.level,
        description: batch.description,
        
        // Status Fields
        status: currentStatus,
        isLive: currentStatus === "LIVE",
        isUpcoming: currentStatus === "UPCOMING",
        
        // The specific flag you asked for
        amIEnrolled: enrolledSet.has(bIdString)
      };
    });

    return sendResponse(res, 200, true, "All active batches retrieved.", responseList);

  } catch (err) {
    console.error("getAllBatchesForStudent err", err);
    return sendResponse(res, 500, false, "Server error retrieving batches.");
  }
};









/// studnt checking week data for a batch in which he is enrolled 


/**
 * ---------------------------------------------------
 * NEW FUNCTION: Get Weeks for a Batch (Student)
 * GET /api/student/weeksinfoofbatch?batch_obj_id=...
 * Verifies enrollment first.
 * ---------------------------------------------------
 */
export const getWeeksForBatchStudent = async (req, res) => {
  try {
    // 1. Get inputs
    const studentId = req.authPayload.id;
    const { batch_obj_id } = req.query;

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id is required in the query.");
    }

    // 2. Verify Enrollment: Is this student linked to this batch?
    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id: batch_obj_id
    });

    if (!isEnrolled) {
      return sendResponse(res, 403, false, "Access denied. You are not enrolled in this batch.");
    }

    // 3. Fetch Weeks
    const weeks = await BatchWeek.find({ batch_obj_id: batch_obj_id })
      .sort({ week_number: 1 }) // Ascending order
      .select("week_number week_title week_description class_days")
      .lean();

    // 4. Format Response
    const formattedWeeks = weeks.map(week => ({
      week_number: week.week_number,
      title: week.week_title,
      description: week.week_description,
      class_days: week.class_days
    }));

    return sendResponse(res, 200, true, "Batch weeks retrieved.", formattedWeeks);

  } catch (err) {
    console.error("getWeeksForBatchStudent err", err);
    return sendResponse(res, 500, false, "Server error retrieving batch weeks.");
  }
};







////////////// student asking for today live batch info class time is class or not like that 


export const getTodaysLiveBatchInfo = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batch_obj_id } = req.body;

    if (!batch_obj_id) return sendResponse(res, 400, false, "batch_obj_id required.");

    // 1. Verify Enrollment
    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id: batch_obj_id
    });
    if (!isEnrolled) return sendResponse(res, 403, false, "Access denied.");

    // 2. Fetch Batch
    const batch = await Batch.findById(batch_obj_id);
    if (!batch) return sendResponse(res, 404, false, "Batch not found.");
    
    // 3. Normalize Dates (Midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(batch.startDate);
    start.setHours(0, 0, 0, 0);

    // 4. Calculate Diff
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return sendResponse(res, 200, true, "Batch upcoming.", { 
        hasClassToday: false,
        classLocation: batch.classLocation // Also return location for upcoming batches
      });
    }

    // 5. Calculate Shift (Mon=1...Sun=7)
    let startDayIndex = start.getDay(); 
    if (startDayIndex === 0) startDayIndex = 7; 
    const shift = startDayIndex - 1;

    // 6. Calculate Current Week & Day
    const currentWeekNumber = 1 + Math.floor((diffDays + shift) / 7);
    let currentDayNumber = today.getDay();
    if (currentDayNumber === 0) currentDayNumber = 7;

    // 7. DB Lookup for Today
    const weekData = await BatchWeek.findOne({
      batch_obj_id: batch_obj_id,
      week_number: currentWeekNumber
    });

    // 8. Check Class Status Today
    let hasClassToday = false;
    let classInfo = null;

    if (weekData && weekData.class_days.includes(currentDayNumber)) {
      hasClassToday = true;
      classInfo = {
        weekTitle: weekData.week_title,
        weekDescription: weekData.week_description,
        startTime: weekData.startTime,
        endTime: weekData.endTime
      };
    }

    // --- NEW LOGIC: FIND NEXT CLASS DATE ---
    let nextClassDate = null;
    let daysToCheck = 1; // Start checking from tomorrow
    let maxDaysLookahead = 30; // Safety break
    
    const weekDataCache = {}; 
    if(weekData) weekDataCache[currentWeekNumber] = weekData;

    while (daysToCheck <= maxDaysLookahead) {
      const futureTotalDays = diffDays + daysToCheck;
      const futureWeekNum = 1 + Math.floor((futureTotalDays + shift) / 7);
      
      const futureDateObj = new Date(today);
      futureDateObj.setDate(today.getDate() + daysToCheck);
      let futureDayNum = futureDateObj.getDay();
      if (futureDayNum === 0) futureDayNum = 7;

      let futureWeekData = weekDataCache[futureWeekNum];
      
      if (futureWeekData === undefined) {
        futureWeekData = await BatchWeek.findOne({
          batch_obj_id: batch_obj_id,
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
    // ----------------------------------------

    // 9. Response
    return sendResponse(res, 200, true, "Info retrieved.", {
      hasClassToday,
      calculatedWeek: currentWeekNumber,
      calculatedDay: currentDayNumber,
      batchId: batch.batchId,
      classLocation: batch.classLocation, // <--- ADDED HERE
      nextClassDate: nextClassDate, 
      ...(hasClassToday ? classInfo : { message: "No class today." })
    });

  } catch (err) {
    console.error("getTodaysLiveBatchInfo err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};








/// admin listing list of studnt is a batch 
export const getStudentsInBatch = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;


    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id is required in the query.");
    }

    // 1. Find all relation entries for this batch
    const relations = await BatchStudentRelation.find({ 
      batch_obj_id: batch_obj_id 
    }).select("student_obj_id");

    if (!relations || relations.length === 0) {
      return sendResponse(res, 200, true, "No students found in this batch.", []);
    }

    // 2. Extract the Student Object IDs
    const studentIds = relations.map(rel => rel.student_obj_id);

    // 3. Fetch details from Student table (name, email, mobile)
    const students = await Student.find({ 
      _id: { $in: studentIds } 
    }).select("name email mobile _id student_number").lean();

    return sendResponse(res, 200, true, "Students in batch retrieved.", students);

  } catch (err) {
    console.error("getStudentsInBatch err", err);
    return sendResponse(res, 500, false, "Server error retrieving students.");
  }
};