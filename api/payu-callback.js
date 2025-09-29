import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu-callback.js:", error);
    }
}

const db = admin.firestore();

// --- Plan Details ---
const planDetails = {
    '798.00':  { planName: 'Inspire', credits: 575, expiryMonths: 3 },
    '1596.00': { planName: 'Create',  credits: 975, expiryMonths: 5 },
    '2571.00': { planName: 'Elevate', credits: 1950, expiryMonths: null } // Never expires
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const salt = process.env.PAYU_SECRET_KEY;
        const receivedData = req.body;
        
        const { status, key, txnid, amount, productinfo, firstname, email, udf1, hash: receivedHash } = receivedData;
        
        const hashString = `${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash !== receivedHash) {
            console.error("Hash Mismatch Error: Payment callback is not authentic.");
            return res.status(400).send("Security Error: Transaction tampering detected.");
        }

        if (status === 'success') {
            const plan = planDetails[amount];
            
            if (plan && udf1) {
                const userRef = db.collection('users').doc(udf1);
                
                const purchaseDate = new Date();
                let expiryDate = null;
                if (plan.expiryMonths) {
                    expiryDate = new Date(purchaseDate);
                    expiryDate.setMonth(expiryDate.getMonth() + plan.expiryMonths);
                }

                await userRef.update({
                    planName: plan.planName,
                    credits: admin.firestore.FieldValue.increment(plan.credits),
                    purchaseDate: admin.firestore.Timestamp.fromDate(purchaseDate),
                    expiryDate: expiryDate ? admin.firestore.Timestamp.fromDate(expiryDate) : null
                });

                console.log(`Successfully applied ${plan.planName} plan to user ${udf1}`);
                
                const successUrl = new URL('/pricing.html', `https://${req.headers.host}`);
                successUrl.searchParams.append('status', 'success');
                successUrl.searchParams.append('plan', plan.planName);
                return res.redirect(302, successUrl.toString());
            }
        }
        
        console.warn(`Payment status was not 'success' for txnid: ${txnid}. Status: ${status}`);
        const failureUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        failureUrl.searchParams.append('status', 'failed');
        res.redirect(302, failureUrl.toString());

    } catch (error) {
        console.error("Fatal Error in PayU Callback Handler:", error);
        const errorUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        errorUrl.searchParams.append('status', 'error');
        res.redirect(302, errorUrl.toString());
    }
}
