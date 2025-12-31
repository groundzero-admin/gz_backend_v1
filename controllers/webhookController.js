import crypto from "crypto";
import CourseOrder from "../models/CourseOrder.js";
import CreditTopUpOrder from "../models/CreditTopUpOrder.js";
import StudentCredit from "../models/StudentCredit.js";
import Student from "../models/Student.js";

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const receivedSignature = req.headers["x-razorpay-signature"];

  // IMPORTANT: req.body is a Buffer here
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  if (expectedSignature !== receivedSignature) {
    console.error("❌ Razorpay signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  // Safe to parse AFTER verification
  const event = JSON.parse(req.body.toString());

  console.log("✅ Razorpay webhook verified:", event.event);

  if (event.event !== "payment.captured") {
    return res.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  const notes = payment.notes || {};

  const orderId = notes.order_id;
  const orderType = notes.order_type;
  const studentEmail = notes.student_email;

  try {
    // ================= TOP-UP =================
    if (orderType === "TOP_UP") {
      const topUp = await CreditTopUpOrder.findById(orderId);
      if (!topUp) return res.json({ received: true });

      topUp.paymentStatus = "PAID";
      topUp.transactionId = payment.id;
      await topUp.save();

      let wallet = await StudentCredit.findOne({ studentEmail });

      if (!wallet) {
        const student = await Student.findOne({ email: studentEmail });
        if (student) {
          wallet = await StudentCredit.create({
            student_obj_id: student._id,
            studentEmail,
            amount_for_online: 0,
            amount_for_offline: 0
          });
        }
      }

      if (wallet) {
        if (topUp.batchType === "ONLINE") {
          wallet.amount_for_online += topUp.amount;
        } else {
          wallet.amount_for_offline += topUp.amount;
        }
        await wallet.save();
      }
    }

    // ================= NEW REGISTRATION =================
    else {
      const courseOrder = await CourseOrder.findById(orderId);
      if (courseOrder) {
        courseOrder.paymentStatus = "PAID";
        courseOrder.transactionId = payment.id;
        await courseOrder.save();
      }
    }

  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  return res.json({ received: true });
};
