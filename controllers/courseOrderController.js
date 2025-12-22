import CourseOrder from "../models/CourseOrder.js";
import { sendResponse } from "../middleware/auth.js";



import NewJoineeInvitation from "../models/NewJoineeInvitation.js";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto"; // Native Node module for random numbers
import Parent from "../models/Parent.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import ParentInvitation from "../models/ParentInvitation.js";



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
    const { 
      course_order_id, 
      batches // Expecting: [{ batch_obj_id: "...", batchName: "..." }]
    } = req.body;

    if (!course_order_id) {
      return sendResponse(res, 400, false, "course_order_id is required.");
    }

    // 1. Fetch Order & Validate Payment
    const order = await CourseOrder.findById(course_order_id);
    if (!order) return sendResponse(res, 404, false, "Course order not found.");
    if (order.paymentStatus !== "PAID") return sendResponse(res, 403, false, "Payment is NOT PAID.");
    if (order.isCredentialSent) return sendResponse(res, 409, false, "Credentials already sent.");

    // ============================================================
    // FLOW A: STUDENT ONBOARDING (Standard)
    // ============================================================
    
    const studentToken = uuidv4();
    const studentOtp = crypto.randomInt(100000, 999999).toString();

    // A2. Save to Student Invitation Table (WITH BATCHES)
    await NewJoineeInvitation.findOneAndUpdate(
      { course_order_id: order._id },
      {
        studentEmail: order.studentEmail,
        magicLinkToken: studentToken,
        otp: studentOtp,
        
        // --- NEW: Save the batches to enroll later ---
        enroll_batches: batches || [],
        
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // A3. Send Email to Student
    const studentLink = `${FRONTEND_BASE}/register-student?token=${studentToken}`;
    
    await resend.emails.send({
      from: SMTP_USER, 
      to: order.studentEmail, 
      subject: "Welcome! Complete Your Student Registration",
      html: `
        <h1>Welcome, ${order.studentName}!</h1>
        <p>Your payment was successful. Please set up your student account.</p>
        <p><strong>Your OTP:</strong> <span style="font-size: 20px; font-weight: bold;">${studentOtp}</span></p>
        <p><a href="${studentLink}">Click here to register as a Student</a></p>
      `
    });

    console.log(`[Credentials] Student Invite sent to ${studentLink} | OTP: ${studentOtp}`);

    // ============================================================
    // FLOW B: PARENT ONBOARDING
    // ============================================================
    
    const existingParent = await Parent.findOne({ email: order.parentEmail });

    if (existingParent) {
      // LINK EXISTING PARENT
      await StudentParentRelation.findOneAndUpdate(
        { studentEmail: order.studentEmail, parentEmail: order.parentEmail },
        { createdAt: new Date() },
        { upsert: true, new: true }
      );
      
      // Notify
      await resend.emails.send({
        from: SMTP_USER,
        to: order.parentEmail,
        subject: "New Student Linked",
        html: `<p>Student <strong>${order.studentName}</strong> has been linked to your account.</p>`
      });
      console.log(`[Credentials] Existing Parent ${order.parentEmail} linked.`);

    } else {
      // INVITE NEW PARENT
      const parentToken = uuidv4();
      const parentOtp = crypto.randomInt(100000, 999999).toString();

      await ParentInvitation.findOneAndUpdate(
        { parentEmail: order.parentEmail, studentEmail: order.studentEmail },
        {
          magicLinkToken: parentToken,
          otp: parentOtp,
          createdAt: new Date()
        },
        { upsert: true, new: true }
      );

      const parentLink = `${FRONTEND_BASE}/parent-signup?token=${parentToken}`;
      await resend.emails.send({
        from: SMTP_USER,
        to: order.parentEmail,
        subject: "Invitation to Join Parent Portal",
        html: `
          <h1>Welcome Parent of ${order.studentName}!</h1>
          <p>OTP: <strong>${parentOtp}</strong></p>
          <p><a href="${parentLink}">Click here to register</a></p>
        `
      });
      console.log(`[Credentials] New Parent Invite sent to ${parentLink} | OTP: ${parentOtp}`);
    }

    // 6. Update CourseOrder Flag
    order.isCredentialSent = true;
    await order.save();

    return sendResponse(res, 200, true, "Credentials sent. Batches saved for auto-enrollment.");

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








