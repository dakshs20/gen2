// This is a serverless function. Example for Vercel or Netlify.
import admin from 'firebase-admin';
import Razorpay from 'razorpay';

// --- Initialize Firebase Admin (should be done once) ---
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error.stack);
    }
}

// --- Initialize Razorpay ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Plan Data (Server-side source of truth) ---
const plans = {
    create: { name: 'Create Plan', monthlyPrice: 79800, yearlyPrice: 814000 },
    price: { name: 'Price Plan', monthlyPrice: 159600, yearlyPrice: 1628000 },
    elevate: { name: 'Elevate Plan', monthlyPrice: 257100, yearlyPrice: 2622400 }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await admin.auth().verifyIdToken(idToken);

        const { planId, billingCycle } = req.body;
        if (!plans[planId] || !['monthly', 'yearly'].includes(billingCycle)) {
            return res.status(400).json({ error: 'Invalid plan or billing cycle.' });
        }

        const plan = plans[planId];
        const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice; // Amount in paise
        
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `receipt_genart_${Date.now()}`,
            notes: {
                userId: user.uid,
                planId: planId,
                billingCycle: billingCycle
            }
        };

        if (billingCycle === 'monthly') {
            // --- Create a Razorpay Subscription ---
            const plan_id = process.env[`RAZORPAY_PLAN_${planId.toUpperCase()}`]; // e.g., RAZORPAY_PLAN_CREATE
            if (!plan_id) {
                return res.status(500).json({ error: 'Server misconfiguration: Razorpay plan ID not found.' });
            }

            const subscriptionOptions = {
                plan_id: plan_id,
                total_count: 120, // Run for 10 years
                quantity: 1,
                notes: options.notes
            };

            const subscription = await razorpay.subscriptions.create(subscriptionOptions);

            return res.status(200).json({
                key: process.env.RAZORPAY_KEY_ID,
                subscriptionId: subscription.id,
                amount: amount,
            });

        } else {
            // --- Create a one-time Razorpay Order ---
            const order = await razorpay.orders.create(options);
            return res.status(200).json({
                key: process.env.RAZORPAY_KEY_ID,
                orderId: order.id,
                amount: order.amount,
            });
        }

    } catch (error) {
        console.error("Create Order/Subscription API Error:", error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
