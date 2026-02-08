const { ipcRenderer } = require('electron');

// Network status detection
function updateNetworkStatus() {
    ipcRenderer.send('network-status', navigator.onLine);
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Listen for DOMContentLoaded event
window.addEventListener('DOMContentLoaded', async () => {
    // Wire up retry button on offline page
    const retryBtn = document.getElementById('retry-btn') || document.querySelector('.retry-btn');
    if (retryBtn) {
        // Ensure any inline onclick (e.g., page reload) does not override IPC-based retry
        retryBtn.removeAttribute('onclick');
        retryBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            ipcRenderer.send('retry-connection');
        });
    }

    // Fetch allowed hosts from main process to avoid duplication
    let allowedHosts = new Set();
    try {
        const hosts = await ipcRenderer.invoke('get-allowed-hosts');
        allowedHosts = new Set(hosts);
    } catch (e) {
        console.error('Failed to fetch allowed hosts:', e);
        // Fallback to empty set if fetch fails
    }

    // Listen for click events and open non-allowed links externally
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.href && link.href.startsWith('http')) {
            try {
                const host = new URL(link.href).host;
                if (allowedHosts.has(host)) {
                    return; // Allow app + auth links to navigate in-app
                }
            } catch (e) {
                // If URL parsing fails, open externally as a safety measure
            }
            event.preventDefault();
            ipcRenderer.send('open-external-link', link.href);
        }
    });
});

// Handle keyboard shortcuts for zoom
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
        event.preventDefault(); // Prevent default scrolling
        if (event.deltaY < 0) {
            ipcRenderer.send('zoom-in');
        } else {
            ipcRenderer.send('zoom-out');
        }
    }
});
