// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Global State ---
let currentUser;
let currentUserPlan = { name: 'Free', credits: 0 }; // Default plan state
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let currentPreviewInputData = null;
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    const ids = [
        'header-nav', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'preview-input-image-container', 'preview-input-image', 'change-input-image-btn', 'remove-input-image-btn', 'preview-image-upload-input',
        'hero-headline', 'hero-subline', 'typewriter', 'prompt-bar-container',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'button-timer', 'button-content'
    ];
    ids.forEach(id => {
        DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
    });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    
    initializeEventListeners();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});


function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('[role="dialog"]').forEach(modal => toggleModal(modal, false));
    }));
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    DOMElements.promptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleImageGenerationRequest(); }
    });
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);
    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.ratioOptions.classList.toggle('hidden');
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    // Ratio buttons event listeners and other UI setups...
    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
}

// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    if (user) {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="plan-badge-header" class="text-sm font-medium text-gray-700 px-3 py-1"></div>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1"></div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        fetchUserPlan(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white bg-primary-blue hover:bg-primary-blue-dark px-4 py-1.5 rounded-full transition-colors">Sign In</button>
        `;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', signInWithGoogle);
        updateCreditsDisplay({ name: 'Free', credits: 0 }); // Reset UI for signed-out state
    }
}

async function fetchUserPlan(user) {
    try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch plan');
        const plan = await response.json();
        currentUserPlan = plan;
        updateCreditsDisplay(plan);
    } catch (error) {
        console.error("Error fetching plan:", error);
        updateCreditsDisplay({ name: 'Error', credits: 'N/A' });
    }
}

function updateCreditsDisplay(plan) {
    const creditsCounter = document.getElementById('credits-counter');
    const planBadge = document.getElementById('plan-badge-header');
    if (creditsCounter) creditsCounter.textContent = `Credits: ${plan.credits}`;
    if (planBadge) planBadge.textContent = `Plan: ${plan.name}`;
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

function signInWithGoogle() {
    signInWithPopup(auth, provider).catch(console.error);
}

// --- Image Generation ---
function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserPlan.credits <= 0 && currentUserPlan.name !== 'Free') {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) return;

    // --- Free User 30-Second Timer Logic ---
    if (currentUserPlan.name === 'Free' && currentUserPlan.credits <= 0) {
        isGenerating = true;
        setLoadingState(true, 30); // Start 30s timer
        setTimeout(() => {
            performGeneration(prompt, uploadedImageData);
        }, 30000);
    } else {
        // Paid users or free users with credits generate immediately
        performGeneration(prompt, uploadedImageData);
    }
}

async function performGeneration(prompt, imageData) {
    isGenerating = true;
    if (currentUserPlan.name !== 'Free' || currentUserPlan.credits > 0) {
        setLoadingState(true, 17); // Start 17s UX timer
    }

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData, aspectRatio: imageData ? null : currentAspectRatio })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.details || 'API generation failed');
        }
        
        const result = await response.json();
        
        // Update credit count from the API response
        currentUserPlan.credits = result.newCreditCount;
        updateCreditsDisplay(currentUserPlan);

        const base64Data = result.predictions?.[0]?.bytesBase64Encoded || result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (!base64Data) throw new Error("No image data in API response");
        
        showPreviewModal(`data:image/png;base64,${base64Data}`, prompt, imageData);

    } catch (error) {
        console.error("Generation Error:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        clearInterval(timerInterval);
        setLoadingState(false);
        DOMElements.promptInput.value = '';
        removeUploadedImage();
    }
}

function setLoadingState(isLoading, duration = 17) {
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.buttonContent.classList.toggle('hidden', isLoading);
    DOMElements.buttonTimer.classList.toggle('hidden', !isLoading);
    if (isLoading) {
        startTimer(duration);
    }
}

function startTimer(duration) {
    let endTime = Date.now() + (duration * 1000);
    DOMElements.buttonTimer.textContent = duration.toFixed(2);
    
    timerInterval = setInterval(() => {
        const remaining = Math.max(0, endTime - Date.now());
        DOMElements.buttonTimer.textContent = (remaining / 1000).toFixed(2);
        if (remaining <= 0) clearInterval(timerInterval);
    }, 50);
}

// --- Image Handling & Uploads (handleImageUpload, removeUploadedImage, etc.) ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        uploadedImageData = { mimeType: file.type, data: base64String };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.ratioBtn.disabled = true;
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreview.src = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.ratioBtn.disabled = false;
}

// --- Preview Modal Functions (showPreviewModal, downloadPreviewImage, handleRegeneration) ---
function showPreviewModal(imageUrl, prompt, inputImageData) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    currentPreviewInputData = inputImageData;
    // ... logic to show/hide input image preview
    toggleModal(DOMElements.previewModal, true);
}

function downloadPreviewImage() {
    const link = document.createElement('a');
    link.href = DOMElements.previewImage.src;
    link.download = 'genart-image.png';
    link.click();
}

async function handleRegeneration() {
    const newPrompt = DOMElements.previewPromptInput.value;
    if (!newPrompt && !currentPreviewInputData) return;
    toggleModal(DOMElements.previewModal, false);
    await performGeneration(newPrompt, currentPreviewInputData);
}

