import mongoose from "mongoose";

const parentInvitationSchema = new mongoose.Schema({
  parentEmail: { type: String, required: true },
  studentEmail: { type: String, required: true }, // Store child email to link later
  magicLinkToken: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now } // No expiry requested
});

// Ensure a parent can't be invited for the same student twice (optional but good)
parentInvitationSchema.index({ parentEmail: 1, studentEmail: 1 }, { unique: true });

const ParentInvitation = mongoose.model("ParentInvitation", parentInvitationSchema);
export default ParentInvitation;