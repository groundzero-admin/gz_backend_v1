import mongoose from "mongoose";

const batchStudentRelationSchema = new mongoose.Schema({
  // Batch Details
  batch_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Batch", 
    required: true 
  },
  batchId: { 
    type: String, 
    required: true 
  },

  // Student Details
  student_obj_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student", 
    required: true 
  },
  student_number: { 
    type: String, 
    required: true 
  },

  joinedAt: { type: Date, default: Date.now }
});

// Create a unique index so you don't accidentally add the 
// same student to the same batch twice.
batchStudentRelationSchema.index({ batch_obj_id: 1, student_obj_id: 1 }, { unique: true });

const BatchStudentRelation = mongoose.model("BatchStudentRelation", batchStudentRelationSchema);
export default BatchStudentRelation;