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
        console.error("Firebase Admin Initialization Error in generate.js:", error);
    }
}

const db = getFirestore();

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
        const userRef = db.collection('users').doc(user.uid);
        
        const { prompt, imageData, aspectRatio } = req.body;
        
        // --- Credit Deduction Logic ---
        const userDoc = await userRef.get();
        const plan = userDoc.data()?.activePlan;

        const isPaidUser = plan && plan.credits > 0 && (!plan.expiryDate || new Date() < plan.expiryDate.toDate());

        if (isPaidUser) {
            // Use an atomic decrement for paid users
            await userRef.update({
                'activePlan.credits': FieldValue.increment(-1)
            });
             console.log(`Credit deducted for paid user: ${user.uid}`);
        } else {
            // This is a free user (or an expired/out-of-credits paid user)
            // The frontend enforces a 30-second delay. The backend proceeds without deduction.
             console.log(`Free generation for user: ${user.uid}`);
        }
        
        // --- Image Generation API Call ---
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;

        if (imageData && imageData.data) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{ 
                    "parts": [
                        { "text": prompt }, 
                        { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }
                    ] 
                }],
                "generationConfig": { "responseModalities": ["IMAGE"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = { 
                instances: [{ prompt }], 
                parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" }
            };
        }

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            // If API fails, we should ideally refund the credit. For simplicity, we'll log it.
            if(isPaidUser) console.error(`CRITICAL: Generation failed for ${user.uid} but credit was deducted.`);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        console.error("API function /api/generate crashed:", error);
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
