// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const firebaseConfig = {
    // This is a placeholder, replace with your actual Firebase config
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Plan Data ---
const plans = {
    create: {
        id: 'create',
        name: 'Create Plan',
        monthlyPrice: 798,
        yearlyPrice: 8140, // 798 * 12 * 0.85 (15% discount)
        credits: 575,
        speed: '17 sec/gen',
        expiry: '3 months',
        tagline: 'Perfect for hobbyists & casual creators.',
        cta: 'Get Started'
    },
    price: {
        id: 'price',
        name: 'Price Plan',
        monthlyPrice: 1596,
        yearlyPrice: 16280, // 1596 * 12 * 0.85
        credits: 975,
        speed: '17 sec/gen',
        expiry: '5 months',
        tagline: 'Perfect for regular creators & freelancers.',
        cta: 'Upgrade Your Workflow'
    },
    elevate: {
        id: 'elevate',
        name: 'Elevate Plan',
        monthlyPrice: 2571,
        yearlyPrice: 26224, // 2571 * 12 * 0.85
        credits: 1950,
        speed: '17 sec/gen',
        expiry: 'Never',
        tagline: 'Perfect for professionals & agencies.',
        cta: 'Scale with Confidence'
    }
};

// --- State ---
let currentUser = null;
let currentBillingCycle = 'monthly'; // 'monthly' or 'yearly'

// --- DOM Elements ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    const elementIds = ['auth-btn', 'mobile-auth-btn', 'auth-modal', 'google-signin-btn', 'generation-counter', 'mobile-generation-counter', 'billing-toggle', 'pricing-grid', 'checkout-modal', 'checkout-modal-content', 'mobile-menu-btn', 'mobile-menu'];
    elementIds.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');

    // Initial Render
    renderPlanCards();
    
    // Event Listeners
    initializeEventListeners();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateUIForAuthState(user);
    });

    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.mobileMenuBtn?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
    
    DOMElements.billingToggle?.addEventListener('change', (e) => {
        currentBillingCycle = e.target.checked ? 'yearly' : 'monthly';
        updateAllPlanPrices();
    });
    
    // Use event delegation for dynamically created elements
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.close-modal-btn') || e.target.closest('.close-modal-btn')) {
            toggleModal(DOMElements.authModal, false);
            toggleModal(DOMElements.checkoutModal, false);
        }
        if (e.target.matches('.choose-plan-btn')) {
            handleChoosePlan(e.target.dataset.planId);
        }
        if (e.target.matches('#confirm-checkout-btn')) {
            handleConfirmCheckout(e.target.dataset.planId, e.target.dataset.billingCycle);
        }
    });
}

// --- Render Functions ---
function renderPlanCards() {
    const grid = DOMElements.pricingGrid;
    if (!grid) return;
    grid.innerHTML = Object.values(plans).map(plan => createPlanCardHTML(plan)).join('');
}

function createPlanCardHTML(plan) {
    const isPopular = plan.id === 'price';
    const price = currentBillingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    return `
        <div id="plan-card-${plan.id}" class="relative bg-white p-8 rounded-2xl border ${isPopular ? 'border-indigo-500' : 'border-slate-200'} shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
            ${isPopular ? '<div class="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>' : ''}
            
            <h2 class="text-sm font-semibold text-slate-500">${plan.name}</h2>
            
            <div class="mt-4 flex items-baseline gap-x-2">
                <span class="text-5xl font-extrabold text-slate-900 tracking-tight">${plan.credits}</span>
                <span class="text-base font-semibold text-slate-500">generations</span>
            </div>

            <div class="mt-4 flex items-baseline gap-x-1">
                <span class="price-value text-3xl font-bold text-slate-800" data-plan-id="${plan.id}" data-monthly="${plan.monthlyPrice}" data-yearly="${plan.yearlyPrice}">₹${price.toLocaleString('en-IN')}</span>
                <span class="price-cycle text-sm font-semibold text-slate-500">/${currentBillingCycle === 'yearly' ? 'year' : 'month'}</span>
            </div>

             <div class="price-breakdown text-xs text-slate-500 h-6 mt-1">
                ${currentBillingCycle === 'yearly' ? `Billed once. Equivalent to ₹${(plan.yearlyPrice / 12).toFixed(0)} / month.` : ''}
            </div>

            <ul class="mt-6 space-y-3 text-sm text-slate-600">
                <li class="flex items-center gap-x-3"><svg class="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>Speed: ${plan.speed}</li>
                <li class="flex items-center gap-x-3"><svg class="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>Expiry: ${plan.expiry}</li>
            </ul>

            <p class="mt-6 text-sm text-slate-500">${plan.tagline}</p>
            
            <button data-plan-id="${plan.id}" class="choose-plan-btn mt-8 w-full ${isPopular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-800 text-white hover:bg-slate-900'} font-semibold py-3 rounded-lg transition-colors">${plan.cta}</button>
            <p class="mt-3 text-xs text-slate-400 text-center">Instant credits added after payment.</p>
        </div>
    `;
}

function updateAllPlanPrices() {
    document.querySelectorAll('.price-value').forEach(el => {
        const planId = el.dataset.planId;
        const monthlyPrice = parseInt(el.dataset.monthly);
        const yearlyPrice = parseInt(el.dataset.yearly);
        const targetPrice = currentBillingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
        
        animateValue(el, parseInt(el.textContent.replace(/[^0-9]/g, '')), targetPrice, 500);
        
        const cycleEl = el.nextElementSibling;
        if (cycleEl) cycleEl.textContent = `/${currentBillingCycle === 'yearly' ? 'year' : 'month'}`;

        const breakdownEl = el.closest('.relative').querySelector('.price-breakdown');
        if (breakdownEl) {
             if (currentBillingCycle === 'yearly') {
                breakdownEl.textContent = `Billed once. Equivalent to ₹${(yearlyPrice / 12).toFixed(0)} / month.`;
             } else {
                breakdownEl.textContent = '';
             }
        }
    });
}

// --- UI Interaction and Auth ---

function handleAuthAction() {
    if (currentUser) {
        signOut(auth);
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            alert("Failed to sign in. Please try again.");
        });
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const credits = userDoc.data().credits;
                DOMElements.generationCounter.textContent = `Credits: ${credits}`;
                DOMElements.mobileGenerationCounter.textContent = `Credits: ${credits}`;
            } else {
                 DOMElements.generationCounter.textContent = `Credits: 0`;
                 DOMElements.mobileGenerationCounter.textContent = `Credits: 0`;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            DOMElements.generationCounter.textContent = "Credits: Error";
            DOMElements.mobileGenerationCounter.textContent = "Credits: Error";
        }
    } else {
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        DOMElements.generationCounter.textContent = '';
        DOMElements.mobileGenerationCounter.textContent = '';
    }
}

// --- Checkout Flow ---

function handleChoosePlan(planId) {
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    const plan = plans[planId];
    renderCheckoutModal(plan);
    toggleModal(DOMElements.checkoutModal, true);
}

function renderCheckoutModal(plan) {
    const isYearly = currentBillingCycle === 'yearly';
    const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
    const firstAllocation = isYearly ? Math.floor(plan.credits / 12) : plan.credits;
    const monthlyAllocation = Math.floor(plan.credits / 12);

    let modalHTML = `
        <h2 class="text-2xl font-bold text-slate-800">Order Summary</h2>
        <button class="close-modal-btn absolute top-4 right-4 text-slate-400 hover:text-slate-600">&times;</button>
        <div class="mt-6 border-t border-slate-200 pt-6 space-y-4 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Plan:</span> <span class="font-semibold text-slate-800">${plan.name}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Billing:</span> <span class="font-semibold text-slate-800">${isYearly ? 'Yearly' : 'Monthly'}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Expiry:</span> <span class="font-semibold text-slate-800">${plan.expiry}</span></div>
            <div class="border-t border-slate-200 pt-4 mt-4">
                <p class="text-slate-600">You will be charged: <span class="text-xl font-bold text-slate-900">₹${price.toLocaleString('en-IN')}</span></p>
            </div>
            <div class="border-t border-slate-200 pt-4 mt-4">
                <p class="text-slate-600">Credits added now: <span class="font-bold text-indigo-600">${firstAllocation} generations.</span></p>
    `;
    if(isYearly) {
        modalHTML += `<p class="mt-1 text-slate-600">Subsequent allocations: <span class="font-bold text-indigo-600">${monthlyAllocation} generations per month for 11 months.</span></p>`;
    }
    modalHTML += `
            </div>
        </div>
        <div class="mt-8">
            <button id="confirm-checkout-btn" data-plan-id="${plan.id}" data-billing-cycle="${currentBillingCycle}" class="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors">
                Proceed to Secure Checkout
            </button>
            <p class="mt-2 text-xs text-slate-500 text-center">Secure checkout via Razorpay.</p>
        </div>
    `;

    DOMElements.checkoutModalContent.innerHTML = modalHTML;
}

async function handleConfirmCheckout(planId, billingCycle) {
    const confirmBtn = document.getElementById('confirm-checkout-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planId, billingCycle })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create order.');
        }

        const data = await response.json();
        const plan = plans[planId];
        
        const options = {
            key: data.key,
            amount: data.amount,
            currency: "INR",
            name: "GenArt",
            description: `${plan.name} - ${billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)}`,
            image: "https://iili.io/FsAoG2I.md.png",
            order_id: data.orderId,
            subscription_id: data.subscriptionId, // Will be undefined for one-time payments
            handler: async function (response) {
                // Verification on the backend
                const verificationResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        billingCycle: billingCycle
                    })
                });

                if(verificationResponse.ok) {
                    alert('Payment successful! Your credits have been added. Please check your dashboard.');
                    window.location.href = '/dashboard.html';
                } else {
                     throw new Error('Payment verification failed.');
                }
            },
            prefill: {
                name: currentUser.displayName || "",
                email: currentUser.email,
            },
            theme: {
                color: "#4F46E5"
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert(`Payment failed: ${response.error.description}`);
            console.error(response.error);
        });

        rzp.open();

    } catch (error) {
        console.error('Checkout Error:', error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Proceed to Secure Checkout';
    }
}


// --- Utilities ---
function toggleModal(modal, show) {
    if (!modal) return;
    const content = modal.querySelector('#checkout-modal-content');

    if (show) {
        modal.classList.remove('opacity-0', 'invisible');
        if (content) content.classList.remove('scale-95');
    } else {
        modal.classList.add('opacity-0');
        if (content) content.classList.add('scale-95');
        setTimeout(() => modal.classList.add('invisible'), 300);
    }
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = Math.floor(progress * (end - start) + start);
        obj.innerHTML = `₹${currentValue.toLocaleString('en-IN')}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
