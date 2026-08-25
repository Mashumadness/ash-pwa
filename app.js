/* ==========================================================================
   JavaScript Application Logic for Pokémon Advanced PWA
   Controls reproduction, local storage persistence, filters and SW
   ========================================================================== */

// Application State
let seasons = [];           // metadata from seasons.json
let activeSeason = null;    // current season object
let episodes = [];          // episodes of the active season
let seenEpisodes = new Set(); // keys: "seasonNumber-episodeNumber"
let episodeProgress = {};     // keys: "seasonNumber-episodeNumber" → percentage
let activeEpisode = null;
let currentFilter = "all"; // "all" | "pending" | "seen"
let searchQuery = "";
let lastProgressSaveTime = 0;
let autoplayEnabled = false;
let autoplayCancelled = false;

// DOM Elements
const episodeListEl = document.getElementById("episode-list");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");
const filterAllBtn = document.getElementById("filter-all");
const filterPendingBtn = document.getElementById("filter-pending");
const filterSeenBtn = document.getElementById("filter-seen");

const videoPlaceholder = document.getElementById("video-placeholder");
const mainVideo = document.getElementById("main-video");
const videoSource = document.getElementById("video-source");
const videoWrapper = mainVideo.closest(".video-wrapper");

const episodeDetails = document.getElementById("episode-details");
const detailNumber = document.getElementById("detail-number");
const detailTitle = document.getElementById("detail-title");
const btnToggleSeen = document.getElementById("btn-toggle-seen");
const btnOriginalLink = document.getElementById("btn-original-link");
const detailDescription = document.getElementById("detail-description");

const progressText = document.getElementById("progress-text");
const progressBarFill = document.getElementById("progress-bar-fill");

const autoplayToggleBtn = document.getElementById("autoplay-toggle");
const autoplayOverlay = document.getElementById("autoplay-overlay");
const autoplayNextThumb = document.getElementById("autoplay-next-thumb");
const autoplayNextTitle = document.getElementById("autoplay-next-title");
const autoplayCountdownFill = document.getElementById("autoplay-countdown-fill");
const autoplayCountdownText = document.getElementById("autoplay-countdown-text");
const autoplayCancelBtn = document.getElementById("autoplay-cancel-btn");

const seasonPickerScreen = document.getElementById("season-picker-screen");
const seasonGrid = document.getElementById("season-grid");
const mainAppScreen = document.getElementById("main-app-screen");
const backToSeasonsBtn = document.getElementById("back-to-seasons-btn");
const sidebarSeasonLogo = document.getElementById("sidebar-season-logo");
const sidebarSeasonLabel = document.getElementById("sidebar-season-label");

// Initialize Application
async function init() {
  // 1. Register Service Worker
  registerServiceWorker();

  // Seed initial history state so Android back button has somewhere to go
  history.replaceState({ screen: "picker" }, "");

  // 2. Load persisted state from localStorage (migrate old format if needed)
  migrateLocalStorage();
  loadSeenEpisodes();
  loadEpisodeProgress();
  loadAutoplayState();

  // 3. Load season index
  try {
    const response = await fetch("./seasons.json");
    if (!response.ok) throw new Error("No se pudo cargar seasons.json");
    seasons = await response.json();
    renderSeasonPicker();
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
  }

  // 4. Set Up Event Listeners
  setupEventListeners();
}

// Migrate old localStorage format (flat episode numbers) to new "season-episode" keys
function migrateLocalStorage() {
  const oldSeen = localStorage.getItem("pokemon_seen_episodes");
  const oldProgress = localStorage.getItem("pokemon_episode_progress");
  const migrated = localStorage.getItem("pokemon_migrated_v2");
  if (migrated) return;

  if (oldSeen) {
    try {
      const arr = JSON.parse(oldSeen);
      // If values are plain numbers (old format), prefix with "6-"
      if (arr.length > 0 && typeof arr[0] === "number") {
        const newArr = arr.map((n) => `6-${n}`);
        localStorage.setItem("pokemon_seen_episodes", JSON.stringify(newArr));
      }
    } catch (e) { /* ignore */ }
  }

  if (oldProgress) {
    try {
      const obj = JSON.parse(oldProgress);
      const keys = Object.keys(obj);
      if (keys.length > 0 && !keys[0].includes("-")) {
        const newObj = {};
        keys.forEach((k) => { newObj[`6-${k}`] = obj[k]; });
        localStorage.setItem("pokemon_episode_progress", JSON.stringify(newObj));
      }
    } catch (e) { /* ignore */ }
  }

  localStorage.setItem("pokemon_migrated_v2", "true");
}

// Render the season picker grid
function renderSeasonPicker() {
  seasonGrid.innerHTML = "";
  seasons.forEach((season) => {
    const card = document.createElement("div");
    card.className = "season-card";
    card.dataset.seasonNumber = season.number;

    const seenCount = [...seenEpisodes].filter((k) => k.startsWith(`${season.number}-`)).length;
    const total = season.episode_count;
    const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;

    card.innerHTML = `
      <img class="season-logo" src="${season.logo}" alt="${season.title}" onerror="this.src='${season.logo_png}'">
      <div class="season-progress-bar-track">
        <div class="season-progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="season-progress-label">Temporada ${season.number} &mdash; ${seenCount}/${total} episodios</span>
    `;
    card.addEventListener("click", () => loadSeason(season));
    seasonGrid.appendChild(card);
  });

  showScreen("picker");
}

// Load a season's episodes and switch to the main app view
async function loadSeason(season) {
  activeSeason = season;
  episodes = [];
  activeEpisode = null;
  currentFilter = "all";
  searchQuery = "";

  // Reset player
  mainVideo.style.display = "none";
  mainVideo.pause();
  videoSource.src = "";
  videoPlaceholder.style.display = "flex";
  episodeDetails.style.display = "none";
  if (searchInput) searchInput.value = "";

  // Update sidebar season logo and label
  if (sidebarSeasonLogo) {
    sidebarSeasonLogo.src = season.logo;
    sidebarSeasonLogo.alt = season.title;
  }
  if (sidebarSeasonLabel) {
    sidebarSeasonLabel.textContent = `Temporada ${season.number}`;
  }

  showScreen("app");

  try {
    const response = await fetch(season.data);
    if (!response.ok) throw new Error(`No se pudo cargar ${season.data}`);
    episodes = await response.json();
    renderEpisodes();
    updateProgress();
  } catch (error) {
    console.error("Error al cargar temporada:", error);
    episodeListEl.innerHTML = `<li class="empty-state">Error al cargar episodios: ${error.message}</li>`;
  }
}

// Switch between season picker and main app screens
function showScreen(screen, pushHistory = true) {
  if (screen === "picker") {
    seasonPickerScreen.classList.remove("hidden");
    mainAppScreen.classList.add("hidden");
  } else {
    seasonPickerScreen.classList.add("hidden");
    mainAppScreen.classList.remove("hidden");
    if (pushHistory) history.pushState({ screen: "app" }, "");
  }
}

// Go back to season picker — shared by back button and Android back gesture
function goBackToPicker() {
  hideAutoplayCountdown();
  mainVideo.pause();
  activeSeason = null;
  renderSeasonPicker(); // calls showScreen("picker") — no history push
}

// Android back button / browser back support
window.addEventListener("popstate", () => {
  if (!mainAppScreen.classList.contains("hidden")) {
    goBackToPicker();
  }
});

// Register PWA Service Worker
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => console.log("Service Worker registrado con éxito. Scope:", reg.scope))
        .catch((err) => console.error("Error al registrar el Service Worker:", err));
    });
  }
}

// Load Seen Episodes from localStorage
function loadSeenEpisodes() {
  const stored = localStorage.getItem("pokemon_seen_episodes");
  if (stored) {
    try {
      const arr = JSON.parse(stored);
      seenEpisodes = new Set(arr);
    } catch (e) {
      console.error("Error parsing localStorage seen episodes:", e);
      seenEpisodes = new Set();
    }
  }
}

// Save Seen Episodes to localStorage
function saveSeenEpisodes() {
  const arr = Array.from(seenEpisodes);
  localStorage.setItem("pokemon_seen_episodes", JSON.stringify(arr));
}

// Load Playback Progress (percentage watched) from localStorage
function loadEpisodeProgress() {
  const stored = localStorage.getItem("pokemon_episode_progress");
  if (stored) {
    try {
      episodeProgress = JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing localStorage episode progress:", e);
      episodeProgress = {};
    }
  }
}

// Save Playback Progress to localStorage
function saveEpisodeProgress() {
  localStorage.setItem("pokemon_episode_progress", JSON.stringify(episodeProgress));
}

// Load and apply autoplay state from localStorage
function loadAutoplayState() {
  autoplayEnabled = localStorage.getItem("pokemon_autoplay") === "true";
  applyAutoplayToggleUI();
}

// Save autoplay state to localStorage
function saveAutoplayState() {
  localStorage.setItem("pokemon_autoplay", autoplayEnabled ? "true" : "false");
}

// Reflect autoplay state in the toggle button UI
function applyAutoplayToggleUI() {
  if (autoplayEnabled) {
    autoplayToggleBtn.classList.add("active");
    autoplayToggleBtn.setAttribute("aria-checked", "true");
  } else {
    autoplayToggleBtn.classList.remove("active");
    autoplayToggleBtn.setAttribute("aria-checked", "false");
  }
}

// Get the next episode to play, respecting current filter and search
function getNextEpisode() {
  if (!activeEpisode) return null;

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.number.toString().includes(searchQuery) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (currentFilter === "seen") return seenEpisodes.has(epKey(ep.number));
    if (currentFilter === "pending") return !seenEpisodes.has(epKey(ep.number));
    return true;
  });

  const currentIndex = filtered.findIndex((ep) => ep.number === activeEpisode.number);
  if (currentIndex === -1 || currentIndex === filtered.length - 1) return null;
  return filtered[currentIndex + 1];
}

// Show (or update) the autoplay countdown overlay — driven by timeupdate, no interval
function showAutoplayCountdown(nextEpisode, secondsLeft) {
  const isAlreadyVisible = !autoplayOverlay.classList.contains("hidden");

  if (!isAlreadyVisible) {
    // First time showing: populate content and animate in
    autoplayNextThumb.src = nextEpisode.image || "icons/icon-192.png";
    autoplayNextThumb.alt = nextEpisode.title;
    autoplayNextTitle.textContent = `Ep. ${nextEpisode.number} — ${nextEpisode.title}`;

    autoplayOverlay.classList.remove("visible");
    autoplayOverlay.classList.remove("hidden");
    void autoplayOverlay.offsetWidth; // force reflow for animation restart
    autoplayOverlay.classList.add("visible");
  }

  // Update bar width and text on every tick (0.25s CSS transition smooths it)
  const barWidth = Math.max(0, Math.min(100, (secondsLeft / 5) * 100));
  autoplayCountdownFill.style.width = `${barWidth}%`;
  autoplayCountdownText.textContent = secondsLeft > 0
    ? `Siguiente en ${Math.ceil(secondsLeft)}...`
    : "Iniciando...";
}

// Hide and reset the autoplay countdown overlay
function hideAutoplayCountdown() {
  autoplayOverlay.classList.add("hidden");
  autoplayOverlay.classList.remove("visible");
  autoplayCountdownFill.style.width = "100%";
}

// Update the red progress bar under an episode's thumbnail
function updateEpisodeProgressBar(number, percentage) {
  const el = document.querySelector(`.episode-item[data-number="${number}"]`);
  if (!el) return;
  const fillEl = el.querySelector(".ep-watch-progress-fill");
  if (fillEl) {
    fillEl.style.width = `${percentage}%`;
  }
}

// Calculate and Update Progress Bar
function updateProgress() {
  const total = episodes.length;
  if (total === 0) return;

  const seasonPrefix = activeSeason ? `${activeSeason.number}-` : "6-";
  const seenCount = [...seenEpisodes].filter((k) => k.startsWith(seasonPrefix)).length;
  const percentage = Math.round((seenCount / total) * 100);

  progressText.textContent = `${seenCount} / ${total} (${percentage}%)`;
  progressBarFill.style.width = `${percentage}%`;
}

// Render the Episode List
function renderEpisodes() {
  episodeListEl.innerHTML = "";

  // Filter episodes
  const filtered = episodes.filter((ep) => {
    // Search filter
    const matchesSearch =
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.number.toString().includes(searchQuery) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter
    if (currentFilter === "seen") return seenEpisodes.has(epKey(ep.number));
    if (currentFilter === "pending") return !seenEpisodes.has(epKey(ep.number));
    return true;
  });

  if (filtered.length === 0) {
    episodeListEl.innerHTML = '<li class="empty-state">No se encontraron episodios.</li>';
    return;
  }

  // Build list items
  filtered.forEach((ep) => {
    const li = document.createElement("li");
    const key = epKey(ep.number);
    li.className = `episode-item ${seenEpisodes.has(key) ? "seen" : ""} ${
      activeEpisode && activeEpisode.number === ep.number ? "active" : ""
    }`;
    li.dataset.number = ep.number;

    // Use placeholder image if thumb is missing or invalid
    const imgUrl = ep.image || "icons/icon-192.png";
    const watchedPercentage = seenEpisodes.has(key) ? 100 : (episodeProgress[key] || 0);

    li.innerHTML = `
      <div class="ep-thumb-wrapper">
        <img class="ep-thumb" src="${imgUrl}" alt="${ep.title}" loading="lazy">
        <span class="ep-number-badge">#${ep.number}</span>
        <div class="ep-seen-badge">✓</div>
        <div class="ep-watch-progress-track">
          <div class="ep-watch-progress-fill" style="width: ${watchedPercentage}%;"></div>
        </div>
      </div>
      <div class="ep-text-info">
        <span class="ep-title">${ep.title}</span>
        <span class="ep-meta">Capítulo ${ep.number}</span>
      </div>
      <button class="ep-check-btn" aria-label="Marcar como visto">✓</button>
    `;

    // Click item to play episode (but prevent if clicking the checkbox button)
    li.addEventListener("click", (e) => {
      if (e.target.closest(".ep-check-btn")) {
        toggleEpisodeSeen(ep.number);
      } else {
        selectEpisode(ep);
      }
    });

    episodeListEl.appendChild(li);
  });
}

// Select and load episode to the video player
function selectEpisode(ep) {
  // Reset cancelled flag and hide any overlay when switching episodes
  autoplayCancelled = false;
  hideAutoplayCountdown();
  activeEpisode = ep;

  // Highlight in list
  document.querySelectorAll(".episode-item").forEach((el) => {
    el.classList.remove("active");
    if (parseInt(el.dataset.number) === ep.number) {
      el.classList.add("active");
    }
  });

  // Load Video source
  videoPlaceholder.style.display = "none";
  mainVideo.style.display = "block";
  
  // Changing video source and loading
  videoSource.src = ep.video_url;
  mainVideo.load();
  
  // Play the video automatically (on user gesture, this is allowed with sound)
  mainVideo.play().catch((err) => {
    console.log("Autoplay blocked or interrupted: ", err);
  });

  // Update Detail UI
  episodeDetails.classList.remove("hidden");
  detailNumber.textContent = `Episodio ${ep.number}`;
  detailTitle.textContent = ep.title;
  detailDescription.textContent = ep.description;
  btnOriginalLink.href = ep.url;

  updateDetailActionButton();

  // Scroll to player area on mobile/portrait stacked view
  if (window.innerWidth <= 900) {
    mainVideo.scrollIntoView({ behavior: "smooth" });
  }
}

// Helper: get the localStorage key for an episode
function epKey(number) {
  return activeSeason ? `${activeSeason.number}-${number}` : `6-${number}`;
}

// Toggle Seen state for an episode
function toggleEpisodeSeen(number) {
  const key = epKey(number);
  if (seenEpisodes.has(key)) {
    seenEpisodes.delete(key);
  } else {
    seenEpisodes.add(key);
    // Mark playback progress as fully watched
    episodeProgress[key] = 100;
    saveEpisodeProgress();
  }

  saveSeenEpisodes();
  updateProgress();
  
  // Rerender list item classes without full redraw to maintain scroll position
  const el = document.querySelector(`.episode-item[data-number="${number}"]`);
  if (el) {
    if (seenEpisodes.has(key)) {
      el.classList.add("seen");
      updateEpisodeProgressBar(number, 100);
    } else {
      el.classList.remove("seen");
    }
  }

  // Update details section if the modified episode is the active one
  if (activeEpisode && activeEpisode.number === number) {
    updateDetailActionButton();
  }

  // If filter is active, we might need a full rerender because it might disappear
  if (currentFilter !== "all") {
    renderEpisodes();
  }
}

// Update "Visto" button state in detail panel
function updateDetailActionButton() {
  if (!activeEpisode) return;

  const isSeen = seenEpisodes.has(epKey(activeEpisode.number));
  if (isSeen) {
    btnToggleSeen.classList.add("seen");
    btnToggleSeen.querySelector(".btn-icon").textContent = "✓";
    btnToggleSeen.querySelector(".btn-text").textContent = "Visto";
  } else {
    btnToggleSeen.classList.remove("seen");
    btnToggleSeen.querySelector(".btn-icon").textContent = "✓";
    btnToggleSeen.querySelector(".btn-text").textContent = "Marcar como Visto";
  }
}

// Fullscreen handler — redirect video fullscreen to wrapper so overlay stays visible
function setupFullscreenHandling() {
  const requestWrapperFullscreen = () => {
    if (videoWrapper.requestFullscreen) return videoWrapper.requestFullscreen();
    if (videoWrapper.webkitRequestFullscreen) return videoWrapper.webkitRequestFullscreen();
  };

  const onFullscreenChange = () => {
    const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
    // If the video itself went fullscreen (native controls), re-request on the wrapper
    if (fullscreenEl === mainVideo) {
      const exitFS = document.exitFullscreen
        ? document.exitFullscreen.bind(document)
        : document.webkitExitFullscreen.bind(document);
      exitFS().then(requestWrapperFullscreen).catch(() => {});
    }
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
}

// Setup Event Listeners
function setupEventListeners() {
  // Fullscreen interception
  setupFullscreenHandling();

  // Search inputs
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? "block" : "none";
    renderEpisodes();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.style.display = "none";
    searchInput.focus();
    renderEpisodes();
  });

  // Filter Buttons
  filterAllBtn.addEventListener("click", () => setFilter("all"));
  filterPendingBtn.addEventListener("click", () => setFilter("pending"));
  filterSeenBtn.addEventListener("click", () => setFilter("seen"));

  // Detail panel Toggle Seen button
  btnToggleSeen.addEventListener("click", () => {
    if (activeEpisode) {
      toggleEpisodeSeen(activeEpisode.number);
    }
  });

  // Track playback progress to fill the red progress bar and detect completion
  mainVideo.addEventListener("timeupdate", handleVideoTimeUpdate);

  // Auto-mark as seen when video ends; if autoplay is on jump to next episode immediately
  mainVideo.addEventListener("ended", () => {
    if (activeEpisode) {
      updateEpisodeProgressBar(activeEpisode.number, 100);
      episodeProgress[epKey(activeEpisode.number)] = 100;
      saveEpisodeProgress();
      if (!seenEpisodes.has(epKey(activeEpisode.number))) {
        toggleEpisodeSeen(activeEpisode.number);
      }

      // Countdown already ran during the last 5s — jump straight to next episode
      if (autoplayEnabled && !autoplayCancelled) {
        const nextEpisode = getNextEpisode();
        if (nextEpisode) {
          hideAutoplayCountdown();
          selectEpisode(nextEpisode);
        }
      } else {
        hideAutoplayCountdown();
      }
    }
  });

  // Back to seasons button — triggers history.back() so popstate handles it consistently
  backToSeasonsBtn.addEventListener("click", () => {
    history.back();
  });

  // Autoplay toggle button
  autoplayToggleBtn.addEventListener("click", () => {
    autoplayEnabled = !autoplayEnabled;
    saveAutoplayState();
    applyAutoplayToggleUI();
    // Cancel any running countdown if the user disables autoplay mid-countdown
    if (!autoplayEnabled) {
      hideAutoplayCountdown();
    }
  });

  // Cancel button: dismiss countdown for this episode without disabling autoplay globally
  autoplayCancelBtn.addEventListener("click", () => {
    autoplayCancelled = true;
    hideAutoplayCountdown();
  });
}

// Handle video time updates: red progress bar + autoplay synchronized countdown
function handleVideoTimeUpdate() {
  if (!activeEpisode || !mainVideo.duration || isNaN(mainVideo.duration)) return;

  const currentTime = mainVideo.currentTime;
  const duration = mainVideo.duration;
  const timeRemaining = duration - currentTime;
  const percentage = Math.min(100, Math.round((currentTime / duration) * 100));

  // Update the visual progress bar under the thumbnail in real time
  updateEpisodeProgressBar(activeEpisode.number, percentage);

  // Persist progress periodically (throttled) to avoid excessive writes
  const now = Date.now();
  episodeProgress[epKey(activeEpisode.number)] = percentage;
  if (now - lastProgressSaveTime > 2000) {
    saveEpisodeProgress();
    lastProgressSaveTime = now;
  }

  // Autoplay countdown: show overlay when 5s remain, synchronized with playback
  if (autoplayEnabled && !autoplayCancelled) {
    const nextEpisode = getNextEpisode();
    if (nextEpisode && timeRemaining <= 5 && timeRemaining > 0) {
      showAutoplayCountdown(nextEpisode, timeRemaining);
    } else if (timeRemaining > 5 && !autoplayOverlay.classList.contains("hidden")) {
      // User seeked back past the 5s window — hide the overlay
      hideAutoplayCountdown();
    }
  }
}

// Set active filter mode
function setFilter(filter) {
  currentFilter = filter;

  // Active styles
  filterAllBtn.classList.remove("active");
  filterPendingBtn.classList.remove("active");
  filterSeenBtn.classList.remove("active");

  if (filter === "all") filterAllBtn.classList.add("active");
  else if (filter === "pending") filterPendingBtn.classList.add("active");
  else if (filter === "seen") filterSeenBtn.classList.add("active");

  renderEpisodes();
}

// Run application on DOMContentLoaded
document.addEventListener("DOMContentLoaded", init);
