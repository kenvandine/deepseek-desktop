const { ipcRenderer } = require('electron');

let conversationHistory = [];
let isWaitingForResponse = false;

// Auto-resize textarea
const messageInput = document.getElementById('messageInput');
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

// Handle Enter key (send) vs Shift+Enter (new line)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function clearChat() {
    if (confirm('Deseja limpar todo o histórico do chat?')) {
        conversationHistory = [];
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = `
            <div class="empty-state">
                <h2>🚀 Bem-vindo ao DeepSeek!</h2>
                <p>Digite sua mensagem abaixo para começar a conversar</p>
            </div>
        `;
    }
}

function openSettings() {
    ipcRenderer.send('open-api-key-config');
}

function addMessage(content, role = 'user') {
    const chatContainer = document.getElementById('chatContainer');

    // Remove empty state if it exists
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    // Format content (basic markdown support)
    const formattedContent = formatMessage(content);
    messageDiv.innerHTML = formattedContent;

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv;
}

function formatMessage(content) {
    // Basic markdown-like formatting
    let formatted = content;

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    const chatContainer = document.getElementById('chatContainer');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const message = input.value.trim();

    if (!message || isWaitingForResponse) return;

    // Get selected model
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;

    // Add user message to UI
    addMessage(message, 'user');

    // Add to conversation history
    conversationHistory.push({
        role: 'user',
        content: message
    });

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Disable input while waiting
    isWaitingForResponse = true;
    sendButton.disabled = true;
    input.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        // Send to main process
        const response = await ipcRenderer.invoke('send-chat-message', {
            messages: conversationHistory,
            model: selectedModel
        });

        // Remove typing indicator
        removeTypingIndicator();

        if (response.success) {
            // Add assistant response
            addMessage(response.content, 'assistant');

            // Add to conversation history
            conversationHistory.push({
                role: 'assistant',
                content: response.content
            });
        } else {
            // Show error
            addMessage(`Erro: ${response.error}`, 'error');
        }
    } catch (error) {
        removeTypingIndicator();
        addMessage(`Erro ao enviar mensagem: ${error.message}`, 'error');
    } finally {
        // Re-enable input
        isWaitingForResponse = false;
        sendButton.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// Handle zoom shortcuts
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        if (event.key === '+') {
            ipcRenderer.send('zoom-in');
        } else if (event.key === '-') {
            ipcRenderer.send('zoom-out');
        } else if (event.key === '0') {
            ipcRenderer.send('zoom-reset');
        }
    }
});

// Handle mouse wheel zoom
document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY < 0) {
            ipcRenderer.send('zoom-in');
        } else {
            ipcRenderer.send('zoom-out');
        }
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    console.log('Chat interface loaded');
    document.getElementById('messageInput').focus();
});
