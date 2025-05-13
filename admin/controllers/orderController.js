import Order from '../../user/models/Order.js';
import User from '../../user/models/User.js';

// Get all orders
export const getAllOrders = async (req, res) => {
    try {
        console.log('Fetching all orders...');
        const orders = await Order.find()
            .populate({
                path: 'userId',
                select: 'firstName lastName email'
            })
            .populate({
                path: 'items.productId',
                select: 'name price images'
            })
            .sort({ createdAt: -1 });
        
        console.log('Found orders:', orders);
        
        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
};

// Get single order details
export const getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate({
                path: 'userId',
                select: 'firstName lastName email'
            })
            .populate({
                path: 'items.productId',
                select: 'name price images'
            });
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch order details' });
    }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { 
                status,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating order status',
            error: error.message
        });
    }
}; 