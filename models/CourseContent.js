import mongoose from "mongoose";
const courseContentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  title: String,
  description: String,
  isReadingMaterial: Boolean,
  offset: Number,
  actualContent: String,
  createdAt: { type: Date, default: Date.now }
});
const CourseContent = mongoose.model("CourseContent", courseContentSchema);
export default CourseContent;