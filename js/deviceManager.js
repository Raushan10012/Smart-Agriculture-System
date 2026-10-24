// IoT Device Manager: Registration, Pairing, and Hardware Integration

document.addEventListener("DOMContentLoaded", () => {
  renderDeviceGrid();

  const addForm = document.getElementById("add-device-form");
  if (addForm) {
    addForm.addEventListener("submit", handleAddDeviceSubmit);
  }
});

function renderDeviceGrid() {
  const container = document.getElementById("device-list-container");
  const countBadge = document.getElementById("device-count-badge");
  if (!container) return;

  const devices = getDevices();
  if (countBadge) countBadge.textContent = `${devices.length} Paired`;

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-[#0a0f1d]/50">
        <div class="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center text-3xl mb-3">
          📡
        </div>
        <h3 class="text-base font-bold text-white">No Sensor Devices Connected</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Add an ESP32 soil probe, edge gateway, or weather station to begin live measurement.
        </p>
        <button onclick="openAddDeviceModal()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow transition">
          + Add Your First Device
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = devices.map(d => `
    <div class="bg-[#0a0f1d] border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <span class="text-xs font-bold text-white block">${d.name}</span>
            <span class="text-[11px] text-slate-400 block">${d.type}</span>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
            d.status === 'online' ? 'bg-slate-950 text-blue-400 border border-blue-500/40' :
            d.status === 'standby' ? 'bg-amber-950 text-amber-400 border border-amber-500/40' :
            'bg-slate-800 text-slate-400 border border-slate-700'
          }">
            ${d.status === 'online' ? '● Online' : d.status === 'standby' ? '◐ Standby' : '○ Offline'}
          </span>
        </div>

        <div class="space-y-1.5 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
          <div class="flex justify-between">
            <span>Hardware ID / MAC:</span>
            <span class="font-mono-code text-slate-200">${d.mac || d.id}</span>
          </div>
          <div class="flex justify-between">
            <span>Farm Zone:</span>
            <span class="text-slate-200">${d.zone || 'Unassigned'}</span>
          </div>
          <div class="flex justify-between">
            <span>Protocol:</span>
            <span class="text-slate-200">${d.protocol}</span>
          </div>
          <div class="flex justify-between">
            <span>Last Reading:</span>
            <span class="text-blue-400 font-semibold">${d.moisture.toFixed(1)}% Moisture</span>
          </div>
        </div>
      </div>

      <div class="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <a href="telemetry.html?device=${d.id}" class="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold transition border border-blue-500/30">
          📊 View Telemetry
        </a>
        <div class="flex gap-1.5">
          <button onclick="simulateDevicePulse('${d.id}')" title="Send test ping" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition">
            🔄
          </button>
          <button onclick="confirmRemoveDevice('${d.id}')" title="Delete device" class="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 text-xs transition">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

// Modal open & close
function openAddDeviceModal() {
  const modal = document.getElementById("add-device-modal");
  if (modal) modal.classList.remove("hidden");
  generateRandomMac();
}

function closeAddDeviceModal() {
  const modal = document.getElementById("add-device-modal");
  if (modal) modal.classList.add("hidden");
}

function generateRandomMac() {
  const hex = "0123456789ABCDEF";
  let mac = "";
  for (let i = 0; i < 6; i++) {
    mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    if (i < 5) mac += ":";
  }
  const macInput = document.getElementById("device-mac");
  if (macInput) macInput.value = mac;
}

// Add Device Submission
function handleAddDeviceSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("device-name").value.trim();
  const type = document.getElementById("device-type").value;
  const protocol = document.getElementById("device-protocol").value;
  const zone = document.getElementById("device-zone").value.trim() || "Field Zone 1";
  const mac = document.getElementById("device-mac").value.trim();
  const threshold = parseFloat(document.getElementById("device-threshold").value) || 30.0;

  if (!name) {
    showToast("Please provide a device name.", "warn");
    return;
  }

  const newId = "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const initialMoisture = 28 + Math.random() * 15; // Realistic initial reading

  const newDevice = {
    id: newId,
    name: name,
    type: type,
    protocol: protocol,
    zone: zone,
    mac: mac,
    status: "online",
    moisture: parseFloat(initialMoisture.toFixed(1)),
    temp: parseFloat((22 + Math.random() * 6).toFixed(1)),
    humidity: parseFloat((55 + Math.random() * 18).toFixed(1)),
    npk: { n: 40, p: 25, k: 30 },
    pumpState: initialMoisture < threshold,
    autoIrrigate: true,
    moistureThreshold: threshold,
    battery: 100,
    lastSeen: "Just now"
  };

  addDevice(newDevice);
  setActiveDevice(newId);
  closeAddDeviceModal();
  renderDeviceGrid();

  // Show Pairing Token Modal
  showPairingCredentials(newDevice);
}

function showPairingCredentials(device) {
  const credModal = document.getElementById("credentials-modal");
  if (!credModal) return;

  credModal.classList.remove("hidden");
  document.getElementById("cred-device-name").textContent = device.name;
  document.getElementById("cred-device-id").textContent = device.id;
  document.getElementById("cred-mqtt-topic").textContent = `farm/${device.id}/telemetry`;

  // Sample Arduino code
  const arduinoCode = `// ESP32 Soil Sensor Telemetry Publisher
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.100"; // Edge Gateway IP
const char* topic = "farm/${device.id}/telemetry";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Read Capacitive Soil Moisture Sensor (ADC on GPIO 34)
  int rawADC = analogRead(34);
  float moisture = map(rawADC, 3100, 1250, 0, 100);

  String payload = "{\\"device_id\\":\\"${device.id}\\",\\"moisture\\":" + String(moisture) + "}";
  client.publish(topic, payload.c_str());
  delay(10000); // Send every 10s
}`;

  const codeBox = document.getElementById("cred-code-snippet");
  if (codeBox) codeBox.textContent = arduinoCode;
}

function closeCredentialsModal() {
  const credModal = document.getElementById("credentials-modal");
  if (credModal) credModal.classList.add("hidden");
}

function simulateDevicePulse(id) {
  const devices = getDevices();
  const d = devices.find(x => x.id === id);
  if (!d) return;

  const newMoist = Math.max(18, Math.min(65, d.moisture + (Math.random() * 4 - 2)));
  const newTemp = Math.max(18, Math.min(38, d.temp + (Math.random() * 1.5 - 0.7)));

  updateDevice(id, {
    moisture: parseFloat(newMoist.toFixed(1)),
    temp: parseFloat(newTemp.toFixed(1)),
    status: "online",
    lastSeen: "Just now"
  });

  renderDeviceGrid();
  showToast(`Received packet from ${d.name}: ${newMoist.toFixed(1)}% moisture`, "success");
}

function confirmRemoveDevice(id) {
  if (confirm("Are you sure you want to delete this device?")) {
    removeDevice(id);
    renderDeviceGrid();
  }
}
