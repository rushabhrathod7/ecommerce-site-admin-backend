import jwt from 'jsonwebtoken';
import { Clerk } from '@clerk/clerk-sdk-node';
import Admin from '../admin/models/Admin.js';
import User from '../user/models/User.js';
import crypto from 'crypto';

// Initialize Clerk
const clerk = new Clerk({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Middleware to verify admin JWT token
export const verifyAdminToken = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    let token = req.cookies.admin_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        error: 'NO_TOKEN',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive account',
        error: 'INVALID_ACCOUNT',
      });
    }

    req.admin = {
      id: decoded.id,
      role: admin.role || 'admin', // Default to 'admin' if role is not set
      email: admin.email,
      isActive: admin.isActive
    };

    console.log('Admin info set in request:', req.admin);
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    const errorMsg =
      error.name === 'TokenExpiredError'
        ? 'Token expired. Please login again'
        : 'Invalid token';

    return res.status(401).json({
      success: false,
      message: errorMsg,
      error: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
};

// Middleware to verify Clerk-authenticated user
export const verifyClerkAuth = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        error: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const { sub: clerkId } = await clerk.verifyToken(token);
      
      if (!clerkId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'INVALID_TOKEN',
        });
      }

      // Find or create user
      let user = await User.findOne({ clerkId });

      if (!user) {
        // Get user data from Clerk
        const clerkUser = await clerk.users.getUser(clerkId);
        
        // Create new user in MongoDB
        user = new User({
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          username: clerkUser.username || '',
          profileImageUrl: clerkUser.profileImageUrl || '',
          emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
          metadata: clerkUser.publicMetadata || {},
        });

        await user.save();
      }

      // Attach user to request
      req.user = {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Token verification failed',
        error: 'TOKEN_VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    console.error('Clerk auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: 'AUTH_FAILED',
    });
  }
};

// Middleware to check if admin is superadmin
export const isSuperAdmin = (req, res, next) => {
  if (req.admin?.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Superadmin privileges required',
    error: 'SUPERADMIN_REQUIRED',
  });
};

// Middleware to verify Clerk webhook
export const verifyClerkWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['svix-signature'];
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];

    if (!signature || !svixId || !svixTimestamp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing webhook headers' 
      });
    }

    // Verify webhook signature
    const payload = JSON.stringify(req.body);
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid webhook signature' 
      });
    }

    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Webhook verification failed' 
    });
  }
};

// Middleware to authorize based on role
export const authorize = (...roles) => {
    return (req, res, next) => {
        console.log('Authorization check:', {
            admin: req.admin,
            requiredRoles: roles,
            currentRole: req.admin?.role
        });

        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
                error: 'NOT_AUTHENTICATED'
            });
        }

        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Not authorized. Required roles: ${roles.join(', ')}`,
                error: 'NOT_AUTHORIZED'
            });
        }

        next();
    };
};
