import mongoose from "mongoose";
const invitationSchema = new mongoose.Schema({
  email: String,
  role: String, // student|teacher|parent
  otp: String,
  token: String,
  parentEmails: { type: [String], default: [] }, // admin prelinks
  childEmails: { type: [String], default: [] }   // admin prelinks
});
const Invitation = mongoose.model("Invitation", invitationSchema);
export default Invitation;