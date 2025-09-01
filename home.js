document.body.style.backgroundColor = "#222"; // dark gray

// --- Constants ---
const CHUNK_SIZE = 256; // px
const CHUNK_RADIUS = 6; // chunks loaded in each direction
const VISIBLE_RADIUS = 4; // chunks visible
const PLAYER_SPEED = 4; // px per frame
const BLAST_SPEED = 12; // px per frame
const BLAST_RANGE = CHUNK_SIZE * 2; // 2 chunks
const CHUNK_TEXTURE = "https://www.art.eonworks.com/free/textures/funky_ground_texture_04-512x512.png";

// --- State ---
let playerPos = { x: 0, y: 0 };
let chunks = new Map();
let blasts = [];
let lastDir = { x: 0, y: 1 }; // Default facing down

// --- UI Setup ---
const button = document.createElement("button");
button.textContent = "TURN BACK!";
button.style.position = "absolute";
button.style.top = "50%";
button.style.left = "50%";
button.style.transform = "translate(-50%, -50%)";
button.style.backgroundColor = "black";
button.style.color = "white";
button.style.fontSize = "2rem";
button.style.padding = "1rem 2rem";
button.style.border = "none";
button.style.borderRadius = "8px";
button.style.cursor = "pointer";
document.body.appendChild(button);

// Add dark fog overlay
const fog = document.createElement("div");
fog.style.position = "fixed";
fog.style.top = "0";
fog.style.left = "0";
fog.style.width = "100vw";
fog.style.height = "100vh";
fog.style.pointerEvents = "none";
fog.style.zIndex = "5";
fog.style.background = "radial-gradient(circle at 50% 60%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)";
document.body.appendChild(fog);

function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.style) Object.assign(el.style, options.style);
  if (options.text) el.textContent = options.text;
  return el;
}

// --- Game Setup ---
let player, hud, floor, heart;
let keys = {};

button.onclick = () => {
  // Turn screen black
  document.body.style.backgroundColor = "black";
  fog.style.display = "none";
  button.style.display = "none";

  setTimeout(() => {
    // Floor container (transparent, just for chunk positioning)
    floor = createElement("div", {
      style: {
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        background: "transparent",
        zIndex: "1",
        overflow: "hidden"
      }
    });
    document.body.appendChild(floor);

    // Add fog back
    fog.style.display = "block";
    fog.style.zIndex = "4";

    // Player sprite
    player = createElement("img", {
      className: "player-sprite",
      style: {
        position: "absolute",
        width: "48px",
        height: "58px",
        zIndex: "2",
        imageRendering: "pixelated"
      }
    });
    player.src = "https://gamedevacademy.org/wp-content/uploads/2021/10/unnamed-file-18-2.png.webp";
    document.body.appendChild(player);

    // HUD
    hud = createElement("div", {
      style: {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "32px",
        zIndex: "10"
      }
    });

    // Beating heart image
    heart = createElement("img", {
      className: "heart",
      style: {
        width: "40px",
        height: "40px",
        marginRight: "16px",
        animation: "beat 0.7s infinite",
        imageRendering: "pixelated"
      }
    });
    heart.src = "https://i.sstatic.net/k4FXK.gif";
    hud.appendChild(heart);

    // Inventory bar
    const inventory = createElement("div", {
      style: {
        display: "flex",
        gap: "8px"
      }
    });
    for (let i = 0; i < 6; i++) {
      const slot = createElement("div", {
        style: {
          width: "32px",
          height: "32px",
          background: "#222",
          border: "2px solid #fff",
          borderRadius: "4px",
          boxShadow: "0 2px 0 #000"
        }
      });
      inventory.appendChild(slot);
    }
    hud.appendChild(inventory);

    // Hunger bar
    const hunger = createElement("div", {
      style: {
        display: "flex",
        gap: "4px",
        marginLeft: "16px"
      }
    });
    for (let i = 0; i < 6; i++) {
      const slot = createElement("div", {
        style: {
          width: "24px",
          height: "24px",
          background: "#ffb347",
          border: "2px solid #fff",
          borderRadius: "50%",
          boxShadow: "0 2px 0 #000"
        }
      });
      hunger.appendChild(slot);
    }
    hud.appendChild(hunger);

    document.body.appendChild(hud);

    // Add heart beat animation and chunk/blast styles
    const style = document.createElement("style");
    style.textContent = `
      @keyframes beat {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.25); }
      }
      .heart {
        display: inline-block;
      }
      .chunk {
        position: absolute;
        width: ${CHUNK_SIZE}px;
        height: ${CHUNK_SIZE}px;
        background: url('${CHUNK_TEXTURE}') repeat;
        background-size: cover;
        border: 1px solid #111;
        z-index: 0;
      }
      .blast {
        position: absolute;
        width: 24px;
        height: 24px;
        background: radial-gradient(circle, #7fffd4 60%, transparent 100%);
        border-radius: 50%;
        z-index: 3;
        pointer-events: none;
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);

    // Start game loop
    window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

    window.addEventListener("keydown", e => {
      if (e.key.toLowerCase() === "x") shootBlast();
    });

    requestAnimationFrame(gameLoop);
  }, 1000);
};

// --- Chunk System ---
function chunkKey(cx, cy) {
  return `${cx},${cy}`;
}

function loadChunks(center) {
  const newChunks = new Map();
  for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
    for (let dy = -CHUNK_RADIUS; dy <= CHUNK_RADIUS; dy++) {
      const cx = Math.floor(center.x / CHUNK_SIZE) + dx;
      const cy = Math.floor(center.y / CHUNK_SIZE) + dy;
      const key = chunkKey(cx, cy);
      if (!chunks.has(key)) {
        const chunk = createElement("div", {
          className: "chunk",
          style: {
            left: `${cx * CHUNK_SIZE}px`,
            top: `${cy * CHUNK_SIZE}px`,
            opacity: (Math.abs(dx) <= VISIBLE_RADIUS && Math.abs(dy) <= VISIBLE_RADIUS) ? 1 : 0
          }
        });
        floor.appendChild(chunk);
        newChunks.set(key, chunk);
      } else {
        newChunks.set(key, chunks.get(key));
      }
    }
  }
  // Remove old chunks
  for (const [key, chunk] of chunks.entries()) {
    if (!newChunks.has(key)) {
      chunk.remove();
    }
  }
  chunks = newChunks;
  // Update visibility
  for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
    for (let dy = -CHUNK_RADIUS; dy <= CHUNK_RADIUS; dy++) {
      const cx = Math.floor(center.x / CHUNK_SIZE) + dx;
      const cy = Math.floor(center.y / CHUNK_SIZE) + dy;
      const key = chunkKey(cx, cy);
      if (chunks.has(key)) {
        chunks.get(key).style.opacity = (Math.abs(dx) <= VISIBLE_RADIUS && Math.abs(dy) <= VISIBLE_RADIUS) ? 1 : 0;
      }
    }
  }
}

// --- Player Movement ---
function movePlayer() {
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len; dy /= len;
    playerPos.x += dx * PLAYER_SPEED;
    playerPos.y += dy * PLAYER_SPEED;
    lastDir = { x: dx, y: dy };
  }
}

// --- Magical Blast ---
function shootBlast() {
  if (lastDir.x === 0 && lastDir.y === 0) return;
  blasts.push({
    x: playerPos.x,
    y: playerPos.y,
    dx: lastDir.x,
    dy: lastDir.y,
    dist: 0,
    el: createElement("div", { className: "blast" })
  });
  floor.appendChild(blasts[blasts.length - 1].el);
}

// --- Game Loop ---
function gameLoop() {
  movePlayer();
  loadChunks(playerPos);

  // Center player on screen
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  player.style.left = `${screenW / 2 - 24}px`;
  player.style.top = `${screenH / 2 - 29}px`;

  // Move floor and chunks
  floor.style.left = `${screenW / 2 - playerPos.x}px`;
  floor.style.top = `${screenH / 2 - playerPos.y}px`;

  // Update blasts
  for (let i = blasts.length - 1; i >= 0; i--