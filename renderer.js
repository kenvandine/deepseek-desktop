const { ipcRenderer } = require('electron');

// Search functionality
let searchActive = false;
let currentSearchTerm = '';

function initSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchClose = document.getElementById('search-close');

    // Show search when Ctrl+F is pressed
    document.addEventListener('keydown', (e) => {
        // Check for Ctrl+F or Cmd+F (macOS)
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            showSearch();
        }
        
        // Close search when Escape is pressed
        if (e.key === 'Escape') {
            hideSearch();
        }
        
        // Navigate between matches with Ctrl+G or Cmd+G
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            if (searchActive && currentSearchTerm) {
                // Use Electron's findInPage API to navigate
                ipcRenderer.send('find-next', currentSearchTerm);
            }
        }
    });

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        if (currentSearchTerm) {
            ipcRenderer.send('find-in-page', currentSearchTerm);
        } else {
            ipcRenderer.send('stop-find-in-page');
        }
    });

    // Close search button
    searchClose.addEventListener('click', hideSearch);

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (searchActive && 
            !searchContainer.contains(e.target) && 
            e.target !== searchInput) {
            hideSearch();
        }
    });
}

function showSearch() {
    const searchContainer = document.getElementById('search-container');
    searchContainer.style.display = 'block';
    searchActive = true;
    document.getElementById('search-input').focus();
}

function hideSearch() {
    const searchContainer = document.getElementById('search-container');
    searchContainer.style.display = 'none';
    searchActive = false;
    currentSearchTerm = '';
    document.getElementById('search-input').value = '';
    ipcRenderer.send('stop-find-in-page');
}

// Initialize search when page loads
window.addEventListener('load', initSearch);

// Handle messages from main process
ipcRenderer.on('find-result', (event, result) => {
    // Handle find result if needed
    console.log('Find result:', result);
});

// Handle messages from main process
ipcRenderer.on('find-started', (event, term) => {
    console.log('Find started for:', term);
});

// Handle messages from main process
ipcRenderer.on('find-ended', (event, term) => {
    console.log('Find ended for:', term);
});
