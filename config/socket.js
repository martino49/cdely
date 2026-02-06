const socketIo = require('socket.io');
const Delivery = require('../models/Delivery.model');
const Notification = require('../models/Notification.model');
const db = require('./database'); // Access to DB for saving messages

let io;

module.exports = {
    init: (httpServer) => {
        io = socketIo(httpServer, {
            cors: {
                origin: process.env.CLIENT_URL || "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            // Join order room for tracking
            socket.on('join-order', async (orderId) => {
                socket.join(`order-${orderId}`);
                console.log(`Socket ${socket.id} joined order-${orderId}`);

                // Send current tracking data
                const delivery = await Delivery.findByOrderId(orderId);
                if (delivery) {
                    const trackingPoints = await Delivery.getTrackingPoints(delivery.id);
                    socket.emit('tracking-data', {
                        delivery,
                        trackingPoints
                    });
                }
            });

            // Rider location updates
            socket.on('rider-location', async (data) => {
                const { orderId, lat, lng, accuracy, battery } = data;

                try {
                    // Save tracking point to database
                    const delivery = await Delivery.findByOrderId(orderId);
                    if (delivery) {
                        await Delivery.addTrackingPoint(
                            delivery.id,
                            lat,
                            lng,
                            accuracy,
                            battery
                        );

                        // Broadcast to everyone in the order room
                        io.to(`order-${orderId}`).emit('location-update', {
                            lat,
                            lng,
                            accuracy,
                            battery,
                            timestamp: new Date().toISOString()
                        });

                        // Update rider's current location
                        await db.execute(
                            'UPDATE riders SET current_lat = ?, current_lng = ? WHERE id = ?',
                            [lat, lng, delivery.rider_id]
                        );
                    }
                } catch (error) {
                    console.error('Error saving location:', error);
                    socket.emit('error', 'Failed to update location');
                }
            });

            // Delivery status updates
            socket.on('delivery-status', async (data) => {
                const { orderId, status } = data;

                try {
                    const delivery = await Delivery.findByOrderId(orderId);
                    if (delivery) {
                        await Delivery.updateStatus(delivery.id, status);

                        // Notify customer
                        io.to(`order-${orderId}`).emit('status-update', {
                            status,
                            timestamp: new Date().toISOString()
                        });

                        // Also update order status
                        let orderStatus = 'preparing';
                        switch (status) {
                            case 'arrived_at_store':
                                orderStatus = 'ready_for_pickup';
                                break;
                            case 'picked_up':
                                orderStatus = 'picked_up';
                                break;
                            case 'in_transit':
                                orderStatus = 'in_transit';
                                break;
                            case 'delivered':
                                orderStatus = 'delivered';
                                break;
                        }

                        await db.execute(
                            'UPDATE orders SET order_status = ? WHERE id = ?',
                            [orderStatus, orderId]
                        );
                    }
                } catch (error) {
                    console.error('Error updating status:', error);
                }
            });

            // Chat messages
            socket.on('send-message', async (data) => {
                const { orderId, senderId, receiverId, message } = data;

                try {
                    // Save message to database
                    const [result] = await db.execute(
                        `INSERT INTO chat_messages 
                         (order_id, sender_id, receiver_id, message)
                         VALUES (?, ?, ?, ?)`,
                        [orderId, senderId, receiverId, message]
                    );

                    // Broadcast to sender and receiver
                    io.to(`order-${orderId}`).emit('new-message', {
                        id: result.insertId,
                        sender_id: senderId,
                        receiver_id: receiverId,
                        message,
                        timestamp: new Date().toISOString()
                    });

                    // Send notification to receiver
                    await Notification.create({
                        user_id: receiverId,
                        type: 'order_status_update',
                        title: 'New Message',
                        message: `You have a new message about order #${orderId}`,
                        data: { order_id: orderId, sender_id: senderId }
                    });

                } catch (error) {
                    console.error('Error sending message:', error);
                }
            });

            // Join chat room
            socket.on('join-chat', (orderId) => {
                socket.join(`chat-${orderId}`);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        return io;
    },

    getIo: () => {
        if (!io) {
            throw new Error('Socket.io not initialized');
        }
        return io;
    }
};
