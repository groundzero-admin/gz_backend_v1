import mongoose from "mongoose";

const newJoineeInvitationSchema = new mongoose.Schema({
  course_order_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "CourseOrder", 
    required: true,
    unique: true // One active invitation per order
  },
  studentEmail: { type: String, required: true },
  
  // Security Tokens
  magicLinkToken: { type: String, required: true }, // UUID for the URL
  otp: { type: String, required: true }, // 6-digit code
  
  // REMOVED: expiresAt field
  
  createdAt: { type: Date, default: Date.now }
});

const NewJoineeInvitation = mongoose.model("NewJoineeInvitation", newJoineeInvitationSchema);
export default NewJoineeInvitation;