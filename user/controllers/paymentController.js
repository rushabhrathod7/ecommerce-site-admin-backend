import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a Razorpay order
 */
export const createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', orderId, paymentMethod } = req.body;
    console.log('Creating Razorpay order with:', { amount, currency, orderId, paymentMethod });
    
    if (!amount || !orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: amount or orderId' 
      });
    }
    
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
      currency,
      receipt: orderId.toString()
    });
    console.log('Razorpay order created:', razorpayOrder);

    // Validate payment method and ensure it's not lost
    // Accept the payment method from the client or use a default
    const validPaymentMethod = paymentMethod || 'card';
    console.log('Using payment method:', validPaymentMethod);

    // Check if payment record already exists
    const existingPayment = await Payment.findOne({ orderId });
    
    if (existingPayment) {
      // Update existing payment record, preserving the original payment method if available
      existingPayment.razorpayOrderId = razorpayOrder.id;
      existingPayment.amount = amount;
      existingPayment.currency = currency;
      
      // Only update the payment method if it's actually provided and not just a default
      if (paymentMethod && paymentMethod !== 'razorpay') {
        existingPayment.paymentMethod = validPaymentMethod;
      }
      
      await existingPayment.save();
      console.log('Updated existing payment record:', existingPayment);
    } else {
      // Create new payment record
      const payment = new Payment({
        orderId,
        userId: req.user._id,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency,
        status: 'pending',
        paymentMethod: validPaymentMethod // Use the actual payment method
      });
      await payment.save();
      console.log('Created new payment record:', payment);
    }

    // Update order with payment details
    await Order.findByIdAndUpdate(orderId, {
      'payment.method': 'razorpay',
      'payment.status': 'pending',
      'payment.razorpayOrderId': razorpayOrder.id,
      'payment.amount': amount
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentMethod: validPaymentMethod
      }
    });
  } catch (error) {
    console.error('Detailed error in createOrder:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Payment initialization failed',
      details: error.message 
    });
  }
};

/**
 * Verify payment
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method } = req.body;
    
    console.log('Payment verification request received:', { 
      razorpay_order_id, 
      razorpay_payment_id,
      payment_method 
    });
    
    // Verify payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Fetch payment details from Razorpay to get complete information
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    console.log('Razorpay Payment Details:', JSON.stringify(razorpayPayment, null, 2));

    // Map Razorpay payment method to our payment method
    // First check if client provided a method
    let paymentMethod = payment_method || 'card';
    
    // Try to detect method from Razorpay response
    if (razorpayPayment.method) {
      console.log(`Detected payment method from Razorpay: ${razorpayPayment.method}`);
      
      if (razorpayPayment.method === 'upi' || razorpayPayment.method === 'upi_intent') {
        paymentMethod = 'upi';
      } else if (razorpayPayment.method === 'netbanking') {
        paymentMethod = 'netbanking';
      } else if (razorpayPayment.method === 'wallet') {
        paymentMethod = 'wallet';
      } else if (razorpayPayment.method === 'emi') {
        paymentMethod = 'emi';
      } else if (razorpayPayment.method === 'card') {
        paymentMethod = 'card';
      }
    }

    console.log('Final Payment Method:', paymentMethod);

    // Find the payment record
    const existingPayment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!existingPayment) {
      console.error('Payment record not found for order ID:', razorpay_order_id);
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Extract payment details based on method
    const paymentDetails = {
      ...(paymentMethod === 'upi' && { 
        upi: { 
          vpa: razorpayPayment.vpa || 
               (razorpayPayment.upi && razorpayPayment.upi.vpa) || 
               (razorpayPayment.upi_intent && razorpayPayment.upi_intent.vpa) || 
               'unknown'
        } 
      }),
      ...(paymentMethod === 'netbanking' && { 
        bank: { 
          name: razorpayPayment.bank || 
                (razorpayPayment.netbanking && razorpayPayment.netbanking.bank_name) || 
                'unknown',
          ifsc: razorpayPayment.ifsc || 
                (razorpayPayment.netbanking && razorpayPayment.netbanking.ifsc) || 
                'unknown'
        } 
      }),
      ...(paymentMethod === 'wallet' && { 
        wallet: { 
          name: razorpayPayment.wallet || 
                (razorpayPayment.wallet && razorpayPayment.wallet.name) || 
                'unknown'
        } 
      }),
      ...(paymentMethod === 'card' && { 
        card: { 
          last4: (razorpayPayment.card && (razorpayPayment.card.last4 || razorpayPayment.card.last4_digits)) || 'unknown',
          network: (razorpayPayment.card && (razorpayPayment.card.network || razorpayPayment.card.card_network)) || 'unknown',
          issuer: (razorpayPayment.card && (razorpayPayment.card.issuer || razorpayPayment.card.issuer_name)) || 'unknown'
        }
      })
    };

    // Update payment record with actual payment details
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed',
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails
      },
      { new: true }
    );

    console.log('Updated payment record with actual details:', payment);

    // Update order payment status and order status
    const updatedOrder = await Order.findByIdAndUpdate(payment.orderId, {
      'payment.status': 'completed',
      'payment.razorpayPaymentId': razorpay_payment_id,
      'payment.razorpaySignature': razorpay_signature,
      'payment.method': 'razorpay', 
      'payment.paymentMethod': paymentMethod, // Add this to track the specific payment method
      status: 'confirmed'
    }, { new: true });

    console.log('Updated order with payment details:', updatedOrder);

    return res.status(200).json({ 
      success: true, 
      data: payment,
      message: `Payment successful via ${paymentMethod}`
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

/**
 * Handle payment webhook
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    console.log(`Processing webhook event: ${event}`);
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
};

/**
 * Handle payment captured event
 */
async function handlePaymentCaptured(payload) {
  try {
    const { payment } = payload;
    
    // Get the actual payment method from the Razorpay event
    let paymentMethod = 'card'; // Default
    
    if (payment.method) {
      if (payment.method === 'upi' || payment.method === 'upi_intent') {
        paymentMethod = 'upi';
      } else if (payment.method === 'netbanking') {
        paymentMethod = 'netbanking';
      } else if (payment.method === 'wallet') {
        paymentMethod = 'wallet';
      } else if (payment.method === 'emi') {
        paymentMethod = 'emi';
      } else if (payment.method === 'card') {
        paymentMethod = 'card';
      }
    }
    
    // Build payment details object based on the method
    const paymentDetails = {};
    
    if (paymentMethod === 'card' && payment.card) {
      paymentDetails.card = {
        last4: payment.card.last4 || 'unknown',
        network: payment.card.network || 'unknown',
        issuer: payment.card.issuer || 'unknown'
      };
    } else if (paymentMethod === 'upi' && payment.upi) {
      paymentDetails.upi = {
        vpa: payment.upi.vpa || 'unknown'
      };
    } else if (paymentMethod === 'netbanking' && payment.bank) {
      paymentDetails.bank = {
        name: payment.bank.name || 'unknown',
        ifsc: payment.bank.ifsc || 'unknown'
      };
    } else if (paymentMethod === 'wallet' && payment.wallet) {
      paymentDetails.wallet = {
        name: payment.wallet.name || 'unknown'
      };
    }
    
    // Update payment record
    const updatedPayment = await Payment.findOneAndUpdate(
      { razorpayPaymentId: payment.id },
      { 
        status: 'completed',
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails
      },
      { new: true }
    );
    
    if (updatedPayment) {
      console.log(`Payment ${payment.id} updated with method ${paymentMethod} and status completed`);
      
      // Also update the order
      await Order.findByIdAndUpdate(
        updatedPayment.orderId,
        {
          'payment.status': 'completed',
          'payment.paymentMethod': paymentMethod,
          status: 'confirmed'
        }
      );
    } else {
      console.log(`Payment ${payment.id} not found in database during webhook processing`);
    }
  } catch (error) {
    console.error('Error in handlePaymentCaptured:', error);
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload) {
  const { payment } = payload;
  await Payment.findOneAndUpdate(
    { razorpayPaymentId: payment.id },
    { status: 'failed' }
  );
  
  // Also update order status
  const paymentRecord = await Payment.findOne({ razorpayPaymentId: payment.id });
  if (paymentRecord) {
    await Order.findByIdAndUpdate(
      paymentRecord.orderId,
      { 'payment.status': 'failed' }
    );
  }
}

/**
 * Handle refund created event
 */
async function handleRefundCreated(payload) {
  const { refund } = payload;
  const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
  
  if (payment) {
    payment.refunds.push({
      amount: refund.amount / 100, // Convert from paise to rupees
      status: 'processed',
      reason: refund.reason || 'Customer request'
    });
    
    await payment.save();
    
    // Update order status if full refund
    if (refund.amount >= payment.amount * 100) {
      await Order.findByIdAndUpdate(
        payment.orderId,
        { 
          'payment.status': 'refunded',
          status: 'cancelled'
        }
      );
    }
  }
}

// Test Razorpay configuration
export const testRazorpayConfig = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay API keys are not configured',
        keyId: !!process.env.RAZORPAY_KEY_ID,
        keySecret: !!process.env.RAZORPAY_KEY_SECRET
      });
    }

    // Test Razorpay connection
    const testOrder = await razorpay.orders.create({
      amount: 100,
      currency: 'INR',
      receipt: 'test-order'
    });

    return res.status(200).json({
      success: true,
      message: 'Razorpay configuration is working',
      testOrder
    });
  } catch (error) {
    console.error('Razorpay test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Razorpay test failed',
      details: error.message
    });
  }
};