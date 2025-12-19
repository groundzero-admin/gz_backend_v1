// // models/AccessRequest.js
// import mongoose from "mongoose";

// const accessRequestSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, lowercase: true, trim: true },
//   role: {
//     type: String,
//     required: true,
//     enum: ["student", "teacher", "parent"],
//   },
//   resolved: { type: Boolean, default: false }, // <-- ADDED THIS LINE



//   requestedAt: { type: Date, default: Date.now },
// });

// // Add an index on email for fast lookups
// accessRequestSchema.index({ email: 1 });

// const AccessRequest = mongoose.model("AccessRequest", accessRequestSchema);
// export default AccessRequest;