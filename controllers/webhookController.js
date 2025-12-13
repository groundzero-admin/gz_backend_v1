import CourseOrder from "../models/CourseOrder.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // req.body must be RAW buffer here (middleware config needed)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    
    // 1. Retrieve the Order ID we sent earlier
    const orderId = session.client_reference_id;
    const transactionId = session.payment_intent;

    // 2. Find and Update the Order in DB
    try {
      await CourseOrder.findByIdAndUpdate(orderId, {
        paymentStatus: "PAID",
        transactionId: transactionId
      });
      console.log(`Order ${orderId} marked as PAID.`);
    } catch (err) {
      console.error("Error updating order:", err);
    }
  }

  res.status(200).json({ received: true });
};