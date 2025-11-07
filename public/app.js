// State
let currentUser = null;
let currentProject = null;
let isProcessing = false;
let isInitialLoad = true;

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
const extractBtn = document.getElementById('extract-btn');
const markdownOutput = document.getElementById('markdown-output');
const mermaidOutput = document.getElementById('mermaid-output');
const newProjectModal = document.getElementById('new-project-modal');
const newProjectNameInput = document.getElementById('new-project-name');
const adminContent = document.getElementById('admin-content');

// Initialize app
async function init() {
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
    // Re-enable input if it was disabled for admin view
    messageInput.disabled = false;
    sendBtn.disabled = false;
    extractBtn.disabled = false;
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
                    addMessage(msg.role, msg.content);
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
        headerDiv.appendChild(avatar);
    } else if (role === 'user' && currentUser && currentUser.picture) {
        const avatar = document.createElement('img');
        avatar.src = currentUser.picture;
        avatar.alt = currentUser.name;
        avatar.className = 'message-avatar';
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

function hideOutputModal() {
    const modal = document.getElementById('output-modal');
    modal.classList.remove('visible');
}

async function extractRequirements() {
    if (isProcessing || !currentProject) return;
    showConfirmExtractModal();
}

async function performExtraction() {
    isProcessing = true;
    sendBtn.disabled = true;
    extractBtn.disabled = true;
    
    // Show modal with loading animation
    showOutputModal();
    
    try {
        const response = await fetch('/analyst/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: currentProject.id })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                hideOutputModal();
                alert('Session expired. Please login again.');
                showLogin();
                return;
            }
            throw new Error('Extraction failed');
        }
        
        const data = await response.json();
        
        markdownOutput.value = data.markdown;
        mermaidOutput.value = data.mermaid;
        
        // Switch modal to show results
        showOutputResults();
    } catch (error) {
        hideOutputModal();
        addMessage('assistant', 'Sorry, I could not extract requirements. Please continue the conversation.');
        console.error('Error:', error);
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
    extractBtn.disabled = false;
}

function copyMarkdown() {
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

function copyMermaid() {
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
        
        // Disable input for admin view
        messageInput.disabled = true;
        sendBtn.disabled = true;
        extractBtn.disabled = true;
        messageInput.placeholder = 'Admin view - read only';
        
        // Display chat history
        if (project.sessions.length > 0) {
            const history = project.sessions[0].history;
            history.forEach(msg => {
                if (msg.role !== 'system') {
                    addMessage(msg.role, msg.content);
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

// Event listeners
sendBtn.addEventListener('click', sendMessage);
extractBtn.addEventListener('click', extractRequirements);

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

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const confirmModal = document.getElementById('confirm-extract-modal');
        const outputModal = document.getElementById('output-modal');
        if (confirmModal.classList.contains('visible')) {
            hideConfirmExtractModal();
        } else if (outputModal.classList.contains('visible')) {
            hideOutputModal();
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

// Initialize on page load
init();
