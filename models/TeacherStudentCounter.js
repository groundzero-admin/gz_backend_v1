import mongoose from "mongoose";

const teacherStudentCounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },   // "student" or "teacher"
  count: { type: Number, default: 0 }    // last number used
});

const TeacherStudentCounter = mongoose.model(
  "TeacherStudentCounter",
  teacherStudentCounterSchema
);

export default TeacherStudentCounter;
