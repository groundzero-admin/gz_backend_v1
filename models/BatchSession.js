import mongoose from "mongoose";

const batchSessionSchema = new mongoose.Schema({
  batch_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Batch", 
    required: true 
  },
  batchId: { 
    type: String, 
    required: true 
  },
  session_number: { 
    type: Number, 
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    trim: true,
    default: ""
  },
  
  // Date and Time of the specific session
  date: { 
    type: Date, 
    required: true 
  },
  startTime: { type: String, required: true }, // e.g., "6:30 PM"
  endTime: { type: String, required: true },   // e.g., "8:30 PM"

  // Context from Batch (Snapshot)
  sessionType: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE'],
    required: true
  },

  // If Online -> GMeet Link. If Offline -> Physical Address
  meetingLinkOrLocation: { 
    type: String, 
  },

  createdAt: { type: Date, default: Date.now }
});

// Ensure session numbers are unique within a specific batch
batchSessionSchema.index({ batchId: 1, session_number: 1 }, { unique: true });
// Index for quick date lookup (useful for "Today's Class" logic)
batchSessionSchema.index({ batchId: 1, date: 1 });

const BatchSession = mongoose.model("BatchSession", batchSessionSchema);
export default BatchSession;