import crypto from "crypto";
import bcrypt from "bcrypt";
import { Resend } from "resend";
import Student from "../models/Student.js";
import StudentCredit from "../models/StudentCredit.js";
import StudentParentRelation from "../models/StudentParentRelation.js";
import TeacherStudentCounter from "../models/TeacherStudentCounter.js";
import StudentDirectInvitation from "../models/StudentDirectInvitation.js"; // New Model
import ParentInvitation from "../models/ParentInvitation.js"; // Existing Model
import { sendResponse } from "../middleware/auth.js";
import BatchStudentRelation from "../models/BatchStudentRelation.js";
const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);

// --- Helper: Student Roll Number ---
const getNextStudentNumber = async () => {
  const key = "student";
  const prefix = "GZST";
  let counter = await TeacherStudentCounter.findOne({ key });
  if (!counter) counter = new TeacherStudentCounter({ key, count: 0 });
  counter.count += 1;
  await counter.save();
  return prefix + String(counter.count).padStart(3, "0");
};





/**
 * 1. ADMIN: Invite Student AND Parent together
 * Input: { studentEmail, parentEmail, onlineCredit, offlineCredit , batch obj id andbatchanmes  }
 */
export const inviteStudentAndParent = async (req, res) => {
  try {
    const { 
      studentEmail, 
      parentEmail, 
      onlineCredit, 
      offlineCredit,
      batches // Expecting: [{ batch_obj_id: "...", batchName: "..." }]
    } = req.body;

    if (!studentEmail || !parentEmail) {
      return sendResponse(res, 400, false, "Both Student and Parent emails are required.");
    }

    // --- A. VALIDATION ---
    const studentExists = await Student.findOne({ email: studentEmail });
    if (studentExists) return sendResponse(res, 409, false, "Student already exists.");

    // --- B. PREPARE STUDENT INVITE ---
    const studentToken = crypto.randomUUID();
    const studentOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert Student Invitation
    await StudentDirectInvitation.findOneAndUpdate(
      { studentEmail },
      {
        parentEmail,
        amount_for_online: Number(onlineCredit) || 0,
        amount_for_offline: Number(offlineCredit) || 0,
        enroll_batches: batches || [],
        magicLinkToken: studentToken,
        otp: studentOtp,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // --- C. PREPARE PARENT INVITE ---
    const parentToken = crypto.randomUUID();
    const parentOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await ParentInvitation.findOneAndUpdate(
      { parentEmail, studentEmail }, 
      {
        magicLinkToken: parentToken,
        otp: parentOtp,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // --- D. SEND EMAILS ---
    const studentLink = `${process.env.FRONTEND_BASE}/student-signup-direct?token=${studentToken}`;
    const parentLink = `${process.env.FRONTEND_BASE}/parent-signup?token=${parentToken}`;

    // 1. Send Email to STUDENT (Only their own details)
    await resend.emails.send({
      from: process.env.SMTP_USER,
      to: studentEmail,
      subject: "Welcome! Complete your Student Profile",
      html: `<p>You have been invited. OTP: <strong>${studentOtp}</strong>. <a href="${studentLink}">Click here to register</a>`
    });

    // 2. Send Email to PARENT (Contains BOTH Student and Parent details)
    await resend.emails.send({
      from: process.env.SMTP_USER,
      to: parentEmail,
      subject: `Action Required: Registration for you and ${studentEmail}`,
      html: `
        <h2>Welcome!</h2>
        <p>Please complete the registration for both yourself and your child.</p>
        
        <hr />
        
        <h3>1. Student Registration (For ${studentEmail})</h3>
        <p>Use these details to register the student account:</p>
        <p><strong>Student OTP:</strong> ${studentOtp}</p>
        <p><strong>Student Link:</strong> <a href="${studentLink}">${studentLink}</a></p>
        
        <hr />
        
        <h3>2. Parent Registration (For You)</h3>
        <p>Use these details to create your parent portal account:</p>
        <p><strong>Parent OTP:</strong> ${parentOtp}</p>
        <p><strong>Parent Link:</strong> <a href="${parentLink}">${parentLink}</a></p>
      `
    });

    return sendResponse(res, 200, true, "Invites sent successfully.", {
      debug_student_otp: studentOtp,
      debug_parent_otp: parentOtp
    });

  } catch (err) {
    console.error("inviteStudentAndParent error:", err);
    return sendResponse(res, 500, false, "Server error sending invites.");
  }
};


/**
 * 2. PUBLIC: Validate Direct Student Invite
 * Input: ?token=...
 */
export const validateDirectStudentInvite = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return sendResponse(res, 400, false, "Token required.");

    const invite = await StudentDirectInvitation.findOne({ magicLinkToken: token });
    if (!invite) return sendResponse(res, 404, false, "Invalid link.");

    return sendResponse(res, 200, true, "Valid token.", {
      email: invite.studentEmail,
      parentEmail: invite.parentEmail // Display only, read-only ideally
    });

  } catch (err) {
    console.error("validateDirectStudentInvite error:", err);
    return sendResponse(res, 500, false, "Server error.");
  }
};



/**
 * 3. PUBLIC: Onboard Direct Student
 * Input: { token, otp, password, name, mobile, class }
 */



export const onboardDirectStudent = async (req, res) => {
  try {
    const { 
      token, otp, password, 
      name, mobile, class: studentClass 
    } = req.body;

    // 1. Basic Validation
    if (!token || !otp || !password || !name) {
      return sendResponse(res, 400, false, "All fields are required.");
    }

    // 2. Verify Invite
    const invite = await StudentDirectInvitation.findOne({ magicLinkToken: token });
    if (!invite) return sendResponse(res, 404, false, "Invalid invitation.");
    if (String(invite.otp) !== String(otp)) return sendResponse(res, 401, false, "Incorrect OTP.");

    // 3. Double Check Duplicate
    const existing = await Student.findOne({ email: invite.studentEmail });
    if (existing) {
      await StudentDirectInvitation.findByIdAndDelete(invite._id);
      return sendResponse(res, 409, false, "Student already registered.");
    }

    // 4. Create Student
    const student_number = await getNextStudentNumber();
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = await Student.create({
      name,
      email: invite.studentEmail,
      password: hashedPassword,
      mobile: mobile || "",
      class: Number(studentClass) || null,
      student_number: student_number,
      role: "student"
    });

    // 5. Create Wallet
    await StudentCredit.create({
      student_obj_id: newStudent._id,
      studentEmail: newStudent.email,
      amount_for_online: invite.amount_for_online,
      amount_for_offline: invite.amount_for_offline
    });

    // 6. Create Parent Relation
    await StudentParentRelation.create({
      studentEmail: newStudent.email,
      parentEmail: invite.parentEmail
    });

    // ============================================================
    // 7. AUTO-ENROLLMENT IN BATCHES (SEQUENTIAL FIX)
    // ============================================================
    
    // Check if batches exist in the invite
    if (invite.enroll_batches && invite.enroll_batches.length > 0) {
      console.log(`[Auto-Enroll] Found ${invite.enroll_batches.length} batches. Starting sequential enrollment...`);
      
      // We use a for...of loop to ensure operations happen one by one.
      // This prevents race conditions or "missing" the second item.
      for (const batch of invite.enroll_batches) {
        try {
            // Safety Check: Ensure the batch object has an ID
            if (!batch.batch_obj_id) {
                console.warn(`[Auto-Enroll] Skipping invalid batch entry (no ID):`, batch);
                continue; 
            }

            console.log(`[Auto-Enroll] processing batch: ${batch.batchName} (${batch.batch_obj_id})`);

            await BatchStudentRelation.findOneAndUpdate(
                { 
                  batch_obj_id: batch.batch_obj_id, 
                  student_obj_id: newStudent._id 
                },
                { 
                  student_number: newStudent.student_number,
                  joinedAt: new Date()
                },
                { upsert: true, new: true }
            );
            
            console.log(`[Auto-Enroll] Success: Enrolled in ${batch.batchName}`);

        } catch (enrollError) {
            // Log the error but CONTINUE the loop so other batches still get added
            console.error(`[Auto-Enroll] Failed to enroll in batch ${batch.batchName}:`, enrollError);
        }
      }
    } else {
        console.log("[Auto-Enroll] No batches found in invitation to enroll.");
    }
    // ============================================================

    // 8. Cleanup
    await StudentDirectInvitation.findByIdAndDelete(invite._id);

    return sendResponse(res, 201, true, "Student onboarding and batch enrollment successful!", {
      studentId: newStudent._id,
      student_number: student_number
    });

  } catch (err) {
    console.error("onboardDirectStudent error:", err);
    return sendResponse(res, 500, false, "Server error onboarding student.");
  }
};