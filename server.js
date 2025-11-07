// server.js (Main Entry Point)
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import './loadenv.js'





import connectDB from "./config/db.js";

// Middleware Imports
import { requireAdmin, requireStudent } from "./middleware/roleCheck.js";

// Controller Imports
import { loginAdmin } from "./controllers/adminController.js";
import { createInvite } from "./controllers/inviteController.js";
import { validateInvite, onboardUser } from "./controllers/onboardController.js";
import { loginUser, logoutUser , whoAmI , checkRole } from "./controllers/authController.js";
import { createCourse } from "./controllers/courseController.js";
import { enrollStudent } from "./controllers/enrollmentController.js";
import { createCourseContent } from "./controllers/contentController.js";
import { updateProgress } from "./controllers/progressController.js";
import { logPrompt } from "./controllers/promptController.js";
import { requireAuthCookie } from "./middleware/auth.js";
import { actionRequest, getAllAccessRequests, requestAccess } from "./controllers/requestAcess.js";

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







////////////////////////////// magic link user part 
app.post("/api/invite-validate", validateInvite); // Also handles GET
app.post("/api/onboard", onboardUser);






// Auth
app.post("/api/login", loginUser);
app.post("/api/logout", logoutUser);

// Course Management (Admin)
app.post("/api/createcourse", requireAdmin, createCourse);

// Enrollment (Student)
app.post("/api/enrollment", requireStudent, enrollStudent);

// Course Content (Admin)
app.post("/api/course-content/create", requireAdmin, createCourseContent);

// Student Progress
app.post("/api/content/progress", requireStudent, updateProgress);
app.post("/api/prompt-log", requireStudent, logPrompt);


app.get("/api/whoami", requireAuthCookie, whoAmI);
app.post("/api/checkrole", requireAuthCookie, checkRole);


//////////////// this is req that is sent by user during signup , that hey admin pls create my account 
app.post("/api/requestaccess", requestAccess);


// ---- Server Start ----
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));