import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../../admin/models/Product.js';

/**
 * Get all users with optional filtering
 */
export const getAllUsers = async (req, res) => {
  try {
    const { sortBy, order, limit, page, search } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    // Pagination
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;

    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .select('-__v');

    const total = await User.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user by clerkId
 */
export const getUserByClerkId = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    const user = await User.findOne({ clerkId }).select('-__v');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by clerkId:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user by ID with detailed information
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-__v')
      .populate({
        path: 'orders.orderId',
        select: 'orderNumber items totalAmount status createdAt'
      })
      .populate({
        path: 'reviews.productId',
        select: 'name slug images'
      })
      .populate({
        path: 'wishlist',
        select: 'name slug price images'
      })
      .populate({
        path: 'cart.productId',
        select: 'name slug price images stock'
      });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update user metadata (custom fields)
 */
export const updateUserMetadata = async (req, res) => {
  try {
    const { clerkId } = req.params;
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid metadata' });
    }
    
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update metadata (merge with existing)
    user.metadata = { ...user.metadata, ...metadata };
    user.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Delete user (admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    const user = await User.findOneAndDelete({ clerkId });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Manual sync with Clerk (in case webhook failed)
 * This would typically be an admin-only endpoint
 */
export const syncUserFromClerk = async (req, res) => {
  try {
    const { clerkId } = req.params;
    
    // This would use your Clerk SDK to fetch user data
    // For this example, we'll assume you pass the Clerk user data in the request body
    const clerkUserData = req.body;
    
    if (!clerkUserData || !clerkUserData.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Clerk user data' 
      });
    }
    
    // Update or create user
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        email: clerkUserData.email_addresses?.[0]?.email_address || '',
        firstName: clerkUserData.first_name || '',
        lastName: clerkUserData.last_name || '',
        username: clerkUserData.username || '',
        profileImageUrl: clerkUserData.profile_image_url || '',
        emailVerified: clerkUserData.email_addresses?.[0]?.verification?.status === 'verified',
        metadata: clerkUserData.public_metadata || {},
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error syncing user from Clerk:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update user details
 */
export const updateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates.clerkId;
    delete updates.email;
    delete updates.orders;
    delete updates.reviews;
    delete updates.statistics;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user details:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Add or update user address
 */
export const updateUserAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.body;
    
    if (!address || !address.street || !address.city || !address.country) {
      return res.status(400).json({ success: false, error: 'Invalid address data' });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // If this is the first address or isDefault is true, set all others to false
    if (address.isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
      address.isDefault = true;
    }
    
    // If address._id exists, update existing address
    if (address._id) {
      const index = user.addresses.findIndex(a => a._id.toString() === address._id);
      if (index !== -1) {
        user.addresses[index] = { ...user.addresses[index], ...address };
      }
    } else {
      user.addresses.push(address);
    }
    
    await user.save();
    
    return res.status(200).json({ success: true, data: user.addresses });
  } catch (error) {
    console.error('Error updating user address:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user orders
 */
export const getUserOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sortBy, order, limit, page } = req.query;
    
    const query = { userId: id };
    if (status) {
      query.status = status;
    }
    
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }
    
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;
    
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .populate('items.productId', 'name slug images');
    
    const total = await Order.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      count: total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      data: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get user reviews
 */
export const getUserReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { sortBy, order, limit, page } = req.query;
    
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }
    
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const skip = (pageNumber - 1) * pageSize;
    
    const user = await User.findById(id)
      .select('reviews')
      .populate({
        path: 'reviews.productId',
        select: 'name slug images'
      });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const reviews = user.reviews
      .sort((a, b) => (order === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))
      .slice(skip, skip + pageSize);
    
    return res.status(200).json({
      success: true,
      count: user.reviews.length,
      page: pageNumber,
      pages: Math.ceil(user.reviews.length / pageSize),
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};