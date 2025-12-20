import mongoose from "mongoose";

const batchStudentRelationSchema = new mongoose.Schema({
  // Batch
  batch_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true
  },

  // Student
  student_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },

  // Optional snapshot for quick access
  student_number: {
    type: String,
    required: true
  },

  joinedAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate enrollment
batchStudentRelationSchema.index(
  { batch_obj_id: 1, student_obj_id: 1 },
  { unique: true }
);

const BatchStudentRelation = mongoose.model(
  "BatchStudentRelation",
  batchStudentRelationSchema
);

export default BatchStudentRelation;
