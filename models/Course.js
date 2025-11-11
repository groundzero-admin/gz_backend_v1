import mongoose from "mongoose";
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  class: Number,
  createdAt: { type: Date, default: Date.now }
});
const Course = mongoose.model("Course", courseSchema);
export default Course;