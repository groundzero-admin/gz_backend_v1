import bcrypt from "bcrypt";
import { sendResponse, verifyTokenSafe } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import Invitation from "../models/Invitation.js";

export const validateInvite = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const role = req.body.role || req.query.role;
    if (!token) return sendResponse(res, 400, false, "token required");

    const decoded = verifyTokenSafe(token);
    if (!decoded || !decoded.email || !decoded.role) return sendResponse(res, 400, false, "Invalid or expired token");

    const invite = await Invitation.findOne({ token });
    if (!invite) return sendResponse(res, 404, false, "Invitation not found");
    // if (invite.expiresAt < new Date()) return sendResponse(res, 410, false, "Invitation expired");
    if (role != invite.role) return sendResponse(res, 400, false, "Role mismatch");
    
    return sendResponse(res, 200, true, "Valid invitation", { email: invite.email, role: invite.role });
  } catch (err) {
    console.error("invite-validate err", err);
    return sendResponse(res, 500, false, "Server error");
  }
};





export const onboardUser = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const roleFromReq = req.body.role || req.query.role;
    const { otp } = req.body;
    if (!token || !otp)
      return sendResponse(res, 400, false, "token and otp required");

    const decoded = verifyTokenSafe(token);
    if (!decoded)
      return sendResponse(res, 400, false, "Invalid or expired token");

    if (roleFromReq && roleFromReq !== decoded.role)
      return sendResponse(res, 400, false, "Role mismatch");

    const invite = await Invitation.findOne({ token });
    if (!invite) return sendResponse(res, 404, false, "Invitation not found");
    // if (invite.expiresAt < new Date())
    //   return sendResponse(res, 410, false, "Invitation expired");
    if (String(invite.otp) !== String(otp))
      return sendResponse(res, 400, false, "Invalid OTP");

    const targetRole = invite.role; // trusted
    const email = invite.email;

    // common checks
    const already = await Promise.all([
      Student.findOne({ email }),
      Teacher.findOne({ email }),
      Parent.findOne({ email }),
      Admin.findOne({ email }),
    ]);
    if (already.some(Boolean)) {
      await Invitation.deleteOne({ _id: invite._id }); // avoid future reuse
      return sendResponse(res, 409, false, "Email already registered");
    }

    if (targetRole === "student") {
      const { name, password, mobile, age } = req.body;
      const studentClass = req.body.class;
      if (
        !name ||
        !password ||
        !mobile ||
        age === undefined ||
        studentClass === undefined
      )
        return sendResponse(res, 400, false, "Missing required student fields");
      if (isNaN(Number(studentClass)))
        return sendResponse(res, 400, false, "class must be a number");

      const hashed = await bcrypt.hash(password, 10);
      const student = new Student({
        name,
        email,
        password: hashed,
        role: "student",
        age: Number(age),
        mobile,
        class: Number(studentClass),
      });
      await student.save();

      // --- LOGIC REMOVED ---
      // Parent linking logic is no longer here.

      await Invitation.deleteOne({ _id: invite._id });
      return sendResponse(res, 201, true, "Student onboarded", {
        studentId: student._id,
      });
    }

    if (targetRole === "teacher") {
      const { name, password, mobile } = req.body;
      if (!name || !password || !mobile)
        return sendResponse(res, 400, false, "Missing required teacher fields");
      const hashed = await bcrypt.hash(password, 10);
      const teacher = new Teacher({
        name,
        email,
        password: hashed,
        role: "teacher",
        mobile,
      });
      await teacher.save();

      await Invitation.deleteOne({ _id: invite._id });
      return sendResponse(res, 201, true, "Teacher onboarded", {
        teacherId: teacher._id,
      });
    }

    if (targetRole === "parent") {
      const { name, password, mobile } = req.body;
      if (!name || !password || !mobile)
        return sendResponse(res, 400, false, "Missing required parent fields");
      const hashed = await bcrypt.hash(password, 10);
      const parent = new Parent({
        name,
        email,
        password: hashed,
        role: "parent",
        mobile,
      });
      await parent.save();

      // --- LOGIC REMOVED ---
      // Child linking logic is no longer here.

      await Invitation.deleteOne({ _id: invite._id });
      return sendResponse(res, 201, true, "Parent onboarded", {
        parentId: parent._id,
      });
    }

    return sendResponse(res, 400, false, "Unknown role");
  } catch (err) {
    console.error("onboard err", err);
    return sendResponse(res, 500, false, "Server error");
  }
};