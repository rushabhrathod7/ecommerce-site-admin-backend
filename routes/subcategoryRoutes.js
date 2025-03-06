// routes/subcategoryRoutes.js
import express from "express";
import {
  getAllSubcategories,
  getSubcategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/subcategoryController.js";

// Import product routes to re-route
import productRouter from "./productRoutes.js";

const router = express.Router({ mergeParams: true });

// Re-route to product router
router.use("/:subcategoryId/products", productRouter);

// Basic CRUD routes
router.route("/").get(getAllSubcategories).post(createSubcategory);

router
  .route("/:id")
  .get(getSubcategory)
  .put(updateSubcategory)
  .delete(deleteSubcategory);

export default router;
