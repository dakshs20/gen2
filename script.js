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

// --- Global State ---
let currentUserCredits = 0;
let isGenerating = false;
let masonry;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    initializeEventListeners();
    initializeScrollAnimations();
    initializeShowcaseSlider();
    initializeGallery();
});

function cacheDOMElements() {
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.outOfCreditsModal = document.getElementById('out-of-credits-modal');
    DOMElements.closeCreditsModalBtn = document.getElementById('close-credits-modal-btn');
    DOMElements.welcomeCreditsModal = document.getElementById('welcome-credits-modal');
    DOMElements.closeWelcomeModalBtn = document.getElementById('close-welcome-modal-btn');
    DOMElements.freeCreditsAmount = document.getElementById('free-credits-amount');
    DOMElements.generationCounter = document.getElementById('generation-counter');
    DOMElements.promptInput = document.getElementById('prompt-input');
    DOMElements.generateBtn = document.getElementById('generate-btn');
    DOMElements.tryNowBtn = document.getElementById('try-now-btn');
    DOMElements.ctaBtn = document.getElementById('cta-btn');
    DOMElements.loadingIndicator = document.getElementById('loading-indicator');
    DOMElements.imageGallery = document.getElementById('image-gallery');
    DOMElements.messageBox = document.getElementById('message-box');
}

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    DOMElements.authBtn?.addEventListener('click', handleAuthAction);
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    
    DOMElements.closeCreditsModalBtn?.addEventListener('click', () => toggleModal(DOMElements.outOfCreditsModal, false));
    DOMElements.closeWelcomeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.welcomeCreditsModal, false));

    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    
    const generatorSection = document.getElementById('generator');
    DOMElements.tryNowBtn?.addEventListener('click', () => generatorSection.scrollIntoView({ behavior: 'smooth' }));
    DOMElements.ctaBtn?.addEventListener('click', () => generatorSection.scrollIntoView({ behavior: 'smooth' }));

    DOMElements.promptInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            DOMElements.generateBtn.click();
        }
    });
}

// --- UI & State Management ---
function toggleModal(modal, show) {
    if (!modal) return;
    modal.setAttribute('aria-hidden', String(!show));
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                // Log detailed error for debugging serverless function issues
                const errorBody = await response.text();
                console.error(`Credit fetch failed with status: ${response.status}`, errorBody);
                throw new Error('Credit fetch failed');
            }
            
            const data = await response.json();
            currentUserCredits = data.credits;
            updateCreditDisplay();

            if (data.isNewUser && data.credits > 0) {
                if (DOMElements.freeCreditsAmount) DOMElements.freeCreditsAmount.textContent = data.credits;
                toggleModal(DOMElements.welcomeCreditsModal, true);
            }
        } catch (error) {
            console.error("Credit fetch error:", error);
            currentUserCredits = 0;
            updateCreditDisplay(true); // Pass error state
            showMessage("Could not fetch your credit balance.", "error");
        }
    } else {
        currentUserCredits = 0;
        DOMElements.authBtn.textContent = 'Sign In';
        updateCreditDisplay();
    }
}

function updateCreditDisplay(isError = false) {
    let text = '';
    if (auth.currentUser) {
        text = isError ? `Credits: --` : `${currentUserCredits} Credits`;
    }
    if(DOMElements.generationCounter) DOMElements.generationCounter.textContent = text;
}


function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    const color = type === 'error' ? 'red' : 'blue';
    messageEl.className = `p-4 rounded-lg bg-${color}-100 text-${color}-700 animate-fade-in-up`;
    messageEl.textContent = text;
    DOMElements.messageBox.innerHTML = '';
    DOMElements.messageBox.appendChild(messageEl);
}

// --- Core Application Logic ---
function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign out error:", error));
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            showMessage('Failed to sign in. Please try again.', 'error');
        });
}

function handleImageGenerationRequest() {
    if (isGenerating) return;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }
    
    generateImage(prompt);
}

async function generateImage(prompt) {
    isGenerating = true;
    startLoadingUI();

    try {
        const token = await auth.currentUser.getIdToken();
        
        // Deduct credit first
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) {
            if (deductResponse.status === 402) {
                toggleModal(DOMElements.outOfCreditsModal, true);
            } else {
                throw new Error('Failed to deduct credit.');
            }
            stopLoadingUI();
            return;
        }
        
        const deductData = await deductResponse.json();
        currentUserCredits = deductData.newCredits;
        updateCreditDisplay();

        // Then generate image
        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt, aspectRatio: "1:1" })
        });

        if (!generateResponse.ok) {
            const errorResult = await generateResponse.json();
            throw new Error(errorResult.error || `API Error: ${generateResponse.status}`);
        }

        const result = await generateResponse.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Data) {
            throw new Error("No image data received from API.");
        }

        const imageUrl = `data:image/png;base64,${base64Data}`;
        displayImage(imageUrl, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        updateUIForAuthState(auth.currentUser); // Refresh credits on error
    } finally {
        stopLoadingUI();
    }
}

// --- UI Updates for Generation ---
function startLoadingUI() {
    DOMElements.messageBox.innerHTML = '';
    DOMElements.loadingIndicator.classList.remove('hidden');
    DOMElements.generateBtn.disabled = true;
    DOMElements.generateBtn.textContent = 'Generating...';
}

function stopLoadingUI() {
    isGenerating = false;
    DOMElements.loadingIndicator.classList.add('hidden');
    DOMElements.generateBtn.disabled = false;
    DOMElements.generateBtn.textContent = 'Generate';
}

function displayImage(imageUrl, prompt) {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;

    galleryItem.appendChild(img);

    // Prepend to gallery for instant visibility
    DOMElements.imageGallery.prepend(galleryItem);
    
    // Use imagesLoaded to wait for the new image before relaying out Masonry
    imagesLoaded(DOMElements.imageGallery, function() {
        masonry.prepended(galleryItem);
        masonry.layout();
    });
}

// --- Initializations for Animations and Components ---
function initializeGallery() {
     masonry = new Masonry(DOMElements.imageGallery, {
        itemSelector: '.gallery-item',
        columnWidth: '.gallery-item',
        percentPosition: true,
        gutter: 16
    });
    // Add some initial placeholder images for design
    const initialImages = [
        'https://placehold.co/600x800/e6f0ff/0052cc?text=GenArt',
        'https://placehold.co/600x600/e6f0ff/0052cc?text=GenArt',
        'https://placehold.co/600x900/e6f0ff/0052cc?text=GenArt',
        'https://placehold.co/600x700/e6f0ff/0052cc?text=GenArt',
        'https://placehold.co/600x500/e6f0ff/0052cc?text=GenArt',
        'https://placehold.co/600x850/e6f0ff/0052cc?text=GenArt',
    ];

    initialImages.forEach(src => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'AI Generated Art Example';
        item.appendChild(img);
        DOMElements.imageGallery.appendChild(item);
    });
    
    imagesLoaded( DOMElements.imageGallery ).on( 'progress', function() {
      // layout Masonry after each image loads
      DOMElements.imageGallery.classList.add('loaded');
      masonry.layout();
    });
}


function initializeScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                if (entry.target.dataset.counter) {
                    animateCounter(entry.target);
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .about-text, .about-visual, [data-counter]').forEach(el => {
        observer.observe(el);
    });
}

function animateCounter(element) {
    const target = +element.dataset.counter;
    let current = 0;
    const increment = target / 200; // Animation speed

    const updateCounter = () => {
        current += increment;
        if (current < target) {
            element.innerText = Math.ceil(current).toLocaleString();
            requestAnimationFrame(updateCounter);
        } else {
            element.innerText = target.toLocaleString() + '+';
        }
    };
    updateCounter();
}

function initializeShowcaseSlider() {
    const tabs = document.querySelectorAll('.showcase-tab');
    const slider = document.querySelector('.showcase-slider');
    if (!tabs.length || !slider) return;

    const images = {
        art: ['https://placehold.co/800x600/0052cc/ffffff?text=Art+1', 'https://placehold.co/800x600/0052cc/ffffff?text=Art+2', 'https://placehold.co/800x600/0052cc/ffffff?text=Art+3'],
        photography: ['https://placehold.co/800x600/0052cc/ffffff?text=Photo+1', 'https://placehold.co/800x600/0052cc/ffffff?text=Photo+2', 'https://placehold.co/800x600/0052cc/ffffff?text=Photo+3'],
        marketing: ['https://placehold.co/800x600/0052cc/ffffff?text=Marketing+1', 'https://placehold.co/800x600/0052cc/ffffff?text=Marketing+2', 'https://placehold.co/800x600/0052cc/ffffff?text=Marketing+3'],
        '3d': ['https://placehold.co/800x600/0052cc/ffffff?text=3D+1', 'https://placehold.co/800x600/0052cc/ffffff?text=3D+2', 'https://placehold.co/800x600/0052cc/ffffff?text=3D+3'],
        concept: ['https://placehold.co/800x600/0052cc/ffffff?text=Concept+1', 'https://placehold.co/800x600/0052cc/ffffff?text=Concept+2', 'https://placehold.co/800x600/0052cc/ffffff?text=Concept+3'],
    };

    function loadCategory(category) {
        slider.innerHTML = '';
        images[category].forEach(src => {
            const item = document.createElement('div');
            item.className = 'showcase-item';
            const img = document.createElement('img');
            img.src = src;
            img.alt = `${category} showcase image`;
            item.appendChild(img);
            slider.appendChild(item);
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadCategory(tab.dataset.category);
        });
    });

    // Initial load
    loadCategory('art');
}

