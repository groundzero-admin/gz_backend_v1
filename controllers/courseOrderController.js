import CourseOrder from "../models/CourseOrder.js";
import { sendResponse } from "../middleware/auth.js";



import NewJoineeInvitation from "../models/NewJoineeInvitation.js";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto"; // Native Node module for random numbers

/**
 * Controller: getNewJoinersList
 * Access: Admin Only
 * Logic: Fetch orders where payment is PAID but credentials haven't been sent yet.
 */




export const getNewJoinersList = async (req, res) => {
  try {
    // Query condition:
    // 1. paymentStatus must be "PAID" (We don't want pending orders)
    // 2. isCredentialSent must be false (We only want new people)
    const newJoiners = await CourseOrder.find({
     
      isCredentialSent: false
    })
    .sort({ createdAt: -1 }) // Show newest orders first
    .lean(); // Convert to plain JSON objects for speed

    if (!newJoiners.length) {
      return sendResponse(res, 200, true, "No new joiners pending credentials.", []);
    }

    return sendResponse(res, 200, true, "New joiners list retrieved.", newJoiners);

  } catch (error) {
    console.error("getNewJoinersList error:", error);
    return sendResponse(res, 500, false, "Server error retrieving new joiners.");
  }
};















const { RESEND_EMAIL_API_KEY, FRONTEND_BASE , SMTP_USER } = process.env;
const resend = new Resend(RESEND_EMAIL_API_KEY);

/**
 * Controller: sendCredentialsToJoiner
 * Input: { course_order_id }
 * Logic: Checks Payment -> Generates OTP/Token -> Saves to DB -> Sends Email -> Updates Order
 */
export const sendCredentialsToJoiner = async (req, res) => {
  try {
    const { course_order_id } = req.body;

    if (!course_order_id) {
      return sendResponse(res, 400, false, "course_order_id is required.");
    }

    // 1. Fetch Order & Validate Payment
    const order = await CourseOrder.findById(course_order_id);

    if (!order) {
      return sendResponse(res, 404, false, "Course order not found.");
    }

    if (order.paymentStatus !== "PAID") {
      return sendResponse(res, 403, false, "Cannot send credentials. Payment is NOT PAID.");
    }

    if (order.isCredentialSent) {
      return sendResponse(res, 409, false, "Credentials already sent for this user.");
    }

    // 2. Generate Credentials
    const magicLinkToken = uuidv4();
    // Generate a 6-digit random numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 3. Save to Invitation Table (Upsert: update if exists, or create new)
    // REMOVED: expiresAt field from update object
    await NewJoineeInvitation.findOneAndUpdate(
      { course_order_id: order._id },
      {
        studentEmail: order.studentEmail,
        magicLinkToken: magicLinkToken,
        otp: otp
      },
      { upsert: true, new: true }
    );

    // 4. Construct Magic Link
    const inviteLink = `${FRONTEND_BASE}/register-student?token=${magicLinkToken}`;

    // 5. Send Email via Resend
    // REMOVED: Expiry text from email HTML
    const emailContent = `
      <h1>Welcome to the Platform, ${order.studentName}!</h1>
      <p>Your payment was successful. Here are your details to complete registration:</p>
      
      <p><strong>One-Time Password (OTP):</strong> <span style="font-size: 20px; font-weight: bold;">${otp}</span></p>
      
      <p>Click the link below to set up your account:</p>
      <a href="${inviteLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        Complete Registration
      </a>
    `;

    await resend.emails.send({
      from: SMTP_USER, 
      to: [order.studentEmail, order.parentEmail], 
      subject: "Complete Your Registration - Access Credentials",
      html: emailContent
    });

    console.log("hhere " , inviteLink , otp )

    // 6. Update CourseOrder Flag
    order.isCredentialSent = true;
    await order.save();

    return sendResponse(res, 200, true, "Credentials generated and email sent successfully.");

  } catch (error) {
    console.error("sendCredentialsToJoiner error:", error);
    return sendResponse(res, 500, false, "Server error sending credentials.");
  }
};















/**
 * Controller: validateInvitationToken
 * Route: GET /api/public/validate-invitation?token=...
 * Access: Public (No Auth Required)
 */
export const validateInvitationToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendResponse(res, 400, false, "Token is required.");
    }

    // 1. Find the invitation by the magic link token
    // We populate 'course_order_id' to get the parent/student details from the original order
    const invitation = await NewJoineeInvitation.findOne({ magicLinkToken: token })
      .populate("course_order_id") 
      .lean();

    if (!invitation) {
      return sendResponse(res, 404, false, "Invalid or missing invitation link.");
    }

    // (Per your request: No expiry check is performed here)

    const orderDetails = invitation.course_order_id;

    if (!orderDetails) {
      return sendResponse(res, 404, false, "Associated order details not found.");
    }

    // 2. Prepare the data to return to the frontend
    // This allows the frontend to show: "Welcome [Student Name], please enter OTP."
    const responseData = {
      isValid: true,
      studentEmail: invitation.studentEmail, // Email to verify against
      
      // Basic Info for Display / Pre-filling
      parentName: orderDetails.parentName,
      parentEmail: orderDetails.parentEmail,
      parentPhone: orderDetails.parentPhone,
      
      studentName: orderDetails.studentName,
      classGrade: orderDetails.classGrade,
      schoolName: orderDetails.schoolName,
      board: orderDetails.board,
      
      batchType: orderDetails.batchType
    };

    return sendResponse(res, 200, true, "Invitation token is valid.", responseData);

  } catch (error) {
    console.error("validateInvitationToken error:", error);
    return sendResponse(res, 500, false, "Server error validating token.");
  }
};








