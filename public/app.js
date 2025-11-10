// State
let currentUser = null;
let currentProject = null;
let isProcessing = false;
let isInitialLoad = true;
let recognition = null;
let isRecording = false;
let cachedRequirements = null; // Store extracted requirements to avoid re-extraction
let tipsInterval = null; // Track tips rotation intervals
let progressAnimationInterval = null; // Track progress bar animation
let currentProgress = 0; // Current progress for smooth animation
let targetProgress = 0; // Target progress from backend

// Educational tips to rotate during loading
const educationalTips = [
    "Requirements documents help ensure everyone understands the project scope",
    "Workflow diagrams make it easier to visualize how your system will operate",
    "User stories break down features into manageable development tasks",
    "Upload Excel spreadsheets to generate seed data for quick project setup",
    "Well-defined requirements reduce development time and costs",
    "Clear documentation helps teams stay aligned throughout the project",
    "Visual workflows help identify bottlenecks before development begins"
];

// DOM Elements
const loginPage = document.getElementById('login-page');
const projectsPage = document.getElementById('projects-page');
const adminPage = document.getElementById('admin-page');
const chatPage = document.getElementById('chat-page');
const userHeader = document.getElementById('user-header');
const userName = document.getElementById('user-name');
const adminBadge = document.getElementById('admin-badge');
const adminViewBtn = document.getElementById('admin-view-btn');
const projectsList = document.getElementById('projects-list');
const projectTitle = document.getElementById('project-title');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const polishBtn = document.getElementById('polish-btn');
const extractBtn = document.getElementById('extract-btn');
const voiceBtn = document.getElementById('voice-btn');
const markdownOutput = document.getElementById('markdown-output');
const mermaidOutput = document.getElementById('mermaid-output');
const newProjectModal = document.getElementById('new-project-modal');
const newProjectNameInput = document.getElementById('new-project-name');
const adminContent = document.getElementById('admin-content');

function configureAvatarElement(avatarEl, size = 36) {
    if (!avatarEl) return;
    avatarEl.width = size;
    avatarEl.height = size;
    avatarEl.loading = 'eager';
    avatarEl.decoding = 'async';
    avatarEl.setAttribute('fetchpriority', 'high');
    avatarEl.style.width = `${size}px`;
    avatarEl.style.height = `${size}px`;
    avatarEl.style.minWidth = `${size}px`;
    avatarEl.style.minHeight = `${size}px`;
    avatarEl.style.maxWidth = `${size}px`;
    avatarEl.style.maxHeight = `${size}px`;
    avatarEl.style.display = 'block';
    avatarEl.style.objectFit = 'contain';
}

// Initialize app
async function init() {
    // Check voice support on page load
    checkVoiceSupport();
    
    try {
        const response = await fetch('/auth/me');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            // Handle initial URL routing
            const hash = window.location.hash;
            if (hash.startsWith('#/project/')) {
                const projectId = hash.replace('#/project/', '');
                await loadProjectFromUrl(projectId);
            } else if (hash === '#/admin' && currentUser.isAdmin) {
                showAdminDashboard();
            } else {
                showProjects();
            }
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showLogin();
    }
    isInitialLoad = false;
}

// Load project from URL
async function loadProjectFromUrl(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
            const data = await response.json();
            await showChat(data.project);
        } else {
            showProjects();
        }
    } catch (error) {
        console.error('Error loading project from URL:', error);
        showProjects();
    }
}

// Show/hide pages
function showLogin() {
    loginPage.classList.remove('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.remove('visible');
    userHeader.style.display = 'none';
}

function showProjects() {
    loginPage.classList.add('hidden');
    projectsPage.classList.add('visible');
    adminPage.style.display = 'none';
    chatPage.classList.remove('visible');
    userHeader.style.display = 'flex';
    userName.textContent = currentUser.name;
    
    // Show admin badge and button if user is admin
    if (currentUser.isAdmin) {
        adminBadge.style.display = 'inline';
        adminViewBtn.style.display = 'inline-block';
    } else {
        adminBadge.style.display = 'none';
        adminViewBtn.style.display = 'none';
    }
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', '#/projects');
    }
    
    loadProjects();
}

async function showChat(project) {
    currentProject = project;
    projectTitle.textContent = project.name;
    chatContainer.innerHTML = '';
    cachedRequirements = null; // Clear cached requirements when switching projects
    
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.add('visible');
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', `#/project/${project.id}`);
    }
    
    // Load existing chat history
    await loadChatHistory(project.id);
}

// Authentication
function loginWithGoogle() {
    window.location.href = '/auth/google';
}

async function logout() {
    try {
        await fetch('/auth/logout');
        currentUser = null;
        currentProject = null;
        showLogin();
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Failed to logout');
    }
}

// Projects
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        
        const data = await response.json();
        displayProjects(data.projects);
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsList.innerHTML = '<div class="empty-state">Failed to load projects</div>';
    }
}

function displayProjects(projects) {
    if (projects.length === 0) {
        projectsList.innerHTML = '<div class="empty-state">No projects yet. Create your first project to get started!</div>';
        return;
    }
    
    projectsList.innerHTML = '';
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.onclick = async () => await showChat(project);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'project-name';
        nameDiv.textContent = project.name;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'project-date';
        const date = new Date(project.updatedAt);
        dateDiv.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        projectItem.appendChild(nameDiv);
        projectItem.appendChild(dateDiv);
        projectsList.appendChild(projectItem);
    });
}

function showNewProjectModal() {
    newProjectNameInput.value = '';
    newProjectModal.classList.add('visible');
    newProjectNameInput.focus();
}

function hideNewProjectModal() {
    newProjectModal.classList.remove('visible');
}

async function createProject() {
    const name = newProjectNameInput.value.trim();
    if (!name) {
        alert('Please enter a project name');
        return;
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) throw new Error('Failed to create project');
        
        const data = await response.json();
        hideNewProjectModal();
        await showChat(data.project);
    } catch (error) {
        console.error('Error creating project:', error);
        alert('Failed to create project');
    }
}

function backToProjects() {
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    // Re-enable input if it was disabled for admin view
    messageInput.disabled = false;
    sendBtn.disabled = false;
    polishBtn.disabled = false;
    extractBtn.disabled = false;
    voiceBtn.disabled = false;
    messageInput.placeholder = 'Tell me about your business...';
    
    // Check if we were in admin view
    if (currentProject && currentProject.isAdminView) {
        currentProject = null;
        showAdminDashboard();
    } else {
        currentProject = null;
        showProjects();
    }
}

// Chat
async function loadChatHistory(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        
        const data = await response.json();
        const project = data.project;
        
        // Display chat history if it exists
        if (project.sessions && project.sessions.length > 0) {
            const history = JSON.parse(project.sessions[0].history);
            let hasMessages = false;
            
            history.forEach(msg => {
                if (msg.role !== 'system') {
                    renderChatMessage(msg.role, msg.content);
                    hasMessages = true;
                }
            });
            
            // If no messages were shown, show welcome message
            if (!hasMessages) {
                const firstName = currentUser.name.split(' ')[0];
                addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly systems analyst for "${project.name}". Tell me about your business, and I'll help you identify your requirements.`);
            }
        } else {
            // No chat history, show welcome message
            const firstName = currentUser.name.split(' ')[0];
            addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly systems analyst for "${project.name}". Tell me about your business, and I'll help you identify your requirements.`);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        // Show welcome message as fallback
        const firstName = currentUser.name.split(' ')[0];
        addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly systems analyst for "${currentProject.name}". Tell me about your business, and I'll help you identify your requirements.`);
    }
}

function renderChatMessage(role, content) {
    // Handle multimodal content (array with text and images)
    if (Array.isArray(content)) {
        let textContent = '';
        let imageAttachments = [];
        
        content.forEach(part => {
            if (part.type === 'text') {
                textContent += part.text;
            } else if (part.type === 'image_url') {
                // Extract attachment ID from attachment:// URL
                const url = part.image_url.url;
                if (url.startsWith('attachment://')) {
                    const attachmentId = url.replace('attachment://', '');
                    imageAttachments.push(attachmentId);
                }
            }
        });
        
        // Add text message if present
        if (textContent.trim()) {
            addMessage(role, textContent);
        }
        
        // Add image messages
        imageAttachments.forEach(attachmentId => {
            addHistoricalImageMessage(role, attachmentId);
        });
    } else {
        // Simple text content
        addMessage(role, content);
    }
}

function addHistoricalImageMessage(role, attachmentId) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    // Add avatar
    if (role === 'assistant') {
        const avatar = document.createElement('img');
        avatar.src = '/assets/sunny-face.png';
        avatar.alt = 'Sunny';
        avatar.className = 'message-avatar';
        configureAvatarElement(avatar);
        headerDiv.appendChild(avatar);
    } else if (role === 'user' && currentUser && currentUser.picture && !currentProject?.isAdminView) {
        const avatar = document.createElement('img');
        avatar.src = currentUser.picture;
        avatar.alt = currentUser.name;
        avatar.className = 'message-avatar';
        configureAvatarElement(avatar);
        headerDiv.appendChild(avatar);
    }
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'Sunny';
    
    headerDiv.appendChild(label);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Add image preview
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'message-attachment';
    
    const img = document.createElement('img');
    img.src = `/api/attachments/${attachmentId}`;
    img.alt = 'Uploaded image';
    img.className = 'message-image';
    img.onclick = () => window.open(`/api/attachments/${attachmentId}`, '_blank');
    
    attachmentDiv.appendChild(img);
    contentDiv.appendChild(attachmentDiv);
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    // Add avatar for both user and assistant messages
    if (role === 'assistant') {
        const avatar = document.createElement('img');
        avatar.src = '/assets/sunny-face.png';
        avatar.alt = 'Sunny';
        avatar.className = 'message-avatar';
        configureAvatarElement(avatar);
        headerDiv.appendChild(avatar);
    } else if (role === 'user' && currentUser && currentUser.picture && !currentProject?.isAdminView) {
        // Only show user avatar if not in admin view
        const avatar = document.createElement('img');
        avatar.src = currentUser.picture;
        avatar.alt = currentUser.name;
        avatar.className = 'message-avatar';
        configureAvatarElement(avatar);
        headerDiv.appendChild(avatar);
    }
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'Sunny';
    
    headerDiv.appendChild(label);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addImageMessage(attachmentId, filename) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    // Add user avatar
    if (currentUser && currentUser.picture && !currentProject?.isAdminView) {
        const avatar = document.createElement('img');
        avatar.src = currentUser.picture;
        avatar.alt = currentUser.name;
        avatar.className = 'message-avatar';
        configureAvatarElement(avatar);
        headerDiv.appendChild(avatar);
    }
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'You';
    
    headerDiv.appendChild(label);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = filename;
    
    // Add image preview
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'message-attachment';
    
    const img = document.createElement('img');
    img.src = `/api/attachments/${attachmentId}`;
    img.alt = filename;
    img.className = 'message-image';
    img.onclick = () => window.open(`/api/attachments/${attachmentId}`, '_blank');
    
    attachmentDiv.appendChild(img);
    contentDiv.appendChild(attachmentDiv);
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = 'loading-indicator';
    loadingDiv.textContent = 'Thinking...';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeLoading() {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing || !currentProject) return;
    
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    isProcessing = true;
    sendBtn.disabled = true;
    extractBtn.disabled = true;
    voiceBtn.disabled = true;
    
    addMessage('user', message);
    messageInput.value = '';
    
    showLoading();
    
    try {
        const response = await fetch('/analyst/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectId: currentProject.id, 
                message 
            })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Please login again.');
                showLogin();
                return;
            }
            throw new Error('Chat failed');
        }
        
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
    voiceBtn.disabled = false;
    messageInput.focus();
}

function showConfirmExtractModal() {
    const modal = document.getElementById('confirm-extract-modal');
    modal.classList.add('visible');
}

function hideConfirmExtractModal() {
    const modal = document.getElementById('confirm-extract-modal');
    modal.classList.remove('visible');
}

function confirmExtract() {
    hideConfirmExtractModal();
    performExtraction();
}

function showOutputModal() {
    const modal = document.getElementById('output-modal');
    const loadingDiv = document.getElementById('extraction-loading');
    const resultsDiv = document.getElementById('extraction-results');
    
    // Reset status and tip text to initial values
    const statusElement = document.getElementById('extraction-status');
    const tipElement = document.getElementById('extraction-tip');
    if (statusElement) statusElement.textContent = "Sunny is reviewing your conversation...";
    if (tipElement) tipElement.textContent = educationalTips[0];
    
    // Reset progress bar and state
    resetProgress();
    const progressBar = document.getElementById('extraction-progress-bar');
    const percentageDisplay = document.getElementById('extraction-percentage');
    if (progressBar) progressBar.style.width = '0%';
    if (percentageDisplay) percentageDisplay.textContent = '0%';
    
    // Show loading state
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    modal.classList.add('visible');
}

function showOutputResults() {
    const loadingDiv = document.getElementById('extraction-loading');
    const resultsDiv = document.getElementById('extraction-results');
    
    // Switch to results state
    loadingDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
}

// Helper function to clear all loading intervals
function clearLoadingIntervals() {
    if (tipsInterval) {
        clearInterval(tipsInterval);
        tipsInterval = null;
    }
    if (progressAnimationInterval) {
        clearInterval(progressAnimationInterval);
        progressAnimationInterval = null;
    }
}

// Animate progress bar smoothly to target with 1% increments
function animateProgressTo(barId, percentageId, target) {
    const progressBar = document.getElementById(barId);
    const percentageDisplay = document.getElementById(percentageId);
    
    if (!progressBar || !percentageDisplay) return;
    
    // Jump immediately to the target milestone from backend
    currentProgress = target;
    targetProgress = target;
    progressBar.style.width = currentProgress + '%';
    percentageDisplay.textContent = currentProgress + '%';
    
    // Start slow 1% increments after reaching milestone (shows activity while waiting)
    if (!progressAnimationInterval && currentProgress < 100) {
        progressAnimationInterval = setInterval(() => {
            // Only increment if we haven't hit a hard limit and still below 100
            if (currentProgress < targetProgress + 4 && currentProgress < 100) {
                currentProgress = Math.min(currentProgress + 1, 100);
                progressBar.style.width = currentProgress + '%';
                percentageDisplay.textContent = currentProgress + '%';
            }
            
            // Stop when we reach 100%
            if (currentProgress >= 100) {
                clearInterval(progressAnimationInterval);
                progressAnimationInterval = null;
            }
        }, 1000); // Slow 1% increments every second between milestones
    }
}

// Reset progress state
function resetProgress() {
    currentProgress = 0;
    targetProgress = 0;
    if (progressAnimationInterval) {
        clearInterval(progressAnimationInterval);
        progressAnimationInterval = null;
    }
}

// Start rotating educational tips
function startTipsRotation(tipElementId, customTips = null) {
    const tipElement = document.getElementById(tipElementId);
    if (!tipElement) return;
    
    const tips = customTips || educationalTips;
    let currentTipIndex = 0;
    
    // Rotate tips every 4.5 seconds
    tipsInterval = setInterval(() => {
        currentTipIndex = (currentTipIndex + 1) % tips.length;
        tipElement.textContent = tips[currentTipIndex];
    }, 4500);
}

function hideOutputModal() {
    const modal = document.getElementById('output-modal');
    modal.classList.remove('visible');
    clearLoadingIntervals();
}

async function extractRequirements() {
    if (isProcessing || !currentProject) return;
    showConfirmExtractModal();
}

async function performExtraction() {
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    isProcessing = true;
    sendBtn.disabled = true;
    extractBtn.disabled = true;
    voiceBtn.disabled = true;
    
    // Show modal with loading animation
    showOutputModal();
    
    // Start tips rotation only
    startTipsRotation('extraction-tip');
    
    try {
        // Use admin endpoint if in admin view, otherwise use regular endpoint
        const endpoint = currentProject.isAdminView 
            ? `/api/admin/projects/${currentProject.id}/extract`
            : '/analyst/extract-stream';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: currentProject.isAdminView ? undefined : JSON.stringify({ projectId: currentProject.id })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                clearLoadingIntervals();
                hideOutputModal();
                alert('Session expired. Please login again.');
                showLogin();
                return;
            }
            throw new Error('Extraction failed');
        }
        
        // Process the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        if (data.complete) {
                            // Store final result
                            console.log('✅ Extraction complete, received final data');
                            finalData = data;
                        } else if (data.progress !== undefined) {
                            // Update progress bar and status
                            console.log(`📊 Progress update: ${data.progress}% - ${data.stage}`);
                            const statusElement = document.getElementById('extraction-status');
                            
                            // Animate progress smoothly to target
                            animateProgressTo('extraction-progress-bar', 'extraction-percentage', data.progress);
                            
                            // Update status message (keep previous message if stage is empty)
                            if (statusElement && data.stage) {
                                statusElement.textContent = data.stage;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }
        
        if (!finalData) {
            throw new Error('No final data received');
        }
        
        // Cache the requirements object for user story generation
        cachedRequirements = finalData.requirements;
        
        markdownOutput.value = finalData.markdown;
        mermaidOutput.value = finalData.mermaid;
        
        // Ensure we're at 100% and it's visible for a moment
        const progressBar = document.getElementById('extraction-progress-bar');
        const percentageDisplay = document.getElementById('extraction-percentage');
        if (progressBar && percentageDisplay) {
            progressBar.style.width = '100%';
            percentageDisplay.textContent = '100%';
            currentProgress = 100;
        }
        
        // Wait briefly to ensure 100% is visible (backend already waited 2s)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear intervals before showing results
        clearLoadingIntervals();
        
        // Switch modal to show results
        showOutputResults();
    } catch (error) {
        clearLoadingIntervals();
        hideOutputModal();
        addMessage('assistant', 'Sorry, I could not extract requirements. Please continue the conversation.');
        console.error('Error:', error);
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    extractBtn.disabled = false;
    voiceBtn.disabled = false;
}

function copyMarkdown(event) {
    const content = markdownOutput.value;
    navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

function copyMermaid(event) {
    const content = mermaidOutput.value;
    navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

function downloadMarkdown() {
    const content = markdownOutput.value;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-requirements.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadMermaid() {
    const content = mermaidOutput.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-workflow.mmd`;
    a.click();
    URL.revokeObjectURL(url);
}

// User Stories Generation
async function generateUserStories() {
    if (!currentProject) return;
    
    const generateBtn = document.getElementById('generate-stories-btn');
    const storiesLoading = document.getElementById('stories-loading');
    const storiesOutput = document.getElementById('stories-output');
    const userStoriesTextarea = document.getElementById('user-stories-output');
    
    // Reset status and tip text to initial values
    const statusElement = document.getElementById('stories-status');
    const tipElement = document.getElementById('stories-tip');
    if (statusElement) statusElement.textContent = "Sunny is analyzing your requirements...";
    if (tipElement) tipElement.textContent = educationalTips[2]; // Use user stories tip
    
    // Reset progress bar and state
    resetProgress();
    const progressBar = document.getElementById('stories-progress-bar');
    const percentageDisplay = document.getElementById('stories-percentage');
    if (progressBar) progressBar.style.width = '0%';
    if (percentageDisplay) percentageDisplay.textContent = '0%';
    
    // Hide button and show loading
    generateBtn.style.display = 'none';
    storiesLoading.style.display = 'block';
    storiesOutput.style.display = 'none';
    
    // Start tips rotation only
    startTipsRotation('stories-tip');
    
    try {
        // Use cached requirements if available (faster, no LLM call to re-extract)
        let response;
        if (cachedRequirements) {
            response = await fetch('/analyst/generate-stories-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirements: cachedRequirements })
            });
        } else {
            // Fallback to legacy endpoint that re-extracts requirements
            response = await fetch('/analyst/generate-stories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: currentProject.id })
            });
        }
        
        if (!response.ok) {
            throw new Error('Failed to generate user stories');
        }
        
        // Check if we're using streaming
        if (cachedRequirements) {
            // Process streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalData = null;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            
                            if (data.complete) {
                                // Store final result
                                console.log('✅ Story generation complete, received final data');
                                finalData = data;
                            } else if (data.progress !== undefined) {
                                // Update progress bar and status
                                console.log(`📊 Progress update: ${data.progress}% - ${data.stage}`);
                                
                                // Animate progress smoothly to target
                                animateProgressTo('stories-progress-bar', 'stories-percentage', data.progress);
                                
                                // Update status message (keep previous message if stage is empty)
                                if (statusElement && data.stage) {
                                    statusElement.textContent = data.stage;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
            
            if (!finalData) {
                throw new Error('No final data received');
            }
            
            // Store the markdown for download
            userStoriesTextarea.value = finalData.markdown;
        } else {
            // Non-streaming fallback
            const data = await response.json();
            userStoriesTextarea.value = data.markdown;
        }
        
        // Ensure we're at 100% and it's visible for a moment
        if (progressBar && percentageDisplay) {
            progressBar.style.width = '100%';
            percentageDisplay.textContent = '100%';
            currentProgress = 100;
        }
        
        // Wait briefly to ensure 100% is visible (backend already waited 2s)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear intervals before showing results
        clearLoadingIntervals();
        
        // Hide loading and show output
        storiesLoading.style.display = 'none';
        storiesOutput.style.display = 'block';
        
    } catch (error) {
        console.error('Error generating user stories:', error);
        clearLoadingIntervals();
        alert('Failed to generate user stories. Please try again.');
        
        // Show button again on error
        generateBtn.style.display = 'inline-flex';
        storiesLoading.style.display = 'none';
    }
}

function copyUserStories(event) {
    const userStoriesTextarea = document.getElementById('user-stories-output');
    const content = userStoriesTextarea.value;
    navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    });
}

function downloadUserStories() {
    const userStoriesTextarea = document.getElementById('user-stories-output');
    const content = userStoriesTextarea.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-user-stories.md`;
    a.click();
    URL.revokeObjectURL(url);
}

// Flowchart Generation
async function generateFlowchart() {
    if (!currentProject || !cachedRequirements) return;
    
    const generateBtn = document.getElementById('generate-flowchart-btn');
    const flowchartLoading = document.getElementById('flowchart-loading');
    const flowchartOutput = document.getElementById('flowchart-output');
    const flowchartTextarea = document.getElementById('detailed-flowchart-output');
    
    // Reset status and tip text to initial values
    const statusElement = document.getElementById('flowchart-status');
    const tipElement = document.getElementById('flowchart-tip');
    if (statusElement) statusElement.textContent = "Sunny is analyzing your system architecture...";
    if (tipElement) tipElement.textContent = "Workflow diagrams make it easier to visualize how your system will operate";
    
    // Reset progress bar and state
    resetProgress();
    const progressBar = document.getElementById('flowchart-progress-bar');
    const percentageDisplay = document.getElementById('flowchart-percentage');
    if (progressBar) progressBar.style.width = '0%';
    if (percentageDisplay) percentageDisplay.textContent = '0%';
    
    // Hide button and show loading
    generateBtn.style.display = 'none';
    flowchartLoading.style.display = 'block';
    flowchartOutput.style.display = 'none';
    
    // Start tips rotation with flowchart-specific tips
    const flowchartTips = [
        "Workflow diagrams make it easier to visualize how your system will operate",
        "Complex flowcharts show decision points and data flows",
        "Visual workflows help identify bottlenecks before development begins",
        "Detailed diagrams clarify system interactions and dependencies"
    ];
    startTipsRotation('flowchart-tip', flowchartTips);
    
    try {
        const response = await fetch('/analyst/generate-flowchart-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requirements: cachedRequirements })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate flowchart');
        }
        
        // Process streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        if (data.complete) {
                            // Store final result
                            console.log('✅ Flowchart generation complete, received final data');
                            finalData = data;
                        } else if (data.progress !== undefined) {
                            // Update progress bar and status
                            console.log(`📊 Progress update: ${data.progress}% - ${data.stage}`);
                            
                            // Animate progress smoothly to target
                            animateProgressTo('flowchart-progress-bar', 'flowchart-percentage', data.progress);
                            
                            // Update status message immediately
                            if (statusElement && data.stage) statusElement.textContent = data.stage;
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }
        
        if (!finalData) {
            throw new Error('No final data received');
        }
        
        // Store the markdown for download
        flowchartTextarea.value = finalData.markdown;
        
        // Backend already waited 1 second at 100%, just ensure animation is done
        // Calculate remaining animation time to reach 100%
        const remainingProgress = 100 - currentProgress;
        const animationTime = remainingProgress > 0 ? (remainingProgress / 5) * 400 : 0;
        
        // Wait for animation to complete (backend already showed "Complete" for 1s)
        if (animationTime > 0) {
            await new Promise(resolve => setTimeout(resolve, animationTime + 300));
        }
        
        // Clear intervals before showing results
        clearLoadingIntervals();
        
        // Hide loading and show output
        flowchartLoading.style.display = 'none';
        flowchartOutput.style.display = 'block';
        
    } catch (error) {
        console.error('Error generating flowchart:', error);
        clearLoadingIntervals();
        alert('Failed to generate flowchart. Please try again.');
        
        // Show button again on error
        generateBtn.style.display = 'inline-flex';
        flowchartLoading.style.display = 'none';
    }
}

function copyFlowchart(event) {
    const flowchartTextarea = document.getElementById('detailed-flowchart-output');
    const content = flowchartTextarea.value;
    navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    });
}

function downloadFlowchart() {
    const flowchartTextarea = document.getElementById('detailed-flowchart-output');
    const content = flowchartTextarea.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-detailed-workflow.mmd`;
    a.click();
    URL.revokeObjectURL(url);
}

// Admin Dashboard
async function showAdminDashboard() {
    if (!currentUser.isAdmin) return;
    
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'flex';
    chatPage.classList.remove('visible');
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', '#/admin');
    }
    
    // Load admin stats
    loadAdminStats();
    
    // Load users by default
    switchAdminTab('users');
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const data = await response.json();
        document.getElementById('stat-users').textContent = data.stats.users;
        document.getElementById('stat-projects').textContent = data.stats.projects;
        document.getElementById('stat-sessions').textContent = data.stats.sessions;
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

async function switchAdminTab(tab) {
    // Update tab buttons
    document.getElementById('tab-users').classList.toggle('active', tab === 'users');
    document.getElementById('tab-projects').classList.toggle('active', tab === 'projects');
    
    // Load content
    if (tab === 'users') {
        await loadAdminUsers();
    } else if (tab === 'projects') {
        await loadAdminProjects();
    }
}

async function loadAdminUsers() {
    adminContent.innerHTML = '<div class="empty-state">Loading users...</div>';
    
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const data = await response.json();
        displayAdminUsers(data.users);
    } catch (error) {
        console.error('Error loading users:', error);
        adminContent.innerHTML = '<div class="empty-state">Failed to load users</div>';
    }
}

function displayAdminUsers(users) {
    if (users.length === 0) {
        adminContent.innerHTML = '<div class="empty-state">No users found</div>';
        return;
    }
    
    adminContent.innerHTML = '';
    users.forEach(user => {
        const totalProjects = user.companies.reduce((sum, c) => sum + c.projects.length, 0);
        
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-card-header">
                <div>
                    <div class="user-card-name">${user.name}${user.isAdmin ? ' (Admin)' : ''}</div>
                    <div class="user-card-email">${user.email}</div>
                    <div class="user-card-stats">${totalProjects} project(s) • Joined ${new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
            </div>
        `;
        adminContent.appendChild(userCard);
    });
}

async function loadAdminProjects() {
    adminContent.innerHTML = '<div class="empty-state">Loading projects...</div>';
    
    try {
        const response = await fetch('/api/admin/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        
        const data = await response.json();
        displayAdminProjects(data.projects);
    } catch (error) {
        console.error('Error loading projects:', error);
        adminContent.innerHTML = '<div class="empty-state">Failed to load projects</div>';
    }
}

function displayAdminProjects(projects) {
    if (projects.length === 0) {
        adminContent.innerHTML = '<div class="empty-state">No projects found</div>';
        return;
    }
    
    adminContent.innerHTML = '';
    projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'admin-project-card';
        projectCard.innerHTML = `
            <div class="user-card-header">
                <div>
                    <div class="user-card-name">${project.name}</div>
                    <div class="user-card-email">Client: ${project.company.user.name} (${project.company.user.email})</div>
                    <div class="user-card-stats">${project.sessions.length} session(s) • Last updated ${new Date(project.updatedAt).toLocaleTimeString()} ${new Date(project.updatedAt).toLocaleDateString()}</div>
                </div>
                <button class="view-chat-btn" onclick="viewProjectChat('${project.id}')">View Chat</button>
            </div>
        `;
        adminContent.appendChild(projectCard);
    });
}

async function viewProjectChat(projectId) {
    try {
        const response = await fetch(`/api/admin/projects/${projectId}/chat`);
        if (!response.ok) throw new Error('Failed to fetch project chat');
        
        const data = await response.json();
        const project = data.project;
        
        // Switch to chat view with read-only mode
        currentProject = { id: project.id, name: project.name, isAdminView: true };
        projectTitle.textContent = `${project.name} (${project.company.user.name}) - Read Only`;
        chatContainer.innerHTML = '';
        
        loginPage.classList.add('hidden');
        projectsPage.classList.remove('visible');
        adminPage.style.display = 'none';
        chatPage.classList.add('visible');
        
        // Disable input for admin view (except extract button which admins can use)
        messageInput.disabled = true;
        sendBtn.disabled = true;
        polishBtn.disabled = true;
        extractBtn.disabled = false; // Enable extract for admins
        voiceBtn.disabled = true;
        messageInput.placeholder = 'Admin view - read only';
        
        // Stop recording if active
        if (isRecording) {
            stopRecording();
        }
        
        // Display chat history
        if (project.sessions.length > 0) {
            const history = project.sessions[0].history;
            history.forEach(msg => {
                if (msg.role !== 'system') {
                    renderChatMessage(msg.role, msg.content);
                }
            });
        } else {
            addMessage('assistant', 'No chat history available for this project.');
        }
    } catch (error) {
        console.error('Error viewing project chat:', error);
        alert('Failed to load project chat');
    }
}

// Polish Text Functions
let polishedTextCache = '';

async function polishText() {
    const text = messageInput.value.trim();
    
    if (!text || isProcessing) return;
    
    if (text.length < 5) {
        alert('Please enter some text to polish.');
        return;
    }
    
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    isProcessing = true;
    sendBtn.disabled = true;
    polishBtn.disabled = true;
    extractBtn.disabled = true;
    voiceBtn.disabled = true;
    
    // Show modal with loading animation
    showPolishModal();
    
    try {
        const response = await fetch('/analyst/polish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                hidePolishModal();
                alert('Session expired. Please login again.');
                showLogin();
                return;
            }
            throw new Error('Polish failed');
        }
        
        const data = await response.json();
        
        // Store the polished text
        polishedTextCache = data.polished;
        
        // Display the comparison
        document.getElementById('polish-original-text').textContent = data.original;
        document.getElementById('polish-polished-text').textContent = data.polished;
        
        // Switch modal to show results
        showPolishResults();
    } catch (error) {
        hidePolishModal();
        alert('Failed to polish text. Please try again.');
        console.error('Error:', error);
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    polishBtn.disabled = false;
    extractBtn.disabled = false;
    voiceBtn.disabled = false;
}

function showPolishModal() {
    const modal = document.getElementById('polish-modal');
    const loadingDiv = document.getElementById('polish-loading');
    const resultsDiv = document.getElementById('polish-results');
    
    // Show loading state
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    modal.classList.add('visible');
}

function showPolishResults() {
    const loadingDiv = document.getElementById('polish-loading');
    const resultsDiv = document.getElementById('polish-results');
    
    // Switch to results state
    loadingDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
}

function hidePolishModal() {
    const modal = document.getElementById('polish-modal');
    modal.classList.remove('visible');
    polishedTextCache = '';
}

function acceptPolish() {
    if (polishedTextCache) {
        messageInput.value = polishedTextCache;
        messageInput.focus();
    }
    hidePolishModal();
}

function rejectPolish() {
    hidePolishModal();
    messageInput.focus();
}

// Excel Upload Functions
const uploadExcelBtn = document.getElementById('upload-excel-btn');
const excelFileInput = document.getElementById('excel-file-input');
const uploadImageBtn = document.getElementById('upload-image-btn');
const imageFileInput = document.getElementById('image-file-input');

function uploadExcel() {
    if (isProcessing || !currentProject) return;
    
    // Trigger file input
    excelFileInput.click();
}

function uploadImage() {
    if (isProcessing || !currentProject) return;
    
    // Trigger file input
    imageFileInput.click();
}

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        alert('Please upload an Excel file (.xls or .xlsx)');
        excelFileInput.value = '';
        return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        excelFileInput.value = '';
        return;
    }
    
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    isProcessing = true;
    sendBtn.disabled = true;
    polishBtn.disabled = true;
    extractBtn.disabled = true;
    uploadExcelBtn.disabled = true;
    uploadImageBtn.disabled = true;
    voiceBtn.disabled = true;
    
    // Show uploading message
    addMessage('user', `Uploading Excel: ${file.name}`);
    showLoading();
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', currentProject.id);
        
        const response = await fetch('/analyst/upload-excel', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                removeLoading();
                alert('Session expired. Please login again.');
                showLogin();
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await response.json();
        removeLoading();
        
        // Display the Excel summary
        addMessage('assistant', data.summary);
        
        // Optionally, you can also add a follow-up message
        addMessage('assistant', 'I\'ve analyzed your Excel file. Would you like me to help you understand this data better or incorporate it into your requirements?');
        
    } catch (error) {
        removeLoading();
        addMessage('assistant', `Sorry, I encountered an error uploading the file: ${error.message}`);
        console.error('Error uploading Excel:', error);
    }
    
    // Reset file input
    excelFileInput.value = '';
    
    isProcessing = false;
    sendBtn.disabled = false;
    polishBtn.disabled = false;
    extractBtn.disabled = false;
    uploadExcelBtn.disabled = false;
    uploadImageBtn.disabled = false;
    voiceBtn.disabled = false;
    messageInput.focus();
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, GIF, WebP)');
        imageFileInput.value = '';
        return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        imageFileInput.value = '';
        return;
    }
    
    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }
    
    isProcessing = true;
    sendBtn.disabled = true;
    polishBtn.disabled = true;
    extractBtn.disabled = true;
    uploadExcelBtn.disabled = true;
    uploadImageBtn.disabled = true;
    voiceBtn.disabled = true;
    
    // Show uploading message
    addMessage('user', `Uploading image: ${file.name}`);
    showLoading();
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', currentProject.id);
        
        const response = await fetch('/analyst/upload-image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
        const data = await response.json();
        
        // Remove loading message
        removeLoading();
        
        // Add the uploaded image message with the image preview
        addImageMessage(data.attachmentId, file.name);
        
        // Add assistant's analysis
        addMessage('assistant', data.analysis);
    } catch (error) {
        removeLoading();
        addMessage('assistant', 'Sorry, I had trouble processing that image. Please try again.');
        console.error('Error uploading image:', error);
    }
    
    // Reset file input
    imageFileInput.value = '';
    
    isProcessing = false;
    sendBtn.disabled = false;
    polishBtn.disabled = false;
    extractBtn.disabled = false;
    uploadExcelBtn.disabled = false;
    uploadImageBtn.disabled = false;
    voiceBtn.disabled = false;
    messageInput.focus();
}

// Speech Recognition Functions
function initSpeechRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return null;
    }
    
    try {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;  // Keep listening
        recognitionInstance.interimResults = true;  // Show results in real-time
        recognitionInstance.lang = 'en-US';
        recognitionInstance.maxAlternatives = 1;
        
        recognitionInstance.onstart = () => {
            console.log('Speech recognition started');
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<span class="material-symbols-outlined">stop_circle</span>Stop';
        };
        
        recognitionInstance.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Update textarea with transcribed text
            if (finalTranscript) {
                const currentValue = messageInput.value;
                const needsSpace = currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n');
                messageInput.value = currentValue + (needsSpace ? ' ' : '') + finalTranscript;
                
                // Auto-scroll to bottom of textarea
                messageInput.scrollTop = messageInput.scrollHeight;
            }
        };
        
        recognitionInstance.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            // Handle specific error cases
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
            } else if (event.error === 'no-speech') {
                console.log('No speech detected');
            } else if (event.error === 'network') {
                alert('Network error occurred. Please check your connection.');
            }
            
            stopRecording();
        };
        
        recognitionInstance.onend = () => {
            console.log('Speech recognition ended');
            if (isRecording) {
                // If we were recording and it ended unexpectedly, update UI
                stopRecording();
            }
        };
        
        return recognitionInstance;
    } catch (error) {
        console.error('Error initializing speech recognition:', error);
        return null;
    }
}

function toggleRecording() {
    if (isProcessing || !currentProject) return;
    
    if (!recognition) {
        recognition = initSpeechRecognition();
    }
    
    if (!recognition) {
        alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari for voice input.');
        voiceBtn.classList.add('not-supported');
        voiceBtn.disabled = true;
        return;
    }
    
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!recognition || isProcessing) return;
    
    try {
        recognition.start();
        // UI updates happen in onstart handler
    } catch (error) {
        console.error('Error starting recognition:', error);
        if (error.name === 'InvalidStateError') {
            // Already started, just update UI
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<span class="material-symbols-outlined">stop_circle</span>Stop';
        } else {
            alert('Failed to start voice recognition. Please try again.');
        }
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
        
        isRecording = false;
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<span class="material-symbols-outlined">mic</span>Voice';
        messageInput.focus();
    }
}

// Check browser support on load
function checkVoiceSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        // Hide or disable voice button for unsupported browsers
        voiceBtn.classList.add('not-supported');
        voiceBtn.title = 'Voice input not supported in this browser. Try Chrome, Edge, or Safari.';
        
        // Show a subtle message on click
        voiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Voice input is not supported in Firefox on desktop. Would you like to learn more about browser compatibility?')) {
                window.open('https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API#browser_compatibility', '_blank');
            }
        });
    }
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);
polishBtn.addEventListener('click', polishText);
extractBtn.addEventListener('click', extractRequirements);
uploadExcelBtn.addEventListener('click', uploadExcel);
excelFileInput.addEventListener('change', handleExcelUpload);
uploadImageBtn.addEventListener('click', uploadImage);
imageFileInput.addEventListener('change', handleImageUpload);
voiceBtn.addEventListener('click', toggleRecording);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

newProjectNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        createProject();
    }
});

// Close modals when clicking outside
document.getElementById('confirm-extract-modal').addEventListener('click', (e) => {
    if (e.target.id === 'confirm-extract-modal') {
        hideConfirmExtractModal();
    }
});

document.getElementById('output-modal').addEventListener('click', (e) => {
    if (e.target.id === 'output-modal') {
        hideOutputModal();
    }
});

document.getElementById('polish-modal').addEventListener('click', (e) => {
    if (e.target.id === 'polish-modal') {
        hidePolishModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const confirmModal = document.getElementById('confirm-extract-modal');
        const outputModal = document.getElementById('output-modal');
        const polishModal = document.getElementById('polish-modal');
        if (confirmModal.classList.contains('visible')) {
            hideConfirmExtractModal();
        } else if (outputModal.classList.contains('visible')) {
            hideOutputModal();
        } else if (polishModal.classList.contains('visible')) {
            hidePolishModal();
        }
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    if (!currentUser) return;
    
    const hash = window.location.hash;
    if (hash.startsWith('#/project/')) {
        const projectId = hash.replace('#/project/', '');
        loadProjectFromUrl(projectId);
    } else if (hash === '#/admin' && currentUser.isAdmin) {
        showAdminDashboard();
    } else {
        showProjects();
    }
});

// Seed Data Generation Functions
let spreadsheetAttachments = [];
let selectedSpreadsheetData = null;

async function showSeedDataModal() {
    if (!currentProject) return;
    
    const modal = document.getElementById('seed-data-modal');
    const loadingDiv = document.getElementById('seed-data-loading');
    const contentDiv = document.getElementById('seed-data-content');
    const spreadsheetSelect = document.getElementById('spreadsheet-select');
    const detailsDiv = document.getElementById('spreadsheet-details');
    
    // Show modal with loading state
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    modal.classList.add('visible');
    
    try {
        // Fetch project details to get spreadsheet attachments
        const response = await fetch(`/api/projects/${currentProject.id}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        
        const data = await response.json();
        const project = data.project;
        
        // Collect spreadsheet attachments from all sessions
        spreadsheetAttachments = [];
        if (project.sessions && project.sessions.length > 0) {
            project.sessions.forEach(session => {
                if (session.attachments) {
                    session.attachments.forEach(attachment => {
                        if (attachment.fileType === 'spreadsheet') {
                            spreadsheetAttachments.push(attachment);
                        }
                    });
                }
            });
        }
        
        // Populate the dropdown
        spreadsheetSelect.innerHTML = '<option value="">-- Choose a spreadsheet --</option>';
        spreadsheetAttachments.forEach(attachment => {
            const option = document.createElement('option');
            option.value = attachment.id;
            option.textContent = `${attachment.filename} (${new Date(attachment.createdAt).toLocaleDateString()})`;
            spreadsheetSelect.appendChild(option);
        });
        
        // Reset selection
        detailsDiv.style.display = 'none';
        selectedSpreadsheetData = null;
        
        // Show content
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        
        if (spreadsheetAttachments.length === 0) {
            spreadsheetSelect.innerHTML = '<option value="">No spreadsheets found in this project</option>';
            spreadsheetSelect.disabled = true;
        } else {
            spreadsheetSelect.disabled = false;
        }
    } catch (error) {
        console.error('Error loading spreadsheet list:', error);
        alert('Failed to load spreadsheets. Please try again.');
        hideSeedDataModal();
    }
}

function hideSeedDataModal() {
    const modal = document.getElementById('seed-data-modal');
    modal.classList.remove('visible');
    selectedSpreadsheetData = null;
}

// Handle spreadsheet selection
document.addEventListener('DOMContentLoaded', () => {
    const spreadsheetSelect = document.getElementById('spreadsheet-select');
    if (spreadsheetSelect) {
        spreadsheetSelect.addEventListener('change', async (e) => {
            const attachmentId = e.target.value;
            const detailsDiv = document.getElementById('spreadsheet-details');
            const previewDiv = document.getElementById('spreadsheet-preview');
            
            if (!attachmentId) {
                detailsDiv.style.display = 'none';
                selectedSpreadsheetData = null;
                return;
            }
            
            try {
                // Fetch the spreadsheet data
                const response = await fetch(`/analyst/get-spreadsheet-data/${attachmentId}`);
                if (!response.ok) throw new Error('Failed to fetch spreadsheet data');
                
                const data = await response.json();
                selectedSpreadsheetData = data;
                
                // Generate preview - show ALL rows for seed data generation
                let preview = `Filename: ${data.filename}\n`;
                preview += `Sheets: ${Object.keys(data.parsedData || {}).length}\n\n`;
                
                // Show all rows of each sheet
                if (data.parsedData) {
                    Object.keys(data.parsedData).forEach(sheetName => {
                        const sheetData = data.parsedData[sheetName];
                        preview += `--- ${sheetName} ---\n`;
                        preview += `Rows: ${sheetData.length}\n`;
                        
                        if (sheetData.length > 0) {
                            preview += `\nAll rows:\n`;
                            sheetData.forEach((row, idx) => {
                                preview += `${idx + 1}: ${JSON.stringify(row)}\n`;
                            });
                        }
                        preview += `\n`;
                    });
                }
                
                previewDiv.textContent = preview;
                detailsDiv.style.display = 'block';
            } catch (error) {
                console.error('Error loading spreadsheet data:', error);
                alert('Failed to load spreadsheet data. Please try again.');
            }
        });
    }
});

function exportAsJSON() {
    if (!selectedSpreadsheetData) return;
    
    const json = JSON.stringify(selectedSpreadsheetData.parsedData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSpreadsheetData.filename.replace(/\.[^/.]+$/, '')}-seed-data.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportAsSQL() {
    if (!selectedSpreadsheetData) return;
    
    let sql = '-- Seed Data SQL\n';
    sql += `-- Generated from: ${selectedSpreadsheetData.filename}\n`;
    sql += `-- Date: ${new Date().toISOString()}\n\n`;
    
    // Generate SQL INSERT statements for each sheet
    Object.keys(selectedSpreadsheetData.parsedData).forEach(sheetName => {
        const sheetData = selectedSpreadsheetData.parsedData[sheetName];
        
        if (sheetData.length === 0) return;
        
        // Sanitize table name
        const tableName = sheetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        
        sql += `-- Table: ${tableName}\n`;
        
        // Assume first row is headers
        const headers = sheetData[0];
        const dataRows = sheetData.slice(1);
        
        if (headers && headers.length > 0 && dataRows.length > 0) {
            // Generate column names
            const columns = headers.map((h, idx) => 
                h ? String(h).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : `column_${idx + 1}`
            );
            
            dataRows.forEach(row => {
                const values = row.map(val => {
                    if (val === null || val === undefined || val === '') return 'NULL';
                    if (typeof val === 'number') return val;
                    // Escape single quotes in strings
                    return `'${String(val).replace(/'/g, "''")}'`;
                });
                
                sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            });
            
            sql += '\n';
        }
    });
    
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSpreadsheetData.filename.replace(/\.[^/.]+$/, '')}-seed-data.sql`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportAsCSV() {
    if (!selectedSpreadsheetData) return;
    
    // Create a CSV file for each sheet
    Object.keys(selectedSpreadsheetData.parsedData).forEach(sheetName => {
        const sheetData = selectedSpreadsheetData.parsedData[sheetName];
        
        if (sheetData.length === 0) return;
        
        // Convert to CSV
        let csv = '';
        sheetData.forEach(row => {
            const csvRow = row.map(cell => {
                if (cell === null || cell === undefined) return '';
                const cellStr = String(cell);
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            });
            csv += csvRow.join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sanitizedSheetName = sheetName.replace(/[^a-zA-Z0-9_]/g, '_');
        a.download = `${selectedSpreadsheetData.filename.replace(/\.[^/.]+$/, '')}-${sanitizedSheetName}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Close seed data modal when clicking outside
document.getElementById('seed-data-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'seed-data-modal') {
        hideSeedDataModal();
    }
});

// Initialize on page load
init();

