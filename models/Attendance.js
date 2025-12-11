import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  student_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  session_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BatchSession", // Ensure this matches your Session model name
    required: true
  },
  status: {
    type: String,
    enum: ["PRESENT", "ABSENT"],
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  }
});

// This ensures unique entry for (Student + Session) combination
attendanceSchema.index({ student_obj_id: 1, session_obj_id: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;