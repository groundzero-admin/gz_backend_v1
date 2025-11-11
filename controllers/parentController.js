// controllers/parentController.js
import { sendResponse } from "../middleware/auth.js";
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";

/**
 * GET /api/parent/mychildrendetails
 * Protected Route: requireAuthCookie, requireParent
 * Fetches all student details linked to the authenticated parent.
 */
export const getMyChildrenDetails = async (req, res) => {
  try {
    // 1. Get parent's email from the auth token.
    // We know this exists because requireParent middleware passed.
    const parentEmail = req.authPayload.email;

    // 2. Find all relation entries for this parent
    const relations = await StudentParentRelation.find({ 
      parentEmail: parentEmail 
    }).lean(); // .lean() for faster, plain JS objects

    if (!relations || relations.length === 0) {
      // This parent is not linked to any children
      return sendResponse(res, 200, true, "No linked children found.", []);
    }

    // 3. Extract all the student emails from the relations
    const studentEmails = relations.map(rel => rel.studentEmail);

    // 4. Find all student documents that match those emails
    // We use .select("-password") to exclude the sensitive password hash
    const childrenDetails = await Student.find({
      email: { $in: studentEmails }
    }).select("-password"); 

    // 5. Return the list of student details
    return sendResponse(res, 200, true, "Children details retrieved.", childrenDetails);

  } catch (err) {
    console.error("getMyChildrenDetails err", err);
    return sendResponse(res, 500, false, "Server error retrieving children details.");
  }
};