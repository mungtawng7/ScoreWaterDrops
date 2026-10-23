const SIZE = 8;
const LEVELS = [
  { types: 4, moves: 25, goal: 800, time: 75 },
  { types: 5, moves: 22, goal: 1500, time: 60 },
  { types: 6, moves: 20, goal: 2500, time: 50 },
];
let TYPES = 4, GOAL = 0, level = 0, timeLeft = 0, timer = null, over = false;
const levelEl = document.getElementById("level");
const timeEl = document.getElementById("time");
const overlay = document.getElementById("overlay");

// Sound effects and procedural random music (Web Audio, no assets needed)
let actx = null, muted = false, musicTimer = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function tone(freq, dur, type = "sine", vol = 0.15, delay = 0) {
  if (muted) return;
  const a = audio(), t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur);
}
const sfx = {
  move: () => { tone(440, 0.08, "triangle"); tone(660, 0.08, "triangle", 0.12, 0.06); },
  bad: () => tone(160, 0.2, "sawtooth", 0.1),
  crush: combo => [0, 1, 2].forEach(i => tone(380 * Math.pow(1.25, i + combo), 0.15, "square", 0.08, i * 0.06)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, i * 0.15)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, "sawtooth", 0.12, i * 0.22)),
};
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
function startMusic() {
  stopMusic();
  if (muted) return;
  const root = 220 * Math.pow(2, Math.floor(Math.random() * 12) / 12);
  let step = 0;
  musicTimer = setInterval(() => {
    const n = SCALE[Math.floor(Math.random() * SCALE.length)];
    if (Math.random() < 0.8) tone(root * Math.pow(2, n / 12), 0.35, "sine", 0.06);
    if (step % 4 === 0) tone(root / 2 * Math.pow(2, SCALE[Math.floor(Math.random() * 4)] / 12), 0.6, "triangle", 0.07);
    step++;
  }, 280);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
document.getElementById("mute").addEventListener("click", e => {
  muted = !muted;
  e.target.textContent = muted ? "🔇 Sound Off" : "🔊 Sound On";
  if (muted) stopMusic(); else if (!over) startMusic();
});

function showOverlay(title, text, btn, cls, action) {
  document.getElementById("ov-title").textContent = title;
  document.getElementById("ov-text").textContent = text;
  const b = document.getElementById("ov-btn");
  b.textContent = btn;
  b.onclick = () => { overlay.classList.add("hidden"); action(); };
  overlay.querySelector(".panel").className = "panel " + cls;
  overlay.classList.remove("hidden");
}
function endGame(won) {
  over = true; busy = true;
  clearInterval(timer); stopMusic();
  if (won) {
    sfx.win();
    if (level < LEVELS.length - 1) {
      showOverlay("MISSION COMPLETE!", `Level ${level + 1} cleared with score ${score}.`, "Next Level", "win", () => { level++; init(); });
    } else {
      showOverlay("MISSION COMPLETE!", `You beat all ${LEVELS.length} levels! Final score ${score}.`, "Play Again", "win", () => { level = 0; init(); });
    }
  } else {
    sfx.lose();
    showOverlay("GAME OVER", `Level ${level + 1}: you didn't reach ${GOAL} in time. Score ${score}.`, "Try Again", "lose", init);
  }
}
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const goalEl = document.getElementById("goal");
const msgEl = document.getElementById("message");

let grid, score, moves, selected, busy;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = () => Math.floor(Math.random() * TYPES);

function findMatches() {
  const hit = new Set();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v < 0) continue;
      if (c < SIZE - 2 && grid[r][c + 1] === v && grid[r][c + 2] === v)
        [0, 1, 2].forEach(i => hit.add(r * SIZE + c + i));
      if (r < SIZE - 2 && grid[r + 1][c] === v && grid[r + 2][c] === v)
        [0, 1, 2].forEach(i => hit.add((r + i) * SIZE + c));
    }
  }
  return hit;
}

function renderTime() {
  timeEl.textContent = Math.max(timeLeft, 0);
  timeEl.classList.toggle("low", timeLeft <= 10);
}

function init() {
  const L = LEVELS[level];
  TYPES = L.types; GOAL = L.goal;
  renderTime();
  do {
    grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rnd));
  } while (findMatches().size || !hasMove());
  score = 0; moves = L.moves; selected = null; busy = false; over = false;
  timeLeft = L.time;
  goalEl.textContent = GOAL;
  levelEl.textContent = level + 1;
  msgEl.textContent = "Swap adjacent drops to match 3 or more.";
  render();
  clearInterval(timer);
  timer = setInterval(() => {
    if (over) return;
    timeLeft--;
    renderTime();
    if (timeLeft <= 0) endGame(false);
  }, 1000);
  if (!muted) startMusic();
}

function render(fresh = new Set()) {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      const v = grid[r][c];
      cell.className = "cell " + (v < 0 ? "empty" : "c" + v);
      if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");
      if (fresh.has(r * SIZE + c)) cell.classList.add("new");
      cell.dataset.r = r; cell.dataset.c = c;
      cell.innerHTML = '<div class="drop"></div>';
      boardEl.appendChild(cell);
    }
  }
  renderTime();
  scoreEl.textContent = score;
  movesEl.textContent = moves;
}

function swap(a, b) {
  [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
}

function hasMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = { r, c }, b = { r: r + dr, c: c + dc };
        if (b.r >= SIZE || b.c >= SIZE) continue;
        swap(a, b);
        const ok = findMatches().size > 0;
        swap(a, b);
        if (ok) return true;
      }
    }
  }
  return false;
}

function collapse() {
  for (let c = 0; c < SIZE; c++) {
    let w = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) if (grid[r][c] >= 0) grid[w--][c] = grid[r][c];
    while (w >= 0) grid[w--][c] = rnd();
  }
}

async function resolve() {
  let combo = 0, m;
  while ((m = findMatches()).size) {
    combo++;
    m.forEach(i => {
      const cell = boardEl.children[i];
      if (cell) cell.classList.add("pop");
    });
    sfx.crush(combo);
    await sleep(250);
    if (over) return;
    score += m.size * 10 * combo;
    const fresh = new Set();
    m.forEach(i => {
      const r = Math.floor(i / SIZE), c = i % SIZE;
      grid[r][c] = -1;
      for (let k = 0; k <= r; k++) fresh.add(k * SIZE + c);
    });
    collapse();
    render(fresh);
    await sleep(300);
  }
}

async function trySwap(a, b) {
  busy = true;
  audio();
  sfx.move();
  swap(a, b);
  selected = null;
  render();
  await sleep(150);
  if (!findMatches().size) {
    swap(a, b);
    sfx.bad();
    render();
    busy = false;
    return;
  }
  moves--;
  await resolve();
  if (over) return;
  while (!hasMove()) { // reshuffle when stuck
    do {
      grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rnd));
    } while (findMatches().size);
  }
  render();
  if (score >= GOAL) { endGame(true); return; }
  if (moves <= 0) { endGame(false); return; }
  busy = false;
}

let drag = null, dragged = false;
boardEl.addEventListener("pointerdown", e => {
  const cell = e.target.closest(".cell");
  dragged = false;
  if (!cell || busy) { drag = null; return; }
  drag = { r: +cell.dataset.r, c: +cell.dataset.c, x: e.clientX, y: e.clientY };
});
boardEl.addEventListener("pointermove", e => {
  if (!drag || busy) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  const need = boardEl.firstElementChild.offsetWidth * 0.4;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < need) return;
  const horiz = Math.abs(dx) > Math.abs(dy);
  const a = { r: drag.r, c: drag.c };
  const b = { r: a.r + (horiz ? 0 : Math.sign(dy)), c: a.c + (horiz ? Math.sign(dx) : 0) };
  drag = null; dragged = true;
  if (b.r < 0 || b.c < 0 || b.r >= SIZE || b.c >= SIZE) return;
  trySwap(a, b);
});
["pointerup", "pointercancel", "pointerleave"].forEach(t =>
  boardEl.addEventListener(t, () => { drag = null; }));

boardEl.addEventListener("click", e => {
  if (dragged) { dragged = false; return; }
  const cell = e.target.closest(".cell");
  if (!cell || busy) return;
  const p = { r: +cell.dataset.r, c: +cell.dataset.c };
  if (!selected) { selected = p; render(); return; }
  const dist = Math.abs(selected.r - p.r) + Math.abs(selected.c - p.c);
  if (dist === 1) trySwap(selected, p);
  else { selected = dist === 0 ? null : p; render(); }
});

document.getElementById("restart").addEventListener("click", () => { level = 0; init(); });
init();
