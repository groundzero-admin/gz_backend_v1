import mongoose from "mongoose";
const promptLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseContent", required: true },
  prompt: String,
  response: String,
  isBadPrompt: { type: Boolean, default: false },
  offset: Number,
  createdAt: { type: Date, default: Date.now }
});
const PromptLog = mongoose.model("PromptLog", promptLogSchema);
export default PromptLog;