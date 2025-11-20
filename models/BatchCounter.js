import mongoose from "mongoose";

const batchCounterSchema = new mongoose.Schema({
  // key will look like "SPA", "BZB", "IGC", etc.
  key: { type: String, required: true, unique: true }, 
  count: { type: Number, default: 0 } 
});

const BatchCounter = mongoose.model("BatchCounter", batchCounterSchema);
export default BatchCounter;