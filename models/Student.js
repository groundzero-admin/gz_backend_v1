import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "student" },
  mobile: String,
  class: Number,
  student_number: { type: String, unique: true },  // NEW FIELD
  createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", studentSchema);
export default Student;
