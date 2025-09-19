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
let lastPrompt = '';
let selectedAspectRatio = '1:1';
let uploadedImageData = null;
let isGenerating = false;
let timerInterval;

// --- Navratri Try-On State ---
let tryOnState = {
    personImage: null,
    garmentImage: null,
    isGenerating: false,
    timerInterval: null
};

// --- Dress Data ---
const NAVRATRI_DRESSES = {
    female: [
        'https://i.ibb.co/6yqM58p/lehenga1.png',
        'https://i.ibb.co/Fqsj1Gg/lehenga2.png',
        'https://i.ibb.co/BPDqGjn/lehenga3.png',
        'https://i.ibb.co/3zd7Jq0/lehenga4.png',
        'https://i.ibb.co/k2qZDTq/lehenga5.png',
        'https://i.ibb.co/wJscf4L/lehenga6.png',
        'https://i.ibb.co/pZ4jjV2/lehenga7.png',
        'https://i.ibb.co/M7S28Bf/lehenga8.png',
        'https://i.ibb.co/M2mwG3Q/lehenga9.png',
        'https://i.ibb.co/j3YkYmg/lehenga10.png'
    ],
    male: [
        'https://i.ibb.co/2Zk1P8f/kurta1.png',
        'https://i.ibb.co/3fQCZ1p/kurta2.png',
        'https://i.ibb.co/MhL2XwM/kurta3.png',
        'https://i.ibb.co/bFzL1qF/kurta4.png',
        'https://i.ibb.co/f46Ry31/kurta5.png',
        'https://i.ibb.co/JCdQKSk/kurta6.png',
        'https://i.ibb.co/2nLdbtG/kurta7.png',
        'https://i.ibb.co/8Y4j7vK/kurta8.png',
        'https://i.ibb.co/v4KdhvR/kurta9.png',
        'https://i.ibb.co/vqm4qBv/kurta10.png'
    ]
};


// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Helper to convert kebab-case IDs to camelCase for property access
    const camelCase = str => str.replace(/-([a-z])/g, g => g[1].toUpperCase());

    // Cache all DOM elements once to avoid repeated lookups
    const ids = [
        'mobile-menu-btn', 'mobile-menu', 'auth-btn', 'mobile-auth-btn', 'auth-modal',
        'google-signin-btn', 'close-modal-btn', 'out-of-credits-modal', 'close-credits-modal-btn',
        'welcome-credits-modal', 'close-welcome-modal-btn', 'free-credits-amount',
        'generation-counter', 'mobile-generation-counter', 'music-btn', 'lofi-music',
        'generator-ui', 'result-container', 'prompt-input', 'generate-btn', 'image-upload-btn',
        'image-upload-input', 'remove-image-btn', 'image-preview-container', 'image-preview',
        'copy-prompt-btn', 'enhance-prompt-btn', 'prompt-suggestions', 'loading-indicator',
        'image-grid', 'post-generation-controls', 'regenerate-prompt-input', 'regenerate-btn',
        'message-box', 'promo-try-now-btn', 'navratri-tryon-btn', 'navratri-modal',
        'close-navratri-modal-btn', 'tryon-step-1', 'tryon-image-upload-btn', 'tryon-image-upload-input',
        'tryon-step-2', 'tryon-step-3', 'dress-gallery', 'tryon-generate-btn', 'tryon-step-4',
        'tryon-loading-indicator', 'tryon-progress-bar', 'tryon-timer', 'tryon-result-image',
        'tryon-start-new-btn', 'tryon-back-btn'
    ];
    
    // FIX: Populate DOMElements with camelCase keys
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            DOMElements[camelCase(id)] = element;
        }
    });
    
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.examplePrompts = document.querySelectorAll('.example-prompt');
    DOMElements.aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    DOMElements.genderBtns = document.querySelectorAll('.gender-btn');

    initializeEventListeners();
});


function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (DOMElements.mobileMenuBtn) DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
    
    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    
    DOMElements.closeCreditsModalBtn?.addEventListener('click', () => toggleModal(DOMElements.outOfCreditsModal, false));
    DOMElements.closeWelcomeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.welcomeCreditsModal, false));

    DOMElements.musicBtn?.addEventListener('click', toggleMusic);
    
    DOMElements.generateBtn?.addEventListener('click', () => handleImageGenerationRequest(false));
    DOMElements.regenerateBtn?.addEventListener('click', () => handleImageGenerationRequest(true));
    
    DOMElements.promoTryNowBtn?.addEventListener('click', handlePromoTryNow);

    DOMElements.promptInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            DOMElements.generateBtn.click();
        }
    });

    DOMElements.examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            DOMElements.promptInput.value = button.innerText.trim();
            DOMElements.promptInput.focus();
        });
    });

    DOMElements.aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOMElements.aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);
    DOMElements.copyPromptBtn?.addEventListener('click', copyPrompt);
    DOMElements.enhancePromptBtn?.addEventListener('click', handleEnhancePrompt);

    // --- Navratri Try-On Event Listeners ---
    DOMElements.navratriTryonBtn?.addEventListener('click', () => toggleModal(DOMElements.navratriModal, true));
    DOMElements.closeNavratriModalBtn?.addEventListener('click', () => {
        toggleModal(DOMElements.navratriModal, false);
        resetTryOnFlow();
    });
    DOMElements.tryonImageUploadBtn?.addEventListener('click', () => DOMElements.tryonImageUploadInput.click());
    DOMElements.tryonImageUploadInput?.addEventListener('change', handleTryOnImageUpload);
    DOMElements.genderBtns?.forEach(btn => btn.addEventListener('click', handleGenderSelection));
    DOMElements.tryonBackBtn?.addEventListener('click', () => showTryOnStep(2));
    DOMElements.tryonGenerateBtn?.addEventListener('click', handleTryOnGeneration);
    DOMElements.tryonStartNewBtn?.addEventListener('click', resetTryOnFlow);


    initializeCursor();
}

// --- UI & State Management ---

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.remove('opacity-0', 'invisible');
    } else {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('opacity-0', 'invisible');
    }
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const bodyText = await response.text();
                throw new Error(`Credit fetch failed with status: ${response.status} and body: ${bodyText}`);
            }
            const data = await response.json();
            currentUserCredits = data.credits;
            updateCreditDisplay();

            if (data.isNewUser && data.credits > 0) {
                if(DOMElements.freeCreditsAmount) DOMElements.freeCreditsAmount.textContent = data.credits;
                toggleModal(DOMElements.welcomeCreditsModal, true);
            }

        } catch (error) {
            console.error("Credit fetch error:", error);
            currentUserCredits = 0;
            updateCreditDisplay();
            showMessage("Could not fetch your credit balance.", "error");
        }
    } else {
        currentUserCredits = 0;
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        updateCreditDisplay();
    }
}

function updateCreditDisplay() {
    const text = auth.currentUser ? `Credits: ${currentUserCredits}` : 'Sign in to generate';
    DOMElements.generationCounter.textContent = text;
    DOMElements.mobileGenerationCounter.textContent = text;
}

function resetToGeneratorView() {
    DOMElements.generatorUi.classList.remove('hidden');
    DOMElements.resultContainer.classList.add('hidden');
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.messageBox.innerHTML = '';
    DOMElements.postGenerationControls.classList.add('hidden');
    removeUploadedImage();
    DOMElements.promptInput.value = '';
    DOMElements.regeneratePromptInput.value = '';
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

function handleImageGenerationRequest(isRegenerate) {
    if (isGenerating) return;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const promptInput = isRegenerate ? DOMElements.regeneratePromptInput : DOMElements.promptInput;
    const prompt = promptInput.value.trim();

    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }
    
    lastPrompt = prompt;
    generateImage(prompt, isRegenerate);
}

async function generateImage(prompt, isRegenerate) {
    isGenerating = true;
    startLoadingUI(isRegenerate);

    try {
        const token = await auth.currentUser.getIdToken();
        
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) {
            if(deductResponse.status === 402) toggleModal(DOMElements.outOfCreditsModal, true);
            else throw new Error('Failed to deduct credit.');
            stopLoadingUI();
            return;
        }
        
        const deductData = await deductResponse.json();
        currentUserCredits = deductData.newCredits;
        updateCreditDisplay();

        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: selectedAspectRatio })
        });

        if (!generateResponse.ok) {
            const errorResult = await generateResponse.json();
            throw new Error(errorResult.error || `API Error: ${generateResponse.status}`);
        }

        const result = await generateResponse.json();
        
        let base64Data = uploadedImageData 
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data
            : result.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Data) throw new Error("No image data received from API.");
        
        displayImage(`data:image/png;base64,${base64Data}`, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        updateUIForAuthState(auth.currentUser); 
    } finally {
        stopLoadingUI();
    }
}

// --- Navratri Try-On Functions ---

function showTryOnStep(stepNumber) {
    [1, 2, 3, 4].forEach(n => {
        DOMElements[`tryonStep${n}`].classList.add('hidden');
    });
    DOMElements[`tryonStep${stepNumber}`].classList.remove('hidden');
}

function resetTryOnFlow() {
    tryOnState = { personImage: null, garmentImage: null, isGenerating: false, timerInterval: null };
    DOMElements.tryonImageUploadInput.value = '';
    DOMElements.dressGallery.innerHTML = '';
    DOMElements.tryonGenerateBtn.disabled = true;
    showTryOnStep(1);
}

function handleTryOnImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        tryOnState.personImage = { mimeType: file.type, data: reader.result.split(',')[1] };
        showTryOnStep(2);
    };
    reader.readAsDataURL(file);
}

function handleGenderSelection(event) {
    const gender = event.currentTarget.dataset.gender;
    populateDressGallery(gender);
    showTryOnStep(3);
}

function populateDressGallery(gender) {
    const dresses = NAVRATRI_DRESSES[gender] || [];
    DOMElements.dressGallery.innerHTML = '';
    dresses.forEach(src => {
        const item = document.createElement('div');
        item.className = 'dress-item';
        item.innerHTML = `<img src="${src}" alt="Navratri Dress" loading="lazy">`;
        item.addEventListener('click', () => {
            document.querySelectorAll('.dress-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            tryOnState.garmentImage = src;
            DOMElements.tryonGenerateBtn.disabled = false;
        });
        DOMElements.dressGallery.appendChild(item);
    });
}

async function handleTryOnGeneration() {
    if (tryOnState.isGenerating || !tryOnState.personImage || !tryOnState.garmentImage) return;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    tryOnState.isGenerating = true;
    showTryOnStep(4);
    startTryOnTimer();

    try {
        // Fetch garment image and convert to base64
        const garmentResponse = await fetch(tryOnState.garmentImage);
        const garmentBlob = await garmentResponse.blob();
        const garmentBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(garmentBlob);
        });
        const garmentImageData = { mimeType: garmentBlob.type, data: garmentBase64 };

        const token = await auth.currentUser.getIdToken();
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) {
            throw new Error('Failed to deduct credit.');
        }

        const deductData = await deductResponse.json();
        currentUserCredits = deductData.newCredits;
        updateCreditDisplay();

        const prompt = `Realistically place the clothing from the second image onto the person in the first image. The final image should only show the person wearing the new outfit in a natural pose, maintaining the original background and body proportions. Ensure the lighting and shadows on the clothing match the person's environment.`;
        
        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                prompt,
                isTryOn: true,
                personImageData: tryOnState.personImage,
                garmentImageData: garmentImageData
            })
        });

        if (!generateResponse.ok) {
            throw new Error(`API Error: ${generateResponse.statusText}`);
        }

        const result = await generateResponse.json();
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Data) {
            throw new Error("No image data received from API.");
        }
        
        const imageUrl = `data:image/png;base64,${base64Data}`;
        DOMElements.tryonLoadingIndicator.classList.add('hidden');
        // FIX: Correct property access from tryonresultimage to tryonResultImage
        DOMElements.tryonResultImage.innerHTML = `<img src="${imageUrl}" alt="Virtual try-on result" class="mx-auto rounded-lg shadow-lg max-h-[60vh] w-auto">`;

    } catch (error) {
        console.error('Try-on generation failed:', error);
        DOMElements.tryonLoadingIndicator.innerHTML = `<p class="text-red-500">Sorry, something went wrong. Please try again.</p>`;
    } finally {
        stopTryOnTimer();
        tryOnState.isGenerating = false;
    }
}


// --- UI Update Functions for Generation ---

function startLoadingUI(isRegenerate) {
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.messageBox.innerHTML = '';
    if (isRegenerate) {
        DOMElements.loadingIndicator.classList.remove('hidden');
        DOMElements.postGenerationControls.classList.add('hidden');
    } else {
        DOMElements.resultContainer.classList.remove('hidden');
        DOMElements.loadingIndicator.classList.remove('hidden');
        DOMElements.generatorUi.classList.add('hidden');
    }
    timerInterval = startTimer();
}

function stopLoadingUI() {
    isGenerating = false;
    stopTimer(timerInterval);
    DOMElements.loadingIndicator.classList.add('hidden');
    DOMElements.regeneratePromptInput.value = lastPrompt;
    DOMElements.postGenerationControls.classList.remove('hidden');
    addNavigationButtons();
}

function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
}

function displayImage(imageUrl, prompt) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    downloadButton.ariaLabel = "Download Image";

    downloadButton.onclick = () => {
        try {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = 'genart-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
            showMessage("Could not download image. Please try saving it manually.", "error");
        }
    };

    imgContainer.append(img, downloadButton);
    DOMElements.imageGrid.appendChild(imgContainer);
}

// --- Utility Functions ---

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    DOMElements.messageBox.innerHTML = '';
    DOMElements.messageBox.appendChild(messageEl);
}

function addNavigationButtons() {
    const startNewButton = document.createElement('button');
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    startNewButton.onclick = resetToGeneratorView;
    DOMElements.messageBox.prepend(startNewButton);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.promptInput.placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    if (DOMElements.imageUploadInput) DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.imagePreview.src = '';
    DOMElements.promptInput.placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

async function handleEnhancePrompt() { showMessage("Prompt enhancement is coming soon!", "info"); }
function copyPrompt() {
    if (!DOMElements.promptInput.value) return showMessage("There's nothing to copy.", "info");
    navigator.clipboard.writeText(DOMElements.promptInput.value)
        .then(() => showMessage("Prompt copied!", "info"))
        .catch(() => showMessage("Failed to copy prompt.", "error"));
}
function toggleMusic() {
    if (!DOMElements.musicBtn || !DOMElements.lofiMusic) return;
    const isPlaying = DOMElements.musicBtn.classList.toggle('playing');
    isPlaying ? DOMElements.lofiMusic.play().catch(e => console.error("Audio failed:", e)) : DOMElements.lofiMusic.pause();
}

function startTimer(elId = 'timer', barId = 'progressBar', max = 17) {
    let startTime = Date.now();
    const timerEl = DOMElements[elId];
    const progressBar = DOMElements[barId];
    const maxTime = max * 1000;
    if (progressBar) progressBar.style.width = '0%';
    return setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        if (progressBar) progressBar.style.width = `${progress * 100}%`;
        if (timerEl) timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~${max}s`;
    }, 100);
}

function stopTimer(interval, barId = 'progressBar') {
    clearInterval(interval);
    if (DOMElements[barId]) DOMElements[barId].style.width = '100%';
}

function startTryOnTimer() { tryOnState.timerInterval = startTimer('tryonTimer', 'tryonProgressBar', 30); }
function stopTryOnTimer() { stopTimer(tryOnState.timerInterval, 'tryonProgressBar'); }

function handlePromoTryNow() {
    DOMElements.promptInput.value = "Transform me into a 1920s vintage glamour portrait, black-and-white, soft shadows, art deco background, ultra-realistic cinematic lighting.";
    DOMElements.promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    DOMElements.promptInput.focus();
}

function initializeCursor() {
    if (!DOMElements.cursorDot) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    const animate = () => {
        let dot = DOMElements.cursorDot;
        let outline = DOMElements.cursorOutline;
        if (dot) {
            dot.style.left = `${mouseX}px`;
            dot.style.top = `${mouseY}px`;
        }
        if (outline) {
            const ease = 0.15;
            outlineX += (mouseX - outlineX) * ease;
            outlineY += (mouseY - outlineY) * ease;
            outline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        }
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline?.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline?.classList.remove('cursor-hover'));
    });
}

