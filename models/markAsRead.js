import mongoose from "mongoose";

const markAsReadSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  worksheetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Worksheet",
    required: true,
  },
  // --- ADDED THIS FIELD ---
  value: {
    type: Boolean,
    default: true,
  },
  // ---
  markedAt: {
    type: Date,
    default: Date.now,
  },
});

// Unique index prevents duplicate entries for the same student/worksheet pair
markAsReadSchema.index({ studentId: 1, worksheetId: 1 }, { unique: true });

// Index to quickly find all entries for a student
markAsReadSchema.index({ studentId: 1 });

const MarkAsRead = mongoose.model("MarkAsRead", markAsReadSchema);

export default MarkAsRead;