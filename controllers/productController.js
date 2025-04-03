// controllers/productController.js
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Subcategory from "../models/Subcategory.js";
import cloudinary from "../config/cloudinary.js";

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

// Create a new product with image uploads
export const createProduct = async (req, res) => {
  try {
    // Get the product data from the request body
    const productData = { ...req.body };
    
    // Handle images directly from request body (new direct Cloudinary integration)
    // Images are now sent as part of the JSON data rather than files
    if (req.body.images) {
      // If images are sent as a string (happens when using FormData), parse them
      if (typeof req.body.images === 'string') {
        try {
          productData.images = JSON.parse(req.body.images);
        } catch (e) {
          productData.images = [];
        }
      }
    } else {
      productData.images = [];
    }

    // Create the product
    const product = await Product.create(productData);

    // Return the created product
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
    const productId = req.params.id;
    
    // Get the product data from the request body
    const productData = { ...req.body };
    
    // Find the product to update
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    
    // Handle images directly from request body (new direct Cloudinary integration)
    // Images are now sent as part of the JSON data rather than files
    if (req.body.images) {
      // If images are sent as a string (happens when using FormData), parse them
      if (typeof req.body.images === 'string') {
        try {
          productData.images = JSON.parse(req.body.images);
        } catch (e) {
          // Keep existing images if parsing fails
          productData.images = product.images;
        }
      }
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      productData,
      {
        new: true,
        runValidators: true,
      }
    );

    // Return the updated product
    res.status(200).json({
      success: true,
      data: updatedProduct,
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

    // Delete all product images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    // Delete the product
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

// Upload product images
export const uploadProductImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "products",
        use_filename: true,
        unique_filename: true,
      });
      
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    
    // Append new images to existing ones
    product.images = [...product.images, ...uploadedImages];
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to upload images",
      error: error.message,
    });
  }
};

// Delete product image
export const deleteProductImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imageIndex = product.images.findIndex(img => img.public_id === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(imageId);

    // Remove image from product
    product.images.splice(imageIndex, 1);
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};