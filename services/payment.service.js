const db = require('../config/database');
const axios = require('axios');

class PaymentService {
    // Process payment based on method
    static async processPayment(orderId, paymentData) {
        const order = await this.getOrder(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        let result;

        switch (paymentData.method) {
            case 'card':
                result = await this.processCardPayment(order, paymentData);
                break;

            case 'mobile_money':
                result = await this.processMobileMoney(order, paymentData);
                break;

            case 'cash':
                result = await this.processCashOnDelivery(order);
                break;

            default:
                throw new Error('Invalid payment method');
        }

        // Update order payment status
        await this.updatePaymentStatus(orderId, result);

        return result;
    }

    // Process card payment (simulated with Stripe)
    static async processCardPayment(order, paymentData) {
        try {
            // In production, use Stripe API
            // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            // const paymentIntent = await stripe.paymentIntents.create({
            //     amount: Math.round(order.total_amount * 100),
            //     currency: 'kes',
            //     payment_method: paymentData.payment_method_id,
            //     confirm: true
            // });

            // Simulate successful payment
            const reference = `CARD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return {
                success: true,
                reference,
                method: 'card',
                amount: order.total_amount,
                message: 'Payment successful'
            };
        } catch (error) {
            console.error('Card payment error:', error);
            throw new Error('Card payment failed');
        }
    }

    // Process M-Pesa payment (Kenya)
    static async processMobileMoney(order, paymentData) {
        try {
            // M-Pesa API integration
            const auth = await this.getMpesaAuthToken();

            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
            const password = Buffer.from(
                `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
            ).toString('base64');

            const requestData = {
                BusinessShortCode: process.env.MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: order.total_amount,
                PartyA: paymentData.phone,
                PartyB: process.env.MPESA_SHORTCODE,
                PhoneNumber: paymentData.phone,
                CallBackURL: `${process.env.BASE_URL}/api/payment/callback`,
                AccountReference: `ORDER-${order.order_number}`,
                TransactionDesc: `Payment for order ${order.order_number}`
            };

            const response = await axios.post(
                'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.ResponseCode === '0') {
                return {
                    success: true,
                    reference: response.data.CheckoutRequestID,
                    method: 'mobile_money',
                    amount: order.total_amount,
                    message: 'STK Push sent to your phone'
                };
            } else {
                throw new Error(response.data.ResponseDescription || 'Payment failed');
            }
        } catch (error) {
            console.error('M-Pesa payment error:', error);
            throw new Error('Mobile money payment failed');
        }
    }

    // Process cash on delivery
    static async processCashOnDelivery(order) {
        // No immediate payment processing for COD
        return {
            success: true,
            reference: `COD-${order.order_number}`,
            method: 'cash',
            amount: order.total_amount,
            message: 'Pay on delivery'
        };
    }

    // Get M-Pesa auth token
    static async getMpesaAuthToken() {
        const auth = Buffer.from(
            `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
        ).toString('base64');

        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );

        return response.data.access_token;
    }

    // Update payment status in database
    static async updatePaymentStatus(orderId, paymentResult) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update order payment status
            await connection.execute(
                `UPDATE orders 
                 SET payment_status = ?, 
                     payment_reference = ?
                 WHERE id = ?`,
                [paymentResult.success ? 'paid' : 'failed',
                paymentResult.reference || '',
                orderId || null]
            );

            // Create transaction record
            await connection.execute(
                `INSERT INTO transactions 
                 (user_id, order_id, type, amount, description, 
                  payment_method, reference, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    // Get customer ID from order
                    (await this.getOrder(orderId))?.customer_id || null,
                    orderId,
                    'debit',
                    paymentResult.amount,
                    `Payment for order ${orderId}`,
                    paymentResult.method || 'unknown',
                    paymentResult.reference || '',
                    paymentResult.success ? 'completed' : 'failed'
                ]
            );

            // Send payment confirmation notification
            if (paymentResult.success) {
                const order = await this.getOrder(orderId);
                await this.sendPaymentNotification(order);
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get order details
    static async getOrder(orderId) {
        const [rows] = await db.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId || null]
        );
        return rows[0];
    }

    // Send payment notification
    static async sendPaymentNotification(order) {
        // Create notification
        await db.execute(
            `INSERT INTO notifications 
             (user_id, type, title, message, data)
             VALUES (?, ?, ?, ?, ?)`,
            [
                order.customer_id,
                'payment_receipt',
                'Payment Successful',
                `Payment of KES ${order.total_amount} for order #${order.order_number} was successful`,
                JSON.stringify({
                    order_id: order.id,
                    amount: order.total_amount || 0,
                    reference: order.payment_reference || ''
                })
            ]
        );

        // Send email receipt
        // await this.sendPaymentEmail(order);
    }

    // Handle payment callbacks (M-Pesa)
    static async handlePaymentCallback(callbackData) {
        if (callbackData.Body.stkCallback.ResultCode === 0) {
            // Payment successful
            const checkoutId = callbackData.Body.stkCallback.CheckoutRequestID;
            const amount = callbackData.Body.stkCallback.CallbackMetadata.Item.find(
                item => item.Name === 'Amount'
            ).Value;

            // Find order by reference
            const [orderRows] = await db.execute(
                'SELECT id FROM orders WHERE payment_reference = ?',
                [checkoutId || '']
            );

            if (orderRows.length > 0) {
                const orderId = orderRows[0].id;
                await this.updatePaymentStatus(orderId, {
                    success: true,
                    reference: checkoutId,
                    amount: amount
                });
            }
        }
    }

    // Refund payment
    static async refundPayment(orderId, reason) {
        const order = await this.getOrder(orderId);

        if (order.payment_status !== 'paid') {
            throw new Error('Order is not paid');
        }

        const connection = await db.getConnection();
        try {
            // ... Refund logic here
        } catch (error) {
            throw error;
        }
    }
}

module.exports = PaymentService;
