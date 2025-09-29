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

let currentUser = null;
let userPlan = 'Free';
let userCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let freeTierTimerInterval;

const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'prompt-input', 'generate-btn', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 
        'image-preview', 'remove-image-btn', 'prompt-bar-container',
        'button-timer', 'button-content', 'generate-icon', 'credits-counter-desktop', 'plan-badge-desktop'
    ];
    ids.forEach(id => {
        if (document.getElementById(id)) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');

    initializeEventListeners();
    onAuthStateChanged(auth, user => {
        currentUser = user;
        if (user) {
            listenToUserData(user.uid);
        } else {
            resetUI();
        }
    });
});

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
        toggleModal(DOMElements.authModal, false);
        toggleModal(DOMElements.outOfCreditsModal, false);
    }));
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    
    DOMElements.promptInput?.addEventListener('input', autoResizeTextarea);
    
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);

    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.ratioOptions.classList.toggle('hidden');
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    DOMElements.ratioOptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            DOMElements.ratioOptionBtns.forEach(b => b.classList.remove('bg-blue-100'));
            e.currentTarget.classList.add('bg-blue-100');
        });
    });
}

function listenToUserData(userId) {
    const userDocRef = doc(db, 'users', userId);
    onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            userPlan = data.planName || 'Free';
            userCredits = data.credits || 0;
            updateUserUI();
        } else {
            resetUI();
        }
    });
}

function updateUserUI() {
    if (DOMElements.planBadgeDesktop) {
        DOMElements.planBadgeDesktop.textContent = `Plan: ${userPlan}`;
    }
     if (DOMElements.creditsCounterDesktop) {
        DOMElements.creditsCounterDesktop.innerHTML = `
            <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z"></path></svg>
            <span>${userCredits} credits</span>
            <div class="h-4 w-px bg-gray-300"></div>
            <a href="pricing.html" class="text-blue-600 font-semibold hover:underline">Get More</a>
        `;
    }
}

function resetUI() {
    userPlan = 'Free';
    userCredits = 0;
     if (DOMElements.planBadgeDesktop) {
        DOMElements.planBadgeDesktop.textContent = `Plan: Free`;
    }
     if (DOMElements.creditsCounterDesktop) {
        DOMElements.creditsCounterDesktop.innerHTML = `
             <a href="pricing.html" class="text-blue-600 font-semibold hover:underline">View Plans</a>
        `;
    }
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    DOMElements.promptBarContainer.classList.toggle('expanded', textarea.scrollHeight > 50);
}

function toggleModal(modal, show) {
    if (!modal) return;
    modal.style.display = show ? 'flex' : 'none';
}

function signInWithGoogle() {
    signInWithPopup(auth, provider).catch(console.error);
}

async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (userPlan !== 'Free' && userCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) {
        DOMElements.promptBarContainer.classList.add('animate-shake');
        setTimeout(() => DOMElements.promptBarContainer.classList.remove('animate-shake'), 500);
        return;
    }
    
    setLoadingState(true);

    if (userPlan === 'Free') {
        startFreeTierTimer();
        await new Promise(resolve => setTimeout(resolve, 30000));
    }

    try {
        const token = await currentUser.getIdToken();
        
        if (userPlan !== 'Free') {
            const deductResponse = await fetch('/api/credits', {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!deductResponse.ok) throw new Error('Credit deduction failed.');
        }

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: currentAspectRatio })
        });

        if (!response.ok) throw new Error(`API generation failed: ${await response.text()}`);
        
        const result = await response.json();
        // Handle response and display image
        
    } catch (error) {
        console.error("Generation Error:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        setLoadingState(false);
        DOMElements.promptInput.value = '';
        autoResizeTextarea({target: DOMElements.promptInput});
        removeUploadedImage();
    }
}

function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.buttonContent.classList.toggle('hidden', isLoading);
    DOMElements.buttonTimer.classList.toggle('hidden', !isLoading);
}

function startFreeTierTimer() {
    let timeLeft = 30;
    DOMElements.buttonTimer.textContent = timeLeft;
    freeTierTimerInterval = setInterval(() => {
        timeLeft--;
        DOMElements.buttonTimer.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(freeTierTimerInterval);
        }
    }, 1000);
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
