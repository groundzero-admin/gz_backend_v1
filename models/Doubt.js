import mongoose from "mongoose";

const doubtSchema = new mongoose.Schema({
  student_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  student_number: {
    type: String, // e.g., "GZST004"
    required: true
  },
  batchId: {
    type: String, // e.g., "SPA001"
    required: true
  },
  doubt_content: {
    type: String,
    required: true,
    trim: true
  },
  isresolved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for fast retrieval
doubtSchema.index({ student_obj_id: 1 }); // For student fetching history
doubtSchema.index({ isresolved: 1, batchId: 1 }); // For teachers filtering

const Doubt = mongoose.model("Doubt", doubtSchema);
export default Doubt;