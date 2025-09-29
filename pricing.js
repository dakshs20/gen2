// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM Element Caching ---
const DOMElements = {};
let userPlanUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn');
    DOMElements.planBadgeDesktop = document.getElementById('plan-badge-desktop');
    DOMElements.planBadgeMobile = document.getElementById('plan-badge-mobile');
    DOMElements.pricingCards = document.querySelectorAll('.pricing-card');

    initializeEventListeners();
    initializeSwiper();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => {
        updateUIForAuthState(user);
        if (user) {
            listenToUserPlan(user.uid);
        } else {
            if (userPlanUnsubscribe) userPlanUnsubscribe();
            resetPlanUI();
        }
    });

    DOMElements.authBtn.addEventListener('click', handleAuthAction);
    DOMElements.googleSignInBtn.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn.addEventListener('click', () => toggleModal(DOMElements.authModal, false));

    DOMElements.buyNowBtns.forEach(btn => {
        btn.addEventListener('click', (event) => handlePurchase(event));
    });

    DOMElements.pricingCards.forEach(card => {
        const info = card.querySelector('.plan-info');
        if (info) {
            card.addEventListener('mouseenter', () => info.classList.remove('hidden'));
            card.addEventListener('mouseleave', () => info.classList.add('hidden'));
        }
    });
}

function initializeSwiper() {
    if (window.innerWidth < 768) {
        new Swiper('.swiper-container', {
            loop: false,
            slidesPerView: 1,
            spaceBetween: 20,
            centeredSlides: true,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    }
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
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
    } else {
        DOMElements.authBtn.textContent = 'Sign In';
    }
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => console.error("Authentication Error:", error));
}

function listenToUserPlan(userId) {
    const userDocRef = doc(db, 'users', userId);
    userPlanUnsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            updatePlanUI(userData);
        } else {
            resetPlanUI();
        }
    });
}

function updatePlanUI(userData) {
    const { planName, credits, expiryDate } = userData;
    const plan = planName || 'Free';
    const badgeText = `Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;

    DOMElements.planBadgeDesktop.textContent = badgeText;
    DOMElements.planBadgeMobile.textContent = badgeText;

    DOMElements.buyNowBtns.forEach(btn => {
        const btnPlan = btn.dataset.plan;
        if (btnPlan === plan.toLowerCase()) {
            btn.textContent = 'Current Plan';
            btn.disabled = true;
            btn.classList.add('bg-gray-400', 'cursor-not-allowed');
            btn.classList.remove('bg-gray-800', 'bg-blue-500', 'hover:bg-black', 'hover:bg-blue-600');
        } else {
            btn.textContent = `Get ${btnPlan.charAt(0).toUpperCase() + btnPlan.slice(1)}`;
            btn.disabled = false;
            btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            if (btnPlan === 'create') {
                 btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            } else {
                 btn.classList.add('bg-gray-800', 'hover:bg-black');
            }
        }
    });

    // Update expiry countdown
    updateExpiryCountdown(plan, expiryDate);
}

function updateExpiryCountdown(plan, expiryDate) {
    // Clear existing countdowns
    document.querySelectorAll('.expiry-countdown').forEach(el => el.remove());

    if (expiryDate && (plan === 'inspire' || plan === 'create')) {
        const expiry = expiryDate.toDate();
        const now = new Date();
        const diffTime = expiry - now;
        
        if (diffTime > 0) {
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const card = document.querySelector(`[data-plan="${plan}"]`).closest('.pricing-card');
            if (card) {
                const countdownEl = document.createElement('p');
                countdownEl.className = 'expiry-countdown text-xs text-center text-red-500 mt-2 font-semibold';
                countdownEl.textContent = `Expires in ${diffDays} days`;
                card.appendChild(countdownEl);
            }
        }
    }
}


function resetPlanUI() {
    DOMElements.planBadgeDesktop.textContent = 'Plan: Free';
    DOMElements.planBadgeMobile.textContent = 'Plan: Free';
    DOMElements.buyNowBtns.forEach(btn => {
        const plan = btn.dataset.plan;
        btn.textContent = `Get ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
        btn.disabled = false;
        btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
         if (plan === 'create') {
            btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        } else {
            btn.classList.add('bg-gray-800', 'hover:bg-black');
        }
    });
     document.querySelectorAll('.expiry-countdown').forEach(el => el.remove());
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
        alert(`Could not start payment: ${error.message}`);
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
