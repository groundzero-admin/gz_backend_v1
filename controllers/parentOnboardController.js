import crypto from "crypto";
import bcrypt from "bcrypt";
import { Resend } from "resend"; 
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import ParentInvitation from "../models/ParentInvitation.js";
import { sendResponse } from "../middleware/auth.js";

const resend = new Resend(process.env.RESEND_EMAIL_API_KEY );



/**
 * 1. ADMIN: Invite Parent
 * Input: { parentEmail, studentEmail }
 * Logic: Check duplicates -> Generate Token/OTP -> Save Invite -> Send Email
 */
export const inviteParent = async (req, res) => {
  try {
    const { parentEmail, studentEmail } = req.body;

    if (!parentEmail || !studentEmail) {
      return sendResponse(res, 400, false, "Parent Email and Student Email are required.");
    }

    // A. Check if Student actually exists (Optional, but safer)
    const studentExists = await Student.findOne({ email: studentEmail });
    if (!studentExists) {
      return sendResponse(res, 404, false, `Student with email ${studentEmail} not found.`);
    }

    // B. Check if Parent Account already exists
    // If yes, you might just want to link them directly? 
    // For this flow, we assume we only invite NEW parents.
    const existingParent = await Parent.findOne({ email: parentEmail });
    if (existingParent) {
      // Logic choice: If parent exists, maybe just link them?
      // For now, let's block invite to avoid confusion.
      return sendResponse(res, 409, false, "Parent account already exists. Please link manually.");
    }

    // C. Check if this specific invite (Parent + Student) is already pending
    // We remove old invites to avoid clutter
    await ParentInvitation.deleteMany({ parentEmail, studentEmail });

    // D. Generate Token & OTP
    const magicLinkToken = crypto.randomUUID();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // E. Save Invitation
    await ParentInvitation.create({
      parentEmail,
      studentEmail,
      magicLinkToken,
      otp
    });

    // F. Send Email
    const inviteLink = `${process.env.FRONTEND_BASE}/parent-signup?token=${magicLinkToken}`;

    await resend.emails.send({
      from:   process.env.SMTP_USER   , // Update this
      to: parentEmail,
      subject: "Invitation to Join Parent Portal",
      html: `
        <p>You have been invited to join as a Parent for student: <strong>${studentEmail}</strong>.</p>
        <p><strong>Your OTP:</strong> ${otp}</p>
        <p>Click the link below to set up your account:</p>
        <a href="${inviteLink}">${inviteLink}</a>
      `
    });


    console.log(inviteLink , otp )

    return sendResponse(res, 200, true, "Invitation sent to parent.", { 
      debug_otp: otp, 
      debug_link: inviteLink 
    });

  } catch (err) {
    console.error("inviteParent error:", err);
    return sendResponse(res, 500, false, "Server error sending invitation.");
  }
};

/**
 * 2. PUBLIC: Validate Parent Invite Token
 * Input: Query Param ?token=...
 * Logic: Check DB -> Return parentEmail & studentEmail for frontend to display
 */
export const validateParentInvite = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendResponse(res, 400, false, "Token is required.");
    }

    const invitation = await ParentInvitation.findOne({ magicLinkToken: token });

    if (!invitation) {
      return sendResponse(res, 404, false, "Invalid or expired invitation link.");
    }

    // Return info to pre-fill/lock frontend fields
    return sendResponse(res, 200, true, "Token valid.", {
      parentEmail: invitation.parentEmail,
      studentEmail: invitation.studentEmail
    });

  } catch (err) {
    console.error("validateParentInvite error:", err);
    return sendResponse(res, 500, false, "Server error validating token.");
  }
};

/**
 * 3. PUBLIC: Onboard Parent
 * Input: { token, otp, password, name, mobile }
 * Logic: Verify -> Create Parent -> Create Relation -> Delete Invite
 */
export const onboardParent = async (req, res) => {
  try {
    const { token, otp, password, name, mobile } = req.body;

    // 1. Validation
    if (!token || !otp || !password || !name) {
      return sendResponse(res, 400, false, "Missing required fields.");
    }

    // 2. Verify Invitation
    const invitation = await ParentInvitation.findOne({ magicLinkToken: token });
    if (!invitation) return sendResponse(res, 404, false, "Invalid invitation.");
    if (String(invitation.otp) !== String(otp)) return sendResponse(res, 401, false, "Incorrect OTP.");

    // 3. Double-check if Parent already exists (Race condition safety)
    const existingParent = await Parent.findOne({ email: invitation.parentEmail });
    if (existingParent) {
      await ParentInvitation.findByIdAndDelete(invitation._id);
      return sendResponse(res, 409, false, "Parent account already exists.");
    }

    // 4. Create Parent Account
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newParent = await Parent.create({
      name,
      email: invitation.parentEmail,
      password: hashedPassword,
      mobile: mobile || "",
      role: "parent"
    });

    // 5. Create Relation (Link to Child)
    // We use findOneAndUpdate with upsert to avoid errors if link somehow exists
    await StudentParentRelation.findOneAndUpdate(
      { 
        studentEmail: invitation.studentEmail, 
        parentEmail: invitation.parentEmail 
      },
      { createdAt: new Date() },
      { upsert: true, new: true }
    );

    // 6. Cleanup Invitation
    await ParentInvitation.findByIdAndDelete(invitation._id);

    return sendResponse(res, 201, true, "Parent onboarding successful!", {
      parentId: newParent._id,
      linkedStudent: invitation.studentEmail
    });

  } catch (err) {
    console.error("onboardParent error:", err);
    return sendResponse(res, 500, false, "Server error onboarding parent.");
  }
};