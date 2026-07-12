const STORAGE_KEY = "lumen.flow.app.v3";
const DEFAULT_STATE = {
  cleanStreak: 0,
  lastCleanDay: null,
  urgeLogs: [],
  sessions: [],
  selectedSessionId: null,
  currentSession: null,
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  bestDistanceLabel: document.querySelector("#bestDistanceLabel"),
  cleanStreakLabel: document.querySelector("#cleanStreakLabel"),
  shieldStreakLabel: document.querySelector("#shieldStreakLabel"),
  liveStatePill: document.querySelector("#liveStatePill"),
  homeHeadline: document.querySelector("#homeHeadline"),
  homeSubtext: document.querySelector("#homeSubtext"),
  liveDistanceLabel: document.querySelector("#liveDistanceLabel"),
  livePaceLabel: document.querySelector("#livePaceLabel"),
  liveSpeedLabel: document.querySelector("#liveSpeedLabel"),
  liveElapsedLabel: document.querySelector("#liveElapsedLabel"),
  latestSessionTitle: document.querySelector("#latestSessionTitle"),
  latestSessionMeta: document.querySelector("#latestSessionMeta"),
  trackingStatusLabel: document.querySelector("#trackingStatusLabel"),
  activityTypeInput: document.querySelector("#activityTypeInput"),
  sessionForm: document.querySelector("#sessionForm"),
  pauseResumeBtn: document.querySelector("#pauseResumeBtn"),
  finishSessionBtn: document.querySelector("#finishSessionBtn"),
  discardSessionBtn: document.querySelector("#discardSessionBtn"),
  trackDistanceLabel: document.querySelector("#trackDistanceLabel"),
  trackSpeedLabel: document.querySelector("#trackSpeedLabel"),
  trackPaceLabel: document.querySelector("#trackPaceLabel"),
  trackElevationLabel: document.querySelector("#trackElevationLabel"),
  reviewCountLabel: document.querySelector("#reviewCountLabel"),
  reviewTitle: document.querySelector("#reviewTitle"),
  reviewMeta: document.querySelector("#reviewMeta"),
  sessionList: document.querySelector("#sessionList"),
  shieldPill: document.querySelector("#shieldPill"),
  cleanDayBtn: document.querySelector("#cleanDayBtn"),
  resetStreakBtn: document.querySelector("#resetStreakBtn"),
  urgeForm: document.querySelector("#urgeForm"),
  urgeLevelInput: document.querySelector("#urgeLevelInput"),
  triggerInput: document.querySelector("#triggerInput"),
  resetPlanTitle: document.querySelector("#resetPlanTitle"),
  resetPlanText: document.querySelector("#resetPlanText"),
  urgeLog: document.querySelector("#urgeLog"),
  tipsBtn: document.querySelector("#tipsBtn"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  panels: Array.from(document.querySelectorAll(".panel")),
  goButtons: Array.from(document.querySelectorAll("[data-go]")),
};

let state = loadState();
let watchId = null;
let liveMap = null;
let livePolyline = null;
let liveMarker = null;
let reviewMap = null;
let reviewPolyline = null;
let reviewMarker = null;
let tickHandle = null;

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
  window.setTimeout(() => {
    if (name === "track" && liveMap) liveMap.invalidateSize();
    if (name === "sessions" && reviewMap) reviewMap.invalidateSize();
  }, 120);
}

function formatToday() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDistance(meters) {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatSpeed(mps) {
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function formatPace(meters, elapsedSeconds) {
  if (!meters || !elapsedSeconds) return "0:00 /km";
  const secPerKm = elapsedSeconds / (meters / 1000);
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "0:00 /km";
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds} /km`;
}

function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function haversineMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earth * Math.asin(Math.sqrt(value));
}

function createSession(activityType) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    activityType,
    startedAt: now,
    elapsedSeconds: 0,
    distanceMeters: 0,
    currentSpeedMps: 0,
    maxSpeedMps: 0,
    elevationGain: 0,
    lastAltitude: null,
    lastSampleAt: null,
    status: "live",
    points: [],
  };
}

function getCurrentSession() {
  return state.currentSession;
}

function bestDistanceMeters() {
  return state.sessions.reduce((best, session) => Math.max(best, session.distanceMeters || 0), 0);
}

function latestSession() {
  return state.sessions[0] || null;
}

function selectedSession() {
  return state.sessions.find((session) => session.id === state.selectedSessionId) || latestSession();
}
function updateLiveMap(session) {
  if (!liveMap || !window.L) return;
  const latLngs = session.points.map((point) => [point.lat, point.lng]);
  livePolyline.setLatLngs(latLngs);
  if (latLngs.length) {
    const last = latLngs[latLngs.length - 1];
    liveMarker.setLatLng(last);
    if (!liveMap._hasCenteredOnce) {
      liveMap.setView(last, 17);
      liveMap._hasCenteredOnce = true;
    } else if (session.status === "live") {
      liveMap.panTo(last, { animate: true, duration: 0.5 });
    }
  }
}

function updateReviewMap(session) {
  if (!reviewMap || !window.L) return;
  if (!session || !session.points.length) {
    reviewPolyline.setLatLngs([]);
    return;
  }
  const latLngs = session.points.map((point) => [point.lat, point.lng]);
  reviewPolyline.setLatLngs(latLngs);
  reviewMarker.setLatLng(latLngs[latLngs.length - 1]);
  reviewMap.fitBounds(reviewPolyline.getBounds(), { padding: [20, 20] });
}

function renderSessionList() {
  if (!state.sessions.length) {
    els.sessionList.innerHTML = `<article class="session-item"><strong>No sessions yet</strong><span class="helper-text">Start a run or walk and finish it to save a route review here.</span></article>`;
    return;
  }

  els.sessionList.innerHTML = state.sessions.map((session) => {
    const active = session.id === (selectedSession()?.id || "") ? ' style="border-color: rgba(252, 76, 2, 0.35);"' : "";
    return `<article class="session-item"${active}><strong>${session.activityType} � ${formatDistance(session.distanceMeters)}</strong><div class="session-meta"><span>${formatElapsed(session.elapsedSeconds)}</span><span>${formatPace(session.distanceMeters, session.elapsedSeconds)}</span><span>${formatSpeed(session.maxSpeedMps)} max</span><span>${new Date(session.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div><button class="ghost-button" type="button" data-session-id="${session.id}">Review route</button></article>`;
  }).join("");

  Array.from(document.querySelectorAll("[data-session-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSessionId = button.dataset.sessionId;
      saveState();
      render();
      setPanel("sessions");
    });
  });
}

function renderUrges() {
  if (!state.urgeLogs.length) {
    els.urgeLog.innerHTML = `<article class="log-item"><strong>No urges logged</strong><span class="helper-text">Use this panel the moment an urge starts so you interrupt it early.</span></article>`;
    return;
  }

  els.urgeLog.innerHTML = state.urgeLogs.slice(0, 4).map((entry) => `<article class="log-item"><strong>${entry.level} urge</strong><span class="helper-text">${escapeHtml(entry.trigger)}</span><span class="helper-text">${entry.time}</span></article>`).join("");
}

function getEffectiveSpeed(session) {
  if (!session || session.status !== "live") return 0;
  if (!session.lastSampleAt) return 0;
  const secondsSinceSample = (Date.now() - session.lastSampleAt) / 1000;
  return secondsSinceSample > 4 ? 0 : session.currentSpeedMps || 0;
}

function render() {
  const session = getCurrentSession();
  const bestMeters = bestDistanceMeters();
  const latest = latestSession();
  const review = selectedSession();
  const effectiveSpeed = session ? getEffectiveSpeed(session) : 0;

  els.todayLabel.textContent = formatToday();
  els.bestDistanceLabel.textContent = formatDistance(bestMeters);
  els.cleanStreakLabel.textContent = `${state.cleanStreak} day${state.cleanStreak === 1 ? "" : "s"}`;
  els.shieldStreakLabel.textContent = `${state.cleanStreak} day${state.cleanStreak === 1 ? "" : "s"}`;
  els.shieldPill.textContent = state.cleanStreak >= 7 ? "Momentum up" : "Recovery mode";
  els.liveStatePill.textContent = session ? (session.status === "paused" ? "Paused" : "Live") : "Ready";
  els.homeHeadline.textContent = session ? `${session.activityType} session in progress` : "No active workout";
  els.homeSubtext.textContent = session ? `Tracking ${formatDistance(session.distanceMeters)} with pace and speed updating in real time.` : "Start a run or walk and the route will draw on the map automatically.";
  els.liveDistanceLabel.textContent = session ? formatDistance(session.distanceMeters) : "0.00 km";
  els.livePaceLabel.textContent = session ? formatPace(session.distanceMeters, session.elapsedSeconds) : "0:00 /km";
  els.liveSpeedLabel.textContent = formatSpeed(effectiveSpeed);
  els.liveElapsedLabel.textContent = session ? formatElapsed(session.elapsedSeconds) : "00:00";
  els.latestSessionTitle.textContent = latest ? `${latest.activityType} � ${formatDistance(latest.distanceMeters)}` : "No finished sessions yet";
  els.latestSessionMeta.textContent = latest ? `${formatElapsed(latest.elapsedSeconds)} � ${formatPace(latest.distanceMeters, latest.elapsedSeconds)} � ${new Date(latest.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Complete one session to see a saved route review.";
  els.trackingStatusLabel.textContent = session ? (session.status === "paused" ? "Paused" : "Tracking") : "Ready";
  els.trackDistanceLabel.textContent = session ? formatDistance(session.distanceMeters) : "0.00 km";
  els.trackSpeedLabel.textContent = formatSpeed(effectiveSpeed);
  els.trackPaceLabel.textContent = session ? formatPace(session.distanceMeters, session.elapsedSeconds) : "0:00 /km";
  els.trackElevationLabel.textContent = session ? `${Math.round(session.elevationGain)} m` : "0 m";
  els.pauseResumeBtn.disabled = !session;
  els.finishSessionBtn.disabled = !session;
  els.discardSessionBtn.disabled = !session;
  els.pauseResumeBtn.textContent = session && session.status === "paused" ? "Resume" : "Pause";
  els.reviewCountLabel.textContent = `${state.sessions.length} saved`;

  if (review) {
    els.reviewTitle.textContent = `${review.activityType} � ${formatDistance(review.distanceMeters)}`;
    els.reviewMeta.textContent = `${formatElapsed(review.elapsedSeconds)} � ${formatPace(review.distanceMeters, review.elapsedSeconds)} � ${formatSpeed(review.maxSpeedMps)} max � ${Math.round(review.elevationGain)} m climb`;
  } else {
    els.reviewTitle.textContent = "No session selected";
    els.reviewMeta.textContent = "Finish a run or walk to save the route and review it here.";
  }

  renderSessionList();
  renderUrges();
  if (session) updateLiveMap(session);
  if (review) updateReviewMap(review);
}

function startTick() {
  if (tickHandle) return;
  tickHandle = window.setInterval(() => {
    const session = getCurrentSession();
    if (!session || session.status !== "live") return;
    session.elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
    saveState();
    render();
  }, 1000);
}

function stopTick() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}
function startWatcher() {
  if (!("geolocation" in navigator)) {
    window.alert("Your browser does not support GPS location tracking.");
    return false;
  }

  watchId = navigator.geolocation.watchPosition(
    handlePosition,
    () => {
      const session = getCurrentSession();
      if (session) session.status = "paused";
      saveState();
      render();
      window.alert("Location permission was blocked or GPS could not lock. Allow location and try again.");
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
  return true;
}

function stopWatcher() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function handlePosition(position) {
  const session = getCurrentSession();
  if (!session || session.status !== "live") return;

  const point = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    altitude: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp || Date.now(),
  };

  const previous = session.points[session.points.length - 1];
  if (previous) {
    const segmentMeters = haversineMeters(previous, point);
    const seconds = Math.max(1, (point.timestamp - previous.timestamp) / 1000);
    const derivedSpeed = segmentMeters / seconds;
    const rawSpeed = Number.isFinite(position.coords.speed) && position.coords.speed >= 0 ? position.coords.speed : derivedSpeed;
    const speed = rawSpeed < 0.35 ? 0 : rawSpeed;

    if (segmentMeters < 250 && point.accuracy < 100) {
      session.distanceMeters += segmentMeters;
    }

    if (point.altitude !== null && session.lastAltitude !== null && point.altitude > session.lastAltitude) {
      session.elevationGain += point.altitude - session.lastAltitude;
    }

    session.currentSpeedMps = speed;
    session.maxSpeedMps = Math.max(session.maxSpeedMps, speed);
  }

  session.lastAltitude = point.altitude;
  session.lastSampleAt = Date.now();
  session.points.push(point);
  session.elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  saveState();
  render();
}

function beginSession(activityType) {
  if (getCurrentSession()) return;
  state.currentSession = createSession(activityType);
  saveState();
  if (liveMap) liveMap._hasCenteredOnce = false;
  render();
  if (startWatcher()) {
    startTick();
    setPanel("track");
  }
}

function pauseSession() {
  const session = getCurrentSession();
  if (!session) return;
  if (session.status === "live") {
    session.status = "paused";
    session.currentSpeedMps = 0;
    stopWatcher();
    saveState();
    render();
    return;
  }
  session.status = "live";
  saveState();
  render();
  startWatcher();
}

function finishSession() {
  const session = getCurrentSession();
  if (!session) return;
  stopWatcher();
  stopTick();
  session.status = "finished";
  session.currentSpeedMps = 0;
  session.elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  state.sessions.unshift(session);
  state.selectedSessionId = session.id;
  state.currentSession = null;
  saveState();
  render();
  setPanel("sessions");
}

function discardSession() {
  stopWatcher();
  stopTick();
  state.currentSession = null;
  saveState();
  if (livePolyline) livePolyline.setLatLngs([]);
  render();
}

function buildResetPlan(level) {
  if (level === "High") {
    return {
      title: "Interrupt hard and move now",
      text: "Put the phone out of reach, leave the room, do 20 fast bodyweight reps, and start a short walk before your mind starts bargaining.",
    };
  }
  if (level === "Medium") {
    return {
      title: "Break the slide early",
      text: "Stand up, drink water, switch rooms, and begin a focused task or a 10 minute walk immediately.",
    };
  }
  return {
    title: "Keep the day clean",
    text: "Close passive feeds, breathe slowly for one minute, and move straight into a useful action.",
  };
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function initMaps() {
  if (!window.L) return;

  liveMap = L.map("liveMap", { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(liveMap);
  liveMap.setView([20.5937, 78.9629], 5);
  livePolyline = L.polyline([], { color: "#fc4c02", weight: 5 }).addTo(liveMap);
  liveMarker = L.circleMarker([20.5937, 78.9629], {
    radius: 7,
    color: "#fc4c02",
    fillColor: "#ffffff",
    fillOpacity: 1,
    weight: 3,
  }).addTo(liveMap);

  reviewMap = L.map("reviewMap", { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(reviewMap);
  reviewMap.setView([20.5937, 78.9629], 5);
  reviewPolyline = L.polyline([], { color: "#0ea5a4", weight: 5 }).addTo(reviewMap);
  reviewMarker = L.circleMarker([20.5937, 78.9629], {
    radius: 7,
    color: "#0ea5a4",
    fillColor: "#ffffff",
    fillOpacity: 1,
    weight: 3,
  }).addTo(reviewMap);
}

els.navItems.forEach((item) => item.addEventListener("click", () => setPanel(item.dataset.panelTarget)));
els.goButtons.forEach((button) => button.addEventListener("click", () => setPanel(button.dataset.go)));

els.sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  beginSession(els.activityTypeInput.value);
});

els.pauseResumeBtn.addEventListener("click", pauseSession);
els.finishSessionBtn.addEventListener("click", finishSession);
els.discardSessionBtn.addEventListener("click", discardSession);

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
  els.triggerInput.value = "";
});

els.tipsBtn.addEventListener("click", () => {
  window.alert("Use Track to start a real session, keep location permission on, and finish the workout to save a route review. Use Shield the moment an urge starts, not after it builds.");
});

initMaps();
render();
setPanel("home");

if (state.currentSession && state.currentSession.status === "live") {
  startWatcher();
  startTick();
}

window.addEventListener("beforeunload", () => {
  stopWatcher();
  stopTick();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}