import mongoose from "mongoose";

const chatThreadSchema = new mongoose.Schema(
  {
    // Link to the student
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true, // A student can only have one thread
    },
    // The external thread ID (e.g., from an AI service)
    thread_id: {
      type: String,
      required: true,
      index: true, // For fast lookups by thread_id
    },
  },
  {
    timestamps: true,
  }
);

const ChatThread = mongoose.model("ChatThread", chatThreadSchema);

export default ChatThread;