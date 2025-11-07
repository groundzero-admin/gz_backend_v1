import mongoose from "mongoose";
const parentSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "parent" },
  mobile: String,
  createdAt: { type: Date, default: Date.now }
});
const Parent = mongoose.model("Parent", parentSchema);
export default Parent;