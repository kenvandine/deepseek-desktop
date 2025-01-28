const { ipcRenderer } = require('electron');

// List for DOMContentLoaded event
window.addEventListener('DOMContentLoaded', () => {
    // Listen for click events and fire open-external-link as needed
    document.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
            event.preventDefault();
            ipcRenderer.send('open-external-link', event.target.href);
        }
    });
});
