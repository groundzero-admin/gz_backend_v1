import bcrypt from "bcrypt";
import {  sendResponse, signToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import Invitation from "../models/Invitation.js";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "email & password required" });

    const e = String(email).toLowerCase().trim();

    // ADMIN LOGIN
    const admin = await Admin.findOne({ email: e });
    if (admin) {
      const ok = await bcrypt.compare(password, admin.password);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

      const token = signToken(
        { id: admin._id.toString(), role: "admin", email: admin.email },
        "7d"
      );
     res.cookie("auth_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 3600 * 1000,
});

      return res.status(200).json({
        success: true,
        message: "Admin logged in",
        role: "admin",
      });
    }

    // STUDENT LOGIN
    const student = await Student.findOne({ email: e });
    if (student) {
      const ok = await bcrypt.compare(password, student.password);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

      const token = signToken(
        { id: student._id.toString(), role: "student", email: student.email },
        "7d"
      );
    res.cookie("auth_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 3600 * 1000,
});

      return res.status(200).json({
        success: true,
        message: "Student logged in",
        role: "student",
      });
    }

    // TEACHER LOGIN
    const teacher = await Teacher.findOne({ email: e });
    if (teacher) {
      const ok = await bcrypt.compare(password, teacher.password);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

      const token = signToken(
        { id: teacher._id.toString(), role: "teacher", email: teacher.email },
        "7d"
      );
   res.cookie("auth_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 3600 * 1000,
});

      return res.status(200).json({
        success: true,
        message: "Teacher logged in",
        role: "teacher",
      });
    }

    // PARENT LOGIN
    const parent = await Parent.findOne({ email: e });
    if (parent) {
      const ok = await bcrypt.compare(password, parent.password);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

      const token = signToken(
        { id: parent._id.toString(), role: "parent", email: parent.email },
        "7d"
      );
   res.cookie("auth_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 3600 * 1000,
});

      return res.status(200).json({
        success: true,
        message: "Parent logged in",
        role: "parent",
      });
    }

    // INVITATION PENDING
    const inv = await Invitation.findOne({ email: e });
    if (inv)
      return res.status(403).json({
        success: false,
        message: "Invitation pending. Check email for OTP/link",
      });

    // ACCOUNT NOT FOUND
    return res.status(404).json({ success: false, message: "Account not found" });
  } catch (err) {
    console.error("login err", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};





export const logoutUser = (req, res) => {
  res.clearCookie("auth_token");
  return sendResponse(res, 200, true, "Logged out");
};





export const whoAmI = async (req, res) => {
  // This controller is only reached if requireAuthCookie middleware succeeds
  try {
    const { id, role } = req.authPayload;
    let user = null;

    // Find the user in the correct collection
    if (role === 'admin') {
      user = await Admin.findById(id).select("name email role");
    } else if (role === 'student') {
      user = await Student.findById(id).select("name email role student_number");
    } else if (role === 'teacher') {
      user = await Teacher.findById(id).select("name email role");
    } else if (role === 'parent') {
      user = await Parent.findById(id).select("name email role");
    }

    if (!user) {
      // This is a rare case where the token is valid but the user was deleted
      res.clearCookie("auth_token");
      return sendResponse(res, 404, false, "User in token not found. Token cleared.");
    }

   

    // Success: return the user's details
    return sendResponse(res, 200, true, "User authenticated", {
      name: user.name,
      email: user.email,
      role: role
    });

  } catch (err) {
    console.error("whoAmI err", err);
    return sendResponse(res, 500, false, "Server error validating user");
  }
};


















// checmingrole check 
export const checkRole = async (req, res) => {
  // This controller is only reached if requireAuthCookie middleware succeeds
  try {
    // 1. Get the role from the frontend request body
    const { role: roleFromFrontend } = req.body;

    // 2. Get the *actual* user data from the verified token
    const { role: actualRole, id: userId, email: userEmail } = req.authPayload;

    if (!roleFromFrontend) {
      return sendResponse(res, 400, false, "Role is required in the request body.");
    }

    // 3. Compare the roles
    if (actualRole === roleFromFrontend) {
      // SUCCESS: Roles match
      
      // Fetch user's name for the response data
      let user;
      if (actualRole === 'admin') user = await Admin.findById(userId).select("name");
      else if (actualRole === 'student') user = await Student.findById(userId).select("name  student_number");
      else if (actualRole === 'teacher') user = await Teacher.findById(userId).select("name");
      else if (actualRole === 'parent') user = await Parent.findById(userId).select("name");
      
      const username = user ? user.name : "Unknown"; // Fallback

      return sendResponse(res, 200, true, "Role verified.", {
        username: username,
        role: actualRole,
        email: userEmail,
        student_number :  user.student_number ? user.student_number : "missing student roll number" 

      });

    } else {
      // FAILURE: Roles do not match
      return sendResponse(res, 403, false, "Unauthorized access. You are not allowed.", {
        correctRole: actualRole,
      });
    }

  } catch (err) {
    console.error("checkRole err", err);
    return sendResponse(res, 500, false, "Server error checking role.");
  }
};