import mongoose from "mongoose";

const promptHistorySchema = new mongoose.Schema({
  // Link to the student
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student", // Links to your Student model
    required: true,
  },
  // Link to the specific worksheet
  worksheetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Worksheet", // Links to your Worksheet model
    required: true,
  },
  // The user's prompt
  prompt: {
    type: String,
    trim: true,
    default: "", // Not required, defaults to empty
  },
  // The AI's response
  response: {
    type: String,
    trim: true,
    default: "", // Not required, defaults to empty
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
// specific student on a specific worksheet, sorted by time.
promptHistorySchema.index({ studentId: 1, worksheetId: 1, createdAt: -1 });

const PromptHistory = mongoose.model("PromptHistory", promptHistorySchema);

export default PromptHistory;