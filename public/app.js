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
const requirementsPage = document.getElementById('requirements-page');
const userHeader = document.getElementById('user-header');
const userName = document.getElementById('user-name');
const adminBadge = document.getElementById('admin-badge');
const adminViewBtn = document.getElementById('admin-view-btn');
const settingsBtn = document.getElementById('settings-btn');
const projectsList = document.getElementById('projects-list');
const projectTitle = document.getElementById('project-title');
const requirementsProjectTitle = document.getElementById('requirements-project-title');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const polishBtn = document.getElementById('polish-btn');
const extractBtn = document.getElementById('extract-btn');
const openRequirementsBtn = document.getElementById('open-requirements-btn');
const refreshRequirementsChatBtn = document.getElementById('refresh-requirements-chat-btn');
const requirementsStaleIndicator = document.getElementById('requirements-stale-indicator');
const voiceBtn = document.getElementById('voice-btn');
const markdownOutput = document.getElementById('markdown-output');
const mermaidOutput = document.getElementById('mermaid-output');
const requirementsMarkdownOutput = document.getElementById('requirements-markdown-output');
const requirementsMermaidOutput = document.getElementById('requirements-mermaid-output');
const requirementsFlowchartOutput = document.getElementById('requirements-detailed-flowchart-output');
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

// Toast Notification System
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <span class="material-symbols-outlined">${icons[type] || icons.info}</span>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
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
                const parts = hash.split('/');
                const projectId = parts[2];
                if (parts[3] === 'requirements') {
                    await loadRequirementsFromUrl(projectId);
                } else {
                    await loadProjectFromUrl(projectId);
                }
            } else if (hash === '#/admin' && currentUser.isAdmin) {
                showAdminDashboard();
            } else if (hash === '#/settings' && currentUser.isAdmin) {
                showSettings();
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

// Load requirements page from URL
async function loadRequirementsFromUrl(projectId) {
    try {
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            currentProject = projectData.project;
            await showRequirementsPage();
        } else {
            showProjects();
        }
    } catch (error) {
        console.error('Error loading requirements from URL:', error);
        showProjects();
    }
}

// Show/hide pages
function showLogin() {
    loginPage.classList.remove('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.remove('visible');
    requirementsPage.classList.remove('visible');
    userHeader.style.display = 'none';
}

function showProjects() {
    const settingsPage = document.getElementById('settings-page');
    loginPage.classList.add('hidden');
    projectsPage.classList.add('visible');
    adminPage.style.display = 'none';
    chatPage.classList.remove('visible');
    if (settingsPage) settingsPage.style.display = 'none';
    userHeader.style.display = 'flex';
    userName.textContent = currentUser.name;
    
    // Show admin badge and button if user is admin
    if (currentUser.isAdmin) {
        adminBadge.style.display = 'inline';
        adminViewBtn.style.display = 'inline-block';
        settingsBtn.style.display = 'inline-block';
    } else {
        adminBadge.style.display = 'none';
        adminViewBtn.style.display = 'none';
        settingsBtn.style.display = 'none';
    }
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', '#/projects');
    }
    
    loadProjects();
}

async function showChat(project) {
    const settingsPage = document.getElementById('settings-page');
    currentProject = project;
    projectTitle.textContent = project.name;
    chatContainer.innerHTML = '';
    cachedRequirements = null; // Clear cached requirements when switching projects
    
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.add('visible');
    requirementsPage.classList.remove('visible');
    if (settingsPage) settingsPage.style.display = 'none';
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', `#/project/${project.id}`);
    }
    
    // Load existing chat history
    await loadChatHistory(project.id);
    
    // Check if requirements exist and update button states
    await updateRequirementsButtonStates();
}

async function showRequirementsPage() {
    if (!currentProject) return;
    
    const settingsPage = document.getElementById('settings-page');
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.remove('visible');
    requirementsPage.classList.add('visible');
    if (settingsPage) settingsPage.style.display = 'none';
    userHeader.style.display = 'flex';
    
    requirementsProjectTitle.textContent = `${currentProject.name} - Requirements`;
    
    // Update URL
    if (!isInitialLoad) {
        window.history.pushState({}, '', `#/project/${currentProject.id}/requirements`);
    }
    
    // Load requirements
    try {
        const response = await fetch(`/analyst/requirements/${currentProject.id}`);
        if (!response.ok) {
            throw new Error(`Failed to load requirements: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if requirements are empty (not yet generated)
        if (data.isEmpty) {
            showToast('No requirements found for this project. Please chat with the analyst to generate requirements, then click "Extract Requirements".', 'info', 6000);
            returnToChat();
            return;
        }
        
        // Check if markdown/mermaid are empty (legacy requirements need refresh)
        if (!data.markdown || !data.mermaid) {
            // Show message and auto-refresh
            document.getElementById('requirements-loading').style.display = 'block';
            document.getElementById('requirements-content').style.display = 'none';
            
            // Wait a moment then refresh
            setTimeout(() => {
                refreshRequirementsOnPage();
            }, 100);
            return;
        }
        
        requirementsMarkdownOutput.value = data.markdown;
        requirementsMermaidOutput.value = data.mermaid;
        cachedRequirements = data.requirements;
        
        // Load detailed flowchart if it exists
        if (data.detailedFlowchart) {
            const flowchartOutput = document.getElementById('requirements-detailed-flowchart-output');
            const flowchartOutputDiv = document.getElementById('requirements-flowchart-output');
            const flowchartBtn = document.getElementById('requirements-generate-flowchart-btn');
            
            if (flowchartOutput && flowchartOutputDiv && flowchartBtn) {
                flowchartOutput.value = data.detailedFlowchart;
                flowchartOutputDiv.style.display = 'block';
                flowchartBtn.style.display = 'none';
            }
        }
        
        // Load user stories if they exist
        if (data.hasUserStories && data.userStoriesMarkdown) {
            loadExistingUserStories(data.userStoriesMarkdown);
        }
        
        document.getElementById('requirements-content').style.display = 'block';
        document.getElementById('requirements-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading requirements:', error);
        showToast('Failed to load requirements', 'error');
        returnToChat();
    }
}

function returnToChat() {
    if (!currentProject) return;
    
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.classList.add('visible');
    requirementsPage.classList.remove('visible');
    userHeader.style.display = 'flex';
    
    // Update URL
    window.history.pushState({}, '', `#/project/${currentProject.id}`);
}

// Load existing user stories from database
function loadExistingUserStories(markdown) {
    const prefix = 'requirements-';
    const userStoriesTextarea = document.getElementById(prefix + 'user-stories-output');
    const storiesOutput = document.getElementById(prefix + 'stories-output');
    const generateBtn = document.getElementById(prefix + 'generate-stories-btn');
    
    if (!userStoriesTextarea || !storiesOutput || !generateBtn) {
        console.error('Required elements not found for loading user stories');
        return;
    }
    
    // Populate the textarea with the markdown
    userStoriesTextarea.value = markdown;
    
    // Hide generate button and show output
    generateBtn.style.display = 'none';
    storiesOutput.style.display = 'block';
    
    // Show action buttons
    showStoriesActionButtons();
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
        // Clear URL hash to prevent routing issues
        window.history.pushState({}, '', '/');
        showLogin();
    } catch (error) {
        console.error('Error logging out:', error);
        showToast('Failed to logout', 'error');
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
        projectItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
        
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'flex: 1; cursor: pointer;';
        contentDiv.onclick = async () => await showChat(project);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'project-name';
        nameDiv.textContent = project.name;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'project-date';
        const date = new Date(project.updatedAt);
        dateDiv.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        contentDiv.appendChild(nameDiv);
        contentDiv.appendChild(dateDiv);
        
        // Add branch button
        const branchBtn = document.createElement('button');
        branchBtn.innerHTML = '<span class="material-symbols-outlined">account_tree</span>';
        branchBtn.title = 'Branch Project';
        branchBtn.style.cssText = 'padding: 0.5rem; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-left: 1rem;';
        branchBtn.onclick = (e) => {
            e.stopPropagation();
            showBranchProjectModal(project);
        };
        
        projectItem.appendChild(contentDiv);
        projectItem.appendChild(branchBtn);
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
        showToast('Please enter a project name', 'warning');
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
        showToast('Failed to create project', 'error');
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
                addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly agent. I'll be working in the System Analyst role for "${project.name}", where I'll help you identify your requirements, document your business processes, and create comprehensive specifications. Do you have any questions about what a Systems Analyst agent does, or shall we get started?`);
            }
        } else {
            // No chat history, show welcome message
            const firstName = currentUser.name.split(' ')[0];
            addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly agent. I'll be working in the System Analyst role for "${project.name}", where I'll help you identify your requirements, document your business processes, and create comprehensive specifications. Do you have any questions about what a Systems Analyst agent does, or shall we get started?`);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        // Show welcome message as fallback
        const firstName = currentUser.name.split(' ')[0];
        addMessage('assistant', `Hello, ${firstName}! I'm Sunny, your friendly agent. I'll be working in the System Analyst role for "${currentProject.name}", where I'll help you identify your requirements, document your business processes, and create comprehensive specifications. Do you have any questions about what a Systems Analyst agent does, or shall we get started?`);
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
                showToast('Session expired. Please login again.', 'warning');
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
                showToast('Session expired. Please login again.', 'warning');
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
        let streamError = null;
        
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
                            // Store the error to throw after stream completes
                            streamError = new Error(data.error);
                            console.error('❌ Server error:', data.error);
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
                        // Store parse errors as well
                        if (!streamError) {
                            streamError = e;
                        }
                    }
                }
            }
        }
        
        // Throw stream error if one occurred
        if (streamError) {
            throw streamError;
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
        
        // Update button states to show Open/Refresh instead of Extract
        await updateRequirementsButtonStates();
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

// Update requirements button states based on whether requirements exist
async function updateRequirementsButtonStates() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`/analyst/requirements/${currentProject.id}`);
        if (response.ok) {
            const data = await response.json();
            
            // Check if requirements are empty
            if (data.isEmpty) {
                // No requirements exist, show Extract button
                extractBtn.style.display = 'inline-block';
                openRequirementsBtn.style.display = 'none';
                refreshRequirementsChatBtn.style.display = 'none';
                requirementsStaleIndicator.style.display = 'none';
            } else {
                // Hide Extract button, show Open and Refresh buttons
                extractBtn.style.display = 'none';
                openRequirementsBtn.style.display = 'inline-block';
                refreshRequirementsChatBtn.style.display = 'inline-block';
                
                // Show staleness indicator if requirements are outdated
                if (data.isStale) {
                    requirementsStaleIndicator.style.display = 'inline';
                } else {
                    requirementsStaleIndicator.style.display = 'none';
                }
                
                // Cache requirements
                cachedRequirements = data.requirements;
            }
        } else {
            // Request failed, default to showing Extract button
            extractBtn.style.display = 'inline-block';
            openRequirementsBtn.style.display = 'none';
            refreshRequirementsChatBtn.style.display = 'none';
            requirementsStaleIndicator.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking requirements:', error);
        // Default to showing Extract button
        extractBtn.style.display = 'inline-block';
        openRequirementsBtn.style.display = 'none';
        refreshRequirementsChatBtn.style.display = 'none';
        requirementsStaleIndicator.style.display = 'none';
    }
}

// Refresh requirements on the requirements page
async function refreshRequirementsOnPage() {
    if (!currentProject) return;
    
    // Show loading state
    document.getElementById('requirements-content').style.display = 'none';
    document.getElementById('requirements-loading').style.display = 'block';
    
    // Reset progress
    currentProgress = 0;
    targetProgress = 0;
    const progressBar = document.getElementById('requirements-progress-bar');
    const percentageDisplay = document.getElementById('requirements-percentage');
    if (progressBar && percentageDisplay) {
        progressBar.style.width = '0%';
        percentageDisplay.textContent = '0%';
    }
    
    // Start tips rotation
    startTipsRotation('requirements-tip');
    
    try {
        const endpoint = currentProject.isAdminView 
            ? `/api/admin/projects/${currentProject.id}/extract`
            : '/analyst/extract-stream';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: currentProject.isAdminView ? undefined : JSON.stringify({ projectId: currentProject.id })
        });
        
        if (!response.ok) {
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
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        if (data.complete) {
                            finalData = data;
                        } else if (data.progress !== undefined) {
                            const statusElement = document.getElementById('requirements-status');
                            animateProgressTo('requirements-progress-bar', 'requirements-percentage', data.progress);
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
        
        // Update the displayed requirements
        requirementsMarkdownOutput.value = finalData.markdown;
        requirementsMermaidOutput.value = finalData.mermaid;
        cachedRequirements = finalData.requirements;
        
        // Ensure 100% is visible
        if (progressBar && percentageDisplay) {
            progressBar.style.width = '100%';
            percentageDisplay.textContent = '100%';
            currentProgress = 100;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear intervals and show content
        clearLoadingIntervals();
        document.getElementById('requirements-loading').style.display = 'none';
        document.getElementById('requirements-content').style.display = 'block';
        
        // Update button states in chat view
        await updateRequirementsButtonStates();
    } catch (error) {
        clearLoadingIntervals();
        document.getElementById('requirements-loading').style.display = 'none';
        document.getElementById('requirements-content').style.display = 'block';
        showToast('Failed to refresh requirements. Please try again.', 'error');
        console.error('Error:', error);
    }
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
        showToast('Failed to copy to clipboard', 'error');
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
        showToast('Failed to copy to clipboard', 'error');
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

// Requirements page copy/download functions
function copyRequirementsMarkdown(event) {
    const content = requirementsMarkdownOutput.value;
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
        showToast('Failed to copy to clipboard', 'error');
    });
}

function copyRequirementsMermaid(event) {
    const content = requirementsMermaidOutput.value;
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
        showToast('Failed to copy to clipboard', 'error');
    });
}

function copyRequirementsFlowchart(event) {
    const content = requirementsFlowchartOutput.value;
    navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

function downloadRequirementsMarkdown() {
    const content = requirementsMarkdownOutput.value;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-requirements.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadRequirementsMermaid() {
    const content = requirementsMermaidOutput.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}-workflow.mmd`;
    a.click();
    URL.revokeObjectURL(url);
}

// User Stories Generation
let isGeneratingStories = false; // Flag to prevent concurrent story generation

async function generateUserStories() {
    if (!currentProject) return;
    
    // Prevent concurrent requests
    if (isGeneratingStories) {
        console.log('⚠️ Story generation already in progress, ignoring click');
        return;
    }
    
    isGeneratingStories = true;
    
    // Detect if we're on requirements page or in modal
    const isRequirementsPage = requirementsPage && requirementsPage.classList.contains('visible');
    const prefix = isRequirementsPage ? 'requirements-' : '';
    
    console.log('🔍 Debug: isRequirementsPage =', isRequirementsPage, ', prefix =', prefix);
    
    const generateBtn = document.getElementById(prefix + 'generate-stories-btn');
    const storiesLoading = document.getElementById(prefix + 'stories-loading');
    const storiesOutput = document.getElementById(prefix + 'stories-output');
    const userStoriesTextarea = document.getElementById(prefix + 'user-stories-output');
    
    console.log('🔍 Debug: Elements found:', {
        generateBtn: !!generateBtn,
        storiesLoading: !!storiesLoading,
        storiesOutput: !!storiesOutput,
        userStoriesTextarea: !!userStoriesTextarea
    });
    
    if (!generateBtn || !storiesLoading || !storiesOutput || !userStoriesTextarea) {
        console.error('❌ Missing required elements for user story generation');
        showToast('Error: Required UI elements not found. Please refresh the page and try again.', 'error', 7000);
        return;
    }
    
    // Reset status and tip text to initial values
    const statusElement = document.getElementById(prefix + 'stories-status');
    const tipElement = document.getElementById(prefix + 'stories-tip');
    if (statusElement) statusElement.textContent = "Sunny is analyzing your requirements...";
    if (tipElement) tipElement.textContent = educationalTips[2]; // Use user stories tip
    
    // Reset progress bar and state
    resetProgress();
    const progressBar = document.getElementById(prefix + 'stories-progress-bar');
    const percentageDisplay = document.getElementById(prefix + 'stories-percentage');
    if (progressBar) progressBar.style.width = '0%';
    if (percentageDisplay) percentageDisplay.textContent = '0%';
    
    console.log('🔍 Debug: Progress elements:', {
        progressBar: !!progressBar,
        percentageDisplay: !!percentageDisplay
    });
    
    // Hide button and show loading
    console.log('🔍 Debug: Setting loading display to block');
    generateBtn.style.display = 'none';
    storiesLoading.style.display = 'block';
    storiesOutput.style.display = 'none';
    
    // Verify the display was set
    const computedDisplay = window.getComputedStyle(storiesLoading).display;
    console.log('🔍 Debug: After setting, storiesLoading display is:', computedDisplay);
    console.log('🔍 Debug: storiesLoading visibility:', window.getComputedStyle(storiesLoading).visibility);
    console.log('🔍 Debug: storiesLoading opacity:', window.getComputedStyle(storiesLoading).opacity);
    
    // Scroll to the loading indicator to ensure it's visible
    console.log('🔍 Debug: Scrolling to loading indicator');
    storiesLoading.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Start tips rotation only
    startTipsRotation(prefix + 'stories-tip');
    
    try {
        // Use cached requirements if available (faster, no LLM call to re-extract)
        let response;
        if (cachedRequirements) {
            response = await fetch('/analyst/generate-stories-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    requirements: cachedRequirements,
                    projectId: currentProject.id 
                })
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
            let streamError = null;
            
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
                                // Store the error to throw after stream completes
                                streamError = new Error(data.error);
                                console.error('❌ Server error:', data.error);
                            }
                            
                            if (data.complete) {
                                // Store final result
                                console.log('✅ Story generation complete, received final data');
                                finalData = data;
                            } else if (data.progress !== undefined) {
                                // Update progress bar and status
                                console.log(`📊 Progress update: ${data.progress}% - ${data.stage}`);
                                
                                // Animate progress smoothly to target
                                animateProgressTo(prefix + 'stories-progress-bar', prefix + 'stories-percentage', data.progress);
                                
                                // Update status message (keep previous message if stage is empty)
                                if (statusElement && data.stage) {
                                    statusElement.textContent = data.stage;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                            // Store parse errors as well
                            if (!streamError) {
                                streamError = e;
                            }
                        }
                    }
                }
            }
            
            // Throw stream error if one occurred
            if (streamError) {
                throw streamError;
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
        
        // Hide loading and show output with action buttons
        storiesLoading.style.display = 'none';
        storiesOutput.style.display = 'block';
        
        // Hide generate button and show view/regenerate buttons
        generateBtn.style.display = 'none';
        showStoriesActionButtons();
        
    } catch (error) {
        console.error('Error generating user stories:', error);
        clearLoadingIntervals();
        showToast('Failed to generate user stories. Please try again.', 'error');
        
        // Show button again on error
        generateBtn.style.display = 'inline-flex';
        storiesLoading.style.display = 'none';
    } finally {
        // Reset flag to allow future requests
        isGeneratingStories = false;
    }
}

function showStoriesActionButtons() {
    // Detect if we're on requirements page or in modal
    const isRequirementsPage = requirementsPage && requirementsPage.classList.contains('visible');
    const prefix = isRequirementsPage ? 'requirements-' : '';
    
    // Check if action buttons container exists, if not create it
    let actionsContainer = document.getElementById(prefix + 'stories-actions');
    if (!actionsContainer) {
        actionsContainer = document.createElement('div');
        actionsContainer.id = prefix + 'stories-actions';
        actionsContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem;';
        
        const generateBtn = document.getElementById(prefix + 'generate-stories-btn');
        generateBtn.parentNode.insertBefore(actionsContainer, generateBtn);
    }
    
    actionsContainer.innerHTML = `
        <button class="view-stories-btn" onclick="viewUserStoriesBoard()" style="background: #10b981; color: white; padding: 0.875rem 1.5rem; border: none; border-radius: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 1rem; box-shadow: 0 3px 10px rgba(16,185,129,0.3);">
            <span class="material-symbols-outlined">view_kanban</span>
            View Stories Board
        </button>
        <button class="regenerate-stories-btn" onclick="regenerateUserStories()" style="background: #f59e0b; color: white; padding: 0.875rem 1.5rem; border: none; border-radius: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 1rem; box-shadow: 0 3px 10px rgba(245,158,11,0.3);">
            <span class="material-symbols-outlined">refresh</span>
            Regenerate Stories
        </button>
    `;
    actionsContainer.style.display = 'flex';
}

function regenerateUserStories() {
    // Detect if we're on requirements page or in modal
    const isRequirementsPage = requirementsPage && requirementsPage.classList.contains('visible');
    const prefix = isRequirementsPage ? 'requirements-' : '';
    
    const actionsContainer = document.getElementById(prefix + 'stories-actions');
    const generateBtn = document.getElementById(prefix + 'generate-stories-btn');
    const storiesOutput = document.getElementById(prefix + 'stories-output');
    
    // Hide actions and output
    if (actionsContainer) actionsContainer.style.display = 'none';
    storiesOutput.style.display = 'none';
    
    // Show generate button again
    generateBtn.style.display = 'inline-flex';
    
    // Trigger generation
    generateUserStories();
}

// User Stories Board Functions
async function viewUserStoriesBoard() {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.id}/stories`);
        if (!response.ok) throw new Error('Failed to fetch user stories');
        
        const { epics, statusCounts, removedCount } = await response.json();
        
        // Show modal
        const modal = document.getElementById('user-stories-board-modal');
        modal.classList.add('visible');
        
        // Render status summary
        const summaryContainer = document.getElementById('stories-status-summary');
        summaryContainer.innerHTML = `
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #3b82f6;">${statusCounts.open}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">Open</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #f59e0b;">${statusCounts.inProgress}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">In Progress</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #6366f1;">${statusCounts.readyForReview}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">Ready for Review</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #ec4899;">${statusCounts.inReview}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">In Review</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${statusCounts.done}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">Done</div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #111827;">${statusCounts.total}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">Total</div>
            </div>
            ${removedCount > 0 ? `
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: #9ca3af;">${removedCount}</div>
                <div style="color: #6b7280; font-size: 0.875rem;">Removed</div>
            </div>
            ` : ''}
        `;
        
        // Render stories by epic
        const boardContent = document.getElementById('stories-board-content');
        boardContent.innerHTML = epics.map(epic => `
            <div style="margin-bottom: 2rem; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; background: white;">
                <h4 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #111827;">
                    <span style="font-size: 1.5rem;">${epic.icon}</span>
                    ${epic.name}
                </h4>
                <p style="color: #6b7280; margin-bottom: 1.5rem; font-size: 0.95rem;">${epic.description}</p>
                <div style="display: grid; gap: 1rem;">
                    ${epic.stories.map(story => renderStoryCard(story)).join('')}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading user stories:', error);
        showToast('Failed to load user stories', 'error');
    }
}

function renderStoryCard(story) {
    const statusColors = {
        OPEN: { bg: '#dbeafe', text: '#1e40af', label: 'Open' },
        IN_PROGRESS: { bg: '#fef3c7', text: '#b45309', label: 'In Progress' },
        READY_FOR_REVIEW: { bg: '#e0e7ff', text: '#4338ca', label: 'Ready for Review' },
        IN_REVIEW: { bg: '#fce7f3', text: '#9f1239', label: 'In Review' },
        DONE: { bg: '#d1fae5', text: '#065f46', label: 'Done' },
        REMOVED: { bg: '#f3f4f6', text: '#6b7280', label: 'Removed' }
    };
    
    const priorityColors = {
        MUST_HAVE: { bg: '#fee2e2', text: '#991b1b', label: 'Must Have' },
        SHOULD_HAVE: { bg: '#fef3c7', text: '#b45309', label: 'Should Have' },
        NICE_TO_HAVE: { bg: '#e0e7ff', text: '#3730a3', label: 'Nice to Have' }
    };
    
    const status = statusColors[story.status] || statusColors.OPEN;
    const priority = priorityColors[story.priority] || priorityColors.SHOULD_HAVE;
    
    return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; background: #fafafa; cursor: pointer; transition: all 0.2s;" 
             onclick="editStory('${story.id}')"
             onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow=''; this.style.transform=''">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #111827; margin-bottom: 0.5rem;">${story.title}</div>
                    <div style="font-size: 0.875rem; color: #6b7280; font-style: italic;">
                        As a <strong>${story.actor}</strong>, I want to <strong>${story.action}</strong>, so that <strong>${story.benefit}</strong>
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <span style="background: ${status.bg}; color: ${status.text}; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                    ${status.label}
                </span>
                <span style="background: ${priority.bg}; color: ${priority.text}; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                    ${priority.label}
                </span>
                <span style="background: #f3f4f6; color: #4b5563; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                    ${story.effort}
                </span>
            </div>
        </div>
    `;
}

async function editStory(storyId) {
    if (!currentProject) return;
    
    try {
        // Fetch all stories to find the one we need
        const response = await fetch(`/api/projects/${currentProject.id}/stories`);
        if (!response.ok) throw new Error('Failed to fetch user stories');
        
        const { epics } = await response.json();
        let story = null;
        for (const epic of epics) {
            story = epic.stories.find(s => s.id === storyId);
            if (story) break;
        }
        
        if (!story) {
            showToast('Story not found', 'error');
            return;
        }
        
        // Show edit modal
        const modal = document.getElementById('edit-story-modal');
        const formContainer = document.getElementById('edit-story-form');
        
        formContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Title</label>
                    <input id="edit-story-title" type="text" value="${story.title}" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Status</label>
                        <select id="edit-story-status" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            <option value="OPEN" ${story.status === 'OPEN' ? 'selected' : ''}>Open</option>
                            <option value="IN_PROGRESS" ${story.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                            <option value="READY_FOR_REVIEW" ${story.status === 'READY_FOR_REVIEW' ? 'selected' : ''}>Ready for Review</option>
                            <option value="IN_REVIEW" ${story.status === 'IN_REVIEW' ? 'selected' : ''}>In Review</option>
                            <option value="DONE" ${story.status === 'DONE' ? 'selected' : ''}>Done</option>
                            <option value="REMOVED" ${story.status === 'REMOVED' ? 'selected' : ''}>Removed</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Priority</label>
                        <select id="edit-story-priority" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            <option value="MUST_HAVE" ${story.priority === 'MUST_HAVE' ? 'selected' : ''}>Must Have</option>
                            <option value="SHOULD_HAVE" ${story.priority === 'SHOULD_HAVE' ? 'selected' : ''}>Should Have</option>
                            <option value="NICE_TO_HAVE" ${story.priority === 'NICE_TO_HAVE' ? 'selected' : ''}>Nice to Have</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Effort</label>
                        <select id="edit-story-effort" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            <option value="SMALL" ${story.effort === 'SMALL' ? 'selected' : ''}>Small</option>
                            <option value="MEDIUM" ${story.effort === 'MEDIUM' ? 'selected' : ''}>Medium</option>
                            <option value="LARGE" ${story.effort === 'LARGE' ? 'selected' : ''}>Large</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Actor</label>
                    <input id="edit-story-actor" type="text" value="${story.actor}" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Action</label>
                    <textarea id="edit-story-action" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; min-height: 60px;">${story.action}</textarea>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Benefit</label>
                    <textarea id="edit-story-benefit" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; min-height: 60px;">${story.benefit}</textarea>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Acceptance Criteria</label>
                    <div id="acceptance-criteria-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${(story.acceptanceCriteria || []).map((ac, index) => `
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <input type="text" class="ac-input" data-index="${index}" value="${ac.description}" style="flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;">
                                <button onclick="removeAcceptanceCriterion(${index})" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button onclick="addAcceptanceCriterion()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">+ Add Criterion</button>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
                    <button onclick="hideEditStoryModal()" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
                    <button onclick="saveStory('${storyId}')" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Changes</button>
                </div>
            </div>
        `;
        
        modal.classList.add('visible');
        
    } catch (error) {
        console.error('Error loading story for edit:', error);
        showToast('Failed to load story', 'error');
    }
}

function addAcceptanceCriterion() {
    const list = document.getElementById('acceptance-criteria-list');
    const index = list.children.length;
    const newCriterion = document.createElement('div');
    newCriterion.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
    newCriterion.innerHTML = `
        <input type="text" class="ac-input" data-index="${index}" placeholder="New criterion" style="flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;">
        <button onclick="removeAcceptanceCriterion(${index})" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">×</button>
    `;
    list.appendChild(newCriterion);
}

function removeAcceptanceCriterion(index) {
    const list = document.getElementById('acceptance-criteria-list');
    list.children[index].remove();
}

async function saveStory(storyId) {
    if (!currentProject) return;
    
    try {
        // Collect form data
        const title = document.getElementById('edit-story-title').value;
        const status = document.getElementById('edit-story-status').value;
        const priority = document.getElementById('edit-story-priority').value;
        const effort = document.getElementById('edit-story-effort').value;
        const actor = document.getElementById('edit-story-actor').value;
        const action = document.getElementById('edit-story-action').value;
        const benefit = document.getElementById('edit-story-benefit').value;
        
        // Collect acceptance criteria
        const acInputs = document.querySelectorAll('.ac-input');
        const acceptanceCriteria = Array.from(acInputs)
            .map(input => ({ description: input.value }))
            .filter(ac => ac.description.trim() !== '');
        
        // Update story
        const response = await fetch(`/api/projects/${currentProject.id}/stories/${storyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                status,
                priority,
                effort,
                actor,
                action,
                benefit,
                acceptanceCriteria
            })
        });
        
        if (!response.ok) throw new Error('Failed to update story');
        
        // Close modal and refresh board
        hideEditStoryModal();
        await viewUserStoriesBoard();
        
    } catch (error) {
        console.error('Error saving story:', error);
        showToast('Failed to save story', 'error');
    }
}

function hideUserStoriesBoard() {
    const modal = document.getElementById('user-stories-board-modal');
    modal.classList.remove('visible');
}

function hideEditStoryModal() {
    const modal = document.getElementById('edit-story-modal');
    modal.classList.remove('visible');
}

// Project Branching Functions
let branchSourceProject = null;

function showBranchProjectModal(project) {
    branchSourceProject = project;
    const modal = document.getElementById('branch-project-modal');
    const sourceInput = document.getElementById('branch-source-project');
    const nameInput = document.getElementById('branch-new-project-name');
    
    sourceInput.value = project.name;
    nameInput.value = `${project.name} (Branch)`;
    
    modal.classList.add('visible');
    nameInput.focus();
    nameInput.select();
}

function hideBranchProjectModal() {
    const modal = document.getElementById('branch-project-modal');
    modal.classList.remove('visible');
    branchSourceProject = null;
}

async function confirmBranchProject() {
    if (!branchSourceProject) return;
    
    const nameInput = document.getElementById('branch-new-project-name');
    const newName = nameInput.value.trim();
    
    if (!newName) {
        showToast('Please enter a name for the new project', 'warning');
        return;
    }
    
    const confirmBtn = document.getElementById('confirm-branch-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Branching...';
    
    try {
        const response = await fetch(`/api/projects/${branchSourceProject.id}/branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) throw new Error('Failed to branch project');
        
        const data = await response.json();
        
        hideBranchProjectModal();
        
        // Show success message
        showToast(`Project branched successfully! ${data.project.epics.reduce((sum, e) => sum + e.stories.length, 0)} user stories copied.`, 'success', 6000);
        
        // Reload projects list
        await loadProjects();
        
    } catch (error) {
        console.error('Error branching project:', error);
        showToast('Failed to branch project', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Branch Project';
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
    
    // Detect if we're on requirements page or in modal
    const isRequirementsPage = requirementsPage && requirementsPage.classList.contains('visible');
    const prefix = isRequirementsPage ? 'requirements-' : '';
    
    const generateBtn = document.getElementById(prefix + 'generate-flowchart-btn');
    const flowchartLoading = document.getElementById(prefix + 'flowchart-loading');
    const flowchartOutput = document.getElementById(prefix + 'flowchart-output');
    const flowchartTextarea = document.getElementById(prefix + 'detailed-flowchart-output');
    
    // Reset status and tip text to initial values
    const statusElement = document.getElementById(prefix + 'flowchart-status');
    const tipElement = document.getElementById(prefix + 'flowchart-tip');
    if (statusElement) statusElement.textContent = "Sunny is analyzing your system architecture...";
    if (tipElement) tipElement.textContent = "Workflow diagrams make it easier to visualize how your system will operate";
    
    // Reset progress bar and state
    resetProgress();
    const progressBar = document.getElementById(prefix + 'flowchart-progress-bar');
    const percentageDisplay = document.getElementById(prefix + 'flowchart-percentage');
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
    startTipsRotation(prefix + 'flowchart-tip', flowchartTips);
    
    try {
        const response = await fetch('/analyst/generate-flowchart-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requirements: cachedRequirements, projectId: currentProject.id })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate flowchart');
        }
        
        // Process streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;
        let streamError = null;
        
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
                            // Store the error to throw after stream completes
                            streamError = new Error(data.error);
                            console.error('❌ Server error:', data.error);
                        }
                        
                        if (data.complete) {
                            // Store final result
                            console.log('✅ Flowchart generation complete, received final data');
                            finalData = data;
                        } else if (data.progress !== undefined) {
                            // Update progress bar and status
                            console.log(`📊 Progress update: ${data.progress}% - ${data.stage}`);
                            
                            // Animate progress smoothly to target
                            animateProgressTo(prefix + 'flowchart-progress-bar', prefix + 'flowchart-percentage', data.progress);
                            
                            // Update status message immediately
                            if (statusElement && data.stage) statusElement.textContent = data.stage;
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                        // Store parse errors as well
                        if (!streamError) {
                            streamError = e;
                        }
                    }
                }
            }
        }
        
        // Throw stream error if one occurred
        if (streamError) {
            throw streamError;
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
        showToast('Failed to generate flowchart. Please try again.', 'error');
        
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

function downloadRequirementsFlowchart() {
    const content = requirementsFlowchartOutput.value;
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
    
    const settingsPage = document.getElementById('settings-page');
    loginPage.classList.add('hidden');
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'flex';
    chatPage.classList.remove('visible');
    if (settingsPage) settingsPage.style.display = 'none';
    
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
        showToast('Failed to load project chat', 'error');
    }
}

// Polish Text Functions
let polishedTextCache = '';

async function polishText() {
    const text = messageInput.value.trim();
    
    if (!text || isProcessing) return;
    
    if (text.length < 5) {
        showToast('Please enter some text to polish.', 'warning');
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
                showToast('Session expired. Please login again.', 'warning');
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
        showToast('Failed to polish text. Please try again.', 'error');
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
        showToast('Please upload an Excel file (.xls or .xlsx)', 'warning');
        excelFileInput.value = '';
        return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'warning');
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
                showToast('Session expired. Please login again.', 'warning');
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
        showToast('Please select a valid image file (PNG, JPG, GIF, WebP)', 'warning');
        imageFileInput.value = '';
        return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'warning');
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
                showToast('Microphone access denied. Please enable microphone permissions in your browser settings.', 'error', 7000);
            } else if (event.error === 'no-speech') {
                console.log('No speech detected');
            } else if (event.error === 'network') {
                showToast('Network error occurred. Please check your connection.', 'error');
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
        showToast('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari for voice input.', 'warning', 7000);
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
            showToast('Failed to start voice recognition. Please try again.', 'error');
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
openRequirementsBtn.addEventListener('click', showRequirementsPage);
refreshRequirementsChatBtn.addEventListener('click', extractRequirements);
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
        const parts = hash.split('/');
        const projectId = parts[2];
        if (parts[3] === 'requirements') {
            loadRequirementsFromUrl(projectId);
        } else {
            loadProjectFromUrl(projectId);
        }
    } else if (hash === '#/admin' && currentUser.isAdmin) {
        showAdminDashboard();
    } else if (hash === '#/settings' && currentUser.isAdmin) {
        showSettings();
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
    
    // Show modal directly without loading state
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';
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
        
        if (spreadsheetAttachments.length === 0) {
            spreadsheetSelect.innerHTML = '<option value="">No spreadsheets found in this project</option>';
            spreadsheetSelect.disabled = true;
        } else {
            spreadsheetSelect.disabled = false;
        }
    } catch (error) {
        console.error('Error loading spreadsheet list:', error);
        showToast('Failed to load spreadsheets. Please try again.', 'error');
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
                showToast('Failed to load spreadsheet data. Please try again.', 'error');
            }
        });
    }
});

async function exportAsJSON() {
    if (!selectedSpreadsheetData) return;
    
    try {
        // Save to database first
        const response = await fetch('/analyst/generate-seed-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProject.id,
                attachmentId: selectedSpreadsheetData.id,
                format: 'json'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate seed data');
        }
        
        const result = await response.json();
        
        // Download the file
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting JSON:', error);
        showToast('Failed to generate seed data. Please try again.', 'error');
    }
}

async function exportAsSQL() {
    if (!selectedSpreadsheetData) return;
    
    try {
        // Save to database first
        const response = await fetch('/analyst/generate-seed-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProject.id,
                attachmentId: selectedSpreadsheetData.id,
                format: 'sql'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate seed data');
        }
        
        const result = await response.json();
        
        // Download the file
        const blob = new Blob([result.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting SQL:', error);
        showToast('Failed to generate seed data. Please try again.', 'error');
    }
}

async function exportAsCSV() {
    if (!selectedSpreadsheetData) return;
    
    try {
        // Save to database first
        const response = await fetch('/analyst/generate-seed-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProject.id,
                attachmentId: selectedSpreadsheetData.id,
                format: 'csv'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate seed data');
        }
        
        const result = await response.json();
        
        // Parse CSV data (stored as JSON object with sheet names as keys)
        const csvData = JSON.parse(result.data);
        
        // Download a CSV file for each sheet
        Object.keys(csvData).forEach(sheetName => {
            const csv = csvData[sheetName];
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sanitizedSheetName = sheetName.replace(/[^a-zA-Z0-9_]/g, '_');
            a.download = `${selectedSpreadsheetData.filename.replace(/\.[^/.]+$/, '')}-${sanitizedSheetName}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Failed to generate seed data. Please try again.', 'error');
    }
}

// Close seed data modal when clicking outside
document.getElementById('seed-data-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'seed-data-modal') {
        hideSeedDataModal();
    }
});

// ===========================
// Settings Page Functions
// ===========================

async function showSettings() {
    // Only allow admin users to access settings
    if (!currentUser || !currentUser.isAdmin) {
        showProjects();
        return;
    }
    
    const settingsPage = document.getElementById('settings-page');
    const projectsPage = document.getElementById('projects-page');
    const adminPage = document.getElementById('admin-page');
    const chatPage = document.getElementById('chat-page');
    const requirementsPage = document.getElementById('requirements-page');
    
    projectsPage.classList.remove('visible');
    adminPage.style.display = 'none';
    chatPage.style.display = 'none';
    requirementsPage.style.display = 'none';
    settingsPage.style.display = 'block';
    
    window.location.hash = '#/settings';
    
    // Load backup status
    await refreshBackupStatus();
}

async function refreshBackupStatus() {
    try {
        const response = await fetch('/api/system/backup-status');
        if (!response.ok) {
            throw new Error('Failed to fetch backup status');
        }
        
        const data = await response.json();
        
        // Update stats
        document.getElementById('backup-count').textContent = data.backupCount;
        document.getElementById('backup-total-size').textContent = formatBytes(data.totalBackupSize);
        document.getElementById('server-uptime').textContent = formatUptime(data.serverUptime);
        document.getElementById('backup-location').textContent = data.backupLocation;
        
        // Update last backup info
        const lastBackupEl = document.getElementById('last-backup-info');
        if (data.lastBackup) {
            const date = new Date(data.lastBackup.timestamp);
            lastBackupEl.innerHTML = `
                <strong>${data.lastBackup.name}</strong><br>
                <small>${date.toLocaleString()} (${formatBytes(data.lastBackup.size)})</small>
            `;
        } else {
            lastBackupEl.textContent = 'No backups yet';
        }
        
        // Update backup list
        const backupListEl = document.getElementById('backup-list');
        if (data.backups.length === 0) {
            backupListEl.innerHTML = '<div style="color: #7f8c8d; text-align: center; padding: 1rem;">No backups found</div>';
        } else {
            backupListEl.innerHTML = data.backups.map(backup => {
                const date = new Date(backup.timestamp);
                return `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #ecf0f1;">
                        <div style="flex: 1;">
                            <div style="font-family: monospace; font-size: 0.875rem;">${backup.name}</div>
                            <div style="font-size: 0.75rem; color: #7f8c8d; margin-top: 0.25rem;">${date.toLocaleString()}</div>
                        </div>
                        <div style="text-align: right; color: #7f8c8d; font-size: 0.875rem;">
                            ${formatBytes(backup.size)}
                        </div>
                    </div>
                `;
            }).join('');
        }
        
    } catch (error) {
        console.error('Error fetching backup status:', error);
        document.getElementById('backup-list').innerHTML = 
            '<div style="color: #e74c3c; text-align: center; padding: 1rem;">Failed to load backup status</div>';
    }
}

async function triggerBackupNow() {
    const btn = document.getElementById('backup-now-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Creating backup...';
        
        const response = await fetch('/api/system/backup-now', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Backup failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Backup created!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
            
            // Refresh the status
            await refreshBackupStatus();
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Error creating backup:', error);
        btn.innerHTML = '<span class="material-symbols-outlined">error</span> Failed!';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
        showToast('Failed to create backup: ' + error.message, 'error');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Initialize on page load
init();

