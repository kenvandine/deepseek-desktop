const { ipcRenderer } = require('electron');

function updateNetworkStatus() {
    console.log(`Sending network status: ${navigator.onLine ? 'online' : 'offline'}`);
    console.log("updateNetworkStatus");
    ipcRenderer.send('network-status', navigator.onLine);
}

// Initial check
updateNetworkStatus();

// Listen for online/offline events
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
