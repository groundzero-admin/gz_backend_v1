import { sendResponse, signToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import Invitation from "../models/Invitation.js";
// import AccessRequest from "../models/AccessRequest.js";
import { Resend } from "resend";

const { RESEND_EMAIL_API_KEY, SMTP_USER, FRONTEND_BASE } = process.env;

const resend = new Resend(RESEND_EMAIL_API_KEY);

/**
 * -----------------------------------------------------------------
 * SUBMIT ACCESS REQUEST
 * -----------------------------------------------------------------
//  */
// export const requestAccess = async (req, res) => {
//   try {
//     const { name, email, role } = req.body;

//     if (!name || !email || !role) {
//       return sendResponse(res, 400, false, "Name, email, and role are required.");
//     }

//     if (!["student", "teacher", "parent"].includes(role)) {
//       return sendResponse(res, 400, false, "Invalid role specified.");
//     }

//     const e = String(email).toLowerCase().trim();

//     const used = await Promise.all([
//       Student.findOne({ email: e }),
//       Teacher.findOne({ email: e }),
//       Parent.findOne({ email: e }),
//       Admin.findOne({ email: e }),
//     ]);

//     if (used.some(Boolean)) {
//       return sendResponse(res, 409, false, "This email is already registered. Please try logging in.");
//     }

//     const existingRequest = await AccessRequest.findOne({ email: e });

//     if (existingRequest) {
//       if (existingRequest.resolved) {
//         return sendResponse(res, 200, true, "We have already sent you an invitation. Please check your email again.");
//       }

//       return sendResponse(res, 200, true, "Your request is still pending review.");
//     }

//     await AccessRequest.create({ name, email: e, role });

//     return sendResponse(res, 201, true, "Access request submitted successfully.");
//   } catch (err) {
//     console.error("requestAccess err", err);
//     return sendResponse(res, 500, false, "Server error submitting request.");
//   }
// };

/**
 * -----------------------------------------------------------------
 * GET ALL ACCESS REQUESTS
 * -----------------------------------------------------------------
//  */
// export const getAllAccessRequests = async (req, res) => {
//   try {
//     const requests = await AccessRequest.find({})
//       .sort({ requestedAt: 1 })
//       .select("_id name email role resolved requestedAt")
//       .lean();

//     return sendResponse(res, 200, true, "Access requests retrieved.", requests);
//   } catch (err) {
//     console.error("getAllAccessRequests err", err);
//     return sendResponse(res, 500, false, "Server error retrieving requests.");
//   }
// };

/**
 * -----------------------------------------------------------------
 * INVITATION SENDER (specific to AccessRequest flow)
 * -----------------------------------------------------------------
 */
export const createAndSendInvitation = async (email, role, req, parentEmails = [], childEmails = []) => {
  const e = String(email).toLowerCase().trim();

  if (!["student", "teacher", "parent"].includes(role)) {
    throw new Error("Invalid role specified.");
  }

  await Invitation.findOneAndDelete({ email: e });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const token = signToken({ email: e, role }, "15m");
  // const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const inviteDoc = new Invitation({
    email: e,
    role,
    otp,
    token,
    // expiresAt,
    parentEmails: Array.isArray(parentEmails)
      ? parentEmails.map(x => String(x).toLowerCase().trim())
      : [],
    childEmails: Array.isArray(childEmails)
      ? childEmails.map(x => String(x).toLowerCase().trim())
      : []
  });

  await inviteDoc.save();

  const link = `${FRONTEND_BASE}/invite/onboard?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;

  const html = `<p>You have been invited as <b>${role}</b>.</p>
                <p>OTP (valid 15m): <b>${otp}</b></p>
                <p>Validate link: <a href="${link}">${link}</a></p>`;

  // --- RESEND MAIL SEND ---
  await resend.emails.send({
    from: SMTP_USER,
    to: e,
    subject: `Invite as ${role}`,
    html,
  });

  return inviteDoc;
};

/**
 * -----------------------------------------------------------------
 * ADMIN ACTION REQUEST
 * -----------------------------------------------------------------
//  */
// export const actionRequest = async (req, res) => {
//   try {
//     const { requestId, action } = req.body;

//     if (!requestId || !action) {
//       return sendResponse(res, 400, false, "requestId and action are required.");
//     }

//     if (String(action).toLowerCase() !== "allow") {
//       return sendResponse(res, 400, false, "Invalid action. Only 'allow' is permitted.");
//     }

//     const request = await AccessRequest.findById(requestId);

//     if (!request) {
//       return sendResponse(res, 404, false, "Access request not found.");
//     }

//     if (request.resolved) {
//       return sendResponse(res, 409, false, "Invitation has already been sent to this email.");
//     }

//     try {
//       await createAndSendInvitation(request.email, request.role, req);

//       request.resolved = true;
//       await request.save();

//       return sendResponse(res, 200, true, `Invitation sent to ${request.email}.`);
//     } catch (err) {
//       return sendResponse(res, 409, false, err.message);
//     }
//   } catch (err) {
//     console.error("actionRequest err", err);
//     return sendResponse(res, 500, false, "Server error processing action.");
//   }
// };
