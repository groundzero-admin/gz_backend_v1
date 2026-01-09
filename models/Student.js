import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  password_text: String, // UPDATED: Stores plain text password
  role: { type: String, default: "student" },
  mobile: String,
  class: Number,
  student_number: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", studentSchema);
export default Student;