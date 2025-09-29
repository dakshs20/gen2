import { auth } from 'firebase-admin';
import admin from 'firebase-admin';

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

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(403).json({ error: 'User profile not found.' });
        }
        
        const userData = userDoc.data();
        const { prompt, imageData, aspectRatio } = req.body;
        
        // Server-side check for credits or free plan
        if (userData.planName !== 'Free' && userData.credits <= 0) {
            return res.status(402).json({ error: 'Insufficient credits.' });
        }

        // Server-side check for expired plans
        if (userData.expiryDate && userData.expiryDate.toDate() < new Date()) {
            return res.status(402).json({ error: 'Your plan has expired.' });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "API key not found." });
        }

        let apiUrl, payload;
        const generationSpeed = (userData.planName === 'Free' || !userData.planName) ? 30000 : 17000; // 30s for free, 17s for paid

        if (imageData && imageData.data) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
            payload = {
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: imageData.mimeType, data: imageData.data } }] }],
                generationConfig: { responseModalities: ["IMAGE"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = { 
                instances: [{ prompt }], 
                parameters: { sampleCount: 1, aspectRatio: aspectRatio || "1:1" }
            };
        }

        // Simulate generation delay
        await new Promise(resolve => setTimeout(resolve, generationSpeed));

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        console.error("API function /api/generate crashed:", error);
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
