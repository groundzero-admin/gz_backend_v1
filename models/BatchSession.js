import mongoose from "mongoose";

const batchSessionSchema = new mongoose.Schema({
  batch_obj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true
  },

  session_number: {
    type: Number,
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true,
    default: ""
  },

  // Date and Time
  date: {
    type: Date,
    required: true
  },

  startTime: {
    type: String,
    required: true
  },

  endTime: {
    type: String,
    required: true
  },

  // Snapshot from Batch
  sessionType: {
    type: String,
    enum: ["ONLINE", "OFFLINE"],
    required: true
  },

  // Online → Meet link | Offline → Location
  meetingLinkOrLocation: {
    type: String,
    default: null
  },

  // ✅ NEW: Google Classroom link (ONLINE only)
  googleClassroomLink: {
    type: String,
    default: null,
    validate: {
      validator: function (value) {
        // Allow only for ONLINE sessions
        if (value && this.sessionType !== "ONLINE") {
          return false;
        }
        return true;
      },
      message: "Google Classroom link is allowed only for ONLINE sessions."
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Indexes
batchSessionSchema.index(
  { batch_obj_id: 1, session_number: 1 },
  { unique: true }
);

batchSessionSchema.index(
  { batch_obj_id: 1, date: 1 }
);

const BatchSession = mongoose.model("BatchSession", batchSessionSchema);
export default BatchSession;
