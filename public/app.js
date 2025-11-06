// Generate a unique session ID
const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const extractBtn = document.getElementById('extract-btn');
const outputContainer = document.getElementById('output-container');
const markdownOutput = document.getElementById('markdown-output');
const mermaidOutput = document.getElementById('mermaid-output');

let isProcessing = false;

// Add a message to the chat
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'Analyst';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show loading indicator
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = 'loading-indicator';
    loadingDiv.textContent = 'Thinking...';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove loading indicator
function removeLoading() {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();
}

// Send a message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;
    
    isProcessing = true;
    sendBtn.disabled = true;
    extractBtn.disabled = true;
    
    addMessage('user', message);
    messageInput.value = '';
    
    showLoading();
    
    try {
        const response = await fetch('/analyst/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message })
        });
        
        const data = await response.json();
        removeLoading();
        addMessage('assistant', data.reply);
    } catch (error) {
        removeLoading();
        addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        console.error('Error:', error);
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    extractBtn.disabled = false;
    messageInput.focus();
}

// Extract requirements
async function extractRequirements() {
    if (isProcessing) return;
    
    isProcessing = true;
    sendBtn.disabled = true;
    extractBtn.disabled = true;
    
    showLoading();
    
    try {
        const response = await fetch('/analyst/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        
        const data = await response.json();
        removeLoading();
        
        markdownOutput.value = data.markdown;
        mermaidOutput.value = data.mermaid;
        outputContainer.classList.add('visible');
        
        addMessage('assistant', 'Requirements extracted! You can now download the documents below.');
    } catch (error) {
        removeLoading();
        addMessage('assistant', 'Sorry, I could not extract requirements. Please continue the conversation.');
        console.error('Error:', error);
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    extractBtn.disabled = false;
}

// Download markdown file
function downloadMarkdown() {
    const content = markdownOutput.value;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requirements.md';
    a.click();
    URL.revokeObjectURL(url);
}

// Download mermaid file
function downloadMermaid() {
    const content = mermaidOutput.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.mmd';
    a.click();
    URL.revokeObjectURL(url);
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);
extractBtn.addEventListener('click', extractRequirements);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Welcome message
addMessage('assistant', 'Hello! I\'m your VSol Systems Analyst. Tell me about your business, and I\'ll help you identify your requirements.');

