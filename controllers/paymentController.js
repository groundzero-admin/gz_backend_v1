import Stripe from "stripe";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import CourseOrder from "../models/CourseOrder.js";
import { sendResponse } from "../middleware/auth.js";
import CreditTopUpOrder from "../models/CreditTopUpOrder.js";




const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
  try {
    const {
      parentName,
      parentPhone,
      parentEmail,
      studentName,
      studentEmail,
      board,
      classGrade,
      schoolName,
      batchType,
      purchaseType
    } = req.body;

    // Basic validation
    if (!studentEmail) {
      return sendResponse(res, 400, false, "Student email is required.");
    }
    if (!parentEmail) {
      return sendResponse(res, 400, false, "Parent email is required.");
    }
    if (!batchType || !["OFFLINE", "ONLINE"].includes(batchType)) {
      return sendResponse(res, 400, false, "Invalid or missing batchType.");
    }
    if (!purchaseType || !["SINGLE_SESSION", "FULL_BUNDLE"].includes(purchaseType)) {
      return sendResponse(res, 400, false, "Invalid or missing purchaseType.");
    }

    const e = studentEmail.toLowerCase().trim();

    // 1) Ensure the student email is not already registered as any user
    const existingUsers = await Promise.all([
      Student.findOne({ email: e }),
      Teacher.findOne({ email: e }),
      Parent.findOne({ email: e }),
      Admin.findOne({ email: e }),
    ]);

    if (existingUsers.some(Boolean)) {
      return sendResponse(res, 400, false, "This student email is already registered in the system.");
    }

    // 2) Remove old pending orders for this studentEmail (only PENDING paymentStatus)
    await CourseOrder.deleteMany({
      studentEmail: e,
      paymentStatus: "PENDING"
    });

    // 3) Price calculation (server-side)
    let unitPrice = batchType === "OFFLINE" ? 1500 : 1000;
    let finalAmount = unitPrice;
    let descriptionText = `${batchType} - Single Session`;

    if (purchaseType === "FULL_BUNDLE") {
      finalAmount = unitPrice * 12;
      descriptionText = `${batchType} - Full Course Bundle (12 Sessions)`;
    }

    // 4) Create DB order (use schema fields exactly)
    const newOrder = await CourseOrder.create({
      parentName,
      parentPhone,
      parentEmail,
      studentName,
      studentEmail: e,
      board,
      classGrade,
      schoolName,
      batchType,
      purchaseType,
      amount: finalAmount,
      currency: "inr",
      paymentStatus: "PENDING",     // <-- schema field
      isCredentialSent: false
    });

    // 5) Create Stripe Checkout Session using Stripe constructor you provided
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Course Enrollment",
              description: descriptionText,
            },
            unit_amount: finalAmount * 100, // paisa
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_BASE}/payment-success`,
      cancel_url: `${process.env.FRONTEND_BASE}/payment-failed`,
      client_reference_id: newOrder._id.toString(),
      customer_email: parentEmail,
    });

    // 6) Save stripeSessionId to the order
    newOrder.stripeSessionId = session.id;
    await newOrder.save();

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: "Failed to create session" });
  }
};


















// Standard Pricing Constants
const PRICE_ONLINE = 1000;
const PRICE_OFFLINE = 1500;

export const createTopUpCheckoutSession = async (req, res) => {
  try {
    const { 
      batch_obj_id,   // Which batch is this for?
      batchType,      // 'ONLINE' or 'OFFLINE'
      no_of_classes,  // e.g., 1, 5, 12
      purchaseType    // e.g. "Next Session" or "Full Bundle"
    } = req.body;


    console.log(batch_obj_id , req.body )

    // 1. Authentication Check
    if (!req.authPayload) {
        return sendResponse(res, 401, false, "Unauthorized: No user data found.");
    }
    const { id: studentId, email: studentEmail } = req.authPayload;

    // 2. Input Validation
    if (!batchType || !no_of_classes || no_of_classes < 1) {
      return sendResponse(res, 400, false, "Batch Type and valid No. of Classes are required.");
    }

    // ============================================================
    // 3. BACKEND PRICE CALCULATION (SECURITY)
    // ============================================================
    let costPerClass = 0;

    if (batchType === "ONLINE") {
      costPerClass = PRICE_ONLINE;
    } else if (batchType === "OFFLINE") {
      costPerClass = PRICE_OFFLINE;
    } else {
      return sendResponse(res, 400, false, "Invalid Batch Type.");
    }

    const finalAmount = costPerClass * Number(no_of_classes);

    // ============================================================
    // 4. CLEANUP: Soft delete old pending orders
    // ============================================================
    await CreditTopUpOrder.updateMany(
      {
        student_obj_id: studentId,
        paymentStatus: 'PENDING'
      },
      {
        $set: { paymentStatus: 'CANCELLED' }
      }
    );

    // ============================================================
    // 5. Create Order in DB (With Calculated Amount)
    // ============================================================
    const newTopUp = await CreditTopUpOrder.create({
      student_obj_id: studentId,
      studentEmail: studentEmail,
      batch_obj_id: batch_obj_id || null, // Optional if just generic topup
      no_of_classes: Number(no_of_classes),
      batchType,
      purchaseType: purchaseType || `${no_of_classes} Sessions Top-Up`,
      amount: finalAmount, // <--- Backend set value
      paymentStatus: 'PENDING'
    });

    // ============================================================
    // 6. Create Stripe Session
    // ============================================================
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${batchType} Sessions (${no_of_classes})`,
              description: `Top-up for ${studentEmail}`,
            },
            unit_amount: finalAmount * 100, // Convert to paisa
          },
          quantity: 1,
        },
      ],
      mode: "payment",
    // --- UPDATED SUCCESS URL ---
      success_url: `${process.env.FRONTEND_BASE}/student/dashboard/payment-result?payment=success`, 
      
      // I also updated cancel to go back to dashboard so they aren't stuck on a blank page
      cancel_url: `${process.env.FRONTEND_BASE}/student/dashboard/payment-result?payment=cancelled`,
      // KEY METADATA
      metadata: {
        order_type: "TOP_UP", 
        order_id: newTopUp._id.toString(),
        student_email: studentEmail
      },
    });

    // 7. Save Session ID
    newTopUp.stripeSessionId = session.id;
    await newTopUp.save();

    return sendResponse(res, 200, true, "Top-up session created.", { 
      url: session.url,
      amount: finalAmount // Return calculated amount so frontend knows what happened
    });

  } catch (error) {
    console.error("createTopUpCheckoutSession error:", error);
    return sendResponse(res, 500, false, `Server error: ${error.message}`);
  }
};