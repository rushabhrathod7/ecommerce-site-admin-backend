// controllers/productController.js
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Subcategory from "../models/Subcategory.js";

// Get all products with filtering, sorting, and pagination
export const getAllProducts = async (req, res) => {
  try {
    // Copy query object
    const queryObj = { ...req.query };

    // Fields to exclude from filtering
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((field) => delete queryObj[field]);

    // Build filter query
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Filter by category or subcategory if provided in URL params
    let filterOptions = JSON.parse(queryStr);
    if (req.params.categoryId) {
      filterOptions.category = req.params.categoryId;
    }
    if (req.params.subcategoryId) {
      filterOptions.subcategory = req.params.subcategoryId;
    }

    // Initial query
    let query = Product.find(filterOptions)
      .populate({
        path: "category",
        select: "name",
      })
      .populate({
        path: "subcategory",
        select: "name",
      });

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(",").join(" ");
      query = query.select(fields);
    } else {
      query = query.select("-__v");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const products = await query;

    // Get total count for pagination
    const total = await Product.countDocuments(filterOptions);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// Get a single product
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("subcategory", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// Create a new product
export const createProduct = async (req, res) => {
  try {
    // Check if category and subcategory exist and are related
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const subcategory = await Subcategory.findById(req.body.subcategory);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Validate that subcategory belongs to the specified category
    if (subcategory.category.toString() !== req.body.category) {
      return res.status(400).json({
        success: false,
        message: "Subcategory does not belong to the specified category",
      });
    }

    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// Update a product
export const updateProduct = async (req, res) => {
  try {
    // If category or subcategory is being updated, perform validation
    if (req.body.category || req.body.subcategory) {
      let categoryId = req.body.category;
      let subcategoryId = req.body.subcategory;

      // If only one is being updated, get the current values
      if (!categoryId || !subcategoryId) {
        const currentProduct = await Product.findById(req.params.id);
        if (!currentProduct) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        categoryId = categoryId || currentProduct.category;
        subcategoryId = subcategoryId || currentProduct.subcategory;
      }

      // Check if category exists
      if (req.body.category) {
        const category = await Category.findById(categoryId);
        if (!category) {
          return res.status(404).json({
            success: false,
            message: "Category not found",
          });
        }
      }

      // Check if subcategory exists
      if (req.body.subcategory) {
        const subcategory = await Subcategory.findById(subcategoryId);
        if (!subcategory) {
          return res.status(404).json({
            success: false,
            message: "Subcategory not found",
          });
        }

        // Validate relationship if both category and subcategory are being updated
        if (
          req.body.category &&
          subcategory.category.toString() !== categoryId.toString()
        ) {
          return res.status(400).json({
            success: false,
            message: "Subcategory does not belong to the specified category",
          });
        }
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// Delete a product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Instead of product.remove()
    await Product.deleteOne({ _id: product._id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// Search products
export const searchProducts = async (req, res) => {
  try {
    if (!req.query.q) {
      return res.status(400).json({
        success: false,
        message: "Please provide a search query",
      });
    }

    const products = await Product.find({
      $text: { $search: req.query.q },
    })
      .populate("category", "name")
      .populate("subcategory", "name");

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search products",
      error: error.message,
    });
  }
};
