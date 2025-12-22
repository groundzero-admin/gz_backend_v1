import crypto from "crypto";
import bcrypt from "bcrypt";
import { Resend } from "resend"; // Assuming you use Resend
import Teacher from "../models/Teacher.js";
import TeacherInvitation from "../models/TeacherInvitation.js";
import TeacherStudentCounter from "../models/TeacherStudentCounter.js";
import { sendResponse } from "../middleware/auth.js";

const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);

// --- Helper: Auto-Increment ID ---
const getNextTeacherNumber = async () => {
  const key = "teacher";
  const prefix = "GZTR"; // Consistent with GZST

  let counter = await TeacherStudentCounter.findOne({ key });

  if (!counter) {
    counter = new TeacherStudentCounter({ key, count: 0 });
  }

  counter.count += 1;
  await counter.save();

  const padded = String(counter.count).padStart(3, "0");
  return prefix + padded; // Returns GZTR001, GZTR002...
};

/**
 * 1. ADMIN: Invite Teacher
 * Input: { email }
 * Logic: Generate Token + OTP -> Save to DB -> Send Email
 */
export const inviteTeacher = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, "Teacher email is required.");
    }

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return sendResponse(res, 409, false, "Teacher with this email already exists.");
    }

    // Generate Magic Link Token & OTP
    const magicLinkToken = crypto.randomUUID();
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    // Save/Upsert Invitation
    await TeacherInvitation.findOneAndUpdate(
      { email },
      { magicLinkToken, otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send Email (Resend)
    const inviteLink = `${process.env.FRONTEND_BASE}/teacher-signup?token=${magicLinkToken}`;

    await resend.emails.send({
      from: process.env.SMTP_USER, // Update this
      to: email,
      subject: "Teacher Invitation",
      html: `
        <p>You have been invited to join as a Teacher.</p>
        <p><strong>Your OTP:</strong> ${otp}</p>
        <p>Click here to complete registration:</p>
        <a href="${inviteLink}">${inviteLink}</a>
      `
    });


    console.log(inviteLink , otp   )

    return sendResponse(res, 200, true, "Invitation sent successfully!", { 
       // Only for testing/debugging, remove in prod
       debug_otp: otp, 
       debug_link: inviteLink 
    });

  } catch (err) {
    console.error("inviteTeacher error:", err);
    return sendResponse(res, 500, false, "Server error sending invitation.");
  }
};

/**
 * 2. PUBLIC: Validate Invite Token
 * Input: Query Param ?token=...
 * Logic: Check DB -> Return Email if valid
 */
export const validateTeacherInvite = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendResponse(res, 400, false, "Token is required.");
    }

    const invitation = await TeacherInvitation.findOne({ magicLinkToken: token });

    if (!invitation) {
      return sendResponse(res, 404, false, "Invalid or invalid invitation link.");
    }

    return sendResponse(res, 200, true, "Token is valid.", {
      email: invitation.email // Return email so frontend can auto-fill it
    });

  } catch (err) {
    console.error("validateTeacherInvite error:", err);
    return sendResponse(res, 500, false, "Server error validating token.");
  }
};

/**
 * 3. PUBLIC: Onboard Teacher
 * Input: { token, otp, password, name, mobile }
 * Logic: Verify OTP -> Create Teacher (Auto ID) -> Delete Invite
 */
export const onboardTeacher = async (req, res) => {
  try {
    const { token, otp, password, name, mobile } = req.body;

    // Validation
    if (!token || !otp || !password || !name || !mobile) {
      return sendResponse(res, 400, false, "All fields (Token, OTP, Password, Name, Mobile) are required.");
    }

    // Verify Invite
    const invitation = await TeacherInvitation.findOne({ magicLinkToken: token });
    if (!invitation) {
      return sendResponse(res, 404, false, "Invalid invitation.");
    }

    if (String(invitation.otp) !== String(otp)) {
      return sendResponse(res, 401, false, "Incorrect OTP.");
    }

    // Verify Duplicate again (Edge case)
    const existing = await Teacher.findOne({ email: invitation.email });
    if (existing) {
      await TeacherInvitation.findByIdAndDelete(invitation._id);
      return sendResponse(res, 409, false, "Account already exists.");
    }

    // Generate Teacher Number (GZTR001...)
    const teacher_number = await getNextTeacherNumber();

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Teacher
    const newTeacher = await Teacher.create({
      name,
      email: invitation.email,
      password: hashedPassword,
      mobile,
      role: "teacher",
      teacher_number: teacher_number
    });

    // Cleanup Invitation
    await TeacherInvitation.findByIdAndDelete(invitation._id);

    return sendResponse(res, 201, true, "Teacher onboarding successful!", {
      teacherId: newTeacher._id,
      teacher_number: teacher_number,
      email: newTeacher.email
    });

  } catch (err) {
    console.error("onboardTeacher error:", err);
    return sendResponse(res, 500, false, "Server error onboarding teacher.");
  }
};