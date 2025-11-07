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