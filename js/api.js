/**
 * Streams the response from the Gemini API.
 * @param {string} prompt - The user's message.
 * @param {string} apiKey - The user's API key.
 * @param {HTMLElement} container - The DOM element to append text to.
 * @param {HTMLElement} loadingIndicator - The loading indicator element to remove on first chunk.
 * @param {Function} onFirstChunk - Callback when the first chunk is received.
 */
window.streamGeminiResponse = async function(prompt, apiKey, container, loadingIndicator, onFirstChunk) {
    const API_CONFIG = window.API_CONFIG;
    const url = `${API_CONFIG.BASE_URL}/models/${API_CONFIG.MODEL}:${API_CONFIG.METHOD}?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponseText = '';
    let isFirstChunk = true;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process buffer to find complete JSON objects
        if (buffer.startsWith('[')) buffer = buffer.substring(1);
        if (buffer.endsWith(']')) buffer = buffer.substring(0, buffer.length - 1);

        let bracketCount = 0;
        let start = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') bracketCount++;
            if (buffer[i] === '}') bracketCount--;

            if (bracketCount === 0 && i > start) {
                const jsonStr = buffer.substring(start, i + 1).trim();
                if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.candidates && data.candidates[0].content) {
                            const textChunk = data.candidates[0].content.parts[0].text;
                            fullResponseText += textChunk;
                            
                            if (isFirstChunk) {
                                if (onFirstChunk) onFirstChunk();
                                isFirstChunk = false;
                            }
                            // Using marked from global scope (loaded via CDN)
                            container.innerHTML = marked.parse(fullResponseText);
                            
                            // Scroll to bottom if needed (passed via callback or handled externally? 
                            // For simplicity, we'll dispatch a custom event or let the observer handle it, 
                            // but here we just update the DOM. The main script handles scrolling.)
                        }
                    } catch (e) {
                        // Ignore incomplete chunks
                    }
                }
                
                start = i + 1;
                while (start < buffer.length && (buffer[start] === ',' || buffer[start] === '\n' || buffer[start] === ' ')) {
                    start++;
                }
                i = start - 1; 
            }
        }
        buffer = buffer.substring(start);
    }
}
