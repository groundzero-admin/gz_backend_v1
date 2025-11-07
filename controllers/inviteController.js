import nodemailer from "nodemailer";
import { sendResponse, signToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import Invitation from "../models/Invitation.js";

const { SMTP_USER, SMTP_PASS } = process.env;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

export const createInvite = async (req, res) => {
  try {
    const { email, role, parentEmails = [], childEmails = [] } = req.body;
    if (!email || !role) return sendResponse(res, 400, false, "email and role required");
    const e = String(email).toLowerCase().trim();
    if (!["student", "teacher", "parent"].includes(role)) return sendResponse(res, 400, false, "invalid role");

    // don't allow invitation if email is already registered
    const used = await Promise.all([
      Student.findOne({ email: e }),
      Teacher.findOne({ email: e }),
      Parent.findOne({ email: e }),
      Admin.findOne({ email: e })
    ]);
    if (used.some(Boolean)) return sendResponse(res, 409, false, "Email already registered");

    // don't allow multiple outstanding invites
    const existingInvite = await Invitation.findOne({ email: e });
    if (existingInvite) return sendResponse(res, 409, false, "Invitation already exists for this email");

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

    // send email
    const link = `http://localhost:5173/invite/onboard?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;
    const html = `<p>You have been invited as <b>${role}</b>.</p>
                  <p>OTP (valid 15m): <b>${otp}</b></p>
                  <p>Validate link: <a href="${link}">${link}</a></p>`;
    await transporter.sendMail({ from: SMTP_USER, to: e, subject: `Invite as ${role}`, html });

    return sendResponse(res, 200, true, "Invitation created and email sent");
  } catch (err) {
    console.error("invite err", err);
    return sendResponse(res, 500, false, "Server error creating invitation");
  }
};