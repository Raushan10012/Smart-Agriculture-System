// Live Telemetry & Irrigation Actuation Controller

let activeDevice = null;
let telemetryInterval = null;
let chartPoints = [];

document.addEventListener("DOMContentLoaded", () => {
  initTelemetryView();
});

function initTelemetryView() {
  const devices = getDevices();
  const emptyState = document.getElementById("telemetry-empty-state");
  const mainView = document.getElementById("telemetry-main-view");
  const deviceSelect = document.getElementById("telemetry-device-select");

  if (devices.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    if (mainView) mainView.classList.add("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (mainView) mainView.classList.remove("hidden");

  // Populate Device Selector
  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get("device");

  if (requestedId) {
    activeDevice = devices.find(d => d.id === requestedId) || devices[0];
  } else {
    activeDevice = getActiveDevice() || devices[0];
  }

  if (deviceSelect) {
    deviceSelect.innerHTML = devices.map(d => `
      <option value="${d.id}" ${d.id === activeDevice.id ? 'selected' : ''}>
        ${d.name} (${d.zone})
      </option>
    `).join("");

    deviceSelect.addEventListener("change", (e) => {
      const selected = devices.find(d => d.id === e.target.value);
      if (selected) {
        activeDevice = selected;
        setActiveDevice(selected.id);
        renderActiveDeviceTelemetry();
      }
    });
  }

  renderActiveDeviceTelemetry();
  startTelemetryStreaming();
}

function renderActiveDeviceTelemetry() {
  if (!activeDevice) return;

  document.getElementById("t-dev-name").textContent = activeDevice.name;
  document.getElementById("t-dev-zone").textContent = activeDevice.zone;
  document.getElementById("t-dev-mac").textContent = activeDevice.mac || activeDevice.id;
  document.getElementById("t-dev-protocol").textContent = activeDevice.protocol;

  updateGaugeValues(activeDevice.moisture, activeDevice.temp, activeDevice.humidity);
  evaluatePumpStatus(activeDevice.moisture);

  const slider = document.getElementById("t-moist-slider");
  if (slider) slider.value = Math.round(activeDevice.moisture);

  const threshInput = document.getElementById("t-thresh-input");
  if (threshInput) threshInput.value = activeDevice.moistureThreshold || 30;

  // Initialize initial chart points
  chartPoints = [];
  for (let i = 0; i < 15; i++) {
    const jitter = (Math.random() - 0.5) * 2;
    chartPoints.push(Math.max(15, Math.min(65, activeDevice.moisture + jitter)));
  }
  redrawTelemetryChart();
}

function updateGaugeValues(moist, temp, hum) {
  document.getElementById("val-moist").textContent = moist.toFixed(1) + "%";
  document.getElementById("val-temp").textContent = temp.toFixed(1) + " °C";
  document.getElementById("val-hum").textContent = hum.toFixed(1) + "%";

  const moistStatus = document.getElementById("status-moist-badge");
  if (moistStatus) {
    if (moist < (activeDevice.moistureThreshold || 30)) {
      moistStatus.textContent = "Deficit (Dry Soil)";
      moistStatus.className = "text-[10px] px-2 py-0.5 rounded font-semibold bg-red-950 text-red-400 border border-red-800/40";
    } else if (moist > 55) {
      moistStatus.textContent = "Saturated";
      moistStatus.className = "text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-950 text-blue-400 border border-blue-800/40";
    } else {
      moistStatus.textContent = "Optimal Range";
      moistStatus.className = "text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-950 text-blue-400 border border-slate-800/40";
    }
  }
}

function evaluatePumpStatus(moist) {
  const threshold = activeDevice.moistureThreshold || 30.0;
  const isAuto = activeDevice.autoIrrigate !== false;

  const pumpBadge = document.getElementById("pump-active-badge");
  const pumpIcon = document.getElementById("pump-status-icon");
  const pumpText = document.getElementById("pump-status-text");

  if (isAuto && moist < threshold) {
    // Turn pump ON
    activeDevice.pumpState = true;
    pumpBadge.textContent = "PUMP ACTIVE (IRRIGATING)";
    pumpBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-950 text-blue-400 border border-blue-500 animate-pulse";
    pumpIcon.textContent = "🚿";
    pumpText.textContent = `Automated irrigation triggered: Moisture (${moist.toFixed(1)}%) < Threshold (${threshold}%).`;
  } else if (!activeDevice.pumpState) {
    // Pump OFF
    pumpBadge.textContent = "PUMP STANDBY (OFF)";
    pumpBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700";
    pumpIcon.textContent = "💧";
    pumpText.textContent = `Moisture levels sufficient (${moist.toFixed(1)}%). Relay circuit de-energized.`;
  }
}

function handleSliderMoistureInput(val) {
  if (!activeDevice) return;
  const newMoist = parseFloat(val);
  activeDevice.moisture = newMoist;
  updateDevice(activeDevice.id, { moisture: newMoist });

  document.getElementById("slider-readout").textContent = newMoist + "%";
  updateGaugeValues(newMoist, activeDevice.temp, activeDevice.humidity);
  evaluatePumpStatus(newMoist);
}

function updateThresholdSetting(val) {
  if (!activeDevice) return;
  const thresh = parseFloat(val) || 30.0;
  activeDevice.moistureThreshold = thresh;
  updateDevice(activeDevice.id, { moistureThreshold: thresh });
  evaluatePumpStatus(activeDevice.moisture);
  showToast(`Irrigation threshold set to ${thresh}%`, "info");
}

function togglePumpManual() {
  if (!activeDevice) return;
  activeDevice.pumpState = !activeDevice.pumpState;
  updateDevice(activeDevice.id, { pumpState: activeDevice.pumpState });

  const btn = document.getElementById("btn-manual-toggle");
  if (activeDevice.pumpState) {
    btn.textContent = "Stop Pump Manually";
    btn.className = "px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow transition";
    evaluatePumpStatus(15); // force display
  } else {
    btn.textContent = "Force Pump ON (Manual Test)";
    btn.className = "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition";
    evaluatePumpStatus(activeDevice.moisture);
  }
}

// Continuous Live Telemetry Streaming
function startTelemetryStreaming() {
  if (telemetryInterval) clearInterval(telemetryInterval);

  telemetryInterval = setInterval(() => {
    if (!activeDevice) return;

    // Small natural fluctuations
    let delta = (Math.random() - 0.5) * 0.4;
    // If pump is active, moisture increases gradually
    if (activeDevice.pumpState) {
      delta = 0.5;
      if (activeDevice.moisture >= 48) activeDevice.pumpState = false; // Turn off once saturated
    } else {
      delta -= 0.1; // natural evaporation
    }

    activeDevice.moisture = Math.max(15, Math.min(65, activeDevice.moisture + delta));
    activeDevice.temp = Math.max(18, Math.min(35, activeDevice.temp + (Math.random() - 0.5) * 0.15));

    updateDevice(activeDevice.id, {
      moisture: activeDevice.moisture,
      temp: activeDevice.temp,
      lastSeen: "Just now"
    });

    updateGaugeValues(activeDevice.moisture, activeDevice.temp, activeDevice.humidity);
    evaluatePumpStatus(activeDevice.moisture);

    // Append to live chart
    chartPoints.push(activeDevice.moisture);
    if (chartPoints.length > 25) chartPoints.shift();
    redrawTelemetryChart();

  }, 3000);
}

function redrawTelemetryChart() {
  const poly = document.getElementById("live-chart-poly");
  if (!poly) return;

  // ViewBox: 0 0 320 120
  // Y: 15% (110) to 65% (10)
  const xStep = 320 / Math.max(1, chartPoints.length - 1);
  const coords = chartPoints.map((val, idx) => {
    const x = idx * xStep;
    const norm = (val - 15) / 50; // 0 to 1
    const y = 110 - norm * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  poly.setAttribute("points", coords.join(" "));
}
