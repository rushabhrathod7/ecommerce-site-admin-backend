import express from 'express';
import { verifyAdminToken, verifyClerkAuth } from '../../middleware/auth.js';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  getUserOrders,
  cancelOrder
} from '../controllers/orderController.js';

const router = express.Router();

// User routes (Clerk auth required)
router.post('/', verifyClerkAuth, createOrder);
router.get('/user/orders', verifyClerkAuth, getUserOrders);
router.get('/:id', verifyClerkAuth, getOrderById);
router.patch('/:id/payment', verifyClerkAuth, updatePaymentStatus);
router.post('/:id/cancel', verifyClerkAuth, cancelOrder);

// Admin routes (admin auth required)
router.get('/', verifyAdminToken, getAllOrders);
router.patch('/:id/status', verifyAdminToken, updateOrderStatus);

export default router; 