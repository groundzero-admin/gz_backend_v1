import Doubt from "../models/Doubt.js";
import Student from "../models/Student.js";
import { sendResponse } from "../middleware/auth.js";

/**
 * ---------------------------------------------------
 * 1. RAISE DOUBT (Student Only)
 * POST /api/student/raisedoubt
 * Body: { batch_obj_id, doubt_content }
 * ---------------------------------------------------
 */
export const raiseDoubt = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { batch_obj_id, doubt_content } = req.body;

    if (!batch_obj_id || !doubt_content) {
      return sendResponse(
        res,
        400,
        false,
        "batch_obj_id and doubt_content are required."
      );
    }

    // Fetch student_number snapshot
    const student = await Student.findById(studentId).select("student_number");
    if (!student) {
      return sendResponse(res, 404, false, "Student profile not found.");
    }

    const newDoubt = await Doubt.create({
      student_obj_id: studentId,
      student_number: student.student_number,
      batch_obj_id,
      doubt_content,
      isresolved: false
    });

    return sendResponse(res, 201, true, "Doubt raised successfully.", {
      _id: newDoubt._id,
      batch_obj_id: newDoubt.batch_obj_id,
      doubt_content: newDoubt.doubt_content,
      isresolved: newDoubt.isresolved,
      createdAt: newDoubt.createdAt
    });

  } catch (err) {
    console.error("raiseDoubt err", err);
    return sendResponse(res, 500, false, "Server error raising doubt.");
  }
};

/**
 * ---------------------------------------------------
 * 2. GET MY DOUBTS (Student Only)
 * GET /api/student/mydoubts
 * ---------------------------------------------------
 */
export const getMyDoubts = async (req, res) => {
  try {
    const studentId = req.authPayload.id;

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
 * GET /api/teacher/unresolveddoubts?batch_obj_id=...
 * ---------------------------------------------------
 */
export const getUnresolvedDoubts = async (req, res) => {
  try {
    const { batch_obj_id } = req.query;

    const query = { isresolved: false };
    if (batch_obj_id) {
      query.batch_obj_id = batch_obj_id;
    }

    const doubts = await Doubt.find(query)
      .sort({ createdAt: 1 })
      .populate({
        path: "student_obj_id",
        select: "name email"
      })
      .lean();

    const formattedDoubts = doubts.map(doubt => {
      const student = doubt.student_obj_id;

      return {
        _id: doubt._id,
        batch_obj_id: doubt.batch_obj_id,
        doubt_content: doubt.doubt_content,
        student_number: doubt.student_number,
        isresolved: doubt.isresolved,
        createdAt: doubt.createdAt,

        student_obj_id: student ? student._id : null,
        studentName: student ? student.name : "Unknown/Deleted Student",
        studentEmail: student ? student.email : "N/A"
      };
    });

    return sendResponse(
      res,
      200,
      true,
      "Unresolved doubts retrieved.",
      formattedDoubts
    );

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
 */
export const resolveDoubt = async (req, res) => {
  try {
    const { doubtId } = req.body;

    if (!doubtId) {
      return sendResponse(res, 400, false, "doubtId is required.");
    }

    const doubt = await Doubt.findByIdAndUpdate(
      doubtId,
      { isresolved: true },
      { new: true }
    );

    if (!doubt) {
      return sendResponse(res, 404, false, "Doubt not found.");
    }

    return sendResponse(
      res,
      200,
      true,
      "Doubt marked as resolved.",
      doubt
    );

  } catch (err) {
    console.error("resolveDoubt err", err);
    return sendResponse(res, 500, false, "Server error resolving doubt.");
  }
};
