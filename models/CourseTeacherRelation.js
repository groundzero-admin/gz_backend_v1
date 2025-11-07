import mongoose from "mongoose";
const courseTeacherRelationSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true }
});
courseTeacherRelationSchema.index({ courseId: 1, teacherId: 1 }, { unique: true });
const CourseTeacherRelation = mongoose.model("CourseTeacherRelation", courseTeacherRelationSchema);
export default CourseTeacherRelation;