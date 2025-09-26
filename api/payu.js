import { auth } from 'firebase-admin';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu.js:", error);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { plan } = req.body;
        const idToken = req.headers.authorization?.split('Bearer ')[1];

        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        
        const user = await auth().verifyIdToken(idToken);

        // Server-side pricing to prevent manipulation
        const pricing = {
            inspire: { amount: '798.00', name: 'Inspire Plan' },
            create:  { amount: '1596.00', name: 'Create Plan' },
            elevate: { amount: '2571.00', name: 'Elevate Plan' }
        };

        if (!pricing[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const { amount, name } = pricing[plan];
        const key = process.env.PAYU_CLIENT_ID;
        const salt = process.env.PAYU_SECRET_KEY;

        if (!key || !salt) {
            console.error("PayU credentials are not set in environment variables.");
            return res.status(500).json({ error: 'Server payment configuration error.' });
        }
        
        const txnid = `GENART-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const productinfo = `GenArt Credits - ${name}`;
        const firstname = user.name || 'GenArt User';
        const email = user.email || '';
        const udf1 = user.uid; // User's Firebase ID
        
        const surl = `${req.headers.origin}/api/payu-callback`;
        const furl = `${req.headers.origin}/api/payu-callback`;

        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        const paymentData = {
            key, txnid, amount, productinfo, firstname, email, surl, furl, hash, udf1,
        };

        res.status(200).json({ paymentData });

    } catch (error) {
        console.error("PayU API Error in payu.js:", error);
        res.status(500).json({ error: 'Could not start the payment process.' });
    }
}
