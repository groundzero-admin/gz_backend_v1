import mongoose from "mongoose";

const worksheetSchema = new mongoose.Schema({
  // Link to the course this worksheet belongs to
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course", // This links it to your 'Course' model
    required: true,
  },
  // The number for ordering (e.g., 1, 2, 3...)
  worksheetNumber: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // Link to the actual worksheet file (e.g., a PDF URL)
  link: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add an index to quickly find all worksheets for a specific course,
// sorted by their number.
// We remove the '{ unique: true }' part to allow duplicates.
worksheetSchema.index({ courseId: 1, worksheetNumber: 1 });

const Worksheet = mongoose.model("Worksheet", worksheetSchema);

export default Worksheet;