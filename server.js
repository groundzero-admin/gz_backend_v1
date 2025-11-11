// server.js (Main Entry Point)
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import './loadenv.js'




import connectDB from "./config/db.js";

// Middleware Imports
import { requireAdmin, requireStudent , requireTeacher, 
  requireParent, 
  requireNonStudent} from "./middleware/roleCheck.js";

// Controller Imports
import { getAllStudentDetails, loginAdmin } from "./controllers/adminController.js";
import { createInvite } from "./controllers/inviteController.js";
import { validateInvite, onboardUser } from "./controllers/onboardController.js";
import { loginUser, logoutUser , whoAmI , checkRole } from "./controllers/authController.js";
import { createCourse , listAllCourses, listStudentsCourses, listTeachersCourses } from "./controllers/courseController.js";
import { enrollStudent } from "./controllers/enrollmentController.js";
import { requireAuthCookie } from "./middleware/auth.js";
import { actionRequest, getAllAccessRequests, requestAccess } from "./controllers/requestAcess.js";
import { getMyChildrenDetails } from "./controllers/parentController.js";
import { listAllTeachers, listMyStudents } from "./controllers/teacherController.js";
import { getWorksheetsFromCCourseForAdmin, listWorksheetsFromCCourseForStudent, uploadWorksheet } from "./controllers/workSheetController.js";
import upload from "./middleware/uploadfile.js";
import { getMyOldChats, getStudentChatHistory } from "./controllers/AiController.js";


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
app.post("/api/admin/login", loginAdmin);
app.post("/api/admin/invite", requireAdmin, createInvite);
app.post("/api/admin/actionrequest", requireAdmin, actionRequest);
app.get("/api/admin/getallrequest", requireAdmin, getAllAccessRequests );
app.get("/api/admin/listallteachers", requireAuthCookie, requireAdmin, listAllTeachers);
app.post( "/api/admin/createcourse", requireAuthCookie, requireAdmin,  createCourse   );
app.get(  "/api/admin/listallcourse",  requireAuthCookie, requireAdmin, listAllCourses  );

app.post(
  "/api/admin/uploadworksheet",
  requireAuthCookie,
  requireAdmin,
  upload.single("worksheetFile"), // This field name must match your frontend
  uploadWorksheet
);


app.get(
  "/api/admin/worksheetfromcouse",
  requireAuthCookie,
  requireAdmin,
  getWorksheetsFromCCourseForAdmin
);


app.get(
  "/api/admin/getallstudentdetails", 
  requireAuthCookie, 
  requireAdmin, 
  getAllStudentDetails
);







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







//////////// get student promt hiostory only for admin teacher parent , except for student ////////////////////////////////////////
app.get(
  "/api/shared/studentchathistory",
  requireAuthCookie,    // Checks for login
  requireNonStudent,    // Checks for Admin, Teacher, or Parent
  getStudentChatHistory // Runs controller
);

/////////////////////////////////////////////// ///////////////////     /   //////////////////////////////////////////////////////////////






//////////////////// parent routes //////////////////////////////////////////////////////////////
app.get(
  "/api/parent/mychildrendetails", 
  requireAuthCookie,  // Checks for login
  requireParent,      // Checks for 'parent' role
  getMyChildrenDetails // Runs controller if both pass
);


////////////////////////////////////////////////////////////////////////////////////////////////////////













/////////////// students routes   ///////////////////////////////////////////////////////////////////////////////////////////////////
  
app.get(
  "/api/student/listmycourses",
  requireAuthCookie,  // Checks for login
  requireStudent,     // Checks for 'student' role
  listStudentsCourses       // Runs controller
);


app.get(
  "/api/student/worksheetsfromcourse",
  requireAuthCookie,
  requireStudent,
  listWorksheetsFromCCourseForStudent
);


app.get(
  "/api/student/myoldchats",
  requireAuthCookie,
  requireStudent,
  getMyOldChats
);


// Enrollment (Student)
app.post("/api/student/enrollment", requireStudent, enrollStudent);

///////////////////////////////////////////////////////////////////////////////////////////////////









///// teachers routes
app.get(
  "/api/teacher/listmycourses",
  requireAuthCookie,      // Checks for login
  requireTeacher,         // Checks for 'teacher' role
  listTeachersCourses     // Runs controller
);

app.get(
  "/api/teacher/worksheetfromcouse",
  requireAuthCookie,
  requireTeacher,
  getWorksheetsFromCCourseForAdmin
);


app.get(
  "/api/teacher/listmystudent",
  requireAuthCookie,
  requireTeacher,
  listMyStudents
);












// ---- Server Start ----
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));