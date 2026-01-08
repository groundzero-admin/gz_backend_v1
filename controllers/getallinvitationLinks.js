import StudentDirectInvitation from "../models/StudentDirectInvitation.js"; // Adjust path
import NewJoineeInvitation from "../models/NewJoineeInvitation.js"; // Adjust path
import ParentInvitation from "../models/ParentInvitation.js"; // Adjust path
import { sendResponse } from "../middleware/auth.js";

export const getallinvitationLinksandOtp = async (req, res) => {
  try {
    const frontendBase = process.env.FRONTEND_BASE; // Ensure this is set in .env

    // 1. Fetch from all 3 tables
    const [directInvites, newJoineeInvites, parentInvites] = await Promise.all([
      StudentDirectInvitation.find({}).lean(),
      NewJoineeInvitation.find({}).lean(),
      ParentInvitation.find({}).lean()
    ]);

    // 2. Format: Student Direct Invites
    const formattedDirect = directInvites.map(inv => ({
      _id: inv._id,
      type: "INVITED BY ADMIN",
      email: inv.studentEmail,
      role: "STUDENT" , // Extra context
      link: `${frontendBase}/student-signup-direct?token=${inv.magicLinkToken}`,
      otp: inv.otp,
      createdAt: inv.createdAt
    }));

    // 3. Format: New Joinee (Course Buyers)
    const formattedNewJoinee = newJoineeInvites.map(inv => ({
      _id: inv._id,
      type: "PAID REGISTRATION", // From course purchase
      email: inv.studentEmail,
      role : "STUDENT",
      link: `${frontendBase}/register-student?token=${inv.magicLinkToken}`,
      otp: inv.otp,
      createdAt: inv.createdAt
    }));

    // 4. Format: Parent Invites
    const formattedParent = parentInvites.map(inv => ({
      _id: inv._id,
      type: "PARENT_INVITE",
      email: inv.parentEmail,
      role: "PARENT",  // Extra context
      link: `${frontendBase}/parent-signup?token=${inv.magicLinkToken}`,
      otp: inv.otp,
      createdAt: inv.createdAt
    }));

    // 5. Merge all lists
    const allInvitations = [
      ...formattedDirect,
      ...formattedNewJoinee,
      ...formattedParent
    ];

    // 6. Sort by Latest First (Descending)
    allInvitations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return sendResponse(res, 200, true, "All pending invitations retrieved.", allInvitations);

  } catch (err) {
    console.error("getAllPendingInvitations error:", err);
    return sendResponse(res, 500, false, "Server error fetching invitations.");
  }
};