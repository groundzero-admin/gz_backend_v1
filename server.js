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
import { getAllStudentDetails  } from "./controllers/adminController.js";
import { createInvite } from "./controllers/inviteController.js";
import { validateInvite, onboardUser } from "./controllers/onboardController.js";
import { loginUser, logoutUser , whoAmI , checkRole } from "./controllers/authController.js";
import { requireAuthCookie } from "./middleware/auth.js";
import { actionRequest, getAllAccessRequests, requestAccess } from "./controllers/requestAcess.js";
import { getMyChildrenDetails } from "./controllers/parentController.js";
import { listAllTeachers, listMyStudents } from "./controllers/teacherController.js";
import { askQ  , getMyChildHistory, getStudentFullHistory  , loadMyChat, setupChatThread } from "./controllers/AiController.js";
import { createBatch, createBatchWeek, getAllBatchesForStudent, getMyEnrolledBatches, getMyLiveBatches, getStudentsInBatch, getTodaysLiveBatchInfo, getWeeksForABatch, getWeeksForBatchStudent, linkStudentToBatch, listAllActiveBatches, updateBatchStatus } from "./controllers/BatchController.js";

// ---- Server & DB Initialization ----




const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

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


app.post("/api/admin/invite", requireAdmin, createInvite);
app.post("/api/admin/actionrequest", requireAdmin, actionRequest);
app.get("/api/admin/getallrequest", requireAdmin, getAllAccessRequests );
app.get("/api/admin/listallteachers", requireAuthCookie, requireAdmin, listAllTeachers);



app.get(
  "/api/admin/getallstudentdetails", 
  requireAuthCookie, 
  requireAdmin, 
  getAllStudentDetails
);







app.post(
  "/api/admin/createCourse", 
  requireAuthCookie, 
  requireAdmin, 
  createBatch
);


app.post(
  "/api/admin/linkstudentinabatch", 
  requireAuthCookie, 
  requireAdmin, 
  linkStudentToBatch
);


app.post(
  "/api/admin/updatebatchstatus", 
  requireAuthCookie, 
  requireAdmin, 
  updateBatchStatus
);



app.post(
  "/api/admin/createbatchweek", 
  requireAuthCookie, 
  requireAdmin, 
  createBatchWeek
);



//////////////////////////////////// returns live and upcoming batches 
app.get(
  "/api/admin/listallbatches",
  requireAuthCookie,
  requireAdmin,
  listAllActiveBatches
);

// V-- NEW GET ROUTE: Get weeks for a specific batch
app.get(
  "/api/admin/weekinforabatch",
  requireAuthCookie,
  requireAdmin,
  getWeeksForABatch
);


app.get(
  "/api/admin/getstudentsinbatch", 
  requireAuthCookie, 
  requireAdmin, 
  getStudentsInBatch
);




//////////////////////////////////////////////////////////////////////////////////////////////////////





////////////////////////////// magic link user part 
app.post("/api/invite-validate", validateInvite); // Also handles GET
app.post("/api/onboard", onboardUser);






// Auth  for all 
app.post("/api/login", loginUser);
app.post("/api/logout", logoutUser);













////////////////////////     general routes 
app.get("/api/whoami", requireAuthCookie, whoAmI);
app.post("/api/checkrole", requireAuthCookie, checkRole);





//////////////// this is req that is sent by user during signup , that hey admin pls create my account  , new join reuest , open route 
app.post("/api/requestaccess", requestAccess);
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



app.get(
  "/api/student/mylivebatchlist",
  requireAuthCookie,
  requireStudent,
  getMyLiveBatches
);


app.get(
  "/api/student/myenrolledbatches",
  requireAuthCookie,
  requireStudent,
  getMyEnrolledBatches
);



app.get(
  "/api/student/getallbatches",
  requireAuthCookie,
  requireStudent,
  getAllBatchesForStudent
);



app.get(
  "/api/student/weeksinfoofbatch",
  requireAuthCookie,
  requireStudent,
  getWeeksForBatchStudent
);


app.post(
  "/api/student/todayslivebatchinfo",
  requireAuthCookie,
  requireStudent,
  getTodaysLiveBatchInfo
);

///////////////////////////////////////////////////////////////////////////////////////////////////










app.get(
  "/api/teacher/listmystudent",
  requireAuthCookie,
  requireTeacher,
  listMyStudents
);






////////////// non student path 
app.get(
  "/api/studenthistory",
  requireAuthCookie,
  requireNonStudent,
  getStudentFullHistory

  
);
////////////////////////////////////////





// ---- Server Start ----
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));