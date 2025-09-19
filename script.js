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

// --- NEW: Virtual Try-On (VTO) State ---
let vtoUserImage = null;
const NAVRATRI_DRESSES = {
    female: [
        { name: "Classic Red", url: "https://i.pinimg.com/originals/9a/2d/34/9a2d342f025413a96f1d2b77a0c8b9d2.png" },
        { name: "Elegant Blue", url: "https://www.sareesbazaar.com/images/products/medium/SB-DRS13035.jpg" },
        { name: "Vibrant Yellow", url: "https://assets.panashindia.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/3/3/332lg11-lg.jpg" },
        { name: "Peacock Green", url: "https://i.pinimg.com/originals/af/7d/f1/af7df11b71d62c1143a29b8214f47b2c.jpg" }
    ],
    male: [
        { name: "Blue Floral Kurta", url: "https://assets.myntassets.com/dpr_1.5,q_60,w_400,c_limit,fl_progressive/assets/images/22022838/2023/2/21/2b8a7f23-3e0e-4a65-a6e5-4a5c54a9c6801676974790890-SOJANYA-Men-Blue-Floral-Printed-Regular-Pure-Cotton-Kurta-w-1.jpg" },
        { name: "Classic White Kurta", url: "https://images.meesho.com/images/products/106686153/b7k7r_512.jpg" },
        { name: "Black Patterned Kurta", url: "https://rukminim1.flixcart.com/image/612/612/xif0q/kurta/c/p/k/m-vkurta-34-vida-loca-original-imagj489tqbgt4ze.jpeg?q=70" },
        { name: "Embroidered Kurta", url: "https://cdn.shopify.com/s/files/1/0523/3433/4379/products/4_740d12e4-e057-4b71-ab58-8686a603c46e_700x.jpg?v=1678877508" }
    ]
};


// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once to avoid repeated lookups
    const ids = ['mobile-menu-btn', 'mobile-menu', 'auth-btn', 'mobile-auth-btn', 'auth-modal', 'google-signin-btn', 'close-modal-btn', 'out-of-credits-modal', 'close-credits-modal-btn', 'welcome-credits-modal', 'close-welcome-modal-btn', 'free-credits-amount', 'generation-counter', 'mobile-generation-counter', 'music-btn', 'lofi-music', 'generator-ui', 'result-container', 'prompt-input', 'generate-btn', 'image-upload-btn', 'image-upload-input', 'remove-image-btn', 'image-preview-container', 'image-preview', 'copy-prompt-btn', 'enhance-prompt-btn', 'prompt-suggestions', 'loading-indicator', 'image-grid', 'post-generation-controls', 'regenerate-prompt-input', 'regenerate-btn', 'message-box', 'promo-try-now-btn', 'prompt-container'];
    ids.forEach(id => DOMElements[id] = document.getElementById(id));
    
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.examplePrompts = document.querySelectorAll('.example-prompt');
    DOMElements.aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    
    // --- NEW: Inject Navratri Try-On feature ---
    injectVTOFeature();
    initializeEventListeners();
});

function injectVTOFeature() {
    // 1. Inject Button
    if (DOMElements.promptContainer) {
        const navratriBtn = document.createElement('button');
        navratriBtn.id = 'navratri-try-on-btn';
        navratriBtn.className = 'prompt-suggestion-btn mt-2 mx-auto';
        navratriBtn.innerHTML = `✨ Try Navratri Dresses`;
        DOMElements.promptContainer.parentElement.appendChild(navratriBtn);
        DOMElements.navratriTryOnBtn = navratriBtn;
    }

    // 2. Inject Modal HTML
    const modalHTML = `
        <div id="vto-modal" class="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] transition-opacity duration-300 opacity-0 invisible">
            <div class="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl w-full text-center fade-in-slide-up relative max-h-[90vh] overflow-y-auto">
                <button id="vto-close-btn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
                
                <!-- Step 1: Upload Photo -->
                <div id="vto-step-1">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-2">Virtual Try-On: Step 1</h2>
                    <p class="text-gray-500 mb-6">Upload a clear, full-body photo of yourself.</p>
                    <input type="file" id="vto-image-upload" class="hidden" accept="image/*">
                    <label for="vto-image-upload" class="w-full bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2 cursor-pointer">
                        <span>Upload Your Photo</span>
                    </label>
                </div>

                <!-- Step 2: Select Gender -->
                <div id="vto-step-2" class="hidden">
                     <h2 class="text-2xl font-semibold text-gray-800 mb-2">Step 2: Choose a Style</h2>
                    <p class="text-gray-500 mb-6">This will help us show you the right outfits.</p>
                    <div class="flex gap-4 justify-center">
                        <button id="vto-gender-male" class="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300">Male</button>
                        <button id="vto-gender-female" class="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300">Female</button>
                    </div>
                </div>

                <!-- Step 3: Choose Dress -->
                <div id="vto-step-3" class="hidden">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-2">Step 3: Pick a Dress</h2>
                    <p class="text-gray-500 mb-6">Select an outfit to try on. (Costs 1 Credit)</p>
                    <div id="vto-dress-grid" class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>
                </div>
                
                <!-- Step 4: Generate & Result -->
                <div id="vto-step-4" class="hidden">
                     <h2 class="text-2xl font-semibold text-gray-800 mb-2">Creating Your New Look...</h2>
                    <p class="text-gray-500 mb-6">Please wait, this can take a moment.</p>
                    <div id="vto-loader" class="flex justify-center items-center h-64">
                         <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                    </div>
                    <div id="vto-result-container" class="hidden"></div>
                    <button id="vto-start-over-btn" class="hidden mt-4 w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-black transition-colors">Start Over</button>
                </div>

            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 3. Cache new VTO elements
    const vtoIds = ['vto-modal', 'vto-close-btn', 'vto-step-1', 'vto-step-2', 'vto-step-3', 'vto-step-4', 'vto-image-upload', 'vto-gender-male', 'vto-gender-female', 'vto-dress-grid', 'vto-loader', 'vto-result-container', 'vto-start-over-btn'];
    vtoIds.forEach(id => DOMElements[id] = document.getElementById(id));
}


function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (DOMElements.mobileMenuBtn) DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
    
    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
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

    // --- NEW: VTO Event Listeners ---
    DOMElements.navratriTryOnBtn?.addEventListener('click', openVTOModal);
    DOMElements.vtoCloseBtn?.addEventListener('click', () => toggleModal(DOMElements.vtoModal, false));
    DOMElements.vtoImageUpload?.addEventListener('change', handleVTOImageUpload);
    DOMElements.vtoGenderMale?.addEventListener('click', () => handleVTOGenderSelect('male'));
    DOMElements.vtoGenderFemale?.addEventListener('click', () => handleVTOGenderSelect('female'));
    DOMElements.vtoStartOverBtn?.addEventListener('click', openVTOModal);


    initializeCursor();
}

// --- NEW: VTO Modal Logic ---

function openVTOModal() {
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }
    vtoUserImage = null;
    DOMElements.vtoImageUpload.value = '';
    goToVTOStep(1);
    toggleModal(DOMElements.vtoModal, true);
}

function goToVTOStep(stepNumber) {
    [1, 2, 3, 4].forEach(n => DOMElements[`vto-step-${n}`].classList.add('hidden'));
    DOMElements[`vto-step-${stepNumber}`].classList.remove('hidden');

    if (stepNumber === 4) {
        DOMElements.vtoLoader.classList.remove('hidden');
        DOMElements.vtoResultContainer.classList.add('hidden');
        DOMElements.vtoResultContainer.innerHTML = '';
        DOMElements.vtoStartOverBtn.classList.add('hidden');
    }
}

function handleVTOImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        vtoUserImage = { mimeType: file.type, data: reader.result.split(',')[1] };
        goToVTOStep(2);
    };
    reader.readAsDataURL(file);
}

function handleVTOGenderSelect(gender) {
    populateDressGrid(gender);
    goToVTOStep(3);
}

function populateDressGrid(gender) {
    DOMElements.vtoDressGrid.innerHTML = '';
    const dresses = NAVRATRI_DRESSES[gender];
    dresses.forEach(dress => {
        const dressItem = document.createElement('div');
        dressItem.className = 'cursor-pointer group border rounded-lg overflow-hidden hover:border-blue-500 transition-all';
        dressItem.innerHTML = `
            <img src="${dress.url}" alt="${dress.name}" class="w-full h-48 object-cover object-top">
            <p class="p-2 text-sm font-medium text-gray-700 group-hover:text-blue-600">${dress.name}</p>
        `;
        dressItem.addEventListener('click', () => handleVTODressSelect(dress.url));
        DOMElements.vtoDressGrid.appendChild(dressItem);
    });
}

async function handleVTODressSelect(dressUrl) {
    goToVTOStep(4);

    try {
        // Fetch and convert dress image to base64
        const response = await fetch(dressUrl);
        if (!response.ok) throw new Error('Could not load dress image.');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const dressImage = { mimeType: blob.type, data: reader.result.split(',')[1] };
            
            // Deduct credit
            const token = await auth.currentUser.getIdToken();
            const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            if (!deductResponse.ok) {
                 if (deductResponse.status === 402) toggleModal(DOMElements.outOfCreditsModal, true);
                 throw new Error('Failed to deduct credit.');
            }
            const deductData = await deductResponse.json();
            currentUserCredits = deductData.newCredits;
            updateCreditDisplay();

            // Generate image
            const prompt = `Virtually try on the outfit. Place the clothing from the second image (the dress) onto the person in the first image. Keep the person's face, hair, and pose exactly the same. The final image should look realistic, seamless, and high-quality.`;
            const generateResponse = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ prompt, userImage: vtoUserImage, dressImage })
            });

            if (!generateResponse.ok) throw new Error('Image generation failed.');

            const result = await generateResponse.json();
            const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (!base64Data) throw new Error("No image data received from API.");
            
            const imageUrl = `data:image/png;base64,${base64Data}`;
            displayVTOResult(imageUrl);
        };
    } catch (error) {
        console.error("VTO Error:", error);
        displayVTOError(error.message);
    }
}

function displayVTOResult(imageUrl) {
    DOMElements.vtoLoader.classList.add('hidden');
    DOMElements.vtoResultContainer.innerHTML = `<img src="${imageUrl}" alt="Virtual Try-On Result" class="rounded-lg max-w-full mx-auto max-h-[60vh]">`;
    DOMElements.vtoResultContainer.classList.remove('hidden');
    DOMElements.vtoStartOverBtn.classList.remove('hidden');
}

function displayVTOError(message) {
     DOMElements.vtoLoader.classList.add('hidden');
    DOMElements.vtoResultContainer.innerHTML = `<p class="text-red-500">${message}</p>`;
    DOMElements.vtoResultContainer.classList.remove('hidden');
    DOMElements.vtoStartOverBtn.classList.remove('hidden');
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
                if(DOMElements.freeCreditsAmount) {
                    DOMElements.freeCreditsAmount.textContent = data.credits;
                }
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
    if(DOMElements.generationCounter) DOMElements.generationCounter.textContent = text;
    if(DOMElements.mobileGenerationCounter) DOMElements.mobileGenerationCounter.textContent = text;
}

function resetToGeneratorView() {
    DOMElements.generatorUI.classList.remove('hidden');
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
        .then(() => {
            toggleModal(DOMElements.authModal, false)
        })
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
            if(deductResponse.status === 402) {
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
        
        let base64Data;
        if (uploadedImageData) {
            base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        } else {
            base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        }

        if (!base64Data) {
            throw new Error("No image data received from API.");
        }

        const imageUrl = `data:image/png;base64,${base64Data}`;
        displayImage(imageUrl, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        updateUIForAuthState(auth.currentUser); 
    } finally {
        stopLoadingUI();
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
        DOMElements.generatorUI.classList.add('hidden');
    }
    startTimer();
}

function stopLoadingUI() {
    isGenerating = false;
    stopTimer();
    DOMElements.loadingIndicator.classList.add('hidden');
    DOMElements.regeneratePromptInput.value = lastPrompt;
    DOMElements.postGenerationControls.classList.remove('hidden');
    addNavigationButtons();
}

function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
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
            const blob = dataURLtoBlob(imageUrl);
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'genart-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
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

async function handleEnhancePrompt() {
    showMessage("Prompt enhancement is coming soon!", "info");
}

function copyPrompt() {
    const promptText = DOMElements.promptInput.value;
    if (!promptText) {
        showMessage("There's nothing to copy.", "info");
        return;
    }
    navigator.clipboard.writeText(promptText).then(() => {
        showMessage("Prompt copied!", "info");
    }).catch(() => {
        showMessage("Failed to copy prompt.", "error");
    });
}

function toggleMusic() {
    const isPlaying = DOMElements.musicBtn.classList.toggle('playing');
    if (isPlaying) {
        DOMElements.lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
    } else {
        DOMElements.lofiMusic.pause();
    }
}

function startTimer() {
    let startTime = Date.now();
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
    const maxTime = 17 * 1000;
    if (progressBar) progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        if (progressBar) progressBar.style.width = `${progress * 100}%`;
        if (timerEl) timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
        if (elapsedTime >= maxTime) {
            if (timerEl) timerEl.textContent = `17.0s / ~17s`;
        }
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '100%';
}

function handlePromoTryNow() {
    const promptText = "Transform me into a 1920s vintage glamour portrait, black-and-white, soft shadows, art deco background, ultra-realistic cinematic lighting.";
    DOMElements.promptInput.value = promptText;
    
    DOMElements.promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    DOMElements.promptInput.focus();
}

function initializeCursor() {
    if (!DOMElements.cursorDot) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        DOMElements.cursorDot.style.left = `${mouseX}px`;
        DOMElements.cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline?.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline?.classList.remove('cursor-hover'));
    });
}
