// models/StudentParentRelation.js
import mongoose from "mongoose";

const studentParentRelationSchema = new mongoose.Schema({
  studentEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  parentEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Create a unique index to prevent duplicate {student, parent} pairs
studentParentRelationSchema.index(
  { studentEmail: 1, parentEmail: 1 },
  { unique: true }
);

const StudentParentRelation = mongoose.model(
  "StudentParentRelation",
  studentParentRelationSchema
);
export default StudentParentRelation;