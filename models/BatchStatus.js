import mongoose from "mongoose";

const batchStatusSchema = new mongoose.Schema({
  batch_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Batch", 
    required: true,
    unique: true // One status document per batch
  },
  batchId: { 
    type: String, 
    required: true 
  },
  // This field handles the state logic
  status: { 
    type: String, 
    enum: ["UPCOMING", "LIVE", "ENDED"], 
    default: "UPCOMING",
    required: true
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
});

const BatchStatus = mongoose.model("BatchStatus", batchStatusSchema);
export default BatchStatus;