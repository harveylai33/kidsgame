const categories = [
  { id: "animals", title: "動物", icon: "🐱" },
  { id: "plants", title: "植物", icon: "🌳" },
  { id: "foods", title: "食物", icon: "🍎" }
];

const baseCards = [
  { id: "lion", label: "獅子", icon: "🦁", category: "animals" },
  { id: "rabbit", label: "兔子", icon: "🐰", category: "animals" },
  { id: "fish", label: "小魚", icon: "🐟", category: "animals" },
  { id: "flower", label: "花朵", icon: "🌼", category: "plants" },
  { id: "tree", label: "樹木", icon: "🌲", category: "plants" },
  { id: "cactus", label: "仙人掌", icon: "🌵", category: "plants" },
  { id: "banana", label: "香蕉", icon: "🍌", category: "foods" },
  { id: "bread", label: "麵包", icon: "🍞", category: "foods" },
  { id: "watermelon", label: "西瓜", icon: "🍉", category: "foods" }
];

const pool = document.getElementById("cards-pool");
const targetsRoot = document.getElementById("targets");
const feedback = document.getElementById("feedback");
const progressText = document.getElementById("progress-text");
const soundToggle = document.getElementById("sound-toggle");
const resetButton = document.getElementById("reset-button");
const playAgainButton = document.getElementById("play-again-button");
const celebration = document.getElementById("celebration");

let cards = [];
let placedCount = 0;
let activeDrag = null;
let feedbackTimer = null;
let soundEnabled = true;
let audioContext = null;

function ensureAudioContext() {
  if (!soundEnabled) {
    return null;
  }

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone({ frequency, duration, type = "sine", volume = 0.18, delay = 0 }) {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + delay;
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playCorrectSound() {
  playTone({ frequency: 523.25, duration: 0.12, type: "triangle", volume: 0.12 });
  playTone({ frequency: 659.25, duration: 0.18, type: "triangle", volume: 0.14, delay: 0.08 });
}

function playWrongSound() {
  playTone({ frequency: 220, duration: 0.16, type: "sawtooth", volume: 0.08 });
  playTone({ frequency: 180, duration: 0.18, type: "sawtooth", volume: 0.06, delay: 0.1 });
}

function playCompleteSound() {
  playTone({ frequency: 523.25, duration: 0.14, type: "triangle", volume: 0.12 });
  playTone({ frequency: 659.25, duration: 0.14, type: "triangle", volume: 0.14, delay: 0.12 });
  playTone({ frequency: 783.99, duration: 0.22, type: "triangle", volume: 0.16, delay: 0.24 });
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? "音效開啟" : "音效關閉";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createCard(card) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card";
  button.dataset.cardId = card.id;
  button.dataset.category = card.category;
  button.innerHTML = `
    <span class="card-icon" aria-hidden="true">${card.icon}</span>
    <span class="card-label">${card.label}</span>
  `;

  button.addEventListener("pointerdown", (event) => startDrag(event, card, button));
  return button;
}

function categoryLabel(categoryId) {
  const category = categories.find((item) => item.id === categoryId);
  return category ? category.title : "";
}

function createTargets() {
  targetsRoot.innerHTML = "";

  categories.forEach((category) => {
    const target = document.createElement("section");
    target.className = "target";
    target.dataset.category = category.id;
    target.innerHTML = `
      <div class="target-header">
        <div class="target-icon" aria-hidden="true">${category.icon}</div>
        <h3 class="target-title">${category.title}</h3>
      </div>
      <div class="stack" aria-hidden="true"></div>
    `;
    targetsRoot.appendChild(target);
  });
}

function renderPool() {
  pool.innerHTML = "";
  cards.forEach((card) => {
    if (!card.placed) {
      pool.appendChild(createCard(card));
    }
  });
}

function renderPlacedCard(card) {
  const target = targetsRoot.querySelector(`[data-category="${card.category}"] .stack`);
  if (!target) {
    return;
  }

  const stackCard = document.createElement("div");
  stackCard.className = "stack-card";
  stackCard.innerHTML = `
    <span class="stack-icon" aria-hidden="true">${card.icon}</span>
    <span class="stack-label">${card.label}</span>
  `;
  target.appendChild(stackCard);
}

function updateProgress() {
  progressText.textContent = `${placedCount} / ${cards.length}`;
  if (placedCount === cards.length) {
    celebration.classList.remove("hidden");
    playCompleteSound();
    showFeedback("全部都分類完成了，真厲害！", "success");
  }
}

function resetGame() {
  cards = shuffle(baseCards).map((card) => ({ ...card, placed: false }));
  placedCount = 0;
  activeDrag = null;
  celebration.classList.add("hidden");
  createTargets();
  renderPool();
  updateProgress();
}

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback show ${type}`;

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedback.className = "feedback";
  }, 1300);
}

function startDrag(event, card, element) {
  if (card.placed || activeDrag) {
    return;
  }

  event.preventDefault();
  ensureAudioContext();

  const rect = element.getBoundingClientRect();
  activeDrag = {
    card,
    element,
    pointerId: event.pointerId,
    originRect: rect,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };

  element.setPointerCapture(event.pointerId);
  element.classList.add("dragging");
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.position = "fixed";
  pool.appendChild(element);

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  onPointerMove(event);
}

function onPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const { element, offsetX, offsetY } = activeDrag;
  const left = event.clientX - offsetX;
  const top = event.clientY - offsetY;

  element.style.left = `${left}px`;
  element.style.top = `${top}px`;

  const target = findHoveredTarget(event.clientX, event.clientY);
  setTargetHighlight(target);
}

function onPointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const hoveredTarget = findHoveredTarget(event.clientX, event.clientY);
  const { card } = activeDrag;

  if (hoveredTarget && hoveredTarget.dataset.category === card.category) {
    placeCard(hoveredTarget);
  } else {
    returnCard(hoveredTarget);
  }

  cleanupDrag();
}

function findHoveredTarget(clientX, clientY) {
  const targets = [...targetsRoot.querySelectorAll(".target")];
  return targets.find((target) => {
    const rect = target.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}

function setTargetHighlight(target) {
  targetsRoot.querySelectorAll(".target").forEach((item) => {
    item.classList.toggle("ready", item === target);
  });
}

function placeCard(target) {
  const { card, element } = activeDrag;
  card.placed = true;
  placedCount += 1;
  element.remove();
  renderPlacedCard(card);
  target.classList.remove("ready");
  playCorrectSound();
  showFeedback(`答對了！${card.label} 是 ${categoryLabel(card.category)}。`, "success");
  updateProgress();
}

function returnCard(target) {
  const { element, originRect } = activeDrag;

  if (target) {
    target.classList.add("wrong");
    window.setTimeout(() => target.classList.remove("wrong"), 450);
  }

  element.classList.add("returning");
  element.style.left = `${originRect.left}px`;
  element.style.top = `${originRect.top}px`;

  window.setTimeout(() => {
    if (!activeDrag || activeDrag.element !== element) {
      return;
    }

    element.classList.remove("dragging", "returning");
    element.style.position = "";
    element.style.width = "";
    element.style.height = "";
    element.style.left = "";
    element.style.top = "";
    pool.appendChild(element);
  }, 450);

  playWrongSound();
  showFeedback("再試一次，這張圖卡應該去別的地方喔。", "error");
}

function cleanupDrag() {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  setTargetHighlight(null);

  if (activeDrag?.element && !activeDrag.card.placed) {
    activeDrag.element.releasePointerCapture(activeDrag.pointerId);
  }

  const previousDrag = activeDrag;
  window.setTimeout(() => {
    if (activeDrag === previousDrag) {
      activeDrag = null;
    }
  }, 460);
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    ensureAudioContext();
  }
  updateSoundToggle();
});

resetButton.addEventListener("click", resetGame);
playAgainButton.addEventListener("click", resetGame);

updateSoundToggle();
resetGame();
