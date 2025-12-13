import Stripe from "stripe";
import Admin from "../models/Admin.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import CourseOrder from "../models/CourseOrder.js";
import { sendResponse } from "../middleware/auth.js";

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
