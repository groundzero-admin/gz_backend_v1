import mongoose from "mongoose";

const promptHistorySchema = new mongoose.Schema({
  // Link to the student
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  // The user's prompt
  prompt: {
    type: String,
    trim: true,
    default: "",
  },
  // The AI's response
  response: {
    type: String,
    trim: true,
    default: "",
  },
  // Flag for bad prompts
  isBadPrompt: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add an index to quickly find all prompts for a
// specific student, sorted by time.
promptHistorySchema.index({ studentId: 1, createdAt: -1 });

const PromptHistory = mongoose.model("PromptHistory", promptHistorySchema);

export default PromptHistory;