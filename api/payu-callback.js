import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error) { console.error("Firebase Admin Initialization Error:", error); }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const salt = process.env.PAYU_SECRET_KEY;
        const { status, key, txnid, amount, productinfo, firstname, email, udf1: userId, udf2: planName, hash: receivedHash } = req.body;

        const hashString = `${salt}|${status}|||||||||${planName}|${userId}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash !== receivedHash) {
            console.error("Hash Mismatch Error: Payment tampering suspected.");
            return res.status(400).send("Security Error.");
        }

        if (status === 'success') {
            const PLANS = {
                inspire: { credits: 575, expiryMonths: 3 },
                create:  { credits: 975, expiryMonths: 5 },
                elevate: { credits: 1950, expiryMonths: null } // null for never expires
            };

            const plan = PLANS[planName];
            if (plan && userId) {
                const userRef = db.collection('users').doc(userId);
                let expiryDate = null;
                if (plan.expiryMonths) {
                    expiryDate = new Date();
                    expiryDate.setMonth(expiryDate.getMonth() + plan.expiryMonths);
                }

                const newPlanData = {
                    name: planName.charAt(0).toUpperCase() + planName.slice(1),
                    expiry: plan.expiryMonths === null ? 'never' : expiryDate.getTime()
                };

                await db.runTransaction(async (transaction) => {
                    transaction.update(userRef, {
                        credits: admin.firestore.FieldValue.increment(plan.credits),
                        activePlan: newPlanData
                    });
                });

                console.log(`Successfully added ${plan.credits} credits to user ${userId}`);
                const successUrl = new URL('/payment-success.html', `https://${req.headers.host}`);
                successUrl.searchParams.append('credits', plan.credits);
                successUrl.searchParams.append('txnid', txnid);
                return res.redirect(302, successUrl.toString());
            }
        }
        
        console.warn(`Payment not successful for txnid: ${txnid}. Status: ${status}`);
        const failureUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        failureUrl.searchParams.append('status', 'failed');
        res.redirect(302, failureUrl.toString());

    } catch (error) {
        console.error("Fatal Error in PayU Callback:", error);
        const errorUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        errorUrl.searchParams.append('status', 'error');
        res.redirect(302, errorUrl.toString());
    }
}

