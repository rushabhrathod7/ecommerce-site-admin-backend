import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Admin routes
import adminRoutes from "./admin/routes/admin.js";
import categoryRoutes from "./admin/routes/categoryRoutes.js";
import subcategoryRoutes from "./admin/routes/subcategoryRoutes.js";
import productRoutes from "./admin/routes/productRoutes.js";
import adminOrderRoutes from "./admin/routes/orderRoutes.js";

// User routes
import userRoutes from "./user/routes/userRoutes.js";
import paymentRoutes from './user/routes/paymentRoutes.js';
import orderRoutes from './user/routes/orderRoutes.js';

// Shared routes
import authRoutes from "./shared/routes/auth.js";
import publicRoutes from "./shared/routes/publicRoutes.js";
import uploadRoutes from "./shared/routes/uploadRoutes.js";

import { verifyAdminToken } from "./middleware/auth.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Configure CORS with options for cookies to work properly
app.use(
  cors({
    origin: ["http://localhost:5173","http://localhost:5174", "https://api.cloudinary.com"],
    credentials: true, // Allow cookies to be sent with requests
  })
);

// Cookie parser middleware
app.use(cookieParser());

// Body parser middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for webhook payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
app.use("/api/uploads", uploadRoutes);

// Apply admin authentication middleware to all admin routes
app.use("/api/admin", verifyAdminToken);

// Mount admin routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/admin/subcategories", subcategoryRoutes);
app.use("/api/admin/products", productRoutes);
app.use("/api/admin/orders", adminOrderRoutes);

// User routes
app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Root route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});