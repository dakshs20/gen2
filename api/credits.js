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

export default async function handler(req, res) {
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
        let userDoc = await userRef.get();

        // --- New User Onboarding: Grant 10 Free Credits ---
        if (!userDoc.exists) {
            await userRef.set({
                email: user.email,
                freeCredits: 10, // Grant 10 free credits on first sign-in
                createdAt: FieldValue.serverTimestamp()
            });
            userDoc = await userRef.get(); // Re-fetch the document after creation
        }

        const userData = userDoc.data();
        const activePlan = userData.activePlan;

        // --- Check for Plan Expiry ---
        if (activePlan && activePlan.expiryDate && new Date() > activePlan.expiryDate.toDate()) {
            await userRef.update({ activePlan: FieldValue.delete() });
            // If plan expires, they revert to the free tier. Return their free credit status.
            return res.status(200).json({
                name: 'Free',
                credits: userData.freeCredits || 0
            });
        }
        
        // If they have a valid, active plan, return its details.
        if (activePlan) {
            return res.status(200).json(activePlan);
        }

        // --- Default Free User ---
        // If no active plan, they are on the free tier.
        return res.status(200).json({
            name: 'Free',
            credits: userData.freeCredits || 0
        });

    } catch (error) {
        console.error("API Error in /api/credits:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(500).json({ error: 'A server error has occurred.' });
    }
}

