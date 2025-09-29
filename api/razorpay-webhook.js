// This is a serverless function.
import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
}
const db = admin.firestore();

// --- Plan Data for Credit Allocation ---
const plans = {
    create: { name: 'Create Plan', credits: 575, expiry: '3 months' },
    price: { name: 'Price Plan', credits: 975, expiry: '5 months' },
    elevate: { name: 'Elevate Plan', credits: 1950, expiry: 'Never' }
};

export default async function handler(req, res) {
    // 1. Verify Webhook Signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return res.status(400).json({ status: 'error', message: 'Invalid signature.' });
        }
    } catch(error) {
        return res.status(500).json({ status: 'error', message: 'Signature verification failed.' });
    }

    // 2. Process the Event (Idempotently)
    const event = req.body;
    const eventId = event.id;
    const eventType = event.event;

    const eventRef = db.collection('webhook_events').doc(eventId);
    
    try {
        await db.runTransaction(async (t) => {
            const eventDoc = await t.get(eventRef);
            if (eventDoc.exists) {
                console.log(`Webhook event ${eventId} already processed.`);
                return;
            }

            if (eventType === 'subscription.charged') {
                await handleSubscriptionCharged(t, event);
            } else if (eventType === 'subscription.cancelled') {
                // Handle cancellation logic if needed
            }
            
            t.set(eventRef, { processedAt: admin.firestore.FieldValue.serverTimestamp(), event: eventType });
        });

        res.status(200).json({ status: 'received' });

    } catch (error) {
        console.error(`Webhook processing error for event ${eventId}:`, error);
        res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
}

async function handleSubscriptionCharged(t, event) {
    const subscription = event.payload.subscription.entity;
    const userId = subscription.notes.userId;
    const planId = subscription.notes.planId;
    
    if (!userId || !planId || !plans[planId]) {
        throw new Error(`Missing or invalid data in webhook payload for subscription ${subscription.id}`);
    }

    const plan = plans[planId];
    const userRef = db.collection('users').doc(userId);

    const nextBillDate = new Date(subscription.charge_at * 1000);

    t.set(userRef, {
        credits: admin.firestore.FieldValue.increment(plan.credits),
        subscription: {
            planId: planId,
            planName: plan.name,
            billingCycle: 'monthly',
            status: 'active',
            expiry: plan.expiry,
            nextCreditDate: admin.firestore.Timestamp.fromDate(nextBillDate),
            razorpaySubscriptionId: subscription.id
        }
    }, { merge: true });
    
    console.log(`Credited ${plan.credits} to user ${userId} for monthly subscription.`);
}
