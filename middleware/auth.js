// middleware/auth.js - Middleware to verify JWT tokens

import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

export const verifyToken = async (req, res, next) => {
  // Allow OPTIONS requests to pass through (for CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  try {
    // First check for cookie
    let token = req.cookies.admin_token;
    
    // If no cookie, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.log('No token found in request');
      return res
        .status(401)
        .json({ message: "Access denied. No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if admin exists and is active
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      console.log('Admin not found or inactive', decoded.id);
      return res.status(401).json({ message: "Invalid or inactive account" });
    }

    // Add admin info to request
    req.admin = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired. Please login again" });
    }

    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Middleware to check if user is a superadmin
export const isSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === "superadmin") {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied. Superadmin privileges required" });
  }
};
