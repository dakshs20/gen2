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
let currentUserCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let isFetchingMore = false;
let page = 0;
let uploadedImageData = null;

// Demo images for infinite scroll
const ALL_IMAGE_URLS = [
    "https://iili.io/K7bN7Hl.md.png", "https://iili.io/K7bOTzP.md.png", "https://iili.io/K7yYoqN.md.png",
    "https://iili.io/K7bk3Ku.md.png", "https://iili.io/K7b6OPV.md.png", "https://iili.io/K7be88v.md.png",
    "https://iili.io/K7b894e.md.png", "https://iili.io/K7y1cUN.md.png", "https://iili.io/K7yEx14.md.png",
    "https://iili.io/K7b4VQR.md.png", "https://iili.io/K7yGhS2.md.png", "https://iili.io/K7bs5wg.md.png",
    "https://iili.io/K7bDzpS.md.png", "https://iili.io/K7yVVv2.md.png", "https://iili.io/K7bmj7R.md.png",
    "https://iili.io/K7bP679.md.png"
];


// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'loader', 'prompt-input', 'ratio-btn', 'ratio-options', 'generate-btn',
        'generate-icon', 'loading-spinner', 'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    
    initializeEventListeners();
    loadInitialImages();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateUIForAuthState(user);
    });

    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    DOMElements.promptInput?.addEventListener('input', autoResizeTextarea);
    DOMElements.ratioBtn?.addEventListener('click', () => DOMElements.ratioOptions.classList.toggle('hidden'));
    
    document.querySelectorAll('.ratio-option').forEach(btn => {
        btn.addEventListener('click', () => selectAspectRatio(btn));
    });
    
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DOMElements.authModal.setAttribute('aria-hidden', 'true');
            DOMElements.outOfCreditsModal.setAttribute('aria-hidden', 'true');
        });
    });

    DOMElements.galleryContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = DOMElements.galleryContainer;
        if (scrollHeight - scrollTop - clientHeight < 1000 && !isFetchingMore) {
            loadMoreImages();
        }
    });

    DOMElements.imageUploadBtn.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn.addEventListener('click', removeUploadedImage);
}

// --- UI & State Management ---

async function updateUIForAuthState(user) {
    DOMElements.headerNav.innerHTML = ''; // Clear previous state
    if (user) {
        // User is signed in
        const token = await user.getIdToken(true);
        try {
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json();
                currentUserCredits = data.credits;
                DOMElements.headerNav.innerHTML = `
                    <a href="pricing.html" class="text-sm font-medium text-gray-600 hover:text-blue-600">Pricing</a>
                    <span class="text-sm font-medium text-gray-800">Credits: ${currentUserCredits}</span>
                    <button id="auth-action-btn" class="text-sm font-medium text-gray-600 hover:text-blue-600">Sign Out</button>
                `;
            } else {
                 DOMElements.headerNav.innerHTML = `<span class="text-sm text-red-500">Error loading credits</span>`;
            }
        } catch (error) {
            console.error("Error fetching credits:", error);
            DOMElements.headerNav.innerHTML = `<span class="text-sm text-red-500">Error loading credits</span>`;
        }
        document.getElementById('auth-action-btn').addEventListener('click', () => signOut(auth));
    } else {
        // User is signed out
        DOMElements.headerNav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-600 hover:text-blue-600">Pricing</a>
            <button id="auth-action-btn" class="text-sm font-medium text-white bg-blue-600 px-3 py-1 rounded-full hover:bg-blue-700">Sign In</button>
        `;
        document.getElementById('auth-action-btn').addEventListener('click', handleAuthAction);
    }
}


function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(console.error);
    } else {
        DOMElements.authModal.setAttribute('aria-hidden', 'false');
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
      .then(() => DOMElements.authModal.setAttribute('aria-hidden', 'true'))
      .catch(console.error);
}

function selectAspectRatio(selectedButton) {
    currentAspectRatio = selectedButton.dataset.ratio;
    document.querySelectorAll('.ratio-option').forEach(btn => btn.classList.remove('selected'));
    selectedButton.classList.add('selected');
    DOMElements.ratioOptions.classList.add('hidden');
}

// --- Image Loading & Gallery ---

function loadInitialImages() {
    isFetchingMore = true;
    const initialImages = ALL_IMAGE_URLS.slice(0, 10);
    initialImages.forEach(url => displayImage(url, 'Initial gallery image'));
    page++;
    isFetchingMore = false;
}

function loadMoreImages() {
    if (isFetchingMore) return;
    isFetchingMore = true;
    DOMElements.loader.style.display = 'block';

    setTimeout(() => { // Simulate network delay
        const startIndex = page * 10;
        const endIndex = startIndex + 10;
        const newImages = ALL_IMAGE_URLS.slice(startIndex, endIndex);

        if (newImages.length > 0) {
            newImages.forEach(url => displayImage(url, 'More gallery images'));
            page++;
        }
        
        DOMElements.loader.style.display = 'none';
        isFetchingMore = false;
    }, 1000);
}


async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!auth.currentUser) {
        handleAuthAction();
        return;
    }
    if (currentUserCredits <= 0) {
        DOMElements.outOfCreditsModal.setAttribute('aria-hidden', 'false');
        return;
    }
    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) return;

    await generateImage(prompt);
}

async function generateImage(prompt) {
    setLoadingState(true);
    try {
        const token = await auth.currentUser.getIdToken();
        const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        if (!deductResponse.ok) throw new Error('Credit deduction failed');
        
        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, aspectRatio: currentAspectRatio, imageData: uploadedImageData })
        });
        if (!generateResponse.ok) throw new Error('API generation failed');
        
        const result = await generateResponse.json();
        const base64Data = uploadedImageData ? result?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData?.data : result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data in response");
        
        displayImage(`data:image/png;base64,${base64Data}`, prompt, true);
        
        await updateUIForAuthState(auth.currentUser);

    } catch (error) {
        console.error("Generation Error:", error);
        alert("Image generation failed. Please try again.");
    } finally {
        setLoadingState(false);
        DOMElements.promptInput.value = '';
        autoResizeTextarea({target: DOMElements.promptInput});
        removeUploadedImage();
    }
}

function displayImage(imageUrl, prompt, isNew = false) {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'masonry-item';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-cover rounded-lg block';
    imgWrapper.appendChild(img);

    if (isNew) {
        DOMElements.masonryGallery.prepend(imgWrapper);
    } else {
        DOMElements.masonryGallery.appendChild(imgWrapper);
    }
}

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


// --- Helpers & Utilities ---
function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateIcon.classList.toggle('hidden', isLoading);
    DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
    DOMElements.generateBtn.disabled = isLoading;
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

