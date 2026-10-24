// Shared State and Core Platform Utilities

const APP_STORAGE_KEY = "agri_smart_devices";
const TELEMETRY_STORAGE_KEY = "agri_smart_telemetry";

// Default initial devices if user hasn't added any yet
const DEFAULT_INITIAL_DEVICES = [
  {
    id: "DEV-ESP32-01",
    name: "Greenhouse Alpha - Soil Probe",
    type: "Soil & Climate Multi-Probe",
    protocol: "WiFi / MQTT",
    zone: "Zone A (North Greenhouse)",
    mac: "24:6F:28:B4:72:A0",
    status: "online", // online, standby, offline
    moisture: 32.4,
    temp: 24.2,
    humidity: 65.0,
    npk: { n: 42, p: 28, k: 35 },
    pumpState: false,
    autoIrrigate: true,
    moistureThreshold: 30.0,
    battery: 92,
    lastSeen: "Just now"
  },
  {
    id: "DEV-RPI-02",
    name: "Open Field - Potato Plot Node",
    type: "Edge Computing & Vision Gateway",
    protocol: "4G-LTE / LoRaWAN",
    zone: "Zone B (South Field)",
    mac: "DC:A6:32:18:99:E4",
    status: "online",
    moisture: 26.8, // Low moisture, triggering pump
    temp: 28.5,
    humidity: 52.0,
    npk: { n: 35, p: 20, k: 30 },
    pumpState: true,
    autoIrrigate: true,
    moistureThreshold: 30.0,
    battery: 88,
    lastSeen: "1 min ago"
  }
];

// Initialize Storage
function getDevices() {
  const data = localStorage.getItem(APP_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_DEVICES));
    return DEFAULT_INITIAL_DEVICES;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveDevices(devices) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(devices));
}

function addDevice(device) {
  const devices = getDevices();
  devices.push(device);
  saveDevices(devices);
  showToast(`Device "${device.name}" registered successfully!`, "success");
}

function removeDevice(id) {
  let devices = getDevices();
  devices = devices.filter(d => d.id !== id);
  saveDevices(devices);
  showToast("Device deleted.", "info");
}

function updateDevice(id, updates) {
  const devices = getDevices();
  const idx = devices.findIndex(d => d.id === id);
  if (idx !== -1) {
    devices[idx] = { ...devices[idx], ...updates };
    saveDevices(devices);
  }
}

function getActiveDevice() {
  const devices = getDevices();
  const activeId = localStorage.getItem("agri_active_device_id");
  if (activeId) {
    const found = devices.find(d => d.id === activeId);
    if (found) return found;
  }
  return devices.length > 0 ? devices[0] : null;
}

function setActiveDevice(id) {
  localStorage.setItem("agri_active_device_id", id);
}

// Toast notification helper
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "warn") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
