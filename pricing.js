// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
let currentUserPlan = null;
let countdownInterval;

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once
    const ids = [
        'header-nav', 'mobile-menu', 'mobile-menu-btn', 'auth-modal',
        'google-signin-btn', 'plan-status-badge'
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.referralBtn = document.getElementById('referral-btn');

    initializeEventListeners();
    initializeCursor();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.mobileMenuBtn?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));

    DOMElements.buyNowBtns.forEach(btn => {
        btn.addEventListener('mousedown', (event) => handlePurchase(event));
    });

    DOMElements.referralBtn?.addEventListener('click', handleReferral);
}

// --- Core Logic ---

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.classList.remove('opacity-0', 'invisible');
        modal.setAttribute('aria-hidden', 'false');
    } else {
        modal.classList.add('opacity-0', 'invisible');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function updateUIForAuthState(user) {
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    if (user) {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 bg-blue-100/80 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">...</div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-slate-200/50 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        mobileNav.innerHTML = `
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg bg-gray-100">Pricing</a>
            <div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">...</div>
            <button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        
        fetchUserPlan(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200/50 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>
        `;
         mobileNav.innerHTML = `
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
            <div class="p-4 mt-4">
                 <button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
            </div>
        `;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        document.getElementById('sign-in-btn-mobile').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        
        updatePlanUI({ name: 'Free', credits: 0, expiryDate: null });
    }
}


async function fetchUserPlan(user) {
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Failed to fetch plan");
        
        currentUserPlan = await response.json();
        updatePlanUI(currentUserPlan);

    } catch (error) {
        console.error("Error fetching user plan:", error);
        updatePlanUI({ name: 'Free', credits: 0, expiryDate: null });
    }
}

function updatePlanUI(plan) {
    // Update header credits display
    const creditsCounter = document.getElementById('credits-counter');
    const creditsCounterMobile = document.getElementById('credits-counter-mobile');
    if (creditsCounter) creditsCounter.textContent = `Credits: ${plan.name === 'Free' ? 'N/A' : plan.credits}`;
    if (creditsCounterMobile) creditsCounterMobile.textContent = `Credits: ${plan.name === 'Free' ? 'N/A' : plan.credits}`;

    // Update main status badge
    const statusBadge = DOMElements.planStatusBadge;
    if (plan.name === 'Free') {
        statusBadge.textContent = `Plan: Free (30 sec per generation)`;
    } else {
        statusBadge.textContent = `Current Plan: ${plan.name} (${plan.credits} credits remaining)`;
    }
    statusBadge.classList.remove('opacity-0', '-translate-y-4');


    // Reset all cards first
    document.querySelectorAll('.pricing-card').forEach(card => {
        const planName = card.id.split('-')[1];
        const btn = card.querySelector('.buy-now-btn');
        btn.disabled = false;
        btn.textContent = `Get ${planName.charAt(0).toUpperCase() + planName.slice(1)}`;
        const badgeContainer = card.querySelector('.plan-badge-container');
        if (badgeContainer) badgeContainer.innerHTML = ''; // Clear existing badges
    });

    if (plan.name !== 'Free') {
        const planId = plan.name.toLowerCase();
        const activeCard = document.getElementById(`plan-${planId}`);
        if (activeCard) {
            const btn = activeCard.querySelector('.buy-now-btn');
            btn.disabled = true;
            btn.textContent = 'Your Current Plan';
            
            const badgeContainer = activeCard.querySelector('.plan-badge-container');
            if (badgeContainer) {
                 badgeContainer.innerHTML = `<div class="absolute top-0 right-0 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full -mt-2 -mr-2">ACTIVE</div>`;
            }
        }
    }
    
    // Handle expiry countdown
    if (countdownInterval) clearInterval(countdownInterval);
    if (plan.expiryDate) {
        const expiryDate = new Date(plan.expiryDate.seconds * 1000);
        const planId = plan.name.toLowerCase();
        const activeCard = document.getElementById(`plan-${planId}`);
        if(activeCard) {
            const expiryEl = activeCard.querySelector('.expiry-info');
            countdownInterval = setInterval(() => {
                 const now = new Date();
                 const diff = expiryDate - now;
                 if (diff <= 0) {
                     expiryEl.textContent = "Expired";
                     clearInterval(countdownInterval);
                 } else {
                     const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                     const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                     expiryEl.textContent = `Expires in ${days}d ${hours}h`;
                 }
            }, 1000);
        }
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

function handleReferral() {
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    const referralLink = `${window.location.origin}?ref=${auth.currentUser.uid}`;
    navigator.clipboard.writeText(referralLink).then(() => {
        DOMElements.referralBtn.textContent = 'Link Copied!';
        setTimeout(() => {
            DOMElements.referralBtn.textContent = 'Get Your Referral Link';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy link. Please try again.');
        console.error('Could not copy text: ', err);
    });
}

async function handlePurchase(event) {
    const clickedButton = event.currentTarget;
    const plan = clickedButton.dataset.plan;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

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

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `Server Error: ${response.status}`);
        }

        const { paymentData } = await response.json();
        redirectToPayU(paymentData);

    } catch (error) {
        console.error('Payment initiation failed:', error);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        clickedButton.disabled = false;
        clickedButton.innerHTML = originalButtonText;
    }
}

function redirectToPayU(data) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://secure.payu.in/_payment'; 

    for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        }
    }

    document.body.appendChild(form);
    form.submit();
}

// --- Utility: Custom Cursor ---
function initializeCursor() {
    if (!DOMElements.cursorDot || !DOMElements.cursorOutline) return;
    
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        DOMElements.cursorDot.style.left = `${mouseX}px`;
        DOMElements.cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline.classList.remove('cursor-hover'));
    });
}
