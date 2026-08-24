/* ==========================================================================
   JavaScript Application Logic for Pokémon Advanced PWA
   Controls reproduction, local storage persistence, filters and SW
   ========================================================================== */

// Application State
let episodes = [];
let seenEpisodes = new Set();
let activeEpisode = null;
let currentFilter = "all"; // "all" | "pending" | "seen"
let searchQuery = "";

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

const episodeDetails = document.getElementById("episode-details");
const detailNumber = document.getElementById("detail-number");
const detailTitle = document.getElementById("detail-title");
const btnToggleSeen = document.getElementById("btn-toggle-seen");
const btnOriginalLink = document.getElementById("btn-original-link");
const detailDescription = document.getElementById("detail-description");

const progressText = document.getElementById("progress-text");
const progressBarFill = document.getElementById("progress-bar-fill");

// Initialize Application
async function init() {
  // 1. Register Service Worker for offline capability
  registerServiceWorker();

  // 2. Load Seen Episodes from LocalStorage
  loadSeenEpisodes();

  // 3. Load Episodes Data
  try {
    const response = await fetch("./episodes.json");
    if (!response.ok) throw new Error("No se pudo cargar episodes.json");
    episodes = await response.json();
    
    // Render initial list
    renderEpisodes();
    updateProgress();
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
    episodeListEl.innerHTML = `<li class="empty-state">Error al cargar episodios: ${error.message}</li>`;
  }

  // 4. Set Up Event Listeners
  setupEventListeners();
}

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

// Calculate and Update Progress Bar
function updateProgress() {
  const total = episodes.length;
  if (total === 0) return;

  const seenCount = seenEpisodes.size;
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
    if (currentFilter === "seen") return seenEpisodes.has(ep.number);
    if (currentFilter === "pending") return !seenEpisodes.has(ep.number);
    return true;
  });

  if (filtered.length === 0) {
    episodeListEl.innerHTML = '<li class="empty-state">No se encontraron episodios.</li>';
    return;
  }

  // Build list items
  filtered.forEach((ep) => {
    const li = document.createElement("li");
    li.className = `episode-item ${seenEpisodes.has(ep.number) ? "seen" : ""} ${
      activeEpisode && activeEpisode.number === ep.number ? "active" : ""
    }`;
    li.dataset.number = ep.number;

    // Use placeholder image if thumb is missing or invalid
    const imgUrl = ep.image || "icons/icon-192.png";

    li.innerHTML = `
      <div class="ep-thumb-wrapper">
        <img class="ep-thumb" src="${imgUrl}" alt="${ep.title}" loading="lazy">
        <span class="ep-number-badge">#${ep.number}</span>
        <div class="ep-seen-badge">✓</div>
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

// Toggle Seen state for an episode
function toggleEpisodeSeen(number) {
  if (seenEpisodes.has(number)) {
    seenEpisodes.delete(number);
  } else {
    seenEpisodes.add(number);
  }

  saveSeenEpisodes();
  updateProgress();
  
  // Rerender list item classes without full redraw to maintain scroll position
  const el = document.querySelector(`.episode-item[data-number="${number}"]`);
  if (el) {
    if (seenEpisodes.has(number)) {
      el.classList.add("seen");
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

  const isSeen = seenEpisodes.has(activeEpisode.number);
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

// Setup Event Listeners
function setupEventListeners() {
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

  // Auto-mark as seen when video ends (cool feature!)
  mainVideo.addEventListener("ended", () => {
    if (activeEpisode && !seenEpisodes.has(activeEpisode.number)) {
      toggleEpisodeSeen(activeEpisode.number);
    }
  });
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
