// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
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
const provider = new GoogleAuthProvider();

// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once to avoid repeated lookups
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn-white');
    DOMElements.headerNav = document.getElementById('header-nav');
    DOMElements.planStatusBadge = document.getElementById('plan-status-badge');

    initializeEventListeners();
    initializePricingAnimations(); // Initialize new animations
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

// --- NEW: ANIMATION LOGIC ---
function initializePricingAnimations() {
    gsap.to('.pricing-page h1', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.2 });
    gsap.to('.pricing-page p', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.4 });
    
    const cards = gsap.utils.toArray('.pricing-card-white');
    cards.forEach((card, i) => {
        gsap.to(card, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            delay: 0.6 + i * 0.2, // Staggered delay for each card
            onComplete: () => {
                // Animate features inside the card after the card has appeared
                const features = card.querySelectorAll('ul li');
                gsap.to(features, {
                    opacity: 1,
                    x: 0,
                    duration: 0.5,
                    stagger: 0.1,
                    ease: 'power2.out'
                });
            }
        });
    });
}

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.buyNowBtns.forEach(btn => {
        btn.addEventListener('click', (event) => handlePurchase(event));
    });
}

// --- Core Logic ---
function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => modal.setAttribute('aria-hidden', 'false'), 10);
    } else {
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.headerNav.innerHTML = `
            <a href="index.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Generator</a>
            <button id="sign-out-btn" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const plan = await response.json();
                updatePlanUI(plan);
            } else {
                throw new Error("Failed to fetch plan details");
            }
        } catch (error) {
            console.error("Error fetching plan:", error);
            DOMElements.planStatusBadge.textContent = 'Could not load plan.';
        }
    } else {
         DOMElements.headerNav.innerHTML = `
            <a href="index.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Generator</a>
            <button id="sign-in-btn" class="text-sm font-medium text-white bg-[#517CBE] hover:bg-[#43649d] px-4 py-1.5 rounded-full transition-colors">Sign In</button>
        `;
        document.getElementById('sign-in-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        updatePlanUI({ name: 'Free', credits: 0 }); // Show default free status
    }
}

function updatePlanUI(plan) {
    // Hide all active badges first
    document.querySelectorAll('.active-plan-badge').forEach(b => b.remove());

    if (plan.name !== 'Free') {
        DOMElements.planStatusBadge.innerHTML = `Current Plan: <span class="font-bold">${plan.name}</span> (${plan.credits} credits remaining)`;
        
        const activePlanCard = document.getElementById(`plan-${plan.name.toLowerCase()}`);
        if (activePlanCard) {
            const badgeContainer = activePlanCard.querySelector('.plan-badge-container');
            const badge = document.createElement('div');
            badge.className = 'active-plan-badge';
            badge.textContent = 'Active Plan';
            badgeContainer.innerHTML = ''; // Clear existing badges like "Most Popular"
            badgeContainer.appendChild(badge);
        }
    } else {
        DOMElements.planStatusBadge.textContent = 'You are on the Free Plan';
    }
}


function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => console.error("Authentication Error:", error));
}

async function handlePurchase(event) {
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    const clickedButton = event.currentTarget;
    const plan = clickedButton.dataset.plan;
    const originalButtonText = clickedButton.innerHTML;
    clickedButton.disabled = true;
    clickedButton.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ plan })
        });
        if (!response.ok) throw new Error(await response.text());
        const { paymentData } = await response.json();
        redirectToPayU(paymentData);
    } catch (error) {
        console.error('Payment initiation failed:', error);
        alert(`Could not start payment. Please try again.`);
        clickedButton.disabled = false;
        clickedButton.innerHTML = originalButtonText;
    }
}

function redirectToPayU(data) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://secure.payu.in/_payment'; 
    for (const key in data) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data[key];
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

