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

// --- Google Drive API ---
const GOOGLE_API_CLIENT_ID = 'YOUR_GOOGLE_API_CLIENT_ID.apps.googleusercontent.com'; // IMPORTANT: Replace with your actual client ID
const DRIVE_API_KEY = 'YOUR_DRIVE_API_KEY'; // IMPORTANT: Replace with your actual API key
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// --- Global State ---
let currentUserCredits = 0;
let uploadedImageData = null;
let isGenerating = false;
let timerInterval;
let gapiInited = false;
let gisInited = false;
let tokenClient;
let isDriveConnected = false;
let genArtFolderId = null;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    Object.assign(DOMElements, {
        authBtn: document.getElementById('auth-btn'),
        authModal: document.getElementById('auth-modal'),
        googleSignInBtn: document.getElementById('google-signin-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        outOfCreditsModal: document.getElementById('out-of-credits-modal'),
        closeCreditsModalBtn: document.getElementById('close-credits-modal-btn'),
        generationCounter: document.getElementById('generation-counter'),
        cursorDot: document.querySelector('.cursor-dot'),
        cursorOutline: document.querySelector('.cursor-outline'),
        promptInput: document.getElementById('prompt-input'),
        generateBtn: document.getElementById('generate-btn'),
        imageUploadBtn: document.getElementById('image-upload-btn'),
        imageUploadInput: document.getElementById('image-upload-input'),
        removeImageBtn: document.getElementById('remove-image-btn'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        aspectRatioBtns: document.querySelectorAll('.aspect-ratio-btn'),
        loadingIndicator: document.getElementById('loading-indicator'),
        imageGrid: document.getElementById('image-grid'),
        messageBox: document.getElementById('message-box'),
        variationsToggle: document.getElementById('variations-toggle'),
        driveConnectBtn: document.getElementById('drive-connect-btn'),
        driveStatusText: document.getElementById('drive-status-text'),
        driveMessage: document.getElementById('drive-message'),
        initialView: document.getElementById('initial-view'),
    });

    initializeEventListeners();
    initializeCursor();
    
    // Load Google API scripts
    gapi.load('client', initializeGapiClient);
});

// --- Initialization ---

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    
    DOMElements.authBtn?.addEventListener('click', handleAuthAction);
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.closeCreditsModalBtn?.addEventListener('click', () => toggleModal(DOMElements.outOfCreditsModal, false));
    
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    DOMElements.promptInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); DOMElements.generateBtn.click(); }
    });

    DOMElements.aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOMElements.aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);
    DOMElements.driveConnectBtn?.addEventListener('click', handleDriveAuthClick);
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
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Credit fetch failed');
            const data = await response.json();
            currentUserCredits = data.credits;
            updateCreditDisplay();
        } catch (error) {
            console.error("Credit fetch error:", error);
            showMessage("Could not fetch credit balance.", "error");
        }
    } else {
        currentUserCredits = 0;
        DOMElements.authBtn.textContent = 'Sign In';
        updateCreditDisplay();
    }
}

function updateCreditDisplay() {
    const text = auth.currentUser ? `Credits: ${currentUserCredits}` : 'Sign in to generate';
    DOMElements.generationCounter.textContent = text;
}


// --- Core Generation Logic ---

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
        const wantsVariations = DOMElements.variationsToggle.checked;
        const sampleCount = wantsVariations ? 4 : 1;
        const creditCost = sampleCount; // Assuming 1 credit per image

        if (currentUserCredits < creditCost) {
            toggleModal(DOMElements.outOfCreditsModal, true);
            stopLoadingUI();
            return;
        }
        
        // Deduct credits first
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` } // Simplified for now, backend should handle amount
        });

        if (!deductResponse.ok) throw new Error('Failed to deduct credit.');
        
        const deductData = await deductResponse.json();
        currentUserCredits = deductData.newCredits; // Should be updated based on actual deduction
        updateCreditDisplay();

        const selectedRatioBtn = document.querySelector('.aspect-ratio-btn.selected');
        const aspectRatio = selectedRatioBtn ? selectedRatioBtn.dataset.ratio : '1:1';
        
        // Generate image(s)
        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio, sampleCount })
        });

        if (!generateResponse.ok) {
            const errorResult = await generateResponse.json();
            throw new Error(errorResult.error || `API Error: ${generateResponse.status}`);
        }

        const result = await generateResponse.json();
        const predictions = result.predictions || [];

        if (predictions.length === 0) {
            throw new Error("No image data received from API.");
        }

        displayImages(predictions, prompt);

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
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.messageBox.innerHTML = '';
    DOMElements.imageGrid.classList.add('hidden');
    DOMElements.initialView.classList.add('hidden');
    DOMElements.loadingIndicator.classList.remove('hidden');
    DOMElements.generateBtn.disabled = true;
    DOMElements.generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    startTimer();
}

function stopLoadingUI() {
    isGenerating = false;
    DOMElements.loadingIndicator.classList.add('hidden');
    DOMElements.generateBtn.disabled = false;
    DOMElements.generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    stopTimer();
}

function displayImages(predictions, prompt) {
    DOMElements.imageGrid.innerHTML = ''; // Clear previous results
    predictions.forEach(prediction => {
        const base64Data = prediction.bytesBase64Encoded;
        if (base64Data) {
            const imageUrl = `data:image/png;base64,${base64Data}`;
            const imgContainer = document.createElement('div');
            imgContainer.className = 'result-image-container fade-in-slide-up';
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = prompt;
            img.className = 'w-full h-full object-cover';

            const overlay = document.createElement('div');
            overlay.className = 'image-overlay';
            
            const saveButton = document.createElement('button');
            saveButton.innerHTML = `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v5a2 2 0 01-2 2z"></path></svg> Save to Drive`;
            saveButton.className = 'text-white font-semibold text-sm flex items-center bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            saveButton.disabled = !isDriveConnected;
            saveButton.onclick = () => {
                saveButton.textContent = 'Saving...';
                saveButton.disabled = true;
                saveToDrive(imageUrl, prompt, (success) => {
                    saveButton.textContent = success ? 'Saved!' : 'Save to Drive';
                    if (!success) saveButton.disabled = false;
                });
            };
            
            overlay.appendChild(saveButton);
            imgContainer.append(img, overlay);
            DOMElements.imageGrid.appendChild(imgContainer);
        }
    });
    DOMElements.imageGrid.classList.remove('hidden');
}


// --- Google Drive Integration ---

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: DRIVE_API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
}

function handleDriveAuthClick() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_API_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            isDriveConnected = true;
            updateDriveButtonUI(true, 'Connected to Google Drive');
            await findOrCreateGenArtFolder();
        },
    });

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function updateDriveButtonUI(connected, message) {
    if (connected) {
        DOMElements.driveStatusText.textContent = 'Drive Connected';
        DOMElements.driveConnectBtn.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
    } else {
        DOMElements.driveStatusText.textContent = 'Connect Google Drive';
        DOMElements.driveConnectBtn.classList.remove('bg-green-100', 'text-green-800', 'border-green-300');
    }
    DOMElements.driveMessage.textContent = message;
}

async function findOrCreateGenArtFolder() {
    try {
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name='GenArt Creations' and trashed=false",
            fields: 'files(id, name)',
        });
        if (response.result.files.length > 0) {
            genArtFolderId = response.result.files[0].id;
        } else {
            const folderMetadata = {
                name: 'GenArt Creations',
                mimeType: 'application/vnd.google-apps.folder',
            };
            const folder = await gapi.client.drive.files.create({ resource: folderMetadata, fields: 'id' });
            genArtFolderId = folder.result.id;
        }
    } catch (error) {
        console.error("Error finding/creating Drive folder:", error);
        showMessage("Could not access or create 'GenArt Creations' folder in Drive.", "error");
    }
}

function saveToDrive(dataUrl, prompt, callback) {
    if (!genArtFolderId) {
        showMessage("GenArt folder not found in Drive. Please reconnect.", "error");
        callback(false);
        return;
    }
    const blob = dataURLtoBlob(dataUrl);
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const fileName = `genart-${prompt.substring(0, 20).replace(/\s/g, '_')}-${Date.now()}.png`;
    const metadata = { name: fileName, mimeType: 'image/png', parents: [genArtFolderId] };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-t\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + blob.type + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        dataUrl.split(',')[1] +
        close_delim;

    const request = gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
        body: multipartRequestBody,
    });

    request.execute(file => {
        if (file && file.id) {
            callback(true);
        } else {
            console.error("Drive upload failed:", file);
            showMessage("Failed to save image to Drive.", "error");
            callback(false);
        }
    });
}


// --- Utility Functions ---

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
        .catch(error => showMessage('Failed to sign in. Please try again.', 'error'));
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.promptInput.placeholder = "Describe the edits to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.imagePreview.src = '';
    DOMElements.promptInput.placeholder = "A hyperrealistic 4k photo of a grizzly bear programmer...";
}

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-3 rounded-lg text-sm ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`;
    messageEl.textContent = text;
    DOMElements.messageBox.innerHTML = '';
    DOMElements.messageBox.appendChild(messageEl);
}

function startTimer() {
    let startTime = Date.now();
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
    const maxTime = DOMElements.variationsToggle.checked ? 35000 : 17000; 
    if (progressBar) progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        if (progressBar) progressBar.style.width = `${progress * 100}%`;
        if (timerEl) timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~${maxTime/1000}s`;
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '100%';
}

function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], {type:mime});
}

function initializeCursor() {
    if (!DOMElements.cursorDot) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
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
    document.querySelectorAll('a, button, textarea, input, label, .slider').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline?.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline?.classList.remove('cursor-hover'));
    });
}
