/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 32-bit Arcade Controller Sprite Generator
 * Pre-renders fixed-frame pixel-art sprites for:
 * - 17 joystick directional frames: neutral, 8 half-tilt (in-between), and 8 full-tilt
 * - Q special button (White): unpressed and pressed
 * - E special button (Black): unpressed and pressed
 * - Pause button: unpressed and pressed
 * - Action buttons L (Red), S (Blue), C (Yellow), P (Green): unpressed and pressed
 *
 * All frames are generated once into offscreen canvases and cached as fixed sprite images
 * for maximum performance (0 layout recalculation, 0 runtime canvas painting, 60 FPS).
 */

export type StickState =
  | 'neutral'
  | 'half_up'
  | 'half_up_right'
  | 'half_right'
  | 'half_down_right'
  | 'half_down'
  | 'half_down_left'
  | 'half_left'
  | 'half_up_left'
  | 'up'
  | 'up_right'
  | 'right'
  | 'down_right'
  | 'down'
  | 'down_left'
  | 'left'
  | 'up_left';

export type ButtonType = 'Q' | 'E' | 'PAUSE' | 'G' | 'L' | 'S' | 'C' | 'P';

const STICK_SIZE = 104;
const BTN_SIZE = 52;
const SPECIAL_BTN_SIZE = 42;
const PAUSE_BTN_SIZE = 46;

// Helper to draw pixelated circle
function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), Math.max(1, Math.round(r)), 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), Math.max(1, Math.round(r)), 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Renders a 32-bit joystick frame
 */
function renderStickFrame(state: StickState): string {
  const canvas = document.createElement('canvas');
  canvas.width = STICK_SIZE;
  canvas.height = STICK_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const cx = STICK_SIZE / 2;
  const cy = STICK_SIZE / 2;

  // Compute stick deflection offset based on state
  let dist = 0;
  let angle = 0; // 0 = right, PI/2 = down, etc.

  if (state.startsWith('half_')) {
    dist = 11;
  } else if (state !== 'neutral') {
    dist = 23;
  }

  switch (state) {
    case 'half_up':
    case 'up':
      angle = -Math.PI / 2;
      break;
    case 'half_up_right':
    case 'up_right':
      angle = -Math.PI / 4;
      break;
    case 'half_right':
    case 'right':
      angle = 0;
      break;
    case 'half_down_right':
    case 'down_right':
      angle = Math.PI / 4;
      break;
    case 'half_down':
    case 'down':
      angle = Math.PI / 2;
      break;
    case 'half_down_left':
    case 'down_left':
      angle = (3 * Math.PI) / 4;
      break;
    case 'half_left':
    case 'left':
      angle = Math.PI;
      break;
    case 'half_up_left':
    case 'up_left':
      angle = -(3 * Math.PI) / 4;
      break;
    default:
      dist = 0;
      break;
  }

  const ballX = cx + Math.cos(angle) * dist;
  const ballY = cy + Math.sin(angle) * dist;

  // 1. Outer Chassis Collar (32-bit metallic bezel)
  fillCircle(ctx, cx, cy, 48, '#061019');
  strokeCircle(ctx, cx, cy, 48, '#0f273d', 2);
  strokeCircle(ctx, cx, cy, 46, '#1a3c5a', 1);

  // 2. Eight Directional Triangle Notches
  const notchAngles = [
    { a: -Math.PI / 2, id: 'up' },
    { a: -Math.PI / 4, id: 'up_right' },
    { a: 0, id: 'right' },
    { a: Math.PI / 4, id: 'down_right' },
    { a: Math.PI / 2, id: 'down' },
    { a: (3 * Math.PI) / 4, id: 'down_left' },
    { a: Math.PI, id: 'left' },
    { a: -(3 * Math.PI) / 4, id: 'up_left' },
  ];

  for (const n of notchAngles) {
    const nx = cx + Math.cos(n.a) * 41;
    const ny = cy + Math.sin(n.a) * 41;
    const isActive =
      state !== 'neutral' &&
      (state === n.id || state === `half_${n.id}`);

    ctx.fillStyle = isActive ? '#facc15' : '#1e3a54';
    ctx.beginPath();
    ctx.arc(nx, ny, isActive ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fill();

    if (isActive) {
      strokeCircle(ctx, nx, ny, 5, 'rgba(250, 204, 21, 0.45)', 1.5);
    }
  }

  // 3. Inner Recessed Well (Deep dark bowl)
  fillCircle(ctx, cx, cy, 35, '#040b12');
  strokeCircle(ctx, cx, cy, 35, '#0b1b2a', 1.5);
  fillCircle(ctx, cx, cy, 30, '#02060a');

  // 4. Rubber Dust Washer (moves slightly in deflection direction)
  const washerX = cx + Math.cos(angle) * (dist * 0.35);
  const washerY = cy + Math.sin(angle) * (dist * 0.35);
  fillCircle(ctx, washerX, washerY, 17, '#080808');
  strokeCircle(ctx, washerX, washerY, 17, '#1f2937', 1.2);
  fillCircle(ctx, washerX, washerY, 13, '#111827');

  // 5. Chrome Stick Shaft (Connecting washer to ball top)
  if (dist > 0) {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(washerX, washerY);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(washerX, washerY);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();
  }

  // 6. Ball Top Drop Shadow (opposite/below ball)
  fillCircle(ctx, ballX + (dist === 0 ? 0 : -Math.cos(angle) * 3), ballY + 4, 15, 'rgba(0,0,0,0.65)');

  // 7. Red Candy Ball Top (32-bit pixel dithered / shaded arcade ball)
  const ballR = 17;
  // Base dark crimson rim
  fillCircle(ctx, ballX, ballY, ballR, '#7f1d1d');
  strokeCircle(ctx, ballX, ballY, ballR, '#450a0a', 1.5);

  // Vibrant red body
  fillCircle(ctx, ballX - 0.5, ballY - 0.5, ballR - 1.5, '#dc2626');
  fillCircle(ctx, ballX - 1.5, ballY - 1.5, ballR - 3.5, '#ef4444');

  // Upper-left specular highlight (Glossy 32-bit sheen)
  fillCircle(ctx, ballX - 5, ballY - 5, 5, '#f87171');
  fillCircle(ctx, ballX - 6, ballY - 6, 2.5, '#ffffff');

  // Secondary lower bounce reflection
  fillCircle(ctx, ballX + 4, ballY + 4, 3, '#991b1b');

  return canvas.toDataURL('image/png');
}

/**
 * Renders Special Q Button (White arcade button)
 */
function renderSpecialQ(pressed: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = SPECIAL_BTN_SIZE;
  canvas.height = SPECIAL_BTN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const cx = SPECIAL_BTN_SIZE / 2;
  const cy = SPECIAL_BTN_SIZE / 2;
  const yOffset = pressed ? 2.5 : 0;

  // Outer dark rim
  fillCircle(ctx, cx, cy + 2, 19, '#09131d');
  strokeCircle(ctx, cx, cy + 2, 19, '#1e293b', 1.5);

  // Button Cap
  const capY = cy + yOffset;
  if (!pressed) {
    fillCircle(ctx, cx, capY + 1, 16.5, '#94a3b8'); // bottom bevel
    fillCircle(ctx, cx, capY, 16, '#f8fafc'); // pure white cap
    strokeCircle(ctx, cx, capY, 16, '#e2e8f0', 1);

    // Top crescent shine
    fillCircle(ctx, cx - 4, capY - 4, 3, '#ffffff');
  } else {
    fillCircle(ctx, cx, capY, 15, '#cbd5e1'); // pressed white cap
    strokeCircle(ctx, cx, capY, 15, '#64748b', 1.5);
  }

  // "Q" Letter Glyph
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pressed ? '#334155' : '#0f172a';
  ctx.fillText('Q', cx, capY + 0.5);

  return canvas.toDataURL('image/png');
}

/**
 * Renders Special E Button (Black arcade button)
 */
function renderSpecialE(pressed: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = SPECIAL_BTN_SIZE;
  canvas.height = SPECIAL_BTN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const cx = SPECIAL_BTN_SIZE / 2;
  const cy = SPECIAL_BTN_SIZE / 2;
  const yOffset = pressed ? 2.5 : 0;

  // Outer silver/metallic rim
  fillCircle(ctx, cx, cy + 2, 19, '#09131d');
  strokeCircle(ctx, cx, cy + 2, 19, '#475569', 1.5);

  // Button Cap
  const capY = cy + yOffset;
  if (!pressed) {
    fillCircle(ctx, cx, capY + 1, 16.5, '#09090b'); // bottom bevel
    fillCircle(ctx, cx, capY, 16, '#18181b'); // obsidian black cap
    strokeCircle(ctx, cx, capY, 16, '#3f3f46', 1);

    // Top gloss dot
    fillCircle(ctx, cx - 4, capY - 4, 2.5, '#52525b');
  } else {
    fillCircle(ctx, cx, capY, 15, '#09090b'); // pressed black cap
    strokeCircle(ctx, cx, capY, 15, '#27272a', 1.5);
  }

  // "E" Letter Glyph
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pressed ? '#94a3b8' : '#f8fafc';
  ctx.fillText('E', cx, capY + 0.5);

  return canvas.toDataURL('image/png');
}

/**
 * Renders Pause Button (Center circular button)
 */
function renderPauseButton(pressed: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = PAUSE_BTN_SIZE;
  canvas.height = PAUSE_BTN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const cx = PAUSE_BTN_SIZE / 2;
  const cy = PAUSE_BTN_SIZE / 2;
  const yOffset = pressed ? 2 : 0;

  // Outer gold ring
  fillCircle(ctx, cx, cy + 1, 21, '#78350f');
  strokeCircle(ctx, cx, cy + 1, 21, pressed ? '#b45309' : '#f59e0b', 2);

  // Inner dish
  const capY = cy + yOffset;
  fillCircle(ctx, cx, capY, 17, pressed ? '#050d16' : '#0a1a2c');
  strokeCircle(ctx, cx, capY, 17, '#0f2842', 1);

  // Pause bars (two vertical rectangles)
  const barColor = pressed ? '#f59e0b' : '#ffffff';
  ctx.fillStyle = barColor;
  ctx.fillRect(cx - 5, capY - 6, 3, 12);
  ctx.fillRect(cx + 2, capY - 6, 3, 12);

  return canvas.toDataURL('image/png');
}

/**
 * Renders Special G Button (Golden amber Ginga button for juggling & sombreros)
 */
function renderSpecialG(pressed: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = SPECIAL_BTN_SIZE;
  canvas.height = SPECIAL_BTN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const cx = SPECIAL_BTN_SIZE / 2;
  const cy = SPECIAL_BTN_SIZE / 2;
  const yOffset = pressed ? 2.5 : 0;

  // Outer dark bronze/amber rim
  fillCircle(ctx, cx, cy + 2, 19, '#09131d');
  strokeCircle(ctx, cx, cy + 2, 19, '#78350f', 1.5);

  // Button Cap
  const capY = cy + yOffset;
  if (!pressed) {
    fillCircle(ctx, cx, capY + 1, 16.5, '#92400e'); // bottom shadow bevel
    fillCircle(ctx, cx, capY, 16, '#f59e0b'); // vibrant amber cap
    strokeCircle(ctx, cx, capY, 16, '#fbbf24', 1);

    // Top crescent shine
    fillCircle(ctx, cx - 4, capY - 4, 3, '#fef3c7');
    fillCircle(ctx, cx - 5, capY - 5, 1.5, '#ffffff');
  } else {
    fillCircle(ctx, cx, capY, 15, '#b45309'); // pressed amber cap
    strokeCircle(ctx, cx, capY, 15, '#78350f', 1.5);
  }

  // "G" Letter Glyph
  ctx.font = 'bold 13px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pressed ? '#451a03' : '#1c1917';
  ctx.fillText('G', cx, capY + 1);

  return canvas.toDataURL('image/png');
}

/**
 * Renders Diamond Action Buttons (L, S, C, P)
 */
function renderActionButton(type: 'L' | 'S' | 'C' | 'P', pressed: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = BTN_SIZE;
  canvas.height = BTN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  const cx = BTN_SIZE / 2;
  const cy = BTN_SIZE / 2;
  const yOffset = pressed ? 3 : 0;

  // Color profiles per button
  let rimColor = '#1f2937';
  let baseColor = '#dc2626';
  let lightColor = '#f87171';
  let darkColor = '#7f1d1d';
  let textColor = '#ffffff';

  switch (type) {
    case 'L': // Red
      rimColor = '#450a0a';
      baseColor = '#dc2626';
      lightColor = '#f87171';
      darkColor = '#7f1d1d';
      break;
    case 'S': // Blue
      rimColor = '#172554';
      baseColor = '#2563eb';
      lightColor = '#60a5fa';
      darkColor = '#1e3a8a';
      break;
    case 'C': // Yellow
      rimColor = '#451a03';
      baseColor = '#eab308';
      lightColor = '#fde047';
      darkColor = '#854d0e';
      textColor = '#0f172a';
      break;
    case 'P': // Green
      rimColor = '#022c22';
      baseColor = '#16a34a';
      lightColor = '#4ade80';
      darkColor = '#14532d';
      break;
  }

  // Outer recessed bevel
  fillCircle(ctx, cx, cy + 2.5, 23, rimColor);
  strokeCircle(ctx, cx, cy + 2.5, 23, '#0b1724', 1.5);

  const capY = cy + yOffset;
  if (!pressed) {
    // 3D elevated button cap
    fillCircle(ctx, cx, capY + 1.5, 20.5, darkColor); // shadow lip
    fillCircle(ctx, cx, capY, 20, baseColor);
    strokeCircle(ctx, cx, capY, 20, darkColor, 1);

    // Specular highlight crescent
    fillCircle(ctx, cx - 5, capY - 5, 5, lightColor);
    fillCircle(ctx, cx - 6, capY - 6, 2.5, '#ffffff');
  } else {
    // Depressed cap
    fillCircle(ctx, cx, capY, 19, darkColor);
    fillCircle(ctx, cx, capY - 0.5, 18, baseColor);
    strokeCircle(ctx, cx, capY, 19, rimColor, 1.5);
  }

  // Center Letter Glyph
  ctx.font = 'bold 17px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.fillText(type, cx, capY + 1);

  return canvas.toDataURL('image/png');
}

// ========================================================
// PRE-CACHED SPRITE MAPS
// ========================================================

let stickCache: Record<StickState, string> | null = null;
let buttonCache: Record<ButtonType, { up: string; down: string }> | null = null;

export function resolveStickState(x: number, y: number): StickState {
  const dist = Math.hypot(x, y);
  if (dist < 0.22) return 'neutral';

  const isHalf = dist < 0.65;
  const angle = Math.atan2(y, x);
  let deg = (angle * 180) / Math.PI;
  if (deg < 0) deg += 360;

  let baseDir: 'right' | 'down_right' | 'down' | 'down_left' | 'left' | 'up_left' | 'up' | 'up_right';
  if (deg >= 337.5 || deg < 22.5) baseDir = 'right';
  else if (deg >= 22.5 && deg < 67.5) baseDir = 'down_right';
  else if (deg >= 67.5 && deg < 112.5) baseDir = 'down';
  else if (deg >= 112.5 && deg < 157.5) baseDir = 'down_left';
  else if (deg >= 157.5 && deg < 202.5) baseDir = 'left';
  else if (deg >= 202.5 && deg < 247.5) baseDir = 'up_left';
  else if (deg >= 247.5 && deg < 292.5) baseDir = 'up';
  else baseDir = 'up_right';

  return isHalf ? (`half_${baseDir}` as StickState) : baseDir;
}

export function getStickSprite(state: StickState): string {
  if (!stickCache) {
    const states: StickState[] = [
      'neutral',
      'half_up',
      'half_up_right',
      'half_right',
      'half_down_right',
      'half_down',
      'half_down_left',
      'half_left',
      'half_up_left',
      'up',
      'up_right',
      'right',
      'down_right',
      'down',
      'down_left',
      'left',
      'up_left',
    ];
    stickCache = {} as Record<StickState, string>;
    for (const s of states) {
      stickCache[s] = renderStickFrame(s);
    }
  }
  return stickCache[state] || stickCache.neutral;
}

export function getButtonSprite(type: ButtonType, pressed: boolean): string {
  if (!buttonCache) {
    buttonCache = {
      Q: { up: renderSpecialQ(false), down: renderSpecialQ(true) },
      E: { up: renderSpecialE(false), down: renderSpecialE(true) },
      PAUSE: { up: renderPauseButton(false), down: renderPauseButton(true) },
      G: { up: renderSpecialG(false), down: renderSpecialG(true) },
      L: { up: renderActionButton('L', false), down: renderActionButton('L', true) },
      S: { up: renderActionButton('S', false), down: renderActionButton('S', true) },
      C: { up: renderActionButton('C', false), down: renderActionButton('C', true) },
      P: { up: renderActionButton('P', false), down: renderActionButton('P', true) },
    };
  }
  return pressed ? buttonCache[type].down : buttonCache[type].up;
}
