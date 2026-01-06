// server.js (Main Entry Point)
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import './loadenv.js'




import connectDB from "./config/db.js";

// Middleware Imports
import { requireAdmin, requireStudent , requireTeacher, 
  requireParent, 
  requireNonStudent} from "./middleware/roleCheck.js";

// Controller Imports
import { getAllStudentDetails, updateStudentCredits  } from "./controllers/adminController.js";
// import { createInvite } from "./controllers/inviteController.js";
import {  completeStudentRegistration } from "./controllers/onboardController.js";
import { loginUser, logoutUser , whoAmI , checkRole } from "./controllers/authController.js";
import { requireAuthCookie } from "./middleware/auth.js";
// import { actionRequest, getAllAccessRequests, requestAccess } from "./controllers/requestAcess.js";
import { getMyChildrenDetails } from "./controllers/parentController.js";
import { getBatchAndSessionDetailsForTeacher , getLiveBatchInfoTeacher, getTodaysLiveBatchesForTeacher, listAllTeachers  } from "./controllers/teacherController.js";
import { askQ  , getMyChildHistory, getStudentFullHistory  , loadMyChat, setupChatThread } from "./controllers/AiController.js";


import {
  createBatchForAdmin,
  linkStudentToBatchForAdmin,
  updateBatchStatusForAdmin,
  createSessionInsideABatchForAdmin,
  listAllActiveBatchesForAdmin,
  getSessionForABatchForAdmin,
  getStudentInSBatchForAdmin,
  updateSessionDetailsForAdmin , 

  // Student
  myLiveBatchesForStudent,
  getSessionForABatchForStudent,
  getTodayLiveBatchInfoForStudent,
  studentBatchProgress,
  unlinkStudentFromBatchForAdmin
} from "./controllers/BatchController.js";

import { 
  raiseDoubt, 
  getMyDoubts, 
  getUnresolvedDoubts, 
  resolveDoubt 
} from "./controllers/doubtController.js";
import { attendanceStatusPerSession, attendanceStatusPerStudent, markAttendance } from "./controllers/AttendanceController.js";
import { getNewJoinersList, sendCredentialsToJoiner, validateInvitationToken } from "./controllers/courseOrderController.js";
import { remainingSessionInfoBatchForStudent } from "./controllers/RemainingSessionBuy.js";
import { inviteTeacher, onboardTeacher, validateTeacherInvite } from "./controllers/teacherOnboardingController.js";
import { inviteParent, onboardParent, validateParentInvite } from "./controllers/parentOnboardController.js";
import { inviteStudentAndParent, onboardDirectStudent, validateDirectStudentInvite } from "./controllers/studentdirectInvitation.js";
import { razorpayWebhook } from "./controllers/webhookController.js";
import { createCoursePaymentSession, createTopUpPaymentSession } from "./controllers/paymentController.js";
import { updateStudentProfile } from "./controllers/studentController.js";

// ---- Server & DB Initialization ----




const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();






// 2. Define the Webhook Route FIRST (Before express.json)
// We use express.raw() here because razorpay needs the raw request body to verify the signature.
app.post(
  "/api/razorpay-webhook", 
  express.raw({ type: "application/json" }), 
    razorpayWebhook
);







// ---- Core Middleware ----
app.use(express.json());
app.use(cookieParser());



app.use(
  cors({
    origin: process.env.FRONTEND_BASE,  // e.g. "https://myfrontend.app"
    credentials: true,
  })
);




// ---- Route Definitions ----

// Admin


// app.post("/api/admin/invite", requireAdmin, createInvite);
// app.post("/api/admin/actionrequest", requireAdmin, actionRequest);
// app.get("/api/admin/getallrequest", requireAdmin, getAllAccessRequests );
app.get("/api/admin/listallteachers", requireAuthCookie, requireAdmin, listAllTeachers);



app.get(
  "/api/admin/getallstudentdetails", 
  requireAuthCookie, 
  requireAdmin, 
  getAllStudentDetails
);




// 1. Create a new Batch
app.post("/api/admin/createbatch", requireAuthCookie, requireAdmin, createBatchForAdmin);

// 2. Link Student to Batch
app.post("/api/admin/linkstudenttobatch", requireAuthCookie, requireAdmin, linkStudentToBatchForAdmin);

// 3. Update Status (Upcoming/Live/Ended)
app.post("/api/admin/updatebatchstatus", requireAuthCookie, requireAdmin, updateBatchStatusForAdmin);

// 4. Create Session in Batch
app.post("/api/admin/createsession", requireAuthCookie, requireAdmin, createSessionInsideABatchForAdmin);


app.put(
  "/api/admin/update-session",
  requireAuthCookie,
  // requireAdmin, 
  updateSessionDetailsForAdmin
);



// 5. List All Active Batches
app.get("/api/admin/listallactivebatches", requireAuthCookie, requireAdmin, listAllActiveBatchesForAdmin);

// 6. Get Sessions for a Batch
app.get("/api/admin/getsessionforabatch", requireAuthCookie, requireAdmin, getSessionForABatchForAdmin);

// 7. Get Students in a Batch
app.get("/api/admin/getstudentofabatch", requireAuthCookie, requireAdmin, getStudentInSBatchForAdmin);

app.post( "/api/admin/unlinkstudentfrombatch",   requireAuthCookie,  requireAdmin,  unlinkStudentFromBatchForAdmin );



///////////////////// attenmdance route 


app.post(
  "/api/admin/mark-attendance",
  requireAuthCookie,
  requireAdmin,
  markAttendance
);



app.post(
  "/api/admin/attendance-status",
  requireAuthCookie,
  requireAdmin, 
  attendanceStatusPerSession
);


app.post(
  "/api/admin/student-attendance-history",
  requireAuthCookie,
  requireAdmin, 
  attendanceStatusPerStudent
);





app.get(
  "/api/admin/newjoinneslist", 
  requireAuthCookie, 
  requireAdmin, 
  getNewJoinersList
);



/////////////////////// for new joinnes , only student s who paid 
app.post(
  "/api/admin/send-credentials",
  requireAuthCookie,
  requireAdmin, // Ensure only admin can do this
  sendCredentialsToJoiner
);




app.post(
  "/api/admin/update-credits", 
  requireAuthCookie, 
  requireAdmin, 
  updateStudentCredits
);


//////////////////////////////////////////////////////////////////////////////////////////////////////





////////////////////////////// magic link user part 
// app.post("/api/invite-validate", validateInvite); // Also handles GET
// app.post("/api/onboard", onboardUser);




///// new version 
app.get("/api/validate-invitation", validateInvitationToken);

////only for student 
app.post("/api/complete-student-registration", completeStudentRegistration);




// Auth  for all 
app.post("/api/login", loginUser);
app.post("/api/logout", logoutUser);













////////////////////////     general routes 
app.get("/api/whoami", requireAuthCookie, whoAmI);
app.post("/api/checkrole", requireAuthCookie, checkRole);





//////////////// this is req that is sent by user during signup , that hey admin pls create my account  , new join reuest , open route 
// app.post("/api/requestaccess", requestAccess);
/////////////////////////////////////////////////////////////////////////////////////////////////////////













//////////////////// parent routes //////////////////////////////////////////////////////////////
app.get(
  "/api/parent/mychildrendetails", 
  requireAuthCookie,  // Checks for login
  requireParent,      // Checks for 'parent' role
  getMyChildrenDetails // Runs controller if both pass
);




app.get(
  "/api/parent/mychildhistory",
  requireAuthCookie,
  requireParent,
  getMyChildHistory
);


////////////////////////////////////////////////////////////////////////////////////////////////////////













/////////////// students routes   ///////////////////////////////////////////////////////////////////////////////////////////////////




app.post(
  "/api/student/setupchatthread",
  requireAuthCookie,
  requireStudent,
  setupChatThread
);



app.post(
  "/api/student/chathistory",
  requireAuthCookie,
  requireStudent,
  loadMyChat
);


app.post(
  "/api/student/askq",
  requireAuthCookie,
  requireStudent,
  askQ

);













// ================= STUDENT ROUTES =================

// 1. My Live Batches
app.get("/api/student/mylivebatches", requireAuthCookie, requireStudent, myLiveBatchesForStudent);

// 2. Get Sessions for a Batch (Enrolled only)
app.get("/api/student/getsessionforabatch", requireAuthCookie, requireStudent, getSessionForABatchForStudent);

// 3. Today's Batch Info (Class today? Next class?)
app.post("/api/student/gettodaylivebatchinfo", requireAuthCookie, requireStudent, getTodayLiveBatchInfoForStudent);

app.post("/api/student/getbatchprogress", requireAuthCookie, requireStudent, studentBatchProgress);



app.get(
  "/api/student/remaining-session-info", 
  requireAuthCookie, 
  requireStudent, 
  remainingSessionInfoBatchForStudent
);



app.post(
  "/api/student/create-credit-topup-session" , 
  requireAuthCookie , 
  requireStudent , 
  createTopUpPaymentSession
)




app.put(   "/api/student/update-profile" , requireAuthCookie , requireStudent , updateStudentProfile  )
///////////////////////////////////////////////////////////////////////////////////////////////////









////////////////////////////////////////////  teeacher 
app.get(
  "/api/teacher/getlivebatchinfo",
  requireAuthCookie,
  requireTeacher,
  getLiveBatchInfoTeacher
);

app.get(
  "/api/teacher/todayslivebatchinfo",
  requireAuthCookie,
  requireTeacher,
  getTodaysLiveBatchesForTeacher
);



app.get(
  "/api/teacher/batchdetails", 
  requireAuthCookie,
  requireTeacher,
  getBatchAndSessionDetailsForTeacher
);












////////////// non student path 
app.get(
  "/api/studenthistory",
  requireAuthCookie,
  requireNonStudent,
  getStudentFullHistory

  
);
////////////////////////////////////////











// --- Doubt Routes (Student) ---//////////////////////////////////////////////////////////
app.post(
  "/api/student/raisedoubt",
  requireAuthCookie,
  requireStudent,
  raiseDoubt
);

app.get(
  "/api/student/mydoubts",
  requireAuthCookie,
  requireStudent,
  getMyDoubts
);

// --- Doubt Routes (Teacher) ---
app.get(
  "/api/teacher/unresolveddoubts",
  requireAuthCookie,
  requireTeacher,
  getUnresolvedDoubts
);

app.post(
  "/api/teacher/resolvedoubt",
  requireAuthCookie,
  requireTeacher,
  resolveDoubt
);

//////////////////////////////////////////////////////////////////////////////////







// --- Teacher Onboarding Routes ---

// 1. Admin sends the invite
app.post(
  "/api/admin/invite-teacher", 
  requireAuthCookie, 
  requireAdmin, 
  inviteTeacher
);

// 2. Validate Link (Public - called when page loads)
app.get(
  "/api/validate-teacher-invite", 
  validateTeacherInvite
);

// 3. Complete Registration (Public - called on form submit)
app.post(
  "/api/complete-teacher-onboarding", 
  onboardTeacher
);








///////////////////// new parent invite controller 
// 1. Admin sends invitation
app.post(
  "/api/admin/invite-parent", 
  requireAuthCookie, 
  requireAdmin, 
  inviteParent
);

// 2. Validate Link (Public)
app.get(
  "/api/validate-parent-invite", 
  validateParentInvite
);

// 3. Complete Registration (Public)
app.post(
  "/api/complete-parent-onboarding", 
  onboardParent
);
















//////////////////////////// direct studnt invite payment 

// 1. Admin sends the Combo Invite
app.post(
  "/api/admin/invite-student-direct", 
  requireAuthCookie, 
  requireAdmin, 
  inviteStudentAndParent
);

// 2. Student validates their Direct Link
app.get(
  "/api/validate-direct-student-invite", 
  validateDirectStudentInvite
);

// 3. Student completes registration
app.post(
  "/api/complete-direct-student-onboarding", 
  onboardDirectStudent
);







/////////////////////////////////////////////////////////    payment 
app.post("/api/create-checkout-session" , createCoursePaymentSession)



app.get("/test", (req, res) => res.send("yes server is on"));


// ---- Server Start ----
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));