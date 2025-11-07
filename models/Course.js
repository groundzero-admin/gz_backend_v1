import mongoose from "mongoose";
const courseSchema = new mongoose.Schema({
  name: String,
  title: String,
  description: String,
  forWhichClass: Number,
  createdAt: { type: Date, default: Date.now }
});
const Course = mongoose.model("Course", courseSchema);
export default Course;