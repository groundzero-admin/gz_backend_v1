import mongoose from "mongoose";
const contentCompletionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseContent", required: true },
  fullyDone: { type: Boolean, default: false },
  partiallyDone: { type: Boolean, default: false },
  submittedCode: { type: String, default: "" },
  keepNotes: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
});
const ContentCompletion = mongoose.model("ContentCompletion", contentCompletionSchema);
export default ContentCompletion;