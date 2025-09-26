import { auth } from 'firebase-admin';
import crypto from 'crypto';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error) { console.error("Firebase Admin Initialization Error in payu.js:", error); }
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
        if (!user) {
            return res.status(401).json({ error: 'Invalid user token.' });
        }

        const PRICING = {
            inspire: { amount: '9.00', credits: 575, name: "Inspire Pack" },
            create:  { amount: '18.00', credits: 975, name: "Create Pack" },
            elevate: { amount: '29.00', credits: 1950, name: "Elevate Pack" }
        };

        if (!PRICING[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const { amount, name } = PRICING[plan];
        const key = process.env.PAYU_CLIENT_ID;
        const salt = process.env.PAYU_SECRET_KEY;

        if (!key || !salt) {
            console.error("PayU credentials are not set.");
            return res.status(500).json({ error: 'Server payment configuration error.' });
        }
        
        const txnid = `GENART-${Date.now()}`;
        const productinfo = name;
        const firstname = user.name || 'GenArt User';
        const email = user.email || '';
        const udf1 = user.uid; // User's Firebase ID
        const udf2 = plan; // Pass the plan name for the callback
        
        const surl = `${req.headers.origin}/api/payu-callback`;
        const furl = `${req.headers.origin}/api/payu-callback`;

        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        const paymentData = {
            key, txnid, amount, productinfo, firstname, email, surl, furl, hash, udf1, udf2
        };

        res.status(200).json({ paymentData });

    } catch (error) {
        console.error("PayU API Error:", error);
        res.status(500).json({ error: 'Could not start payment process.' });
    }
}

