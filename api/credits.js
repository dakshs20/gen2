import admin from 'firebase-admin';

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

const db = admin.firestore();

export default async function handler(req, res) {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);

        // GET request: Fetch user data (plan, credits, etc.)
        if (req.method === 'GET') {
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                // Check for expired plans
                if (userData.expiryDate && userData.expiryDate.toDate() < new Date()) {
                    // Plan has expired, reset to Free
                    await userRef.set({
                        email: user.email,
                        planName: 'Free',
                        credits: 0,
                        purchaseDate: null,
                        expiryDate: null
                    }, { merge: true });
                     return res.status(200).json({ planName: 'Free', credits: 0 });
                }
                return res.status(200).json(userData);
            } else {
                // New user, set up with Free plan
                const freePlanData = {
                    email: user.email,
                    planName: 'Free',
                    credits: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    purchaseDate: null,
                    expiryDate: null
                };
                await userRef.set(freePlanData);
                return res.status(200).json(freePlanData);
            }
        }

        // POST request: Deduct a credit for generation
        if (req.method === 'POST') {
             await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error("User document does not exist!");
                }
                
                const userData = userDoc.data();
                
                // Free users are handled on the frontend with a timer, no credit deduction
                if (userData.planName === 'Free' || !userData.planName) {
                    // Should not happen if frontend logic is correct, but as a safeguard.
                     res.status(200).json({ message: "Free user, no credits deducted."});
                     return;
                }

                if (userData.credits <= 0) {
                     res.status(402).json({ error: 'Insufficient credits.' });
                     return;
                }
                
                 // Check for expiry again within the transaction for atomicity
                if (userData.expiryDate && userData.expiryDate.toDate() < new Date()) {
                    transaction.set(userRef, {
                        planName: 'Free',
                        credits: 0,
                        purchaseDate: null,
                        expiryDate: null
                    }, { merge: true });
                     res.status(402).json({ error: 'Your plan has expired.' });
                     return;
                }

                transaction.update(userRef, {
                    credits: admin.firestore.FieldValue.increment(-1)
                });
                
                const newCredits = userData.credits - 1;
                res.status(200).json({ newCredits: newCredits });
            });
            return; // Exit after transaction
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (error) {
        console.error("API Error in /api/credits:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        res.status(500).json({ error: 'A server error occurred.' });
    }
}
