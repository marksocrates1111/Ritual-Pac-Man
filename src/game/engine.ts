import { TILE_SIZE, COLS, ROWS, MAZE, COLORS, DIR } from './constants';
import { playWaka, playPowerPellet, playEatGhost, playDeath, playLevelClear, startSiren, stopSiren, setFrightenedSiren, playGameStart } from './audio';

const ritualLogo = new Image();
ritualLogo.src = '/ritgreen-logo.png';

export type Direction = { x: number; y: number };
export type GameState = 'waiting' | 'starting' | 'playing' | 'dying' | 'gameover' | 'won' | 'levelclear';

export interface PacmanState {
  x: number; y: number;
  dir: Direction; nextDir: Direction;
  mouthOpen: number; mouthDir: number;
}

export interface GhostState {
  x: number; y: number;
  dir: Direction;
  color: string;
  name: string;
  mode: 'chase' | 'scatter' | 'frightened' | 'eaten';
  prevMode: 'chase' | 'scatter';  // mode before frightened
  frightenedTimer: number;
  scatterTarget: { x: number; y: number };
  homeX: number; homeY: number;
  released: boolean;
  releaseTimer: number;
  bobOffset: number;  // for bouncing animation in ghost house
}

interface GameData {
  maze: number[][];
  pacman: PacmanState;
  ghosts: GhostState[];
  score: number;
  lives: number;
  level: number;
  dotsLeft: number;
  totalDots: number;
  state: GameState;
  ghostEatCombo: number;
  frameCount: number;
  // Scatter/chase mode timing (in frames at 60fps)
  modeTimer: number;
  modePhase: number;  // which scatter/chase phase (0-7)
  globalMode: 'scatter' | 'chase';
  scorePopups: { x: number; y: number; score: number; timer: number }[];
  pauseTimer: number;
}

// Scatter/Chase timing for Level 1 (in seconds, converted to frames)
// Scatter 7s → Chase 20s → Scatter 7s → Chase 20s → Scatter 5s → Chase 20s → Scatter 5s → Chase indefinite
const MODE_TIMINGS = [
  { mode: 'scatter' as const, duration: 7 * 60 },
  { mode: 'chase' as const, duration: 20 * 60 },
  { mode: 'scatter' as const, duration: 7 * 60 },
  { mode: 'chase' as const, duration: 20 * 60 },
  { mode: 'scatter' as const, duration: 5 * 60 },
  { mode: 'chase' as const, duration: 20 * 60 },
  { mode: 'scatter' as const, duration: 5 * 60 },
  { mode: 'chase' as const, duration: Infinity }, // indefinite chase
];

// Speed config: frames per move (lower = faster)
// These are base values; getGhostSpeed adjusts by level
const SPEED = {
  pacmanNormal: 6,
  pacmanFrightened: 5,
  ghostNormal: 7,
  ghostFrightened: 12,
  ghostTunnel: 14,
  ghostEaten: 7,         // same speed as normal (not rushed)
};

// Level difficulty: returns speed adjustments & frightened duration
function getLevelConfig(level: number) {
  if (level === 1) return { ghostSpeed: 9, frightDuration: 360, pacSpeed: 7 };
  if (level === 2) return { ghostSpeed: 8, frightDuration: 300, pacSpeed: 6 };
  if (level === 3) return { ghostSpeed: 7, frightDuration: 240, pacSpeed: 6 };
  if (level <= 6) return { ghostSpeed: 6, frightDuration: 180, pacSpeed: 5 };
  if (level <= 10) return { ghostSpeed: 5, frightDuration: 120, pacSpeed: 5 };
  return { ghostSpeed: 4, frightDuration: 60, pacSpeed: 4 }; // level 11+: very fast
}

// Ghost release timing based on level
function getGhostReleaseTimers(level: number): [number, number, number] {
  // Level 1: 15s interval, Level 2: 14.5s... up to minimum of 10s
  const intervalSeconds = Math.max(10, 15 - (level - 1) * 0.5);
  const intervalFrames = intervalSeconds * 60;
  return [intervalFrames, intervalFrames * 2, intervalFrames * 3];
}

// Tunnel zone: y=14, x<=5 or x>=22
function isInTunnel(x: number): boolean {
  return x <= 5 || x >= 22;
}

function cloneMaze(): number[][] {
  return MAZE.map(row => [...row]);
}

function countDots(maze: number[][]): number {
  let count = 0;
  for (const row of maze) for (const cell of row) if (cell === 2 || cell === 3) count++;
  return count;
}

export function createGame(level = 1): GameData {
  const maze = cloneMaze();
  const dots = countDots(maze);
  const [t1, t2, t3] = getGhostReleaseTimers(level);
  return {
    maze,
    pacman: { x: 14, y: 23, dir: DIR.LEFT, nextDir: DIR.LEFT, mouthOpen: 0, mouthDir: 1 },
    ghosts: [
      { x: 14, y: 11, dir: DIR.LEFT, color: COLORS.ghostRed, name: 'blinky', mode: 'scatter', prevMode: 'scatter', frightenedTimer: 0, scatterTarget: { x: 25, y: 0 }, homeX: 14, homeY: 14, released: true, releaseTimer: 0, bobOffset: 0 },
      { x: 14, y: 14, dir: DIR.UP, color: COLORS.ghostPink, name: 'pinky', mode: 'scatter', prevMode: 'scatter', frightenedTimer: 0, scatterTarget: { x: 2, y: 0 }, homeX: 14, homeY: 14, released: false, releaseTimer: t1, bobOffset: 0 },
      { x: 12, y: 14, dir: DIR.UP, color: COLORS.ghostCyan, name: 'inky', mode: 'scatter', prevMode: 'scatter', frightenedTimer: 0, scatterTarget: { x: 27, y: 30 }, homeX: 12, homeY: 14, released: false, releaseTimer: t2, bobOffset: 0 },
      { x: 16, y: 14, dir: DIR.UP, color: COLORS.ghostOrange, name: 'clyde', mode: 'scatter', prevMode: 'scatter', frightenedTimer: 0, scatterTarget: { x: 0, y: 30 }, homeX: 16, homeY: 14, released: false, releaseTimer: t3, bobOffset: 0 },
    ],
    score: 0, lives: 3, level, dotsLeft: dots, totalDots: dots,
    state: 'waiting', ghostEatCombo: 0, frameCount: 0,
    modeTimer: 0, modePhase: 0, globalMode: 'scatter',
    scorePopups: [], pauseTimer: 0,
  };
}

function canMove(maze: number[][], x: number, y: number, dir: Direction, isGhost = false, ghostReleased = false, ghostEaten = false): boolean {
  let nx = x + dir.x;
  let ny = y + dir.y;
  if (nx < 0) nx = COLS - 1;
  if (nx >= COLS) nx = 0;
  const cell = maze[ny]?.[nx];
  if (cell === undefined) return false;
  if (cell === 1) return false; // Walls always block everyone
  
  // Eaten ghosts can enter the ghost house (4) and gate (5)
  if (ghostEaten && (cell === 4 || cell === 5)) return true;

  if (cell === 5 && !isGhost) return false; // Pacman cannot enter gate
  
  // Prevent released ghosts from re-entering the ghost house
  if (cell === 5 && isGhost && ghostReleased && dir.y > 0) return false;
  if (cell === 4 && isGhost && ghostReleased) return false;
  
  return true;
}

function getGhostTarget(ghost: GhostState, pacman: PacmanState, blinky: GhostState): { x: number; y: number } {
  if (ghost.mode === 'eaten') return { x: 14, y: 11 }; // above the gate
  if (ghost.mode === 'scatter') return ghost.scatterTarget;
  if (ghost.mode === 'frightened') return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  // Chase mode targets
  switch (ghost.name) {
    case 'blinky': return { x: pacman.x, y: pacman.y };
    case 'pinky': return { x: pacman.x + pacman.dir.x * 4, y: pacman.y + pacman.dir.y * 4 };
    case 'inky': {
      const ax = pacman.x + pacman.dir.x * 2;
      const ay = pacman.y + pacman.dir.y * 2;
      return { x: ax + (ax - blinky.x), y: ay + (ay - blinky.y) };
    }
    case 'clyde': {
      const dist = Math.abs(ghost.x - pacman.x) + Math.abs(ghost.y - pacman.y);
      return dist > 8 ? { x: pacman.x, y: pacman.y } : ghost.scatterTarget;
    }
    default: return { x: pacman.x, y: pacman.y };
  }
}

function moveGhost(game: GameData, ghost: GhostState): void {
  // Unreleased ghosts bob up and down inside the ghost house
  if (!ghost.released) {
    ghost.releaseTimer--;
    // Bob animation: oscillate between y positions
    ghost.bobOffset = Math.sin(game.frameCount * 0.08) * 0.4;
    if (ghost.releaseTimer <= 0) {
      ghost.released = true;
      ghost.x = 14; ghost.y = 11;
      ghost.dir = DIR.LEFT;
      ghost.bobOffset = 0;
    }
    return;
  }

  const target = getGhostTarget(ghost, game.pacman, game.ghosts[0]);
  const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
  const opposite = { x: -ghost.dir.x, y: -ghost.dir.y };

  let bestDir = ghost.dir;
  let bestDist = Infinity;

  for (const d of dirs) {
    if (d.x === opposite.x && d.y === opposite.y) continue;
    if (!canMove(game.maze, ghost.x, ghost.y, d, true, ghost.released, ghost.mode === 'eaten')) continue;
    const nx = ghost.x + d.x;
    const ny = ghost.y + d.y;
    const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
    if (dist < bestDist) { bestDist = dist; bestDir = d; }
  }

  ghost.dir = bestDir;
  ghost.x += ghost.dir.x;
  ghost.y += ghost.dir.y;

  // Tunnel wrap
  if (ghost.x < 0) ghost.x = COLS - 1;
  if (ghost.x >= COLS) ghost.x = 0;

  // (frightened timer is now handled in updateGame, not here)

  // Eaten ghost returns home
  if (ghost.mode === 'eaten') {
    // Check if near the ghost house entrance
    if (ghost.x >= 12 && ghost.x <= 16 && ghost.y >= 11 && ghost.y <= 15) {
      ghost.mode = game.globalMode;
      ghost.prevMode = game.globalMode;
      ghost.x = 14;
      ghost.y = 11;
      ghost.dir = DIR.LEFT;
    }
  }
}

// Get speed (frames per move) for a ghost based on its state
function getGhostSpeed(ghost: GhostState, level: number): number {
  const cfg = getLevelConfig(level);
  if (ghost.mode === 'eaten') return SPEED.ghostEaten;
  if (ghost.mode === 'frightened') return SPEED.ghostFrightened;
  if (isInTunnel(ghost.x)) return SPEED.ghostTunnel;
  return cfg.ghostSpeed;
}

// Collision check helper — returns true if Pac-Man died
function checkCollisions(game: GameData): boolean {
  for (const g of game.ghosts) {
    if (g.x === game.pacman.x && g.y === game.pacman.y) {
      if (g.mode === 'frightened') {
        g.mode = 'eaten';
        game.ghostEatCombo++;
        const points = 200 * (2 ** (game.ghostEatCombo - 1));
        game.score += points;
        playEatGhost();
        game.scorePopups.push({ x: g.x, y: g.y, score: points, timer: 60 });
        game.pauseTimer = 60; // Freeze for 1 second
      } else if (g.mode !== 'eaten') {
        game.lives--;
        stopSiren();
        if (game.lives <= 0) {
          game.state = 'gameover';
          playDeath();
        } else {
          game.state = 'dying';
          playDeath();
          const [t1, t2, t3] = getGhostReleaseTimers(game.level);
          setTimeout(() => {
            game.pacman = { x: 14, y: 23, dir: DIR.LEFT, nextDir: DIR.LEFT, mouthOpen: 0, mouthDir: 1 };
            game.ghosts[0] = { ...game.ghosts[0], x: 14, y: 11, dir: DIR.LEFT, mode: 'scatter', prevMode: 'scatter', released: true, releaseTimer: 0 };
            game.ghosts[1] = { ...game.ghosts[1], x: 14, y: 14, dir: DIR.UP, mode: 'scatter', prevMode: 'scatter', released: false, releaseTimer: t1, bobOffset: 0 };
            game.ghosts[2] = { ...game.ghosts[2], x: 12, y: 14, dir: DIR.UP, mode: 'scatter', prevMode: 'scatter', released: false, releaseTimer: t2, bobOffset: 0 };
            game.ghosts[3] = { ...game.ghosts[3], x: 16, y: 14, dir: DIR.UP, mode: 'scatter', prevMode: 'scatter', released: false, releaseTimer: t3, bobOffset: 0 };
            game.modeTimer = 0;
            game.modePhase = 0;
            game.globalMode = 'scatter';
            game.state = 'playing';
          }, 1500);
        }
        return true;
      }
    }
  }
  return false;
}

export function updateGame(game: GameData): void {
  if (game.state !== 'playing') return;
  
  if (game.pauseTimer > 0) {
    game.pauseTimer--;
    // Update popups during pause
    if (game.scorePopups) {
      for (let i = game.scorePopups.length - 1; i >= 0; i--) {
        game.scorePopups[i].timer--;
        if (game.scorePopups[i].timer <= 0) game.scorePopups.splice(i, 1);
      }
    }
    return; // Skip normal updates
  }

  // Update popups during normal play
  if (game.scorePopups) {
    for (let i = game.scorePopups.length - 1; i >= 0; i--) {
      game.scorePopups[i].timer--;
      if (game.scorePopups[i].timer <= 0) game.scorePopups.splice(i, 1);
    }
  }

  game.frameCount++;

  // ─── SCATTER/CHASE MODE SWITCHING ───
  game.modeTimer++;
  const currentPhase = MODE_TIMINGS[game.modePhase];
  if (currentPhase && game.modeTimer >= currentPhase.duration && game.modePhase < MODE_TIMINGS.length - 1) {
    game.modeTimer = 0;
    game.modePhase++;
    const newPhase = MODE_TIMINGS[game.modePhase];
    game.globalMode = newPhase.mode;
    // Force direction reversal for all active ghosts on mode change
    for (const g of game.ghosts) {
      if (g.released && g.mode !== 'frightened' && g.mode !== 'eaten') {
        g.mode = newPhase.mode;
        g.prevMode = newPhase.mode;
        g.dir = { x: -g.dir.x, y: -g.dir.y }; // reverse direction!
      }
    }
  }

  // ─── PAC-MAN ANIMATION ───
  game.pacman.mouthOpen += 0.15 * game.pacman.mouthDir;
  if (game.pacman.mouthOpen >= 1) game.pacman.mouthDir = -1;
  if (game.pacman.mouthOpen <= 0) game.pacman.mouthDir = 1;

  // ─── FRIGHTENED TIMER (decrements every frame, not per-move) ───
  for (const g of game.ghosts) {
    if (g.mode === 'frightened') {
      g.frightenedTimer--;
      if (g.frightenedTimer <= 0) {
        g.mode = g.prevMode;
      }
    }
  }

  // ─── MOVE PAC-MAN ───
  const cfg = getLevelConfig(game.level);
  const hasFrightened = game.ghosts.some(g => g.mode === 'frightened');
  const pacSpeed = hasFrightened ? SPEED.pacmanFrightened : cfg.pacSpeed;
  if (game.frameCount % pacSpeed === 0) {
    // Try queued direction first
    if (canMove(game.maze, game.pacman.x, game.pacman.y, game.pacman.nextDir)) {
      game.pacman.dir = game.pacman.nextDir;
    }
    if (canMove(game.maze, game.pacman.x, game.pacman.y, game.pacman.dir)) {
      game.pacman.x += game.pacman.dir.x;
      game.pacman.y += game.pacman.dir.y;
      if (game.pacman.x < 0) game.pacman.x = COLS - 1;
      if (game.pacman.x >= COLS) game.pacman.x = 0;
    }

    // Check collision immediately after Pac-Man moves
    if (checkCollisions(game)) return;

    // Eat dots
    const cell = game.maze[game.pacman.y]?.[game.pacman.x];
    if (cell === 2) {
      game.maze[game.pacman.y][game.pacman.x] = 0;
      game.score += 10;
      game.dotsLeft--;
      playWaka();
    } else if (cell === 3) {
      // Power pellet — enter frightened mode!
      game.maze[game.pacman.y][game.pacman.x] = 0;
      game.score += 50;
      game.dotsLeft--;
      game.ghostEatCombo = 0;
      playPowerPellet();
      const frightDur = cfg.frightDuration;
      for (const g of game.ghosts) {
        if (g.mode !== 'eaten' && g.released) {
          g.prevMode = (g.mode === 'frightened') ? g.prevMode : g.mode as 'chase' | 'scatter';
          g.mode = 'frightened';
          g.frightenedTimer = frightDur;
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        }
      }
    }

    if (game.dotsLeft <= 0) {
      game.state = 'levelclear';
      playLevelClear();
      return;
    }
  }

  // Manage Siren
  if (game.state === 'playing') {
    startSiren();
    setFrightenedSiren(hasFrightened);
  } else {
    stopSiren();
  }

  // ─── MOVE GHOSTS (each ghost has its own speed) ───
  for (const g of game.ghosts) {
    if (!g.released) {
      moveGhost(game, g);
      continue;
    }
    const speed = getGhostSpeed(g, game.level);
    if (game.frameCount % speed === 0) {
      moveGhost(game, g);
      // Check collision immediately after each ghost moves
      if (checkCollisions(game)) return;
    }
  }
}

// ─── RENDERER ───
export function renderGame(ctx: CanvasRenderingContext2D, game: GameData): void {
  const T = TILE_SIZE;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, COLS * T, ROWS * T);

  // Draw maze
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = game.maze[y][x];
      if (cell === 1) {
        drawWall(ctx, x, y, game.maze);
      } else if (cell === 2) {
        // Gold Coin
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        // Inner detail
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (cell === 3) {
        // Power pellet — pulsing Ritual Logo
        const pulse = 0.5 + 0.5 * Math.sin(game.frameCount * 0.1);
        ctx.globalAlpha = pulse;
        const size = 12; // Made smaller as requested
        if (ritualLogo.complete && ritualLogo.naturalWidth > 0) {
          ctx.drawImage(ritualLogo, x * T + (T - size) / 2, y * T + (T - size) / 2, size, size);
        } else {
          ctx.fillStyle = COLORS.powerPellet;
          ctx.beginPath();
          ctx.arc(x * T + T / 2, y * T + T / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (cell === 5) {
        ctx.strokeStyle = COLORS.gate;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = COLORS.gate;
        ctx.beginPath();
        ctx.moveTo(x * T, y * T + T / 2);
        ctx.lineTo(x * T + T, y * T + T / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Draw ghosts
  for (const g of game.ghosts) {
    drawGhost(ctx, g, game.frameCount);
  }

  // Draw Pac-Man
  if (game.state !== 'dying') {
    drawPacman(ctx, game.pacman, game.frameCount);
  }

  // Draw Score Popups
  if (game.scorePopups && game.scorePopups.length > 0) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    for (const popup of game.scorePopups) {
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
      ctx.fillText(popup.score.toString(), popup.x * TILE_SIZE + TILE_SIZE / 2, popup.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, maze: number[][]): void {
  const T = TILE_SIZE;
  const px = x * T;
  const py = y * T;

  ctx.fillStyle = COLORS.wallFill;
  ctx.fillRect(px + 1, py + 1, T - 2, T - 2);

  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1.5;

  const isW = (cx: number, cy: number) => {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return true;
    const c = maze[cy]?.[cx];
    return c === 1 || c === 5;
  };

  if (!isW(x, y - 1)) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + T, py); ctx.stroke(); }
  if (!isW(x, y + 1)) { ctx.beginPath(); ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); ctx.stroke(); }
  if (!isW(x - 1, y)) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + T); ctx.stroke(); }
  if (!isW(x + 1, y)) { ctx.beginPath(); ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); ctx.stroke(); }

}

function drawPacman(ctx: CanvasRenderingContext2D, pac: PacmanState, frame: number): void {
  const T = TILE_SIZE;
  const cx = pac.x * T + T / 2;
  const cy = pac.y * T + T / 2;
  const r = T / 2 - 1;
  // Wide mouth like classic Pac-Man
  const mouth = pac.mouthOpen * 0.5;

  let angle = 0;
  if (pac.dir.x === 1) angle = 0;
  else if (pac.dir.x === -1) angle = Math.PI;
  else if (pac.dir.y === -1) angle = -Math.PI / 2;
  else if (pac.dir.y === 1) angle = Math.PI / 2;

  // Glow
  ctx.fillStyle = COLORS.pacman;
  ctx.shadowBlur = 14;
  ctx.shadowColor = COLORS.pacmanGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Direction arrow
  const arrowDist = r + 6;
  const ax = cx + pac.dir.x * arrowDist;
  const ay = cy + pac.dir.y * arrowDist;
  const arrowSize = 4;

  ctx.fillStyle = COLORS.pacman;
  ctx.globalAlpha = 0.4 + 0.3 * Math.sin(frame * 0.12);
  ctx.shadowBlur = 6;
  ctx.shadowColor = COLORS.pacmanGlow;
  ctx.beginPath();
  if (pac.dir.x === 1) {
    ctx.moveTo(ax + arrowSize, ay);
    ctx.lineTo(ax - arrowSize, ay - arrowSize);
    ctx.lineTo(ax - arrowSize, ay + arrowSize);
  } else if (pac.dir.x === -1) {
    ctx.moveTo(ax - arrowSize, ay);
    ctx.lineTo(ax + arrowSize, ay - arrowSize);
    ctx.lineTo(ax + arrowSize, ay + arrowSize);
  } else if (pac.dir.y === -1) {
    ctx.moveTo(ax, ay - arrowSize);
    ctx.lineTo(ax - arrowSize, ay + arrowSize);
    ctx.lineTo(ax + arrowSize, ay + arrowSize);
  } else if (pac.dir.y === 1) {
    ctx.moveTo(ax, ay + arrowSize);
    ctx.lineTo(ax - arrowSize, ay - arrowSize);
    ctx.lineTo(ax + arrowSize, ay - arrowSize);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: GhostState, frame: number): void {
  const T = TILE_SIZE;
  // Apply bob offset for unreleased ghosts
  const bobPixels = ghost.released ? 0 : ghost.bobOffset * T;
  const cx = ghost.x * T + T / 2;
  const cy = ghost.y * T + T / 2 + bobPixels;
  const r = T / 2 - 2;

  let color = ghost.color;

  if (ghost.mode === 'eaten') {
    // Just eyes — moving fast back to the house
    drawGhostEyes(ctx, cx, cy, ghost.dir);
    return;
  }

  if (ghost.mode === 'frightened') {
    // Flashing when about to wear off (last 2 seconds = 120 frames)
    if (ghost.frightenedTimer < 120 && Math.floor(frame / 10) % 2 === 0) {
      color = COLORS.frightenedFlash;
    } else {
      color = COLORS.frightened;
    }
  }

  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;

  // Body — dome top + wavy bottom
  ctx.beginPath();
  ctx.arc(cx, cy - 2, r, Math.PI, 0);
  ctx.lineTo(cx + r, cy + r - 2);
  // Wavy tentacles
  const waveSpeed = ghost.mode === 'frightened' ? 0.08 : 0.2;
  const wave = Math.sin(frame * waveSpeed) * 2;
  for (let i = 0; i < 3; i++) {
    const lx = cx + r - (i + 1) * (r * 2 / 3);
    ctx.quadraticCurveTo(lx + r / 3, cy + r + wave, lx, cy + r - 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Eyes
  if (ghost.mode === 'frightened') {
    // Frightened face — small dots for eyes, wavy mouth
    ctx.fillStyle = '#fff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wavy frown
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 4);
    for (let i = 0; i <= 10; i++) {
      ctx.lineTo(cx - 5 + i, cy + 4 + (i % 2 === 0 ? -1 : 1));
    }
    ctx.stroke();
  } else {
    drawGhostEyes(ctx, cx, cy, ghost.dir);
  }
}

function drawGhostEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: Direction): void {
  const eyeOff = 4;
  for (const side of [-1, 1]) {
    // White
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + side * eyeOff, cy - 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupil — looks in the direction of travel
    ctx.fillStyle = '#22f';
    ctx.beginPath();
    ctx.arc(cx + side * eyeOff + dir.x * 2, cy - 3 + dir.y * 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function handleKeyDown(game: GameData, key: string): void {
  if (game.state === 'starting') return;
  if (game.state === 'waiting' || game.state === 'gameover' || game.state === 'levelclear') {
    if (key === ' ' || key === 'Enter') {
      game.state = 'starting';
      playGameStart().then(() => {
        if (game.state === 'starting') game.state = 'playing';
      });
    }
    return;
  }
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': game.pacman.nextDir = DIR.UP; break;
    case 'ArrowDown': case 's': case 'S': game.pacman.nextDir = DIR.DOWN; break;
    case 'ArrowLeft': case 'a': case 'A': game.pacman.nextDir = DIR.LEFT; break;
    case 'ArrowRight': case 'd': case 'D': game.pacman.nextDir = DIR.RIGHT; break;
  }
}
