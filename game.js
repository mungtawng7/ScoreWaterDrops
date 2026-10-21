const SIZE = 8, TYPES = 6, START_MOVES = 25, GOAL = 1000;
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

function init() {
  do {
    grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rnd));
  } while (findMatches().size || !hasMove());
  score = 0; moves = START_MOVES; selected = null; busy = false;
  goalEl.textContent = GOAL;
  msgEl.textContent = "Swap adjacent drops to match 3 or more.";
  render();
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
    await sleep(250);
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
  swap(a, b);
  selected = null;
  render();
  await sleep(150);
  if (!findMatches().size) {
    swap(a, b);
    render();
    busy = false;
    return;
  }
  moves--;
  await resolve();
  while (!hasMove()) { // reshuffle when stuck
    do {
      grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rnd));
    } while (findMatches().size);
  }
  render();
  if (score >= GOAL) { msgEl.textContent = "You win! Final score " + score; busy = true; return; }
  if (moves <= 0) { msgEl.textContent = "Out of moves! Score " + score; busy = true; return; }
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

document.getElementById("restart").addEventListener("click", init);
init();
