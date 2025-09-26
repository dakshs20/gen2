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

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn-white');
    DOMElements.headerNav = document.getElementById('header-nav');
    DOMElements.planStatusBadge = document.getElementById('plan-status-badge');
    DOMElements.pricingToggle = document.getElementById('pricing-toggle-checkbox');
    DOMElements.priceAmounts = document.querySelectorAll('.plan-price-amount');

    initializeEventListeners();
    initializeDynamicBackground();
    initializePricingAnimations(); // This function has been rewritten
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

// --- DYNAMIC UI & ANIMATIONS ---

function initializeDynamicBackground() {
    const pricingPage = document.querySelector('.pricing-page');
    if (pricingPage) {
        window.addEventListener('mousemove', e => {
            gsap.to(pricingPage, {
                '--x': `${e.clientX}px`,
                '--y': `${e.clientY}px`,
                duration: 0.5,
                ease: 'sine.out'
            });
        });
    }
}

// --- REWRITTEN AND FIXED ANIMATION LOGIC ---
function initializePricingAnimations() {
    // Failsafe: If GSAP isn't loaded, just show the content to avoid a blank page.
    if (typeof gsap === 'undefined') {
        console.error("GSAP not loaded. Bypassing animations.");
        document.querySelectorAll('.pricing-title, .pricing-subtitle, .pricing-toggle-container, .pricing-card-wrapper').forEach(el => {
            el.style.opacity = 1;
            el.style.transform = 'none';
        });
        return;
    }

    const masterTl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    // 1. Animate the main page elements first with a nice stagger.
    masterTl.to('.pricing-title, .pricing-subtitle, .pricing-toggle-container', {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2
    });

    const cards = gsap.utils.toArray('.pricing-card-wrapper');

    // 2. Animate the card containers into view.
    masterTl.to(cards, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.15,
    }, "-=0.5"); // Overlap slightly with the previous animation for a smoother flow.

    // 3. Animate the content inside each card *after* the card container is visible.
    cards.forEach((card, index) => {
        const cardContentTl = gsap.timeline();
        
        const priceEl = card.querySelector('.plan-price-amount');
        if (!priceEl) return; // Skip if price element doesn't exist.

        const price = parseFloat(priceEl.dataset.monthly);
        const priceProxy = { val: 0 };
        
        cardContentTl.from(card.querySelectorAll('h2, .text-sm, p:not(.plan-price-amount)'), { opacity: 0, y: 20, stagger: 0.1, duration: 0.6 })
                     .to(priceProxy, {
                         val: price,
                         duration: 1,
                         ease: 'power1.inOut',
                         onUpdate: () => {
                             priceEl.textContent = '$' + Math.ceil(priceProxy.val);
                         }
                     }, "<0.2")
                     .to(card.querySelectorAll('ul li'), { opacity: 1, x: 0, stagger: 0.1, duration: 0.5 }, "<0.3")
                     .from(card.querySelector('button'), { opacity: 0, y: 20, duration: 0.6 }, "<0.2");
        
        // Add this card's content animation to the master timeline, ensuring it starts
        // only after the card wrapper has started its animation.
        masterTl.add(cardContentTl, 1 + index * 0.15);
    });
}

function handlePriceToggle() {
    const isYearly = DOMElements.pricingToggle.checked;
    DOMElements.priceAmounts.forEach(el => {
        const monthlyPrice = el.dataset.monthly;
        const yearlyPrice = el.dataset.yearly;
        const targetPrice = isYearly ? yearlyPrice : monthlyPrice;

        const priceProxy = { val: parseFloat(el.textContent.replace('$', '')) };
        
        gsap.to(priceProxy, {
            val: targetPrice,
            duration: 0.8,
            ease: 'power3.inOut',
            onUpdate: () => {
                el.textContent = '$' + Math.round(priceProxy.val);
            }
        });

        const siblingSpan = el.nextElementSibling;
        if(siblingSpan) {
            siblingSpan.textContent = isYearly ? '/year' : '/month';
        }
    });
}


// --- CORE LOGIC ---

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.buyNowBtns.forEach(btn => {
        btn.addEventListener('click', (event) => handlePurchase(event));
    });
    DOMElements.pricingToggle?.addEventListener('change', handlePriceToggle);
}

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => modal.setAttribute('aria-hidden', 'false'), 10);
    } else {
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.style.display = 'none', 300);
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
            if (!response.ok) throw new Error("Failed to fetch plan details");
            const plan = await response.json();
            updatePlanUI(plan);
        } catch (error) {
            console.error("Error fetching plan:", error);
            if(DOMElements.planStatusBadge) DOMElements.planStatusBadge.textContent = 'Could not load plan.';
        }
function updatePlanUI(plan) {
    document.querySelectorAll('.active-plan-badge').forEach(b => b.remove());

    if (plan.name !== 'Free') {
        DOMElements.planStatusBadge.innerHTML = `Current Plan: <span class="font-bold">${plan.name}</span> (${plan.credits} credits remaining)`;
        
        const activePlanCard = document.getElementById(`plan-${plan.name.toLowerCase()}`);
        if (activePlanCard) {
            const badgeContainer = activePlanCard.querySelector('.plan-badge-container');
            if (badgeContainer) {
                 const badge = document.createElement('div');
                badge.className = 'active-plan-badge';
                badge.textContent = 'Active Plan';
                badgeContainer.innerHTML = ''; 
                badgeContainer.appendChild(badge);
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

