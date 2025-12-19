// import { Resend } from "resend";
// import { sendResponse, signToken } from "../middleware/auth.js";
// import Admin from "../models/Admin.js";
// import Student from "../models/Student.js";
// import Teacher from "../models/Teacher.js";
// import Parent from "../models/Parent.js";
// // import Invitation from "../models/Invitation.js";
// import StudentParentRelation from "../models/StudentParentRelation.js";

// const { RESEND_EMAIL_API_KEY, SMTP_USER, FRONTEND_BASE } = process.env;

// const resend = new Resend(RESEND_EMAIL_API_KEY);

// /**
//  * -----------------------------------------------------------------
//  * HELPER FUNCTION (This creates/sends any single invitation)
//  * -----------------------------------------------------------------
//  */
// // export const createAndSendInvitation = async (email, role, req) => {
// //   const e = String(email).toLowerCase().trim();
// //   if (!["student", "teacher", "parent"].includes(role)) {
// //     throw new Error("Invalid role specified.");
// //   }

// //   // Check 1: Is user already registered?
// //   const used = await Promise.all([
// //     Student.findOne({ email: e }),
// //     Teacher.findOne({ email: e }),
// //     Parent.findOne({ email: e }),
// //     Admin.findOne({ email: e }),
// //   ]);
// //   if (used.some(Boolean)) {
// //     throw new Error(`Email already registered as a user.`);
// //   }

// //   // Check 2: Is an invitation pending?
// //   const existingInvite = await Invitation.findOne({ email: e });

// //   /**
// //    * -----------------------------------------------------------
// //    *  🔥 MODIFIED LOGIC (RESEND EXISTING INVITATION)
// //    * -----------------------------------------------------------
// //    */
// //   if (existingInvite) {
// //     console.log("📨 Resending existing invitation...");

// //     const { token, otp } = existingInvite;

// //     const link = `${FRONTEND_BASE}/invite/onboard?token=${encodeURIComponent(
// //       token
// //     )}&role=${encodeURIComponent(role)}`;

// //     const html = `<p>You have been invited as <b>${role}</b>.</p>
// //                   <p>OTP  : <b>${otp}</b></p>
// //                   <p>Validate link: <a href="${link}">${link}</a></p>`;

// //     // --- LOG BEFORE RESEND ---
// //     console.log("📨 Re-sending email via RESEND:", {
// //       to: e,
// //       role,
// //       frontendLink: link
// //     });

// //     // SEND AGAIN
// //     const result = await resend.emails.send({
// //       from: SMTP_USER,
// //       to: e,
// //       subject: `Invite as ${role} (Resent)`,
// //       html,
// //     });

// //     console.log("📧 RESEND EMAIL RESULT:", {
// //       to: e,
// //       messageId: result?.data?.id || null,
// //       error: result?.error || null,
// //     });

// //     throw new Error("RESEND_EXISTING_INVITATION"); // used for response later
// //   }

// //   // ------------------------------------------------------------
// //   // Original: Create new invitation
// //   // ------------------------------------------------------------
// //   const otp = Math.floor(100000 + Math.random() * 900000).toString();
// //   const token = signToken({ email: e, role }, "60m");

// //   const inviteDoc = new Invitation({
// //     email: e,
// //     role,
// //     otp,
// //     token,
// //   });
// //   await inviteDoc.save();

// //   const link = `${FRONTEND_BASE}/invite/onboard?token=${encodeURIComponent(
// //     token
// //   )}&role=${encodeURIComponent(role)}`;

// //   const html = `<p>You have been invited as <b>${role}</b>.</p>
// //                 <p>OTP  : <b>${otp}</b></p>
// //                 <p>Validate link: <a href="${link}">${link}</a></p>`;

// //   console.log("📨 Sending email via RESEND:", {
// //     to: e,
// //     role,
// //     frontendLink: link
// //   });

// //   const result = await resend.emails.send({
// //     from: SMTP_USER,
// //     to: e,
// //     subject: `Invite as ${role}`,
// //     html,
// //   });

// //   console.log("📧 RESEND EMAIL RESULT:", {
// //     to: e,
// //     messageId: result?.data?.id || null,
// //     error: result?.error || null,
// //   });

// //   return inviteDoc;
// // };

// /**
//  * -----------------------------------------------------------------
//  * CONTROLLER (This is the route admins call)
//  * -----------------------------------------------------------------
//  */
// // export const createInvite = async (req, res) => {
// //   try {
// //     const { email, role, parentEmails = [], childEmails = [] } = req.body;
// //     if (!email || !role)
// //       return sendResponse(res, 400, false, "email and role required");

// //     const mainEmail = String(email).toLowerCase().trim();

// //     let mainInviteCreated = false;
// //     let resendMode = false;

// //     // --- 1. Main invite ---
// //     try {
// //       await createAndSendInvitation(mainEmail, role, req);
// //       mainInviteCreated = true;
// //     } catch (err) {
// //       if (err.message === "RESEND_EXISTING_INVITATION") {
// //         resendMode = true;
// //       } else {
// //         throw err;
// //       }
// //     }

// //     const results = [];

// //     /**
// //      * ---------------------------------------------------------
// //      * 2. If role is STUDENT → Invite Parents
// //      * ---------------------------------------------------------
// //      */
// //     if (role === "student" && Array.isArray(parentEmails) && !resendMode) {
// //       for (const pEmail of parentEmails) {
// //         const pEmailClean = String(pEmail).toLowerCase().trim();
// //         if (!pEmailClean) continue;

// //         const existingParent = await Parent.findOne({ email: pEmailClean });

// //         if (!existingParent) {
// //           try {
// //             await createAndSendInvitation(pEmailClean, "parent", req);
// //             results.push({ email: pEmailClean, status: "Invited as parent" });
// //           } catch (err) {
// //             if (err.message === "RESEND_EXISTING_INVITATION") {
// //               results.push({ email: pEmailClean, status: "Parent invitation resent" });
// //             } else {
// //               results.push({ email: pEmailClean, status: `Error: ${err.message}` });
// //             }
// //           }
// //         } else {
// //           results.push({ email: pEmailClean, status: "Parent account exists" });
// //         }

// //         try {
// //           await StudentParentRelation.create({
// //             studentEmail: mainEmail,
// //             parentEmail: pEmailClean,
// //           });
// //           results.push({ link: `${mainEmail} <-> ${pEmailClean}`, status: "Link created" });
// //         } catch (err) {
// //           if (err.code === 11000) {
// //             results.push({ link: `${mainEmail} <-> ${pEmailClean}`, status: "Link already exists" });
// //           } else {
// //             results.push({
// //               link: `${mainEmail} <-> ${pEmailClean}`,
// //               status: `Error creating link: ${err.message}`,
// //             });
// //           }
// //         }
// //       }
// //     }

// //     /**
// //      * ---------------------------------------------------------
// //      * 3. If role is PARENT → Invite Children
// //      * ---------------------------------------------------------
// //      */
// //     if (role === "parent" && Array.isArray(childEmails) && !resendMode) {
// //       for (const cEmail of childEmails) {
// //         const cEmailClean = String(cEmail).toLowerCase().trim();
// //         if (!cEmailClean) continue;

// //         const existingStudent = await Student.findOne({ email: cEmailClean });

// //         if (!existingStudent) {
// //           try {
// //             await createAndSendInvitation(cEmailClean, "student", req);
// //             results.push({ email: cEmailClean, status: "Invited as student" });
// //           } catch (err) {
// //             if (err.message === "RESEND_EXISTING_INVITATION") {
// //               results.push({ email: cEmailClean, status: "Student invitation resent" });
// //             } else {
// //               results.push({ email: cEmailClean, status: `Error: ${err.message}` });
// //             }
// //           }
// //         } else {
// //           results.push({ email: cEmailClean, status: "Student account exists" });
// //         }

// //         try {
// //           await StudentParentRelation.create({
// //             studentEmail: cEmailClean,
// //             parentEmail: mainEmail,
// //           });
// //           results.push({ link: `${cEmailClean} <-> ${mainEmail}`, status: "Link created" });
// //         } catch (err) {
// //           if (err.code === 11000) {
// //             results.push({ link: `${cEmailClean} <-> ${mainEmail}`, status: "Link already exists" });
// //           } else {
// //             results.push({
// //               link: `${cEmailClean} <-> ${mainEmail}`,
// //               status: `Error creating link: ${err.message}`,
// //             });
// //           }
// //         }
// //       }
// //     }

// //     // final response
// //     if (resendMode) {
// //       return sendResponse(res, 200, true, "Invitation already existed . Resending the email ", {});
// //     }

// //     return sendResponse(
// //       res,
// //       200,
// //       true,
// //       "Main invitation created. Linked accounts processed.",
// //       { processingResults: results }
// //     );

// //   } catch (err) {
// //     console.error("createInvite err", err);

// //     if (err.message.includes("already registered")) {
// //       return sendResponse(res, 409, false, err.message);
// //     }
// //     if (err.message.includes("Invalid role")) {
// //       return sendResponse(res, 400, false, err.message);
// //     }

// //     return sendResponse(res, 500, false, err.message || "Server error creating invitation");
// //   }
// // };
