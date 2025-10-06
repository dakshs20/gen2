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

// --- IMPORTANT: Google Drive API Configuration ---
// REPLACE WITH YOUR ACTUAL GOOGLE CLOUD CREDENTIALS
const DRIVE_API_KEY = 'YOUR_API_KEY_HERE'; 
const DRIVE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// --- Global State ---
let currentUser, gapi, google;
let currentUserCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let currentStyle = 'Realistic';
let uploadedImageData = null;
let currentPreviewInputData = null; 
let timerInterval;
let isDriveConnected = false;
let driveSavePreference = 'manual'; // 'manual' or 'auto'
let gapiTokenClient;
let lastGeneratedImageUrl = null; // To store the URL for manual saving
let lastGeneratedImagePrompt = null;


// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'prompt-input', 'generate-btn', 'ratio-btn', 'ratio-options', 'auth-modal', 
        'google-signin-btn', 'out-of-credits-modal', 'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn', 'image-upload-btn', 'image-upload-input', 
        'image-preview-container', 'image-preview', 'remove-image-btn', 'prompt-bar-container', 'mobile-menu', 
        'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon', 'button-timer', 'button-content', 'style-selector', 
        'mobile-style-toggle-btn', 'mobile-style-options', 'drive-btn-container', 'drive-connect-modal', 
        'connect-drive-btn', 'drive-options', 'drive-status-message', 'save-to-drive-btn'
    ];
    ids.forEach(id => { if (id) DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id); });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.modalBackdrops = document.querySelectorAll('.modal-backdrop');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');
    DOMElements.styleBtns = document.querySelectorAll('.style-btn');
    DOMElements.savePreferenceRadios = document.querySelectorAll('input[name="save-preference"]');

    initializeEventListeners();
    initializeGapiClient();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

function initializeEventListeners() {
    // Standard event listeners...
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.modalBackdrops.forEach(backdrop => backdrop.addEventListener('click', e => { if (e.target === backdrop) closeAllModals(); }));
    DOMElements.generateBtn?.addEventListener('click', () => handleImageGenerationRequest());
    DOMElements.promptInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleImageGenerationRequest(); } });
    DOMElements.ratioBtn?.addEventListener('click', e => { e.stopPropagation(); if (!DOMElements.ratioBtn.disabled) DOMElements.ratioOptions?.classList.toggle('hidden'); });
    DOMElements.mobileStyleToggleBtn?.addEventListener('click', e => { e.stopPropagation(); DOMElements.mobileStyleOptions?.classList.toggle('hidden'); });
    document.addEventListener('click', () => { DOMElements.ratioOptions?.classList.add('hidden'); DOMElements.mobileStyleOptions?.classList.add('hidden'); });
    DOMElements.styleBtns.forEach(btn => btn.addEventListener('click', () => { currentStyle = btn.dataset.style; DOMElements.styleBtns.forEach(b => b.classList.toggle('selected', b.dataset.style === currentStyle)); DOMElements.mobileStyleOptions?.classList.add('hidden'); }));
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);

    // --- NEW: Google Drive Event Listeners ---
    // Note: The click listener for the drive button itself is added dynamically in updateUIForAuthState
    DOMElements.connectDriveBtn?.addEventListener('click', handleDriveAuthClick);
    DOMElements.savePreferenceRadios.forEach(radio => radio.addEventListener('change', setSavePreference));
    DOMElements.saveToDriveBtn?.addEventListener('click', handleManualSaveToDrive);
}

// --- Google Drive Integration ---

function initializeGapiClient() {
    gapi.load('client', async () => {
        await gapi.client.init({
            apiKey: DRIVE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: driveAuthCallback,
        });
    });
}

function handleDriveAuthClick() {
    if (gapiTokenClient) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        gapiTokenClient.requestAccessToken();
    } else {
        console.error("Google Drive client not initialized.");
        DOMElements.driveStatusMessage.textContent = "Error: Client not ready. Please refresh.";
    }
}

async function driveAuthCallback(tokenResponse) {
    if (tokenResponse && tokenResponse.access_token) {
        gapi.client.setToken(tokenResponse);
        isDriveConnected = true;
        localStorage.setItem('drive_connected', 'true');
        DOMElements.driveStatusMessage.textContent = "Successfully connected to Google Drive!";
        DOMElements.driveStatusMessage.className = 'mt-4 text-sm text-green-600';
        updateDriveButtonUI(true);
        // Enable preference options
        DOMElements.driveOptions.classList.remove('opacity-50', 'pointer-events-none');
        setTimeout(() => {
            closeAllModals();
        }, 1500);
    } else {
        console.error("Google Drive authentication failed.", tokenResponse);
        DOMElements.driveStatusMessage.textContent = "Authentication failed. Please try again.";
        DOMElements.driveStatusMessage.className = 'mt-4 text-sm text-red-600';
    }
}

function updateDriveButtonUI(isConnected) {
    const container = DOMElements.driveBtnContainer;
    if (!container) return;

    if (isConnected) {
        container.innerHTML = `<div class="flex items-center space-x-2 text-sm font-medium text-green-600 rounded-full px-3 py-1"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg><span>Drive Connected</span></div>`;
    } else {
        container.innerHTML = `<button id="drive-btn" class="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors"><svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M7.71,3.5,1.71,13.8,4.2,18.3,10.2,7.9Zm8.58,0L10.2,13.8,12.7,18.3,18.7,7.9ZM4.7,19.3,7.2,23.8,12.7,14.8,10.2,10.4Zm14.6,0-2.5,4.5-5.5-9L14.8,10.4Z"/></svg><span>Connect Drive</span></button>`;
        // Re-attach listener since we replaced the innerHTML
        document.getElementById('drive-btn')?.addEventListener('click', () => toggleModal(DOMElements.driveConnectModal, true));
    }
}

function setSavePreference(event) {
    driveSavePreference = event.target.value;
    localStorage.setItem('drive_save_preference', driveSavePreference);
}

// --- Core App Logic ---

function updateUIForAuthState(user) {
    currentUser = user;
    if (user) {
        // Existing auth UI update logic...
        DOMElements.headerNav.innerHTML = `
            <div id="drive-btn-container" class="border-r pr-2 mr-2 border-gray-200"></div>
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);

        // Handle Drive UI
        DOMElements.driveBtnContainer = document.getElementById('drive-btn-container'); // Re-cache after innerHTML change
        DOMElements.driveBtnContainer.classList.remove('hidden');
        if (localStorage.getItem('drive_connected') === 'true') {
            isDriveConnected = true;
            // You might want to re-validate token here in a real app, but for now, trust localStorage
            gapi.client.setToken(JSON.parse(localStorage.getItem('gapi_token')));
            updateDriveButtonUI(true);
        } else {
            updateDriveButtonUI(false);
        }
        driveSavePreference = localStorage.getItem('drive_save_preference') || 'manual';
        document.querySelector(`input[name="save-preference"][value="${driveSavePreference}"]`).checked = true;

    } else {
        // Reset state on logout
        isDriveConnected = false;
        localStorage.removeItem('drive_connected');
        localStorage.removeItem('drive_save_preference');
        localStorage.removeItem('gapi_token');
        DOMElements.headerNav.innerHTML = `<a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a><button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>`;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', signInWithGoogle);
    }
}

async function handleImageGenerationRequest() {
    // ... (existing checks for auth, credits, prompt)
    if (isGenerating) return;
    if (!currentUser) { toggleModal(DOMElements.authModal, true); return; }
    if (currentUserCredits <= 0) { toggleModal(DOMElements.outOfCreditsModal, true); return; }
    const userPrompt = DOMElements.promptInput.value?.trim();
    if (!userPrompt && !uploadedImageData) { /* shake animation */ return; }

    const finalPrompt = currentStyle ? `${userPrompt}, ${currentStyle} style` : userPrompt;
    setLoadingState(true);

    try {
        // ... (existing generation logic)
        const token = await currentUser.getIdToken();
        await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const response = await fetch('/api/generate', { /* ... existing fetch options ... */ body: JSON.stringify({ prompt: finalPrompt, /*...*/ }) });
        const result = await response.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data");
        
        const imageUrl = `data:image/png;base64,${base64Data}`;
        lastGeneratedImageUrl = imageUrl; // Store for manual save
        lastGeneratedImagePrompt = userPrompt; // Store prompt for filename

        showPreviewModal(imageUrl, userPrompt, null);

        // Auto-save to Drive if enabled
        if (isDriveConnected && driveSavePreference === 'auto') {
            uploadImageToDrive(imageUrl, userPrompt);
        }

    } catch (error) {
        console.error("Generation Error:", error);
    } finally {
        setLoadingState(false);
    }
}

function showPreviewModal(imageUrl, prompt, inputImageData) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    // Show/hide manual save button based on Drive connection
    DOMElements.saveToDriveBtn.classList.toggle('hidden', !isDriveConnected);
    toggleModal(DOMElements.previewModal, true);
}

async function handleManualSaveToDrive() {
    if (lastGeneratedImageUrl) {
        this.disabled = true;
        this.innerHTML = `<svg class="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

        await uploadImageToDrive(lastGeneratedImageUrl, lastGeneratedImagePrompt);

        this.disabled = false;
        this.innerHTML = `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="#4285F4"><path d="M7.71,3.5,1.71,13.8,4.2,18.3,10.2,7.9Zm8.58,0L10.2,13.8,12.7,18.3,18.7,7.9ZM4.7,19.3,7.2,23.8,12.7,14.8,10.2,10.4Zm14.6,0-2.5,4.5-5.5-9L14.8,10.4Z"/></svg>`;
    }
}


// --- Utility Functions ---

function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const contentType = parts[0].match(/:(.*?);/)[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
}

async function findOrCreateFolder() {
    // 1. Search for the folder
    const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name='GenArt' and trashed=false",
        fields: 'files(id)',
    });
    if (response.result.files.length > 0) {
        return response.result.files[0].id; // Folder exists
    }

    // 2. Create the folder if it doesn't exist
    const folderMetadata = {
        name: 'GenArt',
        mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id',
    });
    return folder.result.id;
}

async function uploadImageToDrive(imageUrl, prompt) {
    if (!isDriveConnected) {
        console.log("Drive not connected. Aborting upload.");
        return;
    }
    try {
        const folderId = await findOrCreateFolder();
        const blob = dataUrlToBlob(imageUrl);
        const fileName = prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '.png';

        const metadata = {
            name: fileName,
            parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
            body: form,
        });
        console.log(`Successfully uploaded "${fileName}" to Google Drive.`);
        // You could add a small success toast/notification here
    } catch (error) {
        console.error("Error uploading to Google Drive:", error);
        // You could add an error toast/notification here
    }
}

// ... (all other existing functions like signInWithGoogle, handleRegeneration, downloadPreviewImage, etc., remain)

// Dummy functions to avoid breaking the code, assuming they exist from previous context
async function fetchUserCredits(user) { /* ... */ }
function setLoadingState(isLoading) { isGenerating = isLoading; /* ... */ }
function closeAllModals() { document.querySelectorAll('[role="dialog"]').forEach(m => m.style.display = 'none'); }
function toggleModal(modal, show) { if (modal) modal.style.display = show ? 'flex' : 'none'; }
async function signInWithGoogle() { /* ... */ }
async function handleRegeneration() { /* ... */ }
function downloadPreviewImage() { /* ... */ }

