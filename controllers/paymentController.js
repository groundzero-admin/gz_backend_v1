import Razorpay from "razorpay";
import CourseOrder from "../models/CourseOrder.js";
import CreditTopUpOrder from "../models/CreditTopUpOrder.js";
import { sendResponse } from "../middleware/auth.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =====================================================
// CREATE COURSE REGISTRATION PAYMENT
// =====================================================
export const createCoursePaymentSession = async (req, res) => {
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

    if (!studentEmail || !parentEmail)
      return sendResponse(res, 400, false, "Emails required");

    if (!["ONLINE", "OFFLINE"].includes(batchType))
      return sendResponse(res, 400, false, "Invalid batch type");

    if (!["SINGLE_SESSION", "FULL_BUNDLE"].includes(purchaseType))
      return sendResponse(res, 400, false, "Invalid purchase type");

    // ================= PRICE LOGIC =================
    let unitPrice = batchType === "OFFLINE" ? 1500 : 1000;
    let finalAmount =
      purchaseType === "FULL_BUNDLE" ? unitPrice * 12 : unitPrice;

    // ================= CREATE DB ORDER =================
    const order = await CourseOrder.create({
      parentName,
      parentPhone,
      parentEmail,
      studentName,
      studentEmail: studentEmail.toLowerCase(),
      board,
      classGrade,
      schoolName,
      batchType,
      purchaseType,
      amount: finalAmount,
      currency: "INR",
      paymentStatus: "PENDING"
    });

    // ================= RAZORPAY ORDER =================
    const razorpayOrder = await razorpay.orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        order_type: "NEW_REGISTRATION",
        order_id: order._id.toString(),
        student_email: studentEmail
      }
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: razorpayOrder
    });

  } catch (error) {
    console.error("createCoursePayment error:", error);
    return sendResponse(res, 500, false, "Failed to create payment");
  }
};


// =====================================================
// CREATE TOP-UP PAYMENT
// =====================================================
export const createTopUpPaymentSession = async (req, res) => {
  try {
    const { batchType, no_of_classes, purchaseType, batch_obj_id } = req.body;

    if (!req.authPayload)
      return sendResponse(res, 401, false, "Unauthorized");

    const { id: studentId, email: studentEmail } = req.authPayload;

    if (!batchType || !no_of_classes)
      return sendResponse(res, 400, false, "Missing data");

    let pricePerClass =
      batchType === "ONLINE" ? 1000 :
      batchType === "OFFLINE" ? 1500 : 0;

    if (!pricePerClass)
      return sendResponse(res, 400, false, "Invalid batch type");

    const finalAmount = pricePerClass * Number(no_of_classes);

    // Cancel old pending
    await CreditTopUpOrder.updateMany(
      { student_obj_id: studentId, paymentStatus: "PENDING" },
      { $set: { paymentStatus: "CANCELLED" } }
    );

    // Create DB order
    const order = await CreditTopUpOrder.create({
      student_obj_id: studentId,
      studentEmail,
      batch_obj_id: batch_obj_id || null,
      batchType,
      no_of_classes,
      purchaseType: purchaseType || `${no_of_classes} Sessions`,
      amount: finalAmount,
      paymentStatus: "PENDING"
    });

    // Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        order_type: "TOP_UP",
        order_id: order._id.toString(),
        student_email: studentEmail
      }
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return sendResponse(res, 200, true, "Top-up order created", {
      key: process.env.RAZORPAY_KEY_ID,
      order: razorpayOrder,
      amount: finalAmount
    });

  } catch (error) {
    console.error("createTopUpPayment error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
