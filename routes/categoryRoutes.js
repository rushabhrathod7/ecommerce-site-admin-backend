// routes/categoryRoutes.js
import express from "express";
import {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

// Import subcategory routes to re-route
import subcategoryRouter from "./subcategoryRoutes.js";
// Import product routes to re-route
import productRouter from "./productRoutes.js";

const router = express.Router();

// Re-route to subcategory router
router.use("/:categoryId/subcategories", subcategoryRouter);

// Add this line to re-route to product router
router.use("/:categoryId/products", productRouter);

// Basic CRUD routes
router.route("/").get(getAllCategories).post(createCategory);

router
  .route("/:id")
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

export default router;
