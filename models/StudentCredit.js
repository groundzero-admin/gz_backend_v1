import mongoose from "mongoose";

const studentCreditSchema = new mongoose.Schema({
  student_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student", 
    required: true,
    unique: true // Ensures one wallet per student
  },
  studentEmail: { type: String, required: true },
  
  // --- NEW: Split Credits ---
  amount_for_online: { type: Number, default: 0 },
  amount_for_offline: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

const StudentCredit = mongoose.model("StudentCredit", studentCreditSchema);
export default StudentCredit;