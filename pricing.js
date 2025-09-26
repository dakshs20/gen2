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
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn-white');
    DOMElements.headerNav = document.getElementById('header-nav');
    DOMElements.planStatusBadge = document.getElementById('plan-status-badge');

    initializeEventListeners();
    initializeDynamicBackground(); // Initialize mouse-follow effect
    initializePricingAnimations(); // Initialize new entrance animations
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

// --- DYNAMIC UI & ANIMATIONS ---

function initializeDynamicBackground() {
    const pricingPage = document.querySelector('.pricing-page');
    if (pricingPage) {
        window.addEventListener('mousemove', e => {
            pricingPage.style.setProperty('--x', e.clientX + 'px');
            pricingPage.style.setProperty('--y', e.clientY + 'px');
        });
    }
}

function initializePricingAnimations() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to('.pricing-title', { opacity: 1, y: 0, duration: 0.8 }, 0.2)
      .to('.pricing-subtitle', { opacity: 1, y: 0, duration: 0.8 }, 0.4);

    gsap.utils.toArray('.pricing-card-wrapper').forEach((card, i) => {
        tl.to(card, { opacity: 1, y: 0, duration: 1 }, 0.6 + i * 0.2);
        
        const cardTl = gsap.timeline({
            scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' }
        });

        const priceEl = card.querySelector('.plan-price-amount');
        const price = parseFloat(priceEl.textContent.replace('$', ''));
        const priceProxy = { val: 0 };
        
        cardTl.from(card.querySelectorAll('h2, .text-sm, .text-xs'), { opacity: 0, y: 15, stagger: 0.1, delay:0.2 })
              .to(priceProxy, { 
                    val: price,
                    duration: 1,
                    ease: 'power1.inOut',
                    onUpdate: () => { priceEl.textContent = '$' + Math.ceil(priceProxy.val); }
              }, "-=0.5")
              .to(card.querySelectorAll('ul li'), { opacity: 1, x: 0, stagger: 0.1 }, "-=0.5")
              .from(card.querySelector('button'), { opacity: 0, y: 15 }, "-=0.5");
    });
}


// --- CORE LOGIC ---

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.buyNowBtns.forEach(btn => {
        btn.addEventListener('click', (event) => handlePurchase(event));
    });
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
    } else {
         DOMElements.headerNav.innerHTML = `
            <a href="index.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Generator</a>
            <button id="sign-in-btn" class="text-sm font-medium text-white bg-[#517CBE] hover:bg-[#43649d] px-4 py-1.5 rounded-full transition-colors">Sign In</button>
        `;
        document.getElementById('sign-in-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        updatePlanUI({ name: 'Free', credits: 10 });
    }
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
        }
    } else {
        DOMElements.planStatusBadge.innerHTML = `You are on the <span class="font-bold">Free Plan</span> with ${plan.credits} credits.`;
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

