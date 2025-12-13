import mongoose from "mongoose";

const studentCreditSchema = new mongoose.Schema({
  student_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student", 
    required: true 
  },
  studentEmail: { type: String, required: true },
  
  // Financials
  amount: { type: Number, required: true }, // The amount paid
  currency: { type: String, default: "INR" },
  
  // Source of this credit
  source: { type: String, default: "COURSE_ENROLLMENT" }, // Description
  course_order_id: { type: mongoose.Schema.Types.ObjectId, ref: "CourseOrder" }, // Link back to original order

  createdAt: { type: Date, default: Date.now }
});

const StudentCredit = mongoose.model("StudentCredit", studentCreditSchema);
export default StudentCredit;