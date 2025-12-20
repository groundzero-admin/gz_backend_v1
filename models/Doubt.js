import mongoose from "mongoose";

const doubtSchema = new mongoose.Schema({
  // Student
  student_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },

  // Snapshot for quick lookup
  student_number: {
    type: String,
    required: true
  },

  // Batch (NEW SOURCE OF TRUTH)
  batch_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
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
doubtSchema.index({ student_obj_id: 1 });
doubtSchema.index({ batch_obj_id: 1, isresolved: 1 });

const Doubt = mongoose.model("Doubt", doubtSchema);
export default Doubt;
