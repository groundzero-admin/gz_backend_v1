import BatchStudentRelation from "../models/BatchStudentRelation.js";
import BatchStatus from "../models/BatchStatus.js";
import Batch from "../models/Batch.js";
import BatchSession from "../models/BatchSession.js";
import Attendance from "../models/Attendance.js";
import { sendResponse } from "../middleware/auth.js";

export const remainingSessionInfoBatchForStudent = async (req, res) => {
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

    // 2. Filter which of these are actually "LIVE"
    const liveStatuses = await BatchStatus.find({ 
      batch_obj_id: { $in: enrolledIds }, 
      status: "LIVE" 
    }).select("batch_obj_id").lean();

    if (!liveStatuses.length) {
      return sendResponse(res, 200, true, "No live batches found.", []);
    }

    const liveBatchIds = liveStatuses.map(s => s.batch_obj_id);

    // 3. Fetch full details for these batches
    const batches = await Batch.find({ _id: { $in: liveBatchIds } }).lean();

    // 4. Calculate Attendance & Format Response
    // We use Promise.all to handle the async attendance counting for each batch concurrently
    const formattedBatches = await Promise.all(batches.map(async (batch) => {
      
      // --- A. Find all Session IDs belonging to this specific Batch ---
      const batchSessions = await BatchSession.find({ batch_obj_id: batch._id })
        .select("_id")
        .lean();
        
      const sessionIds = batchSessions.map(s => s._id);

      // --- B. Count how many of THESE sessions the student was "PRESENT" for ---
      const attendedCount = await Attendance.countDocuments({
        student_obj_id: studentId,
        session_obj_id: { $in: sessionIds }, // Check only sessions from this batch
        status: "PRESENT"
      });

      // --- C. Calculate Remaining (Formula: 12 - Attended) ---
      // Ensure it doesn't go below 0 if they somehow attended more than 12
      const remaining = Math.max(0, 12 - attendedCount);

      // --- D. Construct Response Object ---
      const batchData = {
        batch_obj_id: batch._id,
        batchName: batch.batchName,
        level: batch.level,
        startDate: batch.startDate,
        batchType: batch.batchType,
        description: batch.description,
        
        // The New Field
        remaining_classes: remaining
      };

      // Add Offline-specific fields if needed
      if (batch.batchType === 'OFFLINE') {
        batchData.classLocation = batch.classLocation;
        batchData.cityCode = batch.cityCode;
      }

      return batchData;
    }));

    return sendResponse(res, 200, true, "Live batches with remaining sessions retrieved.", formattedBatches);

  } catch (err) {
    console.error("remainingSessionInfoBatchForStudent error:", err);
    return sendResponse(res, 500, false, "Server error retrieving batch info.");
  }
};