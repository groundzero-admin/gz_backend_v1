
import { sendResponse , signToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import nodemailer from "nodemailer";


import AccessRequest from "../models/AccessRequest.js"; // <-- 1. ADD THIS IMPORT
import Invitation from "../models/Invitation.js";





export const requestAccess = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return sendResponse(res, 400, false, "Name, email, and role are required.");
    }

    if (!["student", "teacher", "parent"].includes(role)) {
      return sendResponse(res, 400, false, "Invalid role specified.");
    }

    const e = String(email).toLowerCase().trim();

    // 1. Check if email is already registered in ANY user table
    const used = await Promise.all([
      Student.findOne({ email: e }),
      Teacher.findOne({ email: e }),
      Parent.findOne({ email: e }),
      Admin.findOne({ email: e }),
    ]);

    if (used.some(Boolean)) {
      return sendResponse(res, 409, false, "This email is already registered. Please try logging in.");
    }

    // 2. Check if a request has already been submitted
    const existingRequest = await AccessRequest.findOne({ email: e });
    if (existingRequest) {
      
      // --- START: MODIFIED LOGIC ---
      // If the request was already resolved/approved
      if (existingRequest.resolved) {
        return sendResponse(res, 200, true, "We have already sent you an invitation. Please check your mail again.");
      }
      
      // If the request exists but is still pending
      return sendResponse(res, 200, true, "Your request is still pending review. An admin will process it shortly.");
      // --- END: MODIFIED LOGIC ---
    }

    // 3. Create the new access request (it will default to resolved: false)
    await AccessRequest.create({
      name,
      email: e,
      role,
    });

    return sendResponse(res, 201, true, "Access request submitted successfully. An admin will review it shortly.");

  } catch (err) {
    console.error("requestAccess err", err);
    return sendResponse(res, 500, false, "Server error submitting request.");
  }
};

















export const getAllAccessRequests = async (req, res) => {
  try {
    const requests = await AccessRequest.find({})
      .sort({ requestedAt: 1 }) // 1 = ascending order (earliest first)
      .select("_id name email role resolved requestedAt") // Select specific fields
      .lean(); // .lean() for faster, plain JS objects

    return sendResponse(res, 200, true, "Access requests retrieved.", requests);

  } catch (err) {
    console.error("getAllAccessRequests err", err);
    return sendResponse(res, 500, false, "Server error retrieving requests.");
  }
};



















// --- Setup NodeMailer Transporter ---
const { SMTP_USER, SMTP_PASS } = process.env;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});


// --- 1. SUPPORTING FUNCTION ---

export const createAndSendInvitation = async (email, role, req, parentEmails = [], childEmails = []) => {
  const e = String(email).toLowerCase().trim();
  if (!["student", "teacher", "parent"].includes(role)) {
    throw new Error("Invalid role specified.");
  }

  // Optimized: Check for an existing invite and delete it
  await Invitation.findOneAndDelete({ email: e });

  // Create new invitation
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const token = signToken({ email: e, role }, "15m");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const inviteDoc = new Invitation({
    email: e,
    role,
    otp,
    token,
    expiresAt,
    parentEmails: Array.isArray(parentEmails) ? parentEmails.map(x => String(x).toLowerCase().trim()) : [],
    childEmails: Array.isArray(childEmails) ? childEmails.map(x => String(x).toLowerCase().trim()) : []
  });
  await inviteDoc.save();

  // Send email
  const link = `http://localhost:5173/invite/onboard?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;
  const html = `<p>You have been invited as <b>${role}</b>.</p>
                <p>OTP (valid 15m): <b>${otp}</b></p>
                <p>Validate link: <a href="${link}">${link}</a></p>`;
  await transporter.sendMail({ from: SMTP_USER, to: e, subject: `Invite as ${role}`, html });

  return inviteDoc;
};


// --- 2. CONTROLLER FUNCTION (Updated) ---

/*
* Admin-only route to action an access request.
* POST /api/admin/actionrequest
* Body: { requestId, action: "allow" }
*/
export const actionRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body;

    if (!requestId || !action) {
      return sendResponse(res, 400, false, "requestId and action are required.");
    }

    if (String(action).toLowerCase() !== "allow") {
      return sendResponse(res, 400, false, "Invalid action. Only 'allow' is permitted.");
    }

    const request = await AccessRequest.findById(requestId);
    if (!request) {
      return sendResponse(res, 404, false, "Access request not found.");
    }

    // --- CHECK ADDED ---
    // If the request has already been resolved, don't send another invite.
    if (request.resolved) {
      return sendResponse(res, 409, false, "Invitation has already been sent to this email.");
    }
    // --- END OF CHECK ---

    // Handle the "allow" case
    try {
      // 1. Send the invitation
      await createAndSendInvitation(request.email, request.role, req);
      
      // 2. Mark as resolved
      request.resolved = true;
      await request.save();
      
      return sendResponse(res, 200, true, `Invitation sent to ${request.email}.`);
    } catch (err) {
      // Send the actual error message back (e.g., if mail server fails)
      return sendResponse(res, 409, false, err.message); 
    }

  } catch (err) {
    console.error("actionRequest err", err);
    return sendResponse(res, 500, false, "Server error processing action.");
  }
};