import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true }, // e.g., SPA001
  
  // Input fields stored
  cohort: { type: String, required: true }, 
  level: { type: String, required: true }, 
  
  startDate: { type: Date, required: true },
  
  // 'S' = School, 'C' = Society, 'I' = Individual
  type: { type: String  , enum: ['S', 'C', 'I'] }, 
  
  // --- NEW FIELDS ---
  batchType: { 
    type: String, 
    required: true, 
    enum: ['ONLINE', 'OFFLINE'] 
  },

  // Conditionally Required Fields (Only for OFFLINE)
  classLocation: { 
    type: String, 
    required: function() { return this.batchType === 'OFFLINE'; },
    default: "" 
  },
  cityCode: { 
    type: String, 
    required: function() { return this.batchType === 'OFFLINE'; },
    default: ""
  },
  // ------------------

  description: { type: String, default: "" },
  
  createdAt: { type: Date, default: Date.now }
});

const Batch = mongoose.model("Batch", batchSchema);
export default Batch;