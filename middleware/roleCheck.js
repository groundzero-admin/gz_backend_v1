// middleware/roleCheck.js
import { requireAuthCookie, sendResponse } from './auth.js';

// require admin role
export const requireAdmin = (req, res, next) => {
  requireAuthCookie(req, res, () => {
    if (!req.authPayload || req.authPayload.role !== "admin") 
      return sendResponse(res, 403, false, "Admin only");
    next();
  });
};

// require student role
export const requireStudent = (req, res, next) => {
  requireAuthCookie(req, res, () => {
    if (!req.authPayload || req.authPayload.role !== "student") 
      return sendResponse(res, 403, false, "Students only");
    next();
  });
};





export const requireTeacher = (req, res, next) => {
  requireAuthCookie(req, res, () => {
    if (!req.authPayload || req.authPayload.role !== "teacher") 
      return sendResponse(res, 403, false, "Teachers only");
    next();
  });
};

// require parent role
export const requireParent = (req, res, next) => {
  requireAuthCookie(req, res, () => {
    if (!req.authPayload || req.authPayload.role !== "parent") 
      return sendResponse(res, 403, false, "Parents only");
    next();
  });
};









export const requireNonStudent = (req, res, next) => {
  requireAuthCookie(req, res, () => {
    const role = req.authPayload?.role;
    if (!role) {
      return sendResponse(res, 401, false, "Invalid auth token");
    }
    if (role === "student") {
      return sendResponse(res, 403, false, "Access denied for students.");
    }
    // Allows admin, teacher, and parent
    if (role === "admin" || role === "teacher" || role === "parent") {
      next();
    } else {
      return sendResponse(res, 403, false, "Insufficient permissions.");
    }
  });
};