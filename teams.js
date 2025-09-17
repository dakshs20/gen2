// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Your web app's Firebase configuration
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
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.mobileAuthBtn = document.getElementById('mobile-auth-btn');
    DOMElements.generationCounter = document.getElementById('generation-counter');
    DOMElements.mobileGenerationCounter = document.getElementById('mobile-generation-counter');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    DOMElements.mobileMenu = document.getElementById('mobile-menu');

    initializeEventListeners();
    initializeCursor();
    initializeScrollAnimations();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.mobileMenuBtn?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
}

// --- Core Logic ---

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json();
                DOMElements.generationCounter.textContent = `Credits: ${data.credits}`;
                DOMElements.mobileGenerationCounter.textContent = `Credits: ${data.credits}`;
            } else {
                throw new Error("Failed to fetch credits");
            }
        } catch (error) {
            console.error("Error fetching credits:", error);
            DOMElements.generationCounter.textContent = "Credits: Error";
            DOMElements.mobileGenerationCounter.textContent = "Credits: Error";
        }
    } else {
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        DOMElements.generationCounter.textContent = 'Sign in for credits';
        DOMElements.mobileGenerationCounter.textContent = 'Sign in for credits';
    }
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        // In a real app, you might have a dedicated sign-in modal/page.
        // For now, we'll just log to console.
        console.log("Sign-in action triggered.");
        // A simple way to sign in if needed for testing:
        signInWithPopup(auth, provider).catch(err => console.error(err));
    }
}

// --- ANIMATION & UTILITY FUNCTIONS ---

function initializeScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, {
        threshold: 0.1 
    });

    const elementsToAnimate = document.querySelectorAll('.observe-me');
    elementsToAnimate.forEach(el => observer.observe(el));
}


function initializeCursor() {
    if (!DOMElements.cursorDot || !DOMElements.cursorOutline) return;
    
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        if(DOMElements.cursorDot) {
            DOMElements.cursorDot.style.left = `${mouseX}px`;
            DOMElements.cursorDot.style.top = `${mouseY}px`;
        }
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        if(DOMElements.cursorOutline) {
            DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        }
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline?.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline?.classList.remove('cursor-hover'));
    });
}
