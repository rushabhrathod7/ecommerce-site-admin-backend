// routes/productRoutes.js
import express from "express";
import {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
} from "../controllers/productController.js";

const router = express.Router({ mergeParams: true });

// Search route
router.get("/search", searchProducts);

// Basic CRUD routes
router.route("/").get(getAllProducts).post(createProduct);

router.route("/:id").get(getProduct).put(updateProduct).delete(deleteProduct);

export default router;
