import mongoose from "mongoose";

const teacherInvitationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  magicLinkToken: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now } // No expiry requested
});

const TeacherInvitation = mongoose.model("TeacherInvitation", teacherInvitationSchema);
export default TeacherInvitation;