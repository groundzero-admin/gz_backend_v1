import Doubt from "../models/Doubt.js";
import Student from "../models/Student.js";
import { sendResponse } from "../middleware/auth.js";

/**
 * ---------------------------------------------------
 * 1. RAISE DOUBT (Student Only)
 * POST /api/student/raisedoubt
 * Body: { batchId, doubt_content }
 * ---------------------------------------------------
 */
export const raiseDoubt = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batchId, doubt_content } = req.body;

    if (!batchId || !doubt_content) {
      return sendResponse(res, 400, false, "batchId and doubt_content are required.");
    }

    // Fetch Student to get the student_number
    const student = await Student.findById(studentId).select("student_number");
    if (!student) {
      return sendResponse(res, 404, false, "Student profile not found.");
    }

    const newDoubt = new Doubt({
      student_obj_id: studentId,
      student_number: student.student_number,
      batchId: batchId, // Frontend sends "SPA001" etc.
      doubt_content: doubt_content,
      isresolved: false
    });

    await newDoubt.save();

    return sendResponse(res, 201, true, "Doubt raised successfully.", newDoubt);

  } catch (err) {
    console.error("raiseDoubt err", err);
    return sendResponse(res, 500, false, "Server error raising doubt.");
  }
};

/**
 * ---------------------------------------------------
 * 2. GET MY DOUBTS (Student Only)
 * GET /api/student/mydoubts
 * Returns all doubts (resolved AND unresolved) for the student
 * ---------------------------------------------------
 */
export const getMyDoubts = async (req, res) => {
  try {
    const studentId = req.authPayload.id;

    // Find all doubts for this student, sorted newest first
    const doubts = await Doubt.find({ student_obj_id: studentId })
      .sort({ createdAt: -1 })
      .lean();

    return sendResponse(res, 200, true, "My doubts retrieved.", doubts);

  } catch (err) {
    console.error("getMyDoubts err", err);
    return sendResponse(res, 500, false, "Server error retrieving doubts.");
  }
};

/**
 * ---------------------------------------------------
 * 3. GET UNRESOLVED DOUBTS (Teacher Only)
 * GET /api/teacher/unresolveddoubts?batchId=... (Optional batchId)
 * Returns only unresolved doubts
 * ---------------------------------------------------
 */
export const getUnresolvedDoubts = async (req, res) => {
  try {
    const { batchId } = req.query;

    const query = { isresolved: false };
    
    if (batchId) {
      query.batchId = batchId;
    }

    // 1. Fetch doubts and POPULATE the student info
    const doubts = await Doubt.find(query)
      .sort({ createdAt: 1 })
      .populate({
        path: "student_obj_id", // The field in Doubt model
        select: "name email"    // The fields to get from Student model
      })
      .lean();

    // 2. Format the response
    // We map over the results to handle cases where a student might 
    // have been deleted (null check) and to format the JSON nicely.
    const formattedDoubts = doubts.map(doubt => {
      const student = doubt.student_obj_id; // This is now an object, not just an ID

      return {
        _id: doubt._id,
        doubt_content: doubt.doubt_content,
        batchId: doubt.batchId,
        student_number: doubt.student_number,
        isresolved: doubt.isresolved,
        createdAt: doubt.createdAt,
        
        // Extracted Student Details
        studentName: student ? student.name : "Unknown/Deleted Student",
        studentEmail: student ? student.email : "N/A",
        student_obj_id: student ? student._id : null
      };
    });

    return sendResponse(res, 200, true, "Unresolved doubts retrieved.", formattedDoubts);

  } catch (err) {
    console.error("getUnresolvedDoubts err", err);
    return sendResponse(res, 500, false, "Server error retrieving doubts.");
  }
};

/**
 * ---------------------------------------------------
 * 4. RESOLVE DOUBT (Teacher Only)
 * POST /api/teacher/resolvedoubt
 * Body: { doubtId }
 * ---------------------------------------------------
 */export const resolveDoubt = async (req, res) => {
  try {
    const { doubtId } = req.body;

    if (!doubtId) {
      return sendResponse(res, 400, false, "doubtId is required.");
    }

    const doubt = await Doubt.findByIdAndUpdate(
      doubtId,
      { 
        isresolved: true,
        createdAt: new Date() // <-- Updates the time to now
      },
      { new: true }
    );

    if (!doubt) {
      return sendResponse(res, 404, false, "Doubt not found.");
    }

    return sendResponse(res, 200, true, "Doubt marked as resolved.", doubt);

  } catch (err) {
    console.error("resolveDoubt err", err);
    return sendResponse(res, 500, false, "Server error resolving doubt.");
  }
};