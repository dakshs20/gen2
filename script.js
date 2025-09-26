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
let currentUser;
let currentUserPlan = { name: 'Free', credits: 0 };
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let currentPreviewInputData = null;
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'hero-headline', 'hero-subline', 'typewriter',
        'prompt-input', 'generate-btn', 'button-content', 'button-timer', 'ratio-btn', 'ratio-options',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'preview-modal', 'preview-image', 'preview-prompt-input', 'download-btn', 'close-preview-btn', 'regenerate-btn',
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.statCards = document.querySelectorAll('.stat-card');
    DOMElements.counters = document.querySelectorAll('.counter');
    DOMElements.masonryColumns = document.querySelectorAll('.masonry-column');


    initializeEventListeners();
    initializeAnimations(); // Re-initializing animations
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    restructureGalleryForMobile();
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
    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });
}

// --- ANIMATIONS (RESTORED & ENHANCED) ---
function initializeAnimations() {
    gsap.registerPlugin(ScrollTrigger, TextPlugin);

    // Hero Section Entrance
    gsap.to(DOMElements.heroHeadline, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 });
    gsap.to(DOMElements.heroSubline, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.4 });

    // Typewriter effect
    const words = ["creators.", "agencies.", "enterprises."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1.5 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });
    
    // Stats Counters Animation
    DOMElements.statCards.forEach(card => {
        gsap.to(card, {
            opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
            scrollTrigger: { trigger: card, start: "top 85%" }
        });
    });
    if (DOMElements.counters) {
        DOMElements.counters.forEach(counter => {
            const target = +counter.dataset.target;
            const proxy = { val: 0 };
    
            gsap.to(proxy, {
                val: target,
                duration: 2,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: counter,
                    start: "top 90%",
                },
                onUpdate: () => {
                    counter.textContent = Math.ceil(proxy.val);
                }
            });
        });
    }

    // Testimonial Animation
    const testimonialSection = document.getElementById('testimonial-section');
    if(testimonialSection) {
        gsap.from(testimonialSection.querySelectorAll(".testimonial-image, .testimonial-card"), {
            opacity: 0, y: 50, duration: 1, stagger: 0.2, ease: 'power3.out',
            scrollTrigger: { trigger: testimonialSection, start: "top 80%" }
        });
    }
}

// Function to handle mobile gallery layout
function restructureGalleryForMobile() {
    if (window.innerWidth >= 768 || !DOMElements.masonryColumns || DOMElements.masonryColumns.length <= 1) return;
    const firstColumn = DOMElements.masonryColumns[0];
    for (let i = 1; i < DOMElements.masonryColumns.length; i++) {
        const column = DOMElements.masonryColumns[i];
        while (column.firstChild) {
            firstColumn.appendChild(column.firstChild);
        }
        column.remove();
    }
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    if (user) {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="plan-badge-header" class="text-sm font-medium text-gray-700 px-3 py-1"></div>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1"></div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        mobileNav.innerHTML = `
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
            <div id="plan-badge-header-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y"></div>
            <div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y"></div>
            <button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
         document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserPlan(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white bg-[#517CBE] hover:bg-[#43649d] px-4 py-1.5 rounded-full transition-colors">Sign In</button>
        `;
         mobileNav.innerHTML = `
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
             <div class="p-4 mt-4"><button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl">Sign In</button></div>
        `;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', signInWithGoogle);
        document.getElementById('sign-in-btn-mobile').addEventListener('click', signInWithGoogle);
        updateCreditsDisplay({ name: 'Free', credits: 0 });
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
    
    const mobileCredits = document.getElementById('credits-counter-mobile');
    const mobilePlan = document.getElementById('plan-badge-header-mobile');
    if(mobileCredits) mobileCredits.textContent = `Credits: ${plan.credits}`;
    if(mobilePlan) mobilePlan.textContent = `Plan: ${plan.name}`;
}

function toggleModal(modal, show) {
    if (!modal) return;
    modal.style.display = show ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', String(!show));
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

    // Free user with no credits has a 30s wait
    if (currentUserPlan.name === 'Free' && currentUserPlan.credits <= 0) {
        isGenerating = true;
        setLoadingState(true, 30);
        // We start the generation after the timer completes
        setTimeout(() => {
            performGeneration(prompt, uploadedImageData);
        }, 30000); 
    } else {
        performGeneration(prompt, uploadedImageData);
    }
}

async function performGeneration(prompt, imageData) {
    isGenerating = true;
    // Only start the 17s timer for non-free users or free users with credits
    if (currentUserPlan.name !== 'Free' || currentUserPlan.credits > 0) {
        setLoadingState(true, 17);
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
        
        // Update credits from the backend response
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
        if (remaining <= 0) {
            clearInterval(timerInterval);
        }
    }, 50);
}

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

function showPreviewModal(imageUrl, prompt, inputImageData) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    currentPreviewInputData = inputImageData;
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

