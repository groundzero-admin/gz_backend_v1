import mongoose from "mongoose";

const studentDirectInvitationSchema = new mongoose.Schema({
  studentEmail: { type: String, required: true, unique: true },
  parentEmail: { type: String, required: true },
  
  // Credits assigned by Admin
  amount_for_online: { type: Number, default: 0 },
  amount_for_offline: { type: Number, default: 0 },

  // --- NEW: Store Batches for Auto-Enrollment ---
  enroll_batches: [
    {
      batch_obj_id: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
      batchName: String
    }
  ],

  magicLinkToken: { type: String, required: true },
  otp: { type: String, required: true },
  
  createdAt: { type: Date, default: Date.now }
});

const StudentDirectInvitation = mongoose.model("StudentDirectInvitation", studentDirectInvitationSchema);
export default StudentDirectInvitation;