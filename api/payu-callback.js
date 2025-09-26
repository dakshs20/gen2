import admin from 'firebase-admin';
import crypto from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
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

const db = getFirestore();

// --- Server-side plan details ---
const plans = {
    'Inspire Plan': { name: 'Inspire', credits: 575, validityMonths: 3 },
    'Create Plan':  { name: 'Create',  credits: 975, validityMonths: 5 },
    'Elevate Plan': { name: 'Elevate', credits: 1950, validityMonths: null } // null means never expires
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const salt = process.env.PAYU_SECRET_KEY;
        const receivedData = req.body;
        
        const { status, key, txnid, amount, productinfo, firstname, email, udf1, hash: receivedHash } = receivedData;
        
        // --- Security Check: Verify Hash ---
        const hashString = `${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash !== receivedHash) {
            console.error("Hash Mismatch Error: Payment callback is not authentic.");
            return res.status(400).send("Security Error: Transaction tampering detected.");
        }

        if (status === 'success') {
            const planKey = productinfo.replace('GenArt Credits - ', '');
            const planDetails = plans[planKey];
            
            if (planDetails && udf1) {
                const userRef = db.collection('users').doc(udf1);
                
                const purchaseDate = new Date();
                let expiryDate = null;
                if (planDetails.validityMonths) {
                    expiryDate = new Date(purchaseDate);
                    expiryDate.setMonth(expiryDate.getMonth() + planDetails.validityMonths);
                }
                
                // --- Create the new plan object for Firestore ---
                const newPlan = {
                    name: planDetails.name,
                    credits: planDetails.credits,
                    purchaseDate: Timestamp.fromDate(purchaseDate),
                    expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
                };
                
                // Set the activePlan for the user. This will overwrite any existing plan.
                await userRef.set({
                    activePlan: newPlan,
                    email: email // Also update email just in case
                }, { merge: true });

                console.log(`Successfully applied plan '${planDetails.name}' for user ${udf1}`);

                // --- Redirect to success page ---
                const successUrl = new URL('/payment-success.html', `https://${req.headers.host}`);
                successUrl.searchParams.append('credits', planDetails.credits);
                successUrl.searchParams.append('txnid', txnid);
                return res.redirect(302, successUrl.toString());
            }
        }
        
        // --- Handle Failure/Pending Cases ---
        console.warn(`Payment status was not 'success' for txnid: ${txnid}. Status: ${status}`);
        const failureUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        failureUrl.searchParams.append('status', 'failed');
        res.redirect(302, failureUrl.toString());

    } catch (error) {
        console.error("Fatal Error in PayU Callback Handler:", error);
        const errorUrl = new URL('/pricing.html', `httpshttps://${req.headers.host}`);
        errorUrl.searchParams.append('status', 'error');
        res.redirect(302, errorUrl.toString());
    }
}

