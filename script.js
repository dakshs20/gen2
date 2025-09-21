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
let isFetchingMore = false;
let page = 0;

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
        'generate-icon', 'loading-spinner', 'auth-modal', 'google-signin-btn', 'out-of-credits-modal'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    
    initializeEventListeners();
    loadMoreImages();
});

// --- Initializers ---
function initializeEventListeners() {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateUIForAuthState(user);
    });

    DOMElements.googleSigninBtn.addEventListener('click', signInWithGoogle);
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeAllModals));

    DOMElements.generateBtn.addEventListener('click', handleImageGenerationRequest);
    DOMElements.promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleImageGenerationRequest();
        }
    });
    
    DOMElements.promptInput.addEventListener('input', autoResizeTextarea);
    
    DOMElements.ratioBtn.addEventListener('click', () => DOMElements.ratioOptions.classList.toggle('hidden'));
    document.querySelectorAll('.ratio-option').forEach(btn => btn.addEventListener('click', selectAspectRatio));
    document.addEventListener('click', (e) => {
        if (!DOMElements.ratioBtn.parentElement.contains(e.target)) {
            DOMElements.ratioOptions.classList.add('hidden');
        }
    });

    // Infinite Scroll
    DOMElements.galleryContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = DOMElements.galleryContainer;
        if (scrollHeight - scrollTop - clientHeight < 1000 && !isFetchingMore) {
            loadMoreImages();
        }
    });
}

// --- UI & State Management ---

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.headerNav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <div id="credits-display" class="text-sm font-medium text-gray-600"></div>
            <button id="sign-out-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-500 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        
        try {
            const token = await user.getIdToken(true);
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch credits');
            
            const data = await response.json();
            currentUserCredits = data.credits;
            document.getElementById('credits-display').textContent = `Credits: ${currentUserCredits}`;

        } catch (error) {
            console.error("Error fetching credits:", error);
            document.getElementById('credits-display').textContent = "Credits: Error";
        }
    } else {
        DOMElements.headerNav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <button id="sign-in-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-500 transition-colors">Sign In</button>
        `;
        document.getElementById('sign-in-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    }
}

function selectAspectRatio(event) {
    const btn = event.currentTarget;
    currentAspectRatio = btn.dataset.ratio;
    
    document.querySelectorAll('.ratio-option').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    
    DOMElements.ratioOptions.classList.add('hidden');
}


// --- Core Generation Logic ---
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
    if (!prompt) return;

    await generateImage(prompt);
}

async function generateImage(prompt) {
    setLoadingState(true);
    try {
        const token = await currentUser.getIdToken();
        const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        if (!deductResponse.ok) throw new Error('Credit deduction failed');

        await addDoc(collection(db, 'generations'), {
            userId: currentUser.uid,
            prompt: prompt,
            createdAt: serverTimestamp()
        });
        
        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, aspectRatio: currentAspectRatio })
        });
        if (!generateResponse.ok) throw new Error('API generation failed');
        
        const result = await generateResponse.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data in response");
        
        displayImage(`data:image/png;base64,${base64Data}`, prompt, true);
        
        const creditData = await deductResponse.json();
        currentUserCredits = creditData.newCredits;
        document.getElementById('credits-display').textContent = `Credits: ${currentUserCredits}`;

    } catch (error) {
        console.error("Generation Error:", error);
    } finally {
        setLoadingState(false);
        DOMElements.promptInput.value = '';
        autoResizeTextarea({target: DOMElements.promptInput});
    }
}

function displayImage(imageUrl, prompt, isNew = false) {
    const item = document.createElement('div');
    item.className = 'grid-item';
    if(isNew) item.style.animationDelay = '0ms'; // New items fade in immediately
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt || "AI generated image";
    img.className = 'w-full h-auto object-cover';
    img.loading = 'lazy';
    
    item.appendChild(img);
    
    if (isNew) {
        DOMElements.masonryGallery.prepend(item);
    } else {
        DOMElements.masonryGallery.appendChild(item);
    }
}

function loadMoreImages() {
    if (isFetchingMore) return;
    isFetchingMore = true;
    DOMElements.loader.style.display = 'block';

    setTimeout(() => { // Simulate network delay
        const imagesToLoad = ALL_IMAGE_URLS.slice(page * 10, (page + 1) * 10);
        if (imagesToLoad.length === 0) {
            DOMElements.loader.style.display = 'none';
            return;
        }

        imagesToLoad.forEach((url, index) => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            // Stagger animation for items loading on scroll
            item.style.animationDelay = `${index * 50}ms`; 
            item.innerHTML = `<img src="${url}" class="w-full h-auto object-cover rounded-lg bg-gray-200" loading="lazy">`;
            DOMElements.masonryGallery.appendChild(item);
        });

        page++;
        isFetchingMore = false;
    }, 1000);
}


// --- Helpers & Utilities ---
function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.generateIcon.classList.toggle('hidden', isLoading);
    DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
      .then(() => closeAllModals())
      .catch(console.error);
}

function toggleModal(modal, show) {
    if (!modal) return;
    modal.setAttribute('aria-hidden', String(!show));
}

function closeAllModals() {
    [DOMElements.authModal, DOMElements.outOfCreditsModal].forEach(modal => toggleModal(modal, false));
}


