import Batch from "../models/Batch.js";
import BatchCounter from "../models/BatchCounter.js";
import BatchStatus from "../models/BatchStatus.js";
import BatchSession from "../models/BatchSession.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";
import { sendResponse } from "../middleware/auth.js";

// --- Helper to generate ID ---
const getNextBatchId = async (cohortCode, levelCode) => {
  const key = `${cohortCode}${levelCode}`;
  const counter = await BatchCounter.findOneAndUpdate(
    { key: key },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );
  const paddedCount = String(counter.count).padStart(3, "0");
  return `${key}${paddedCount}`;
};

// ==========================================
//              ADMIN CONTROLLERS
// ==========================================

/**
 * Controller: createBatchForAdmin
 * Input: { cohort, level, description, type, startDate, batchType, citycode (if offline), classLocation (if offline) }
 * Output: Created Batch object with initial status
 */
export const createBatchForAdmin = async (req, res) => {
  try {
    const { 
      cohort, level, description, type, startDate, batchType, 
      citycode, classLocation 
    } = req.body;

    if (!cohort || !level || !startDate || !batchType) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }

    const batchTypeClean = String(batchType).toUpperCase().trim();
    let finalCityCode = "", finalLocation = "Online";

    // Online/Offline Validation
    if (batchTypeClean === 'OFFLINE') {
      if (!citycode || !classLocation) {
        return sendResponse(res, 400, false, "OFFLINE batches require citycode and classLocation.");
      }
      finalCityCode = citycode;
      finalLocation = classLocation;
    }

    // Generate Codes
    const cohortLower = String(cohort).toLowerCase().trim();
    const levelLower = String(level).toLowerCase().trim();
    const typeInput = String(type).toLowerCase().trim();

    let cohortCode = "";
    if (cohortLower === "spark") cohortCode = "SP";
    else if (cohortLower === "blaze") cohortCode = "BZ";
    else if (cohortLower === "ignite") cohortCode = "IG";
    else if (cohortLower === "inferno") cohortCode = "IN";
    else return sendResponse(res, 400, false, "Invalid cohort.");

    let levelCode = "";
    if (levelLower === "alpha") levelCode = "A";
    else if (levelLower === "beta") levelCode = "B";
    else if (levelLower === "gamma") levelCode = "C";
    else return sendResponse(res, 400, false, "Invalid level.");

    let typeChar = "";
    if (['s', 'c', 'i'].includes(typeInput)) typeChar = typeInput.toUpperCase();
    else if (typeInput === "society") typeChar = "C";
    else if (typeInput === "school") typeChar = "S";
    else if (typeInput === "individual") typeChar = "I";
    else if (batchTypeClean === "OFFLINE") 
      return sendResponse(res, 400, false, "Invalid type.");

    const batchId = await getNextBatchId(cohortCode, levelCode);

    // Build payload depending on ONLINE or OFFLINE
    let batchPayload = {
      batchId,
      cohort: cohortLower,
      level: levelLower,
      startDate: new Date(startDate),
      batchType: batchTypeClean,
      description: description || ""
    };

    if (batchTypeClean === "OFFLINE") {
      batchPayload.type = typeChar;
      batchPayload.classLocation = finalLocation;
      batchPayload.cityCode = finalCityCode;
    } else {
      // ONLINE — Ignore these fields
      batchPayload.type = undefined;
      batchPayload.classLocation = "Online";
      batchPayload.cityCode = "";
    }

    const newBatch = await Batch.create(batchPayload);

    // Create Status
    const batchStatus = await BatchStatus.create({
      batch_obj_id: newBatch._id,
      batchId: newBatch.batchId,
      status: "UPCOMING"
    });

    return sendResponse(res, 201, true, "Batch created.", { 
      ...newBatch.toObject(), 
      status: batchStatus.status 
    });

  } catch (err) {
    console.error("createBatchForAdmin err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};


/**
 * Controller: linkStudentToBatchForAdmin
 * Input: { batchId (string), student_number (string) }
 * Output: Created Relation object
 */
export const linkStudentToBatchForAdmin = async (req, res) => {
  try {
    const { batchId, student_number } = req.body;
    if (!batchId || !student_number) return sendResponse(res, 400, false, "Fields required.");

    const batchIdClean = String(batchId).toUpperCase().trim();
    const studentNumberClean = String(student_number).toUpperCase().trim();

    const batch = await Batch.findOne({ batchId: batchIdClean });
    if (!batch) return sendResponse(res, 404, false, "Batch not found.");

    const student = await Student.findOne({ student_number: studentNumberClean });
    if (!student) return sendResponse(res, 404, false, "Student not found.");

    const exists = await BatchStudentRelation.exists({ batch_obj_id: batch._id, student_obj_id: student._id });
    if (exists) return sendResponse(res, 409, false, "Student already in batch.");

    const newLink = await BatchStudentRelation.create({
      batch_obj_id: batch._id,
      batchId: batchIdClean,
      student_obj_id: student._id,
      student_number: studentNumberClean
    });

    return sendResponse(res, 200, true, "Student linked.", newLink);
  } catch (err) {
    return sendResponse(res, 500, false, "Server error.");
  }
};

/**
 * Controller: updateBatchStatusForAdmin
 * Input: { batchId, status (UPCOMING/LIVE/ENDED) }
 * Output: Updated Status document
 */
export const updateBatchStatusForAdmin = async (req, res) => {
  try {
    const { batchId, status } = req.body;
    if (!batchId || !status) return sendResponse(res, 400, false, "Fields required.");

    const statusClean = String(status).toUpperCase().trim();
    if (!["UPCOMING", "LIVE", "ENDED"].includes(statusClean)) return sendResponse(res, 400, false, "Invalid status.");

    const statusDoc = await BatchStatus.findOne({ batchId: String(batchId).toUpperCase().trim() });
    if (!statusDoc) return sendResponse(res, 404, false, "Batch status not found.");

    statusDoc.status = statusClean;
    statusDoc.lastUpdated = new Date();
    await statusDoc.save();

    return sendResponse(res, 200, true, "Status updated.", statusDoc);
  } catch (err) {
    return sendResponse(res, 500, false, "Server error.");
  }
};

/**
 * Controller: createSessionInsideABatchForAdmin
 * Input: { batchId, session_number, title, date, startTime, endTime, meetingLinkOrLocation }
 * Output: Created Session object
 */
export const createSessionInsideABatchForAdmin = async (req, res) => {
  try {
    const { 
      batchId, 
      session_number, 
      title, 
      description, 
      date, 
      startTime, 
      endTime, 
      meetingLinkOrLocation 
    } = req.body;
    
    // 1. Removed meetingLinkOrLocation from required checks
    if (!batchId || !session_number || !title || !date || !startTime || !endTime) {
      return sendResponse(res, 400, false, "Missing required session fields (batchId, session_number, title, date, times).");
    }

    const batch = await Batch.findOne({ batchId: String(batchId).toUpperCase().trim() });
    if (!batch) return sendResponse(res, 404, false, "Batch not found.");

    const exists = await BatchSession.exists({ batch_obj_id: batch._id, session_number: Number(session_number) });
    if (exists) return sendResponse(res, 409, false, "Session number already exists for this batch.");

    // 2. Create session (meetingLinkOrLocation is optional now)
    const newSession = await BatchSession.create({
      batch_obj_id: batch._id,
      batchId: batch.batchId,
      session_number: Number(session_number),
      title,
      description: description || "",
      date: new Date(date),
      startTime,
      endTime,
      sessionType: batch.batchType , // Fallback if batchType missing
      meetingLinkOrLocation: meetingLinkOrLocation || null // Save null if empty
    });

    return sendResponse(res, 201, true, "Session created successfully.", newSession);
  } catch (err) {
    console.error("createSession error:", err);
    return sendResponse(res, 500, false, "Server error creating session.");
  }
};




/**
 * Controller: updateSessionDetailsForAdmin
 * Input: { session_obj_id, ...updates }
 * Output: Updated Session object
 */
export const updateSessionDetailsForAdmin = async (req, res) => {
  try {
    const { 
      session_obj_id, // <--- Direct ID lookup
      title, 
      description, 
      date, 
      startTime, 
      endTime, 
      meetingLinkOrLocation 
    } = req.body;

    // 1. Validate ID is present
    if (!session_obj_id) {
      return sendResponse(res, 400, false, "session_obj_id is required.");
    }

    // 2. Find the Session directly using the ID
    const session = await BatchSession.findById(session_obj_id);

    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    // 3. Update fields if they are provided in the body
    if (title !== undefined) session.title = title;
    if (description !== undefined) session.description = description;
    if (date !== undefined) session.date = new Date(date);
    if (startTime !== undefined) session.startTime = startTime;
    if (endTime !== undefined) session.endTime = endTime;
    
    // Allow updating link to empty/null if passed explicitly, or new value
    if (meetingLinkOrLocation !== undefined) {
      session.meetingLinkOrLocation = meetingLinkOrLocation;
    }

    await session.save();

    return sendResponse(res, 200, true, "Session updated successfully.", session);

  } catch (err) {
    console.error("updateSession error:", err);
    return sendResponse(res, 500, false, "Server error updating session.");
  }
};




/**
 * Controller: listAllActiveBatchesForAdmin
 * Input: None (GET request)
 * Output: Array of batch objects (LIVE or UPCOMING only)
 */
export const listAllActiveBatchesForAdmin = async (req, res) => {
  try {
    const activeStatuses = await BatchStatus.find({ status: { $in: ["LIVE", "UPCOMING"] } }).lean();
    if (!activeStatuses.length) return sendResponse(res, 200, true, "No active batches.", []);

    const batchIds = activeStatuses.map(s => s.batch_obj_id);
    const batches = await Batch.find({ _id: { $in: batchIds } }).lean();

    const statusMap = new Map();
    activeStatuses.forEach(s => statusMap.set(s.batch_obj_id.toString(), s.status));

    const result = batches.map(b => ({
      ...b,
      status: statusMap.get(b._id.toString()),
      isLive: statusMap.get(b._id.toString()) === "LIVE"
    }));

    return sendResponse(res, 200, true, "Active batches retrieved.", result);
  } catch (err) {
    return sendResponse(res, 500, false, "Server error.");
  }
};

/**
 * Controller: getSessionForABatchForAdmin
 * Input: Query param ?batch_obj_id=...
 * Output: Array of session objects sorted by number
 */
export const getSessionForABatchForAdmin = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;
    if (!batch_obj_id) return sendResponse(res, 400, false, "batch_obj_id required.");

    const sessions = await BatchSession.find({ batch_obj_id }).sort({ session_number: 1 }).lean();
    return sendResponse(res, 200, true, "Sessions retrieved.", sessions);
  } catch (err) {
    return sendResponse(res, 500, false, "Server error.");
  }
};

/**
 * Controller: getStudentInSBatchForAdmin
 * Input: Query param ?batch_obj_id=...
 * Output: Array of student objects (name, email, mobile, student_number)
 */
export const getStudentInSBatchForAdmin = async (req, res) => {
  try {

    // console.log(1111)
    const { batch_obj_id } = req.query;
    if (!batch_obj_id) return sendResponse(res, 400, false, "batch_obj_id required.");

    const relations = await BatchStudentRelation.find({ batch_obj_id }).select("student_obj_id");
    const studentIds = relations.map(r => r.student_obj_id);

    const students = await Student.find({ _id: { $in: studentIds } }).select("name email mobile student_number").lean();
    return sendResponse(res, 200, true, "Students retrieved.", students);
  } catch (err) {
    return sendResponse(res, 500, false, "Server error.");
  }
};


// ==========================================
//              STUDENT CONTROLLERS
// ==========================================





/**
 * Controller: myLiveBatchesForStudent
 * Input: Auth Token
 * Output: Detailed Array of enrolled LIVE batches
 */
export const myLiveBatchesForStudent = async (req, res) => {
  try {
    const studentId = req.authPayload.id;

    // 1. Get enrolled batches from Relation table
    const relations = await BatchStudentRelation.find({ student_obj_id: studentId })
      .select("batch_obj_id")
      .lean();

    if (!relations.length) {
      return sendResponse(res, 200, true, "No batches found.", []);
    }
    
    const enrolledIds = relations.map(r => r.batch_obj_id);

    // 2. Filter which of these are actually "LIVE" using BatchStatus
    const liveStatuses = await BatchStatus.find({ 
      batch_obj_id: { $in: enrolledIds }, 
      status: "LIVE" 
    }).select("batch_obj_id").lean();

    if (!liveStatuses.length) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    const liveBatchIds = liveStatuses.map(s => s.batch_obj_id);

    // 3. Fetch full details from the main Batch collection
    const batches = await Batch.find({ _id: { $in: liveBatchIds } }).lean();

    // 4. Format the response (Hide offline fields if ONLINE)
    const formattedBatches = batches.map(batch => {
      // Fields common to both Online and Offline
      const batchData = {
        _id: batch._id,
        batchId: batch.batchId,
        cohort: batch.cohort,
        level: batch.level,
        startDate: batch.startDate,
        batchType: batch.batchType, // ONLINE or OFFLINE
        description: batch.description
      };

      // Only add these if the batch is OFFLINE
      if (batch.batchType === 'OFFLINE') {
        batchData.classLocation = batch.classLocation;
        batchData.cityCode = batch.cityCode;
        batchData.type = batch.type; // 'S', 'C', 'I'
      }

      return batchData;
    });

    return sendResponse(res, 200, true, "Live batches retrieved successfully.", formattedBatches);

  } catch (err) {
    console.error("myLiveBatchesForStudent error:", err);
    return sendResponse(res, 500, false, "Server error retrieving live batches.");
  }
};


/**
 * Controller: getSessionForABatchForStudent
 * Input: Query param ?batch_obj_id=...
 * Output: Array of sessions (Verifies enrollment first)
 */
export const getSessionForABatchForStudent = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batch_obj_id } = req.query;

    if (!batch_obj_id)
      return sendResponse(res, 400, false, "batch_obj_id required.");

    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id
    });
    if (!isEnrolled)
      return sendResponse(res, 403, false, "Not enrolled.");

    // find batch to know ONLINE or OFFLINE
    const batch = await Batch.findById(batch_obj_id).lean();
    if (!batch)
      return sendResponse(res, 404, false, "Batch not found.");

    let sessions = await BatchSession.find({ batch_obj_id })
      .sort({ session_number: 1 })
      .lean();

    // ---------------------------------------------------------
    // APPLY ONLINE BATCH LOGIC → hide link UNTIL 1 hour before
    // ---------------------------------------------------------
    if (batch.batchType === "ONLINE") {
      const now = new Date();

      sessions = sessions.map(session => {
        const updated = { ...session };

        // Convert startTime (string) + date into a Date object
        const sessionStart = new Date(session.date);
        const [timeStr, modifier] = session.startTime.split(" ");
        let [hours, minutes] = timeStr.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        sessionStart.setHours(hours, minutes, 0, 0);

        const oneHourBefore = new Date(sessionStart.getTime() - 60 * 60 * 1000);

        // If more than 60 minutes remaining → hide link
        if (now < oneHourBefore) {
          updated.meetingLinkOrLocation = "Link will be shared soon";
        }

        return updated;
      });
    }

    // ---------------------------------------------------------
    // For OFFLINE batch -> return sessions unchanged
    // ---------------------------------------------------------

    return sendResponse(res, 200, true, "Sessions retrieved.", sessions);

  } catch (err) {
    console.error("getSessionForABatchForStudent err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};




/**
 * Controller: getTodayLiveBatchInfoForStudent
 */
export const getTodayLiveBatchInfoForStudent = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batch_obj_id } = req.body;

    if (!batch_obj_id)
      return sendResponse(res, 400, false, "batch_obj_id required.");

    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id
    });
    if (!isEnrolled)
      return sendResponse(res, 403, false, "Not enrolled.");

    const batch = await Batch.findById(batch_obj_id);
    if (!batch)
      return sendResponse(res, 404, false, "Batch not found.");

    // Today range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Find today's session (if any)
    const todaysSession = await BatchSession.findOne({
      batch_obj_id: batch._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    // Next session (future after today)
    const nextSession = await BatchSession.findOne({
      batch_obj_id: batch._id,
      date: { $gt: endOfDay }
    }).sort({ date: 1 });

    let sessionResponse = null;

    if (todaysSession) {
      sessionResponse = todaysSession.toObject(); // clone object

      // ONLY APPLY TIME CHECK FOR ONLINE SESSIONS
      if (batch.batchType === "ONLINE") {
        const now = new Date();

        // Combine today's date with session startTime string, e.g. "10:00 AM"
        const sessionStart = new Date(todaysSession.date);
        const [timeStr, modifier] = todaysSession.startTime.split(" ");
        let [hours, minutes] = timeStr.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        sessionStart.setHours(hours, minutes, 0, 0);

        const oneHourBefore = new Date(sessionStart.getTime() - 60 * 60 * 1000);

        // Check if link can be revealed
        if (now < oneHourBefore) {
          // Too early → hide link
          sessionResponse.meetingLinkOrLocation = "Link will be shared soon (1 hour before class)";
        }
        // else → within 1 hr window → return original link
      }
    }

    const responseData = {
      batchId: batch.batchId,
      batchType: batch.batchType,
      defaultLocation:
        batch.batchType === "OFFLINE"
          ? batch.classLocation
          : "Online",

      hasClassToday: !!todaysSession,
      sessionDetails: sessionResponse,

      nextClassDate: nextSession
        ? nextSession.date.toDateString()
        : "Not scheduled"
    };

    return sendResponse(res, 200, true, "Info retrieved.", responseData);
  } catch (err) {
    console.error("getTodayLiveBatchInfoForStudent err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};
