// import mongoose from "mongoose";

// const batchWeekSchema = new mongoose.Schema({
//   batch_obj_id: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: "Batch", 
//     required: true 
//   },
//   batchId: { 
//     type: String, 
//     required: true 
//   },
//   week_number: { 
//     type: Number, 
//     required: true 
//   },
//   week_title: { 
//     type: String, 
//     required: true,
//     trim: true
//   },
//   week_description: { 
//     type: String, 
//     trim: true
//   },
//   // --- NEW FIELDS ---
//   startTime: {
//     type: String, // e.g., "6:30 am"
//     required: true,
//     trim: true
//   },
//   endTime: {
//     type: String, // e.g., "8:30 am"
//     required: true,
//     trim: true
//   },
//   // ------------------
//   class_days: { 
//     type: [Number], 
//     required: true
//   },
//   createdAt: { type: Date, default: Date.now }
// });

// batchWeekSchema.index({ batchId: 1, week_number: 1 }, { unique: true });

// const BatchWeek = mongoose.model("BatchWeek", batchWeekSchema);
// export default BatchWeek;