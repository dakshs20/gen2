import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in credits.js:", error);
    }
}

const db = getFirestore();

// --- Default Plan for Free Users ---
const freePlan = {
    name: 'Free',
    credits: 0,
    expiryDate: null
};

export default async function handler(req, res) {
    // This endpoint only handles GET requests to fetch the user's current plan status.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists() || !userDoc.data().activePlan) {
            // If the user has no document or no active plan, they are on the free tier.
            return res.status(200).json(freePlan);
        }

        const plan = userDoc.data().activePlan;
        
        // --- Check for Plan Expiry ---
        // The check is ignored if expiryDate is null (e.g., for the 'Elevate' plan).
        if (plan.expiryDate && new Date() > plan.expiryDate.toDate()) {
            // The plan has expired. We will update the document to remove the activePlan
            // and return the free plan details to the user for this session.
            await userRef.update({ activePlan: FieldValue.delete() });
            console.log(`Plan for user ${user.uid} has expired and was removed.`);
            return res.status(200).json(freePlan);
        }

        // If the plan is valid and not expired, return its details.
        return res.status(200).json(plan);

    } catch (error) {
        console.error("API Error in /api/credits:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(500).json({ error: 'A server error has occurred.' });
    }
}

