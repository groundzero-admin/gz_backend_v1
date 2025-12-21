import Batch from "../models/Batch.js";
import BatchCounter from "../models/BatchCounter.js";
import BatchStatus from "../models/BatchStatus.js";
import BatchSession from "../models/BatchSession.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
import Student from "../models/Student.js";
import { sendResponse } from "../middleware/auth.js";
import StudentCredit from "../models/StudentCredit.js";





/////////// to genrate new batch name 
const getNextBatchName = async (rawBatchName) => {
  const key = String(rawBatchName).toUpperCase().trim(); // SPARK

  const counter = await BatchCounter.findOneAndUpdate(
    { key },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );

  const paddedCount = String(counter.count).padStart(3, "0");
  return `${key}_${paddedCount}`; // SPARK001
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
      batchName,
      level,
      description,
      startDate,
      batchType,
      citycode,
      classLocation
    } = req.body;

    if (!batchName || !startDate || !batchType) {
      return sendResponse(res, 400, false, "batchName, startDate, batchType are required.");
    }

    const batchTypeClean = String(batchType).toUpperCase().trim();
    if (!["ONLINE", "OFFLINE"].includes(batchTypeClean)) {
      return sendResponse(res, 400, false, "Invalid batchType.");
    }

    // OFFLINE validation
    if (batchTypeClean === "OFFLINE") {
      if (!citycode || !classLocation) {
        return sendResponse(
          res,
          400,
          false,
          "OFFLINE batches require citycode and classLocation."
        );
      }
    }

    // 🔥 Generate SPARK001 / SPARK002
    const finalBatchName = await getNextBatchName(batchName);

    // Build payload
    const batchPayload = {
      batchName: finalBatchName,
      level: level || "",
      startDate: new Date(startDate),
      batchType: batchTypeClean,
      description: description || ""
    };

    if (batchTypeClean === "OFFLINE") {
      batchPayload.cityCode = citycode;
      batchPayload.classLocation = classLocation;
    }

    const newBatch = await Batch.create(batchPayload);

    // Create initial status
    const batchStatus = await BatchStatus.create({
      batch_obj_id: newBatch._id,
      batchName: newBatch.batchName,
      status: "UPCOMING"
    });

  return sendResponse(res, 201, true, "Batch created successfully.", {
  batch_obj_id: newBatch._id,
  batchName: newBatch.batchName,
  level: newBatch.level,
  startDate: newBatch.startDate,
  batchType: newBatch.batchType,
  description: newBatch.description,
  classLocation:
    newBatch.batchType === "OFFLINE" ? newBatch.classLocation : undefined,
  cityCode:
    newBatch.batchType === "OFFLINE" ? newBatch.cityCode : undefined,
  status: batchStatus.status
});


  } catch (err) {
    console.error("createBatchForAdmin error:", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};



/**
 * Controller: linkStudentToBatchForAdmin
 * Input: { batch object Id , student_number (string) }
 * Output: Created Relation object
 */

export const linkStudentToBatchForAdmin = async (req, res) => {
  try {
    const { batch_obj_id, student_number } = req.body;

    if (!batch_obj_id || !student_number)
      return sendResponse(res, 400, false, "Fields required.");

    const studentNumberClean = String(student_number).toUpperCase().trim();

    const batch = await Batch.findById(batch_obj_id);
    if (!batch) return sendResponse(res, 404, false, "Batch not found.");

    const student = await Student.findOne({ student_number: studentNumberClean });
    if (!student) return sendResponse(res, 404, false, "Student not found.");

    const exists = await BatchStudentRelation.exists({
      batch_obj_id: batch._id,
      student_obj_id: student._id
    });

    if (exists)
      return sendResponse(res, 409, false, "Student already in batch.");

    const newLink = await BatchStudentRelation.create({
      batch_obj_id: batch._id,
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
 * Input: { batch obj id , status (UPCOMING/LIVE/ENDED) }
 * Output: Updated Status document
 */
export const updateBatchStatusForAdmin = async (req, res) => {
  try {
    const { batch_obj_id, status } = req.body;

    if (!batch_obj_id || !status)
      return sendResponse(res, 400, false, "Fields required.");

    const statusClean = String(status).toUpperCase().trim();
    if (!["UPCOMING", "LIVE", "ENDED"].includes(statusClean))
      return sendResponse(res, 400, false, "Invalid status.");

    const statusDoc = await BatchStatus.findOne({ batch_obj_id });
    if (!statusDoc)
      return sendResponse(res, 404, false, "Batch status not found.");

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
 * Input: { batch obj id , session_number, title, date, startTime, endTime, meetingLinkOrLocation }
 * Output: Created Session object
 */
export const createSessionInsideABatchForAdmin = async (req, res) => {
  try {
    const {
      batch_obj_id,
      session_number,
      title,
      description,
      date,
      startTime,
      endTime,
      meetingLinkOrLocation,
      googleClassroomLink // ✅ NEW (optional)
    } = req.body;



    // console.log(googleClassroomLink)

    if (!batch_obj_id || !session_number || !title || !date || !startTime || !endTime) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }

    const batch = await Batch.findById(batch_obj_id);
    if (!batch) return sendResponse(res, 404, false, "Batch not found.");

    const exists = await BatchSession.exists({
      batch_obj_id,
      session_number: Number(session_number)
    });

    if (exists)
      return sendResponse(
        res,
        409,
        false,
        "Session Number already exists. Please change session number."
      );

    // 🚫 Safety: classroom link only for ONLINE
    if (googleClassroomLink && batch.batchType !== "ONLINE") {
      return sendResponse(
        res,
        400,
        false,
        "Google Classroom link is allowed only for ONLINE batches."
      );
    }

    const newSession = await BatchSession.create({
      batch_obj_id,
      session_number: Number(session_number),
      title,
      description: description || "",
      date: new Date(date),
      startTime,
      endTime,
      sessionType: batch.batchType,
      meetingLinkOrLocation: meetingLinkOrLocation || null,
      googleClassroomLink: googleClassroomLink || null // ✅ SAVED
    });

    return sendResponse(res, 201, true, "Session created.", newSession);

  } catch (err) {
    console.error("createSessionInsideABatchForAdmin error:", err);
    return sendResponse(res, 500, false, "Server error.");
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
      session_obj_id,
      title,
      description,
      date,
      startTime,
      endTime,
      meetingLinkOrLocation,
      googleClassroomLink // ✅ NEW
    } = req.body;

    if (!session_obj_id) {
      return sendResponse(res, 400, false, "session_obj_id is required.");
    }

    const session = await BatchSession.findById(session_obj_id);
    if (!session) {
      return sendResponse(res, 404, false, "Session not found.");
    }

    if (title !== undefined) session.title = title;
    if (description !== undefined) session.description = description;
    if (date !== undefined) session.date = new Date(date);
    if (startTime !== undefined) session.startTime = startTime;
    if (endTime !== undefined) session.endTime = endTime;
    if (meetingLinkOrLocation !== undefined)
      session.meetingLinkOrLocation = meetingLinkOrLocation;

    // 🚫 Safety check
    if (googleClassroomLink !== undefined) {
      if (googleClassroomLink && session.sessionType !== "ONLINE") {
        return sendResponse(
          res,
          400,
          false,
          "Google Classroom link allowed only for ONLINE sessions."
        );
      }
      session.googleClassroomLink = googleClassroomLink;
    }

    await session.save();

    return sendResponse(res, 200, true, "Session updated successfully.", session);

  } catch (err) {
    console.error("updateSessionDetailsForAdmin error:", err);
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
  batch_obj_id: b._id,
  batchName: b.batchName,
  level: b.level,
  startDate: b.startDate,
  batchType: b.batchType,
  description: b.description,
  classLocation: b.batchType === "OFFLINE" ? b.classLocation : undefined,
  cityCode: b.batchType === "OFFLINE" ? b.cityCode : undefined,
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

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id required.");
    }

    // 1️⃣ Fetch Batch details
    const batch = await Batch.findById(batch_obj_id)
      .select("batchName level startDate batchType classLocation cityCode")
      .lean();

    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // 2️⃣ Fetch Sessions
    const sessions = await BatchSession.find({ batch_obj_id })
      .sort({ session_number: 1 })
      .lean();


      // console.log(sessions.googleClassroomLink)

    // 3️⃣ Build response
  const responseData = {
  batch: {
    batch_obj_id: batch._id,
    batchName: batch.batchName,
    level: batch.level,
    startDate: batch.startDate,
    batchType: batch.batchType, // ONLINE / OFFLINE
    classLocation:
      batch.batchType === "OFFLINE" ? batch.classLocation : undefined,
    cityCode:
      batch.batchType === "OFFLINE" ? batch.cityCode : undefined
  },

  sessions: sessions.map(session => ({
    ...session,

    // ✅ expose classroom link only for ONLINE
    googleClassroomLink:
      batch.batchType === "ONLINE"
        ? session.googleClassroomLink
        : undefined
  }))
};


    return sendResponse(
      res,
      200,
      true,
      "Batch sessions retrieved successfully.",
      responseData
    );

  } catch (err) {
    console.error("getSessionForABatchForAdmin error:", err);
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
  batch_obj_id: batch._id,
  batchName: batch.batchName,
  level: batch.level,
  startDate: batch.startDate,
  batchType: batch.batchType,
  description: batch.description
};


      // Only add these if the batch is OFFLINE
      if (batch.batchType === 'OFFLINE') {
        batchData.classLocation = batch.classLocation;
        batchData.cityCode = batch.cityCode;
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

    if (!batch_obj_id) {
      return sendResponse(res, 400, false, "batch_obj_id required.");
    }

    // 1. Verify enrollment
    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id
    });
    if (!isEnrolled) {
      return sendResponse(res, 403, false, "Not enrolled in this batch.");
    }

    // 2. Get the batch details (needed to check if ONLINE/OFFLINE)
    const batch = await Batch.findById(batch_obj_id).lean();
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found.");
    }

    // 3. Fetch sessions sorted by session number
    let sessions = await BatchSession.find({ batch_obj_id })
      .sort({ session_number: 1 })
      .lean();

    // 4. ONLINE BATCH LOGIC: Hide link until 1 hour before class
    if (batch.batchType === "ONLINE") {
      const now = new Date();

      sessions = sessions.map((session) => {
        const updated = { ...session };

        // Construct Session Start Time
        const sessionStart = new Date(session.date);
        const [timeStr, modifier] = session.startTime.split(" ");
        let [hours, minutes] = timeStr.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        sessionStart.setHours(hours, minutes, 0, 0);

        // Calculate 1 hour before
        const oneHourBefore = new Date(sessionStart.getTime() - 60 * 60 * 1000);

        // If current time is BEFORE the 1-hour mark, hide the link
        if (now < oneHourBefore) {
          updated.meetingLinkOrLocation = "Link will be shared soon";
        }

        return updated;
      });
    }

    // For OFFLINE batches, we send everything as is (no restrictions)
    return sendResponse(res, 200, true, "Sessions retrieved.", sessions);

  } catch (err) {
    console.error("getSessionForABatchForStudent err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};



/**
 * Controller: getTodayLiveBatchInfoForStudent
 */




/**
 * Controller: getTodayLiveBatchInfoForStudent
 * Rules:
 *  - ONLINE batch → hide fields if totalCredit < 1000
 *  - OFFLINE batch → hide fields if totalCredit < 1500
 *  - Hidden fields: title, description, meetingLinkOrLocation
 */
export const getTodayLiveBatchInfoForStudent = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batch_obj_id } = req.body;

    if (!batch_obj_id)
      return sendResponse(res, 400, false, "batch_obj_id required.");

    // 1. CHECK ENROLLMENT
    const isEnrolled = await BatchStudentRelation.exists({
      student_obj_id: studentId,
      batch_obj_id
    });

    if (!isEnrolled)
      return sendResponse(res, 403, false, "Not enrolled in this batch.");

    // 2. FETCH BATCH
    const batch = await Batch.findById(batch_obj_id);
    if (!batch)
      return sendResponse(res, 404, false, "Batch not found.");

    // 3. FIND TODAY'S SESSION
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaysSession = await BatchSession.findOne({
      batch_obj_id: batch._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    // 4. FIND NEXT SESSION (For display purposes)
    const nextSession = await BatchSession.findOne({
      batch_obj_id: batch._id,
      date: { $gt: endOfDay }
    }).sort({ date: 1 });

    // Prepare common response data
    const responseData = {
      batch_obj_id: batch._id,
      batchName: batch.batchName || batch.cohort, // Fallback if name is missing
      batchType: batch.batchType,
      defaultLocation: batch.batchType === "OFFLINE" ? batch.classLocation : "Online",
      nextClassDate: nextSession ? nextSession.date.toDateString() : "Not scheduled",
    };

    // CASE 1 — NO CLASS TODAY
    if (!todaysSession) {
      return sendResponse(res, 200, true, "Info retrieved.", {
        ...responseData,
        hasClassToday: false,
        sessionDetails: null
      });
    }

    // CASE 2 — CLASS IS TODAY
    // Return full details without any credit checks/restrictions
    return sendResponse(res, 200, true, "Info retrieved.", {
      ...responseData,
      hasClassToday: true,
      sessionDetails: todaysSession
    });

  } catch (err) {
    console.error("getTodayLiveBatchInfoForStudent err", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};

