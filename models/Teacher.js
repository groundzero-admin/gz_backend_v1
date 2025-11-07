import mongoose from "mongoose";
const teacherSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "teacher" },
  mobile: String,
  createdAt: { type: Date, default: Date.now }
});
const Teacher = mongoose.model("Teacher", teacherSchema);
export default Teacher;