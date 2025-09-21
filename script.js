// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let currentUserCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let isFetchingMore = false;

// The full list of gallery images.
const ALL_IMAGE_URLS = [
    "https://iili.io/K7bN7Hl.md.png", "https://iili.io/K7bOTzP.md.png", "https://iili.io/K7yYoqN.md.png",
    "https://iili.io/K7bk3Ku.md.png", "https://iili.io/K7b6OPV.md.png", "https://iili.io/K7be88v.md.png",
    "https://iili.io/K7b894e.md.png", "https://iili.io/K7y1cUN.md.png", "https://iili.io/K7yEx14.md.png",
    "https://iili.io/K7b4VQR.md.png", "https://iili.io/K7yGhS2.md.png", "https://iili.io/K7bs5wg.md.png",
    "https://iili.io/K7bDzpS.md.png", "https://iili.io/K7yVVv2.md.png", "https://iili.io/K7bmj7R.md.png",
    "https://iili.io/K7bP679.md.png"
];

// Start index for infinite scroll, after the initial hardcoded images.
let nextImageIndex = 10; 

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'prompt-input', 'generate-btn', 'generate-icon', 'loading-spinner',
        'image-upload-btn', 'image-upload-input', 'remove-image-btn',
        'image-preview-container', 'image-preview', 'masonry-gallery', 'gallery-container', 'loader',
        'ratio-btn', 'ratio-options'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');

    initializeEventListeners();
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateUIForAuthState(user);
    });
});

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);

    // Aspect Ratio Dropdown
    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.ratioOptions.classList.toggle('hidden');
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    
    document.querySelectorAll('.ratio-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            document.querySelectorAll('.ratio-option').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    // Infinite Scroll
    DOMElements.galleryContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = DOMElements.galleryContainer;
        if (scrollTop + clientHeight >= scrollHeight - 300 && !isFetchingMore) {
            fetchMoreImages();
        }
    });
}


// --- UI & State Management ---

function updateUIForAuthState(user) {
    const nav = DOMElements.headerNav;
    if (!nav) return;

    if (user) {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            <div id="generation-counter" class="text-sm font-medium text-gray-700">Loading...</div>
            <button id="auth-action-btn" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Sign Out</button>
        `;
        document.getElementById('auth-action-btn').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            <button id="auth-action-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-all">Sign In</button>
        `;
        document.getElementById('auth-action-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    }
}

async function fetchUserCredits(user) {
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch credits');
        const data = await response.json();
        currentUserCredits = data.credits;
        const counter = document.getElementById('generation-counter');
        if (counter) counter.textContent = `Credits: ${currentUserCredits}`;
    } catch (error) {
        console.error("Error fetching credits:", error);
        const counter = document.getElementById('generation-counter');
        if (counter) counter.textContent = "Credits: Error";
    }
}


// --- Image Gallery & Infinite Scroll ---

function addImageToGallery(imageUrl, isNew = false) {
    const gallery = DOMElements.masonryGallery;
    const item = document.createElement('div');
    item.className = 'masonry-item';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'rounded-lg w-full h-auto block'; // Added 'block' to ensure correct masonry rendering
    img.loading = 'lazy';
    img.alt = 'Generated Art';
    item.appendChild(img);

    if (isNew) {
        gallery.insertBefore(item, gallery.firstChild);
    } else {
        gallery.appendChild(item);
    }
}

function fetchMoreImages() {
    if (nextImageIndex >= ALL_IMAGE_URLS.length) {
        DOMElements.loader.style.display = 'none'; // No more images
        return;
    }

    isFetchingMore = true;
    DOMElements.loader.style.display = 'block';

    setTimeout(() => { // Simulate network delay
        const imagesToLoad = ALL_IMAGE_URLS.slice(nextImageIndex, nextImageIndex + 5);
        imagesToLoad.forEach(url => addImageToGallery(url));
        nextImageIndex += 5;
        isFetchingMore = false;
        DOMElements.loader.style.display = 'none';
    }, 1000);
}


// --- Generation Logic ---

async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }
    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) {
        // Add a visual cue for empty prompt
        DOMElements.promptInput.classList.add('placeholder-red-400');
        setTimeout(() => DOMElements.promptInput.classList.remove('placeholder-red-400'), 1000);
        return;
    }
    
    generateImage(prompt);
}

async function generateImage(prompt) {
    setLoadingState(true);
    try {
        const token = await currentUser.getIdToken();
        
        // 1. Deduct credit first
        const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        if (!deductResponse.ok) throw new Error('Credit deduction failed');
        
        // 2. Generate image
        const body = { prompt, aspectRatio: currentAspectRatio };
        if (uploadedImageData) {
            body.imageData = uploadedImageData;
        }

        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (!generateResponse.ok) {
            const errorData = await generateResponse.json();
            throw new Error(errorData.error || 'API generation failed');
        }
        
        const result = await generateResponse.json();
        
        // Handle different API responses
        const base64Data = uploadedImageData 
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            : result.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Data) throw new Error("No image data in API response");
        
        addImageToGallery(`data:image/png;base64,${base64Data}`, true);
        await fetchUserCredits(currentUser); // Refresh credits
        resetPromptBar();

    } catch (error) {
        console.error("Generation Error:", error);
        // TODO: Add user-facing error message
    } finally {
        setLoadingState(false);
    }
}


// --- Image Upload Handling ---

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.imageUploadBtn.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.imageUploadBtn.classList.remove('hidden');
}


// --- UI Helpers ---

function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.generateIcon.classList.toggle('hidden', isLoading);
    DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
}

function resetPromptBar() {
    DOMElements.promptInput.value = '';
    removeUploadedImage();
}

function toggleModal(modal, show) {
    if (!modal) return;
    modal.setAttribute('aria-hidden', String(!show));
}

function closeAllModals() {
    document.querySelectorAll('[role="dialog"], [id*="-modal"]').forEach(modal => {
        toggleModal(modal, false);
    });
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
      .then(() => closeAllModals())
      .catch(console.error);
}

