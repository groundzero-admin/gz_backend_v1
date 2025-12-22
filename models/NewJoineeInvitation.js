import mongoose from "mongoose";

const newJoineeInvitationSchema = new mongoose.Schema({
  course_order_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "CourseOrder", 
    required: true,
    unique: true 
  },
  studentEmail: { type: String, required: true },
  
  // --- NEW: Store Batches to Enroll ---
  enroll_batches: [
    {
      batch_obj_id: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
      batchName: String
    }
  ],

  // Security Tokens
  magicLinkToken: { type: String, required: true }, 
  otp: { type: String, required: true }, 
  
  createdAt: { type: Date, default: Date.now }
});

const NewJoineeInvitation = mongoose.model("NewJoineeInvitation", newJoineeInvitationSchema);
export default NewJoineeInvitation;