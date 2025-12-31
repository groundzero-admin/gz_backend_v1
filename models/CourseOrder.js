import mongoose from "mongoose";

const courseOrderSchema = new mongoose.Schema({
  // --- 1. Parent Details ---
  parentName: { type: String, required: true },
  parentPhone: { type: String, required: true },
  parentEmail: { type: String, required: true },

  // --- 2. Student Details ---
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  board: { type: String, required: true }, // e.g., CBSE, ICSE
  classGrade: { type: String, required: true }, // 'class' is a reserved keyword in JS
  schoolName: { type: String, required: true },

  // --- 3. Order Details ---
  batchType: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE'], 
    required: true 
  },
  purchaseType: { 
    type: String, 
    enum: ['SINGLE_SESSION', 'FULL_BUNDLE'], 
    required: true 
  },
  
  // Financials
  amount: { type: Number, required: true }, // Store in Rupee (e.g., 1500)
  currency: { type: String, default: "inr" },

  // --- 4. Payment Status (Crucial) ---
  paymentStatus: { 
    type: String, 
    enum: ['PENDING', 'PAID', 'FAILED'], 
    default: 'PENDING' 
  },
   razorpayOrderId: { type: String },
  transactionId: { type: String },   // The actual payment ID from razorpay


   isCredentialSent: { type: Boolean, default: false },

   
  createdAt: { type: Date, default: Date.now }
});

const CourseOrder = mongoose.model("CourseOrder", courseOrderSchema);
export default CourseOrder;