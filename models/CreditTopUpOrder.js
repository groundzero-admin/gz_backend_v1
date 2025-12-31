import mongoose from "mongoose";

const creditTopUpOrderSchema = new mongoose.Schema({
  // Who is paying?
  student_obj_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, 
  studentEmail: { type: String, required: true },
  
  // What are they buying?
  batch_obj_id: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" }, // <--- NEW
  no_of_classes: { type: Number, default: 1 }, // <--- NEW
  
  batchType: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE'], 
    required: true 
  },
  purchaseType: { 
    type: String, 
    default: 'TOP_UP' 
  },
  
  // Financials (Calculated by Backend)
  amount: { type: Number, required: true },
  currency: { type: String, default: "inr" },

  // Payment Status
  paymentStatus: { 
    type: String, 
    enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'], 
    default: 'PENDING' 
  },
   razorpayOrderId: { type: String },
  transactionId: { type: String },

  createdAt: { type: Date, default: Date.now }
});

const CreditTopUpOrder = mongoose.model("CreditTopUpOrder", creditTopUpOrderSchema);
export default CreditTopUpOrder;