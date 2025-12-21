import Stripe from "stripe";
import CourseOrder from "../models/CourseOrder.js";
import CreditTopUpOrder from "../models/CreditTopUpOrder.js"; 
import StudentCredit from "../models/StudentCredit.js";
import Student from "../models/Student.js"; // Required for Self-Healing

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Retrieve IDs
    const orderId = session.metadata?.order_id || session.client_reference_id;
    const studentEmail = session.metadata?.student_email || session.customer_email;
    const orderType = session.metadata?.order_type || "NEW_REGISTRATION"; 

    console.log(`[Stripe] Processing ${orderType} for ${studentEmail}`);

    try {
      // ==========================================
      // CASE A: TOP-UP (Existing Student)
      // ==========================================
      if (orderType === "TOP_UP") {
        const topUpOrder = await CreditTopUpOrder.findById(orderId);
        
        if (topUpOrder) {
          // 1. Mark Order as PAID
          topUpOrder.paymentStatus = "PAID";
          topUpOrder.transactionId = session.payment_intent;
          await topUpOrder.save();

          // 2. FIND WALLET
          let wallet = await StudentCredit.findOne({ studentEmail });

          // --- SELF-HEALING LOGIC (Fixes "Wallet not found" error) ---
          if (!wallet) {
            console.log(`[Stripe] Wallet missing for ${studentEmail}. Creating new wallet...`);
            
            // Verify student exists first to link _id correctly
            const existingStudent = await Student.findOne({ email: studentEmail });
            
            if (existingStudent) {
              wallet = await StudentCredit.create({
                student_obj_id: existingStudent._id,
                studentEmail: studentEmail,
                amount_for_online: 0,
                amount_for_offline: 0
              });
              console.log(`[Stripe] Created new wallet for ${studentEmail}`);
            } else {
              console.error(`[Stripe] CRITICAL: Student account ALSO missing for ${studentEmail}. Cannot create wallet.`);
              return res.json({ received: true });
            }
          }
          // -----------------------------------------------------------

          // 3. ADD FUNDS
          if (topUpOrder.batchType === "ONLINE") {
            wallet.amount_for_online += topUpOrder.amount;
          } else {
            wallet.amount_for_offline += topUpOrder.amount;
          }
          
          await wallet.save();
          console.log(`[Stripe] Top-up: Added ${topUpOrder.amount} to ${topUpOrder.batchType} wallet.`);
        }
      } 
      
      // ==========================================
      // CASE B: NEW REGISTRATION (Old Flow)
      // ==========================================
      else {
        const courseOrder = await CourseOrder.findById(orderId);
        if (courseOrder) {
          courseOrder.paymentStatus = "PAID";
          courseOrder.transactionId = session.payment_intent;
          await courseOrder.save();
          console.log(`[Stripe] Registration: Order ${orderId} marked as PAID.`);
        }
      }

    } catch (err) {
      console.error("[Stripe] Database update error:", err);
    }
  }

  res.json({ received: true });
};