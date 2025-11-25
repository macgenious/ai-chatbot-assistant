document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    const state = {
        apiKey: sessionStorage.getItem(window.STORAGE_KEYS.API_KEY),
        isGenerating: false
    };

    // --- DOM Elements ---
    const elements = {
        modalOverlay: document.getElementById('api-key-modal'),
        apiKeyInput: document.getElementById('api-key-input'),
        saveKeyBtn: document.getElementById('save-api-key-btn'),
        apiKeyError: document.getElementById('api-key-error'),
        resetKeyBtn: document.getElementById('reset-key-btn'),
        chatForm: document.getElementById('chat-form'),
        userInput: document.getElementById('user-input'),
        sendBtn: document.getElementById('send-btn'),
        chatHistory: document.getElementById('chat-history'),
        infoSection: document.getElementById('info-section')
    };

    // --- Initialization ---
    init();

    function init() {
        checkApiKey();
        setupEventListeners();
        setupScrollObserver();
    }

    // --- API Key Management ---
    function checkApiKey() {
        if (!state.apiKey) {
            showModal();
        } else {
            hideModal();
        }
    }

    function saveApiKey() {
        const key = elements.apiKeyInput.value.trim();
        if (key.length > 10) {
            state.apiKey = key;
            sessionStorage.setItem(window.STORAGE_KEYS.API_KEY, key);
            hideModal();
            elements.apiKeyError.classList.add('hidden');
        } else {
            elements.apiKeyError.classList.remove('hidden');
        }
    }

    function resetApiKey() {
        sessionStorage.removeItem(window.STORAGE_KEYS.API_KEY);
        state.apiKey = null;
        elements.apiKeyInput.value = '';
        showModal();
    }

    function showModal() {
        elements.modalOverlay.classList.add('active');
        elements.userInput.disabled = true;
    }

    function hideModal() {
        elements.modalOverlay.classList.remove('active');
        elements.userInput.disabled = false;
        elements.userInput.focus();
    }

    // --- Chat Logic ---
    async function handleChatSubmit(e) {
        e.preventDefault();
        const userMessage = elements.userInput.value.trim();
        
        if (!userMessage || state.isGenerating) return;

        // Add User Message
        appendMessage('user', userMessage);
        elements.userInput.value = '';
        adjustTextareaHeight(elements.userInput);
        toggleSendButton();

        // Start Generation
        state.isGenerating = true;
        
        // Create placeholder for AI response
        const aiMessageId = `ai-${Date.now()}`;
        const aiContentDiv = appendMessage('ai', '', aiMessageId);
        
        // Show loading state
        const loadingIndicator = createLoadingIndicator();
        aiContentDiv.appendChild(loadingIndicator);

        try {
            await window.streamGeminiResponse(
                userMessage, 
                state.apiKey, 
                aiContentDiv, 
                loadingIndicator,
                () => {
                    // On first chunk
                    if (loadingIndicator) loadingIndicator.remove();
                }
            );
            scrollToBottom(); // Ensure we scroll to bottom after stream finishes or updates
        } catch (error) {
            console.error('Chat Error:', error);
            aiContentDiv.innerHTML = `<p class="error-message">Error: ${error.message || 'Something went wrong. Please check your API key.'}</p>`;
            if (error.message.includes('401') || error.message.includes('INVALID_ARGUMENT')) {
                resetApiKey();
            }
        } finally {
            state.isGenerating = false;
            scrollToBottom();
        }
    }

    function appendMessage(role, text, id = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content glass-panel';
        if (id) contentDiv.id = id;
        
        if (text) {
            contentDiv.innerHTML = marked.parse(text);
        }

        messageDiv.appendChild(contentDiv);
        elements.chatHistory.appendChild(messageDiv);
        scrollToBottom();
        
        return contentDiv;
    }

    function createLoadingIndicator() {
        const div = document.createElement('div');
        div.className = 'typing-indicator';
        div.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        return div;
    }

    function scrollToBottom() {
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
    }

    // --- UI Helpers ---
    function toggleSendButton() {
        const hasText = elements.userInput.value.trim().length > 0;
        elements.sendBtn.disabled = !hasText || state.isGenerating;
    }

    function adjustTextareaHeight(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }

    function setupEventListeners() {
        elements.saveKeyBtn.addEventListener('click', saveApiKey);
        
        elements.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveApiKey();
        });

        elements.resetKeyBtn.addEventListener('click', resetApiKey);

        elements.chatForm.addEventListener('submit', handleChatSubmit);

        elements.userInput.addEventListener('input', () => {
            adjustTextareaHeight(elements.userInput);
            toggleSendButton();
        });

        elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // --- Scroll Animation ---
    function setupScrollObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1
        });

        observer.observe(elements.infoSection);
    }
});
