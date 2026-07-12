const STORAGE_KEY = "lumen.flow.app.v2";
const DEFAULT_ROUTE = [
  { x: 24, y: 260 },
  { x: 60, y: 210 },
  { x: 92, y: 224 },
  { x: 126, y: 168 },
  { x: 176, y: 144 },
  { x: 220, y: 96 },
  { x: 278, y: 62 },
];

const DEFAULT_STATE = {
  routePoints: DEFAULT_ROUTE,
  activityType: "Run",
  durationMinutes: 45,
  heartRate: 138,
  elevationGain: 120,
  distanceKm: 6.4,
  cleanStreak: 0,
  urgeLogs: [],
  lastCleanDay: null,
  gpsTracking: false,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  todayLabel: $("#todayLabel"),
  streakLabel: $("#streakLabel"),
  shieldStreakLabel: $("#shieldStreakLabel"),
  distanceLabel: $("#distanceLabel"),
  readinessPill: $("#readinessPill"),
  routeHeadline: $("#routeHeadline"),
  defenseHeadline: $("#defenseHeadline"),
  paceLabel: $("#paceLabel"),
  elevationLabel: $("#elevationLabel"),
  heartLabel: $("#heartLabel"),
  urgeLabel: $("#urgeLabel"),
  shieldPill: $("#shieldPill"),
  trackingPill: $("#trackingPill"),
  homeRouteLine: $("#homeRouteLine"),
  routeLine: $("#routeLine"),
  routeDots: $("#routeDots"),
  mapStage: $("#mapStage"),
  mapSvg: $("#mapSvg"),
  gpsToggleBtn: $("#gpsToggleBtn"),
  clearRouteBtn: $("#clearRouteBtn"),
  metricsForm: $("#metricsForm"),
  activityTypeInput: $("#activityTypeInput"),
  durationInput: $("#durationInput"),
  heartRateInput: $("#heartRateInput"),
  elevationInput: $("#elevationInput"),
  cleanDayBtn: $("#cleanDayBtn"),
  resetStreakBtn: $("#resetStreakBtn"),
  urgeForm: $("#urgeForm"),
  urgeLevelInput: $("#urgeLevelInput"),
  triggerInput: $("#triggerInput"),
  resetPlanTitle: $("#resetPlanTitle"),
  resetPlanText: $("#resetPlanText"),
  urgeLog: $("#urgeLog"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  panels: Array.from(document.querySelectorAll(".panel")),
  buttonsToPanel: Array.from(document.querySelectorAll("[data-go]")),
  settingsBtn: $("#settingsBtn"),
};

let state = loadState();
let watchId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setPanel(name) {
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.panelTarget === name));
}

function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function computeDistance(points) {
  if (points.length < 2) return 0;
  let pixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    pixels += Math.hypot(next.x - prev.x, next.y - prev.y);
  }
  return Number((pixels * 0.018).toFixed(1));
}

function computePace(distanceKm, durationMinutes) {
  if (!distanceKm || !durationMinutes) return "0:00 /km";
  const pace = durationMinutes / distanceKm;
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

function readinessLabel() {
  if (state.cleanStreak >= 14 && state.distanceKm >= 8) return "Locked in";
  if (state.cleanStreak >= 7 || state.distanceKm >= 5) return "Rising";
  return "Building";
}

function urgeStatus() {
  const last = state.urgeLogs[0];
  return last ? last.level : "Low";
}

function defenseHeadline() {
  const last = state.urgeLogs[0];
  if (!last) return "No urges logged yet";
  return `Last trigger: ${last.trigger}`;
}

function activityHeadline() {
  if (state.routePoints.length < 2) return "Ready to track your next session";
  return `${state.activityType} route with ${state.routePoints.length} tracked points`;
}

function routePolyline(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function renderRoute() {
  const route = routePolyline(state.routePoints);
  els.routeLine.setAttribute("points", route);
  els.homeRouteLine.setAttribute("points", route);
  els.routeDots.innerHTML = state.routePoints
    .map((point) => `<circle class="route-point" cx="${point.x}" cy="${point.y}" r="6"></circle>`)
    .join("");
}

function renderLogs() {
  if (!state.urgeLogs.length) {
    els.urgeLog.innerHTML = `
      <article class="log-item">
        <strong>No setbacks logged</strong>
        <span class="helper-text">When an urge hits, log it quickly so the app can suggest a reset pattern.</span>
      </article>
    `;
    return;
  }

  els.urgeLog.innerHTML = state.urgeLogs
    .slice(0, 4)
    .map(
      (entry) => `
        <article class="log-item">
          <strong>${entry.level} urge</strong>
          <span class="helper-text">${escapeHtml(entry.trigger)}</span>
          <span class="helper-text">${entry.time}</span>
        </article>
      `
    )
    .join("");
}

function render() {
  state.distanceKm = computeDistance(state.routePoints);

  els.todayLabel.textContent = formatToday();
  els.streakLabel.textContent = `${state.cleanStreak} day${state.cleanStreak === 1 ? "" : "s"}`;
  els.shieldStreakLabel.textContent = `${state.cleanStreak} day${state.cleanStreak === 1 ? "" : "s"}`;
  els.distanceLabel.textContent = `${state.distanceKm.toFixed(1)} km`;
  els.readinessPill.textContent = readinessLabel();
  els.routeHeadline.textContent = activityHeadline();
  els.defenseHeadline.textContent = defenseHeadline();
  els.paceLabel.textContent = computePace(state.distanceKm, Number(state.durationMinutes));
  els.elevationLabel.textContent = `${state.elevationGain} m`;
  els.heartLabel.textContent = `${state.heartRate} bpm`;
  els.urgeLabel.textContent = urgeStatus();
  els.shieldPill.textContent = state.cleanStreak >= 7 ? "Momentum up" : "Recovery mode";
  els.trackingPill.textContent = state.gpsTracking ? "GPS active" : "Manual route";
  els.gpsToggleBtn.textContent = state.gpsTracking ? "Stop GPS" : "Start GPS";

  els.activityTypeInput.value = state.activityType;
  els.durationInput.value = state.durationMinutes;
  els.heartRateInput.value = state.heartRate;
  els.elevationInput.value = state.elevationGain;

  renderRoute();
  renderLogs();
}

function addPoint(x, y) {
  state.routePoints.push({
    x: Math.max(12, Math.min(308, Math.round(x))),
    y: Math.max(12, Math.min(308, Math.round(y))),
  });
  saveState();
  render();
}

function getMapPoint(event) {
  const rect = els.mapSvg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 320;
  const y = ((event.clientY - rect.top) / rect.height) * 320;
  return { x, y };
}

function buildResetPlan(level) {
  if (level === "High") {
    return {
      title: "Interrupt hard and move now",
      text: "Step away from the screen, put your phone out of reach, do 20 bodyweight reps, and message someone safe before you negotiate with the urge.",
    };
  }

  if (level === "Medium") {
    return {
      title: "Break the boredom spiral",
      text: "Stand up, switch rooms, drink water, and start a 10 minute walk or workout before the urge grows teeth.",
    };
  }

  return {
    title: "Keep the edge clean",
    text: "Close passive feeds, set one clear task, and stay in motion so the urge does not get room to build.",
  };
}

function logUrge(level, trigger) {
  const plan = buildResetPlan(level);
  state.urgeLogs.unshift({
    level,
    trigger,
    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  });
  els.resetPlanTitle.textContent = plan.title;
  els.resetPlanText.textContent = plan.text;
  saveState();
  render();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toggleGps() {
  if (!("geolocation" in navigator)) {
    window.alert("Geolocation is not available in this browser.");
    return;
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    state.gpsTracking = false;
    saveState();
    render();
    return;
  }

  state.gpsTracking = true;
  saveState();
  render();

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const x = 20 + ((position.coords.longitude + 180) / 360) * 280;
      const y = 300 - ((position.coords.latitude + 90) / 180) * 280;
      addPoint(x, y);
    },
    () => {
      state.gpsTracking = false;
      watchId = null;
      saveState();
      render();
      window.alert("Location access was blocked, so the app stayed in manual route mode.");
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => setPanel(item.dataset.panelTarget));
});

els.buttonsToPanel.forEach((button) => {
  button.addEventListener("click", () => setPanel(button.dataset.go));
});

els.mapStage.addEventListener("click", (event) => {
  const point = getMapPoint(event);
  addPoint(point.x, point.y);
});

els.clearRouteBtn.addEventListener("click", () => {
  state.routePoints = [];
  saveState();
  render();
});

els.gpsToggleBtn.addEventListener("click", toggleGps);

els.metricsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.activityType = els.activityTypeInput.value;
  state.durationMinutes = Number(els.durationInput.value);
  state.heartRate = Number(els.heartRateInput.value);
  state.elevationGain = Number(els.elevationInput.value);
  saveState();
  render();
});

els.cleanDayBtn.addEventListener("click", () => {
  const today = new Date().toDateString();
  if (state.lastCleanDay !== today) {
    state.cleanStreak += 1;
    state.lastCleanDay = today;
    saveState();
    render();
  }
});

els.resetStreakBtn.addEventListener("click", () => {
  state.cleanStreak = 0;
  state.lastCleanDay = null;
  saveState();
  render();
});

els.urgeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const level = els.urgeLevelInput.value;
  const trigger = els.triggerInput.value.trim() || "Unspecified trigger";
  logUrge(level, trigger);
  els.triggerInput.value = "";
  setPanel("shield");
});

els.settingsBtn.addEventListener("click", () => {
  window.alert(
    "Quick tips: use Track to draw or capture a route, update your metrics after each session, and use Shield the moment an urge starts instead of after it grows."
  );
});

render();
setPanel("home");

window.addEventListener("beforeunload", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}