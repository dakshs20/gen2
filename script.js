import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

// --- DOM Elements ---
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messageForm = document.getElementById('message-form');
const chatContainer = document.getElementById('chat-container');
const newChatBtn = document.getElementById('new-chat-btn');
const fileUpload = document.getElementById('file-upload');
const uploadedFilesContainer = document.getElementById('uploaded-files-container');
const statusIndicator = document.getElementById('status-indicator');
const revealBtn = document.getElementById('reveal-btn');
const revealContainer = document.getElementById('reveal-container');

// Auth elements
const authContainer = document.getElementById('auth-container');
const authModal = document.getElementById('auth-modal');
const googleSigninBtn = document.getElementById('google-signin-btn');
const emailSigninForm = document.getElementById('email-signin-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const emailSigninBtn = document.getElementById('email-signin-btn');
const emailSignupBtn = document.getElementById('email-signup-btn');
const authError = document.getElementById('auth-error');


// Actions Dropdown & Items
const actionsToggleBtn = document.getElementById('actions-toggle-btn');
const actionsDropdown = document.getElementById('actions-dropdown');
const brainstormBtn = document.getElementById('brainstorm-btn');
const codeGeneratorBtn = document.getElementById('code-generator-btn');
const webSearchToggle = document.getElementById('web-search-toggle');
const webSearchStatus = document.getElementById('web-search-status');

// Modals
const brainstormModal = document.getElementById('brainstorm-modal');
const brainstormForm = document.getElementById('brainstorm-form');
const brainstormInput = document.getElementById('brainstorm-input');
const codeGeneratorModal = document.getElementById('code-generator-modal');
const codeGeneratorForm = document.getElementById('code-generator-form');
const codeDescriptionInput = document.getElementById('code-description-input');

// --- State ---
let isWebSearchEnabled = false;
let uploadedFiles = [];
let isGenerating = false;
let animationTimeout;
let currentAnimationTarget = null;
let currentAudio = null;
let currentSpeakBtn = null;
let currentUser = null;
let pendingPrompt = null;


// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateUIForAuthState(user);
});

function updateUIForAuthState(user) {
    authContainer.innerHTML = ''; // Clear previous state
    if (user) {
        const userDisplay = document.createElement('div');
        userDisplay.className = 'flex items-center gap-2';
        userDisplay.innerHTML = `
            <span class="text-sm font-medium text-text-primary">${user.displayName || user.email}</span>
            <button id="logout-btn" class="text-xs bg-bg-tertiary hover:bg-slate-200 text-text-secondary font-semibold py-1 px-3 rounded-full">Log Out</button>
        `;
        authContainer.appendChild(userDisplay);
        authContainer.querySelector('#logout-btn').addEventListener('click', () => signOut(auth));
        
        messageInput.disabled = false;
        actionsToggleBtn.disabled = false;
        messageInput.placeholder = "Ask Verse anything...";
        sendBtn.disabled = messageInput.value.trim() === '';
        
        authModal.classList.add('hidden');

        if (pendingPrompt) {
            messageInput.value = pendingPrompt;
            sendBtn.disabled = false;
            messageForm.dispatchEvent(new Event('submit'));
            pendingPrompt = null;
        }

    } else {
        const signinBtn = document.createElement('button');
        signinBtn.id = 'signin-btn';
        signinBtn.className = 'text-sm bg-accent-primary hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-lg';
        signinBtn.textContent = 'Sign In';
        authContainer.appendChild(signinBtn);
        signinBtn.addEventListener('click', () => {
            authModal.classList.remove('hidden');
        });

        messageInput.disabled = false;
        actionsToggleBtn.disabled = false;
        messageInput.placeholder = "Type a message to sign in...";
        sendBtn.disabled = messageInput.value.trim() === '';
    }
}

googleSigninBtn.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider).catch(error => {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    });
});

emailSigninForm.addEventListener('submit', (e) => e.preventDefault());

emailSigninBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    signInWithEmailAndPassword(auth, email, password).catch(error => {
         authError.textContent = error.message;
         authError.classList.remove('hidden');
    });
});

 emailSignupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    createUserWithEmailAndPassword(auth, email, password).catch(error => {
         authError.textContent = error.message;
         authError.classList.remove('hidden');
    });
});


// --- Event Listeners ---

actionsToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!actionsDropdown.contains(e.target) && e.target !== actionsToggleBtn) {
        actionsDropdown.classList.add('hidden');
    }
});

webSearchToggle.addEventListener('click', () => {
    isWebSearchEnabled = !isWebSearchEnabled;
    actionsToggleBtn.classList.toggle('text-accent-primary', isWebSearchEnabled);
    actionsToggleBtn.classList.toggle('glow', isWebSearchEnabled);
    webSearchStatus.textContent = isWebSearchEnabled ? 'On' : 'Off';
    webSearchStatus.classList.toggle('text-green-600', isWebSearchEnabled);
    webSearchStatus.classList.toggle('bg-green-100', isWebSearchEnabled);
    webSearchStatus.classList.toggle('text-gray-400', !isWebSearchEnabled);
    webSearchStatus.classList.toggle('bg-gray-200', !isWebSearchEnabled);
});

messageInput.addEventListener('input', () => {
    sendBtn.disabled = messageInput.value.trim() === '';
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
});

newChatBtn.addEventListener('click', () => {
    chatContainer.innerHTML = `
        <div class="flex items-start gap-4 max-w-2xl">
             <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm">V</div>
            <div class="bg-bg-tertiary p-4 rounded-xl rounded-tl-none">
                <strong class="font-semibold text-text-primary">Verse</strong>
                <p class="text-text-primary leading-relaxed">Hello! It's great to connect. I'm Verse, and I'm here to help. What's on your mind? You can ask a question, we can look at a file, or we can build a website together.</p>
            </div>
        </div>`;
    uploadedFiles = [];
    uploadedFilesContainer.innerHTML = '';
    messageInput.value = '';
    sendBtn.disabled = true;
});

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = messageInput.value.trim();
    
    if (!currentUser) {
        pendingPrompt = prompt;
        authModal.classList.remove('hidden');
        return;
    }

    if (!prompt || isGenerating) return;
    
    const useWebSearch = isWebSearchEnabled;

    addUserMessage(prompt);
    addThinkingIndicator();

    messageInput.value = '';
    sendBtn.disabled = true;
    messageInput.style.height = 'auto';

    if (isWebSearchEnabled) {
        isWebSearchEnabled = false;
        actionsToggleBtn.classList.remove('text-accent-primary', 'glow');
        webSearchStatus.textContent = 'Off';
        webSearchStatus.classList.remove('text-green-600', 'bg-green-100');
        webSearchStatus.classList.add('text-gray-400', 'bg-gray-200');
    }

    setGeneratingState(true);

    if (useWebSearch) addWebSearchIndicator();

    try {
        const response = await callGeminiAPI(prompt, { useWebSearch });
        removeThinkingIndicator();
        if (useWebSearch) removeWebSearchIndicator();
        addAiResponse(response);
    } catch (error) {
        console.error("API Call failed:", error);
        removeThinkingIndicator();
        if (useWebSearch) removeWebSearchIndicator();
        addAiResponse(`<p class="text-red-500">Sorry, I ran into a little trouble there. Could you try that again? If the problem continues, checking the console might give us a clue.</p>`);
    } finally {
        setGeneratingState(false);
    }
});

fileUpload.addEventListener('change', (e) => {
    for (const file of e.target.files) {
        if (uploadedFiles.some(f => f.name === file.name)) continue;
        uploadedFiles.push({ name: file.name, type: file.type });
        const fileTag = document.createElement('div');
        fileTag.className = 'bg-bg-tertiary px-2 py-1 rounded-full flex items-center gap-2 text-xs border border-border-color';
        fileTag.innerHTML = `<span>${file.name}</span><button class="text-text-secondary hover:text-text-primary" data-filename="${file.name}">&times;</button>`;
        uploadedFilesContainer.appendChild(fileTag);
        fileTag.querySelector('button').addEventListener('click', (ev) => {
            const filename = ev.currentTarget.dataset.filename;
            uploadedFiles = uploadedFiles.filter(f => f.name !== filename);
            fileTag.remove();
        });
    }
     showFeedback(`Got it. I'll keep ${e.target.files.length} file(s) in mind.`);
     actionsDropdown.classList.add('hidden');
});

// Modal Logic
const setupModal = (button, modal) => {
    button.addEventListener('click', () => {
        modal.style.display = 'flex';
        actionsDropdown.classList.add('hidden');
    });
    const cancelBtn = modal.querySelector('button[type="button"]');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
};

setupModal(brainstormBtn, brainstormModal);
setupModal(codeGeneratorBtn, codeGeneratorModal);

brainstormForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = brainstormInput.value.trim();
    if (topic) {
        const fullPrompt = `Let's brainstorm some creative ideas about: "${topic}"`;
        messageInput.value = fullPrompt;
        sendBtn.disabled = false;
        messageForm.dispatchEvent(new Event('submit', { cancelable: true }));
        brainstormInput.value = '';
        brainstormModal.style.display = 'none';
    }
});

codeGeneratorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = codeDescriptionInput.value.trim();
    if (!description) return;
    
    addUserMessage(`Request: Create a website about "${description.substring(0, 50)}..."`);
    addThinkingIndicator();
    
    codeDescriptionInput.value = '';
    codeGeneratorModal.style.display = 'none';
    setGeneratingState(true);

    try {
        const code = await callGeminiAPI(description, { isCodeGeneration: true });
        removeThinkingIndicator();
        addAiCodeResponse(code);
    } catch(error) {
        console.error("Code Generation API Call failed:", error);
        removeThinkingIndicator();
        addAiResponse(`<p class="text-red-500">I hit a snag trying to build that for you. Could we try describing it a different way?</p>`);
    } finally {
        setGeneratingState(false);
    }
});

revealBtn.addEventListener('click', () => {
    if (animationTimeout && currentAnimationTarget) {
        finalizeResponse(currentAnimationTarget);
    }
});

// --- UI Helper Functions ---

function setGeneratingState(isGen) {
    isGenerating = isGen;
    statusIndicator.innerHTML = isGen 
        ? `<div class="flex items-center gap-2 text-sm text-yellow-500"><svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Verse is typing...</div>`
        : `<div class="flex items-center gap-2 text-sm text-green-500"><span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span></span>Verse is Online</div>`;
}

function addUserMessage(prompt) {
    const messageEl = document.createElement('div');
    messageEl.className = 'flex items-start gap-4 justify-end';
    messageEl.innerHTML = `
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 max-w-2xl p-4 rounded-xl rounded-br-none text-white">
            <p>${prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
         <div class="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold border border-border-color text-slate-500">Y</div>
    `;
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addAiResponse(htmlResponse) {
    const messageEl = document.createElement('div');
    messageEl.className = 'flex items-start gap-4 max-w-2xl';
    messageEl.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm">V</div>
        <div class="bg-bg-tertiary p-4 rounded-xl rounded-tl-none prose prose-slate prose-sm max-w-none">
            <strong class="font-semibold text-text-primary not-prose">Verse</strong>
            <div class="ai-response-content text-text-primary leading-relaxed not-prose"></div>
        </div>`;
    chatContainer.appendChild(messageEl);
    const responseContentEl = messageEl.querySelector('.ai-response-content');
    animateText(responseContentEl, htmlResponse);
}

function addAiCodeResponse(code) {
    const messageEl = document.createElement('div');
    messageEl.className = 'flex items-start gap-4 max-w-3xl';
    const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    messageEl.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm">V</div>
        <div class="bg-bg-tertiary p-4 rounded-xl rounded-tl-none w-full">
            <strong class="font-semibold text-text-primary">Verse</strong>
            <p class="text-text-primary leading-relaxed mb-3">I've finished building that for you. Here is the complete code, presented in a file that you can easily copy.</p>
            
            <div class="mt-4 border border-border-color rounded-lg bg-white shadow-sm overflow-hidden">
                <div class="flex justify-between items-center px-4 py-2 border-b border-border-color bg-bg-secondary">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        <span class="text-sm font-medium text-text-secondary">index.html</span>
                    </div>
                    <button class="copy-code-btn bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold py-1 px-2 rounded transition-colors">Copy Code</button>
                </div>
                <div class="max-h-96 overflow-y-auto">
                    <pre class="p-4 text-sm"><code>${escapedCode}</code></pre>
                </div>
            </div>
            <div class="response-actions-container mt-3 pt-3 border-t border-border-color"></div>
        </div>`;

    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    messageEl.querySelector('.copy-code-btn').addEventListener('click', (e) => {
        const button = e.currentTarget;
        navigator.clipboard.writeText(code).then(() => {
            button.textContent = 'Copied!';
            button.classList.add('bg-green-100', 'text-green-800');
            button.classList.remove('bg-slate-200', 'text-slate-700');
            setTimeout(() => { 
                button.textContent = 'Copy Code'; 
                button.classList.remove('bg-green-100', 'text-green-800');
                button.classList.add('bg-slate-200', 'text-slate-700');
            }, 2000);
        });
    });
    
    const actionsContainer = messageEl.querySelector('.response-actions-container');
    addSpeakButtonAndPrefetch(actionsContainer);
}


function addThinkingIndicator() {
    const indicatorEl = document.createElement('div');
    indicatorEl.id = 'thinking-indicator';
    indicatorEl.className = 'flex items-start gap-4 max-w-2xl';
    indicatorEl.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm">V</div>
        <div class="bg-bg-tertiary p-4 rounded-xl rounded-tl-none">
            <div class="flex items-center justify-center gap-1.5 h-5">
                <span class="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span class="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span class="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></span>
            </div>
        </div>
    `;
    chatContainer.appendChild(indicatorEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeThinkingIndicator() {
    document.getElementById('thinking-indicator')?.remove();
}

function addWebSearchIndicator() {
    const indicatorEl = document.createElement('div');
    indicatorEl.id = 'web-search-indicator';
    indicatorEl.className = 'flex items-center justify-center gap-2 text-sm text-accent-primary my-4';
    indicatorEl.innerHTML = `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Searching the web for you...</span>`;
    chatContainer.appendChild(indicatorEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeWebSearchIndicator() {
    document.getElementById('web-search-indicator')?.remove();
}

function finalizeResponse(element) {
    if (!element) return;
    if (animationTimeout) clearTimeout(animationTimeout);
    animationTimeout = null;
    
    element.innerHTML = element.getAttribute('data-full-response');
    element.removeAttribute('data-full-response');
    
    if (currentAnimationTarget === element) currentAnimationTarget = null;
    revealContainer.style.display = 'none';

    const responseContainer = element.closest('.bg-bg-tertiary');
    if (responseContainer) {
        let actionsContainer = responseContainer.querySelector('.response-actions-container');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'response-actions-container mt-3 pt-3 border-t border-border-color';
            responseContainer.appendChild(actionsContainer);
        }
        actionsContainer.innerHTML = '';
        addSpeakButtonAndPrefetch(actionsContainer);
    }
}

function animateText(element, html) {
    element.setAttribute('data-full-response', html);
    currentAnimationTarget = element;
    revealContainer.style.display = 'block';

    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < html.length) {
            element.innerHTML += html.charAt(i);
            const char = html.charAt(i);
            i++;
            const pause = /[.,?!]/.test(char) ? 150 : 25;
            animationTimeout = setTimeout(type, pause);
        } else {
            finalizeResponse(element);
        }
    }
    type();
}

function showFeedback(message) {
    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'text-center text-xs text-text-secondary my-2 transition-opacity duration-300 opacity-0';
    feedbackEl.textContent = message;
    chatContainer.appendChild(feedbackEl);
    setTimeout(() => feedbackEl.classList.remove('opacity-0'), 10);
    setTimeout(() => {
        feedbackEl.classList.add('opacity-0');
        setTimeout(() => feedbackEl.remove(), 300);
    }, 3000);
}

// --- TTS Functions ---
async function addSpeakButtonAndPrefetch(container) {
    if (!container) return;
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn flex items-center gap-1.5 text-sm text-text-secondary cursor-not-allowed opacity-50';
    speakBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg> Preparing audio...`;
    speakBtn.disabled = true;
    container.appendChild(speakBtn);

    const responseContainer = container.closest('.bg-bg-tertiary');
    const textToSpeak = (responseContainer.querySelector('.ai-response-content') || responseContainer).textContent.replace(/^Verse/, '').trim();

    if (!textToSpeak) {
        speakBtn.remove();
        return;
    }

    try {
        const audioUrl = await callTextToSpeechAPI(textToSpeak);
        speakBtn.dataset.audioUrl = audioUrl;
        speakBtn.disabled = false;
        speakBtn.className = 'speak-btn flex items-center gap-1.5 text-sm text-accent-primary hover:text-accent-hover transition-colors';
        speakBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg> Speak`;
        speakBtn.addEventListener('click', handleSpeakButtonClick);
    } catch (error) {
        console.error("TTS pre-fetch Error:", error);
        speakBtn.innerHTML = `<span>Audio unavailable</span>`;
    }
}

function handleSpeakButtonClick(e) {
    const button = e.currentTarget;
    const audioUrl = button.dataset.audioUrl;
    if (!audioUrl) return;

    if (button.dataset.playing === 'true') {
        if (currentAudio) {
            currentAudio.pause();
        }
        resetSpeakButton(button);
        return;
    }
    if (currentSpeakBtn) {
        resetSpeakButton(currentSpeakBtn);
    }
    if (currentAudio) {
        currentAudio.pause();
    }

    currentSpeakBtn = button;
    currentAudio = new Audio(audioUrl);
    setSpeakButtonState(button, 'playing');
    currentAudio.play();
    currentAudio.onended = () => resetSpeakButton(button);
    currentAudio.onerror = () => resetSpeakButton(button);
}

function setSpeakButtonState(button, state) {
    if (state === 'playing') {
        button.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z"></path></svg> Stop`;
        button.dataset.playing = 'true';
    }
}

function resetSpeakButton(button) {
    if (!button) return;
    button.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg> Speak`;
    delete button.dataset.playing;
    if (button === currentSpeakBtn) {
        currentSpeakBtn = null;
        currentAudio = null;
    }
}


async function callTextToSpeechAPI(text) {
    const apiKey = "AIzaSyAVSoLRiPffQrDM9-2JfgouSuGCwwNsv_w";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: `Speak in a friendly, clear, and natural human voice: ${text.substring(0, 4000)}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
        model: "gemini-2.5-flash-preview-tts"
    };
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("TTS API request failed");
    const result = await response.json();
    const part = result?.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType;
    if (!audioData || !mimeType?.startsWith("audio/")) throw new Error("Invalid audio data in TTS response");
    const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
    const pcmData = base64ToArrayBuffer(audioData);
    const pcm16 = new Int16Array(pcmData);
    const wavBlob = pcmToWav(pcm16, sampleRate);
    return URL.createObjectURL(wavBlob);
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcmData, sampleRate) {
    const numChannels = 1, bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(44 + i * 2, pcmData[i], true);
    }
    return new Blob([view], { type: 'audio/wav' });
}

// --- API & Formatting ---
function parseWebSearchResponse(text) {
    const data = { tldr: "", keyPoints: [], details: [] };
    const tldrMatch = text.match(/(?:### TL;DR|### Summary|TL;DR:|Summary:)\s*([\s\S]*?)(?=\n###|\n\*\*|$)/i);
    if (tldrMatch?.[1].trim()) data.tldr = tldrMatch[1].trim();
    const keyPointsMatch = text.match(/(?:### Key Points|Key Points:)\s*([\s\S]*?)(?=\n###|$)/i);
    if (keyPointsMatch?.[1].trim()) data.keyPoints = keyPointsMatch[1].trim().split(/\n\s*[\-\*]\s*/).filter(p => p.trim());
    const detailsMatch = text.match(/(?:### Detailed Explanation|### Details|Details:)\s*([\s\S]*)/i);
    if (detailsMatch?.[1].trim()) data.details.push({ title: "Detailed Explanation", content: detailsMatch[1].trim().replace(/\n/g, '<br>') });
    if (!data.tldr && !data.keyPoints.length && !data.details.length) data.tldr = text;
    return data;
}

function formatVerseResponse(data) {
    let html = '';
    if (data.tldr) html += `<p>${data.tldr}</p>`;
    if (data.keyPoints?.length > 0) html += `<h4 class="font-semibold text-text-primary mt-4 mb-2">Key Points</h4><ul class="list-disc list-inside space-y-1">${data.keyPoints.map(p => `<li>${p}</li>`).join('')}</ul>`;
    if (data.details?.length > 0) html += `<h4 class="font-semibold text-text-primary mt-4 mb-2">Detailed Explanation</h4><div class="space-y-2">${data.details.map(d => `<p><strong>${d.title}:</strong> ${d.content}</p>`).join('')}</div>`;
    if (data.code) html += `<h4 class="font-semibold text-text-primary mt-4 mb-2">Example Code</h4><pre><code class="!bg-bg-primary">${data.code.replace(/</g, "&lt;")}</code></pre>`;
    
    if (data.sources?.length > 0) {
        html += `<div class="mt-4 pt-3 border-t border-border-color">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-9 9a9 9 0 019-9"></path></svg>
                        <h4 class="text-sm font-semibold text-text-secondary">Sources from the Web</h4>
                    </div>
                    <ul class="list-disc list-inside text-sm space-y-1 pl-2">${data.sources.map(s => `<li><a href="${s.uri}" target="_blank" class="text-accent-primary hover:underline">${s.title}</a></li>`).join('')}</ul>
                </div>`;
    }
    
    const hasReferences = data.references;
    const hasConfidence = typeof data.confidence === 'number';
    const hasNextSteps = data.nextSteps;
    if (hasReferences || hasConfidence || hasNextSteps) {
         html += `<div class="mt-4 pt-3 border-t border-border-color text-sm text-text-secondary flex flex-col gap-1">`;
        if (hasReferences) html += `<span><strong>References:</strong> ${data.references}</span>`;
        if (hasConfidence) {
            const confidenceScore = data.confidence <= 1 ? data.confidence * 100 : data.confidence;
            html += `<span><strong>Confidence:</strong> ${Math.round(confidenceScore)}%</span>`;
        }
        if (hasNextSteps) html += `<span><strong>Next Steps:</strong> ${data.nextSteps}</span>`;
        html += `</div>`;
    }
    return html || `<p>It looks like I couldn't find a clear answer for that. Could we try rephrasing the question?</p>`;
}

async function callGeminiAPI(prompt, options = {}) {
    const { useWebSearch = false, isCodeGeneration = false } = options;
    const apiKey = "AIzaSyAVSoLRiPffQrDM9-2JfgouSuGCwwNsv_w";
    const lowerCasePrompt = prompt.toLowerCase();
    
    if (lowerCasePrompt.includes('founder of genart')) return formatVerseResponse({ tldr: 'Daksh Suthar is the founder of GenArt.' });
    if (lowerCasePrompt.includes('who created you')) return formatVerseResponse({ tldr: 'I was developed by GenArt ML Technologies.' });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    let payload;
    const baseSystemPrompt = `You are Verse, a thoughtful and conversational AI companion from GenArt ML Technologies. Your goal is to talk like a real human—be natural, warm, and engaging. Avoid robotic phrasing and adapt your tone to the user's needs. Your founder is Daksh Suthar.`;

    if (isCodeGeneration) {
        const systemPrompt = `You are an expert web developer. Create a complete, single-file HTML website based on the user's request. The website must include all necessary HTML, CSS (using Tailwind CSS classes directly in the HTML or within a <style> tag), and JavaScript in one file. The code should be clean, well-commented, and visually appealing. User's request: ${prompt}`;
        payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
    } else if (useWebSearch) {
        const systemPrompt = baseSystemPrompt + ` Answer the user's question based on a web search. Format your response clearly using Markdown-style headings: '### TL;DR', '### Key Points' (as a bulleted list), and '### Detailed Explanation'. The user's prompt is: ${prompt}`;
        payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, tools: [{ "google_search": {} }] };
    } else {
        let systemPrompt = baseSystemPrompt + ` You MUST reply in structured JSON format per the schema. `;
        if (uploadedFiles.length > 0) systemPrompt += `Ground your answer in these files: [${uploadedFiles.map(f => f.name).join(', ')}]. If the answer isn't in the files, state that clearly. `;
        systemPrompt += `The user's question is: ${prompt}`;
        payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: { type: "OBJECT", properties: { "tldr": { "type": "STRING" }, "keyPoints": { "type": "ARRAY", "items": { "type": "STRING" } }, "details": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "title": { "type": "STRING" }, "content": { "type": "STRING" } } } }, "code": { "type": "STRING", "nullable": true }, "references": { "type": "STRING" }, "confidence": { "type": "NUMBER" }, "nextSteps": { "type": "STRING" } } }
            }
        };
    }

    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response:", errorBody);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];

    if (!candidate?.content?.parts?.[0]?.text) {
         if(candidate?.finishReason === "SAFETY") return formatVerseResponse({tldr: "I can't answer that. It seems to be outside of my safety guidelines."});
        throw new Error("Invalid response structure from API.");
    }
    
    const rawText = candidate.content.parts[0].text;
    
    if(isCodeGeneration) {
        return rawText; // Return raw code string
    }

    let responseData;
    if (useWebSearch) {
        responseData = parseWebSearchResponse(rawText);
        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata?.groundingAttributions) {
            responseData.sources = groundingMetadata.groundingAttributions
                .map(attr => ({ title: attr.web?.title || "Untitled Source", uri: attr.web?.uri || "#" }))
                .filter(source => source.uri !== "#");
        }
    } else {
        responseData = JSON.parse(rawText);
    }
    
    return formatVerseResponse(responseData);
}

 
