import mongoose from "mongoose";
const studentParentRelationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true }
});
studentParentRelationSchema.index({ studentId: 1, parentId: 1 }, { unique: true });
const StudentParentRelation = mongoose.model("StudentParentRelation", studentParentRelationSchema);
export default StudentParentRelation;