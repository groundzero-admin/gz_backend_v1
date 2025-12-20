import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    batchName: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      required: false,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    batchType: {
      type: String,
      required: true,
      enum: ["ONLINE", "OFFLINE"],
    },

    // Required ONLY when batchType === "OFFLINE"
    classLocation: {
      type: String,
      required: function () {
        return this.batchType === "OFFLINE";
      },
      default: "",
      trim: true,
    },

    cityCode: {
      type: String,
      required: function () {
        return this.batchType === "OFFLINE";
      },
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

const Batch = mongoose.model("Batch", batchSchema);
export default Batch;
