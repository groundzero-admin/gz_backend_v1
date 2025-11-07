// middleware/auth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

/* -------------------- Shared Helpers -------------------- */

export const sendResponse = (res, status, success, message, data = null) =>
  res.status(status).json({ success, message, data });

export const signToken = (payload, expiresIn = "15m") =>
  jwt.sign(payload, JWT_SECRET, { expiresIn });

export const verifyTokenSafe = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
};

/* -------------------- Auth Middleware -------------------- */

// verifies cookie token; sets req.authPayload
export const requireAuthCookie = (req, res, next) => {
  console.log(1111)
  try {
    const token = req.cookies?.auth_token;
    if (!token) return sendResponse(res, 401, false, "Missing auth cookie , you are not logged in ");
    
    const payload = verifyTokenSafe(token);
    if (!payload) return sendResponse(res, 401, false, "Invalid or expired auth token");
    
    req.authPayload = payload; // contains id, role, email
    next();
  } catch (err) {
    console.error("requireAuthCookie err", err);
    return sendResponse(res, 500, false, "Server error auth");
  }
};