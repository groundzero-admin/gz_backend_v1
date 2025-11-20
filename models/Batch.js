import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true }, // e.g., SPA001
  
  // Input fields stored
  cohort: { type: String, required: true }, // spark, ignite...
  level: { type: String, required: true },  // alpha, beta...
  
  classLocation: { type: String, required: true },
  cityCode: { type: String, required: true }, // Replaces pincode
  
  startDate: { type: Date, required: true },
  
  // Stored as char: 'S', 'C', or 'I'
  type: { type: String, required: true, enum: ['S', 'C', 'I'] }, 
  
  description: { type: String, default: "" },
  
  createdAt: { type: Date, default: Date.now }
});

const Batch = mongoose.model("Batch", batchSchema);
export default Batch;