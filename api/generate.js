import { auth } from 'firebase-admin';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (ensure it's initialized only once)
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

// --- Function to log generation data for analytics ---
async function logGeneration(userId, prompt) {
    try {
        await db.collection('generations').add({
            userId: userId,
            prompt: prompt,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Logged prompt for user: ${userId}`);
    } catch (error) {
        // We log the error but don't stop the image generation process
        console.error("Failed to log prompt:", error);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Authenticate the user
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await auth().verifyIdToken(idToken);

        // 2. Get prompt and aspect ratio from the request
        const { prompt, aspectRatio } = req.body;
        
        // 3. Log the generation attempt for analytics
        await logGeneration(user.uid, prompt);

        // 4. Prepare the API request for Google's Image Generation Model
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        const payload = { 
            instances: [{ prompt }], 
            parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" }
        };

        // 5. Call the external API
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

        // 6. Send the result back to the client
        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        console.error("API function /api/generate crashed:", error);
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
