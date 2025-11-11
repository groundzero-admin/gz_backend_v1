import mongoose from "mongoose";

const chatThreadSchema = new mongoose.Schema(
  {
    // Link to the student
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student", // Links to your Student model
      required: true,
    },
    // Link to the specific worksheet
    worksheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worksheet", // Links to your Worksheet model
      required: true,
    },
    // The external thread ID (e.g., from an AI service)
    thread_id: {
      type: String,
      required: true,
      index: true, // For fast lookups by thread_id
    },
  },
  {
    // Automatically adds `createdAt` and `updatedAt`
    timestamps: true,
  }
);

// Create a unique index for the studentId-worksheetId pair
// This ensures only ONE thread can exist for each pair.
chatThreadSchema.index({ studentId: 1, worksheetId: 1 }, { unique: true });

// Add an index to quickly find all chat threads for a specific student
chatThreadSchema.index({ studentId: 1 });

const ChatThread = mongoose.model("ChatThread", chatThreadSchema);

export default ChatThread;