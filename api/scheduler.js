// This is a serverless function designed to be run by a cron job (e.g., daily).
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
}
const db = admin.firestore();

// --- Plan Data for Credit Allocation ---
const plans = {
    create: { credits: 575 },
    price: { credits: 975 },
    elevate: { credits: 1950 }
};

export default async function handler(req, res) {
    // Optional: Secure this endpoint with a secret key if it's publicly accessible
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const today = admin.firestore.Timestamp.now();
        const usersToCreditQuery = db.collection('users')
            .where('subscription.status', '==', 'active')
            .where('subscription.billingCycle', '==', 'yearly')
            .where('subscription.nextCreditDate', '<=', today);

        const snapshot = await usersToCreditQuery.get();

        if (snapshot.empty) {
            console.log("Scheduler run: No users due for yearly credit allocation.");
            return res.status(200).json({ message: 'No users to credit.' });
        }

        const promises = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            const userId = doc.id;
            const planId = user.subscription.planId;
            const plan = plans[planId];

            if (!plan) {
                console.error(`Invalid planId '${planId}' for user ${userId}`);
                return;
            }
            
            const allocationAmount = Math.floor(plan.credits / 12);
            const userRef = db.collection('users').doc(userId);

            const nextCreditDate = new Date(user.subscription.nextCreditDate.seconds * 1000);
            nextCreditDate.setMonth(nextCreditDate.getMonth() + 1);

            const updatePromise = userRef.update({
                'credits': admin.firestore.FieldValue.increment(allocationAmount),
                'subscription.nextCreditDate': admin.firestore.Timestamp.fromDate(nextCreditDate)
            });

            promises.push(updatePromise);
            console.log(`Scheduled credit allocation for user ${userId}. Amount: ${allocationAmount}`);
        });

        await Promise.all(promises);
        
        console.log(`Successfully processed ${promises.length} yearly credit allocations.`);
        res.status(200).json({ success: true, processedCount: promises.length });

    } catch (error) {
        console.error("Scheduler run failed:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
