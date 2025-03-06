// controllers/subcategoryController.js
import Subcategory from "../models/Subcategory.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

// Get all subcategories
export const getAllSubcategories = async (req, res) => {
  try {
    let query;

    // If category ID is provided, filter by category
    if (req.params.categoryId) {
      query = Subcategory.find({ category: req.params.categoryId });
    } else {
      query = Subcategory.find();
    }

    // Add populate
    query = query.populate("category", "name");

    const subcategories = await query;

    res.status(200).json({
      success: true,
      count: subcategories.length,
      data: subcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
      error: error.message,
    });
  }
};

// Get a single subcategory
export const getSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id)
      .populate("category", "name")
      .populate("products");

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subcategory",
      error: error.message,
    });
  }
};

// Create a new subcategory
export const createSubcategory = async (req, res) => {
  try {
    // Check if the category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const subcategory = await Subcategory.create(req.body);

    res.status(201).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create subcategory",
      error: error.message,
    });
  }
};

// Update a subcategory
export const updateSubcategory = async (req, res) => {
  try {
    // If category is being updated, check if it exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update subcategory",
      error: error.message,
    });
  }
};

// Delete a subcategory
export const deleteSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Instead of subcategory.remove()
    await Subcategory.deleteOne({ _id: subcategory._id });

    // Manual cascade delete
    await Product.deleteMany({ subcategory: subcategory._id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete subcategory",
      error: error.message,
    });
  }
};
