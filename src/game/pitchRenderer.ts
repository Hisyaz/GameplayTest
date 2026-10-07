import { PITCH_CONFIG, HOME_KIT, AWAY_KIT } from './constants';
import { TurfParticle, GoalNetState } from '../types';

let pitchPatternCanvas: HTMLCanvasElement | null = null;

/**
 * Creates an authentic, high-detail 16-bit pixel turf pattern with directional mowing stripes,
 * individual grass blade dithering, cylinder mower track sheen, and natural turf depth.
 */
function getPitchPattern(): HTMLCanvasElement {
  if (pitchPatternCanvas) return pitchPatternCanvas;

  const canvas = document.createElement('canvas');
  const stripeH = 64; // Regulation mowing stripe height
  canvas.width = 160;
  canvas.height = stripeH * 2; // 2 alternating mower bands
  const ctx = canvas.getContext('2d')!;

  // ---------------------------------------------------------
  // STRIPE 1: Sunlit / Lighter Cut Grass Band
  // ---------------------------------------------------------
  const baseLight = '#3e9a1f';
  ctx.fillStyle = baseLight;
  ctx.fillRect(0, 0, canvas.width, stripeH);

  // Mower cylinder roller sheen highlight (1px at top)
  ctx.fillStyle = '#58c030';
  ctx.fillRect(0, 0, canvas.width, 1);
  ctx.fillStyle = '#4db226';
  ctx.fillRect(0, 1, canvas.width, 1);
  // Mower blade cut depression shadow (1px at bottom)
  ctx.fillStyle = '#266c11';
  ctx.fillRect(0, stripeH - 1, canvas.width, 1);

  // ---------------------------------------------------------
  // STRIPE 2: Velvety / Darker Cut Grass Band
  // ---------------------------------------------------------
  const baseDark = '#338317';
  ctx.fillStyle = baseDark;
  ctx.fillRect(0, stripeH, canvas.width, stripeH);

  // Mower roller boundary highlight (1px at top of dark band)
  ctx.fillStyle = '#48a623';
  ctx.fillRect(0, stripeH, canvas.width, 1);
  // Mower cut depression shadow (1px at bottom of dark band)
  ctx.fillStyle = '#1c520a';
  ctx.fillRect(0, stripeH * 2 - 1, canvas.width, 1);

  // ---------------------------------------------------------
  // HIGH-DETAIL PIXEL GRASS BLADE DITHERING
  // Creates authentic tactile turf with 2-3px grass flecks,
  // blade highlights, and lowlight blade bases.
  // ---------------------------------------------------------
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Pseudo-random deterministic hash for repeatable seamless pattern
  const pHash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) ^ (x * y);
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) & 0xffff;
  };

  for (let y = 0; y < canvas.height; y++) {
    const isDarkStripe = y >= stripeH;
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const rnd = pHash(x, y);

      // Grass blade highlights (sun-catching tips of grass)
      if (rnd % 19 === 0) {
        // Bright grass tip
        const boost = isDarkStripe ? 26 : 34;
        data[idx] = Math.min(255, data[idx] + boost * 0.45);
        data[idx + 1] = Math.min(255, data[idx + 1] + boost);
        data[idx + 2] = Math.min(255, data[idx + 2] + boost * 0.35);
      } else if (rnd % 23 === 0) {
        // Subtle secondary blade sheen
        const boost = isDarkStripe ? 16 : 20;
        data[idx] = Math.min(255, data[idx] + boost * 0.4);
        data[idx + 1] = Math.min(255, data[idx + 1] + boost);
        data[idx + 2] = Math.min(255, data[idx + 2] + boost * 0.3);
      } else if (rnd % 17 === 0) {
        // Turf root depth shadow
        const cut = isDarkStripe ? 24 : 18;
        data[idx] = Math.max(0, data[idx] - cut * 0.5);
        data[idx + 1] = Math.max(0, data[idx + 1] - cut);
        data[idx + 2] = Math.max(0, data[idx + 2] - cut * 0.4);
      } else {
        // Micro-fine blade texture
        const microNoise = ((rnd % 11) - 5) * 2;
        data[idx] = Math.max(0, Math.min(255, data[idx] + microNoise * 0.3));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + microNoise * 0.8));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + microNoise * 0.25));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add subtle 2px directional grass blade tufts for high-craft 16-bit finish
  ctx.fillStyle = 'rgba(100, 220, 60, 0.28)';
  for (let y = 3; y < canvas.height - 3; y += 7) {
    for (let x = 4; x < canvas.width - 4; x += 11) {
      const h = pHash(x, y);
      if (h % 5 === 0) {
        ctx.fillRect(x, y, 1, 2);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      }
    }
  }

  ctx.fillStyle = 'rgba(15, 50, 10, 0.32)';
  for (let y = 4; y < canvas.height - 4; y += 8) {
    for (let x = 5; x < canvas.width - 5; x += 13) {
      const h = pHash(x * 3, y * 2);
      if (h % 5 === 0) {
        ctx.fillRect(x, y + 2, 2, 1);
      }
    }
  }

  pitchPatternCanvas = canvas;
  return canvas;
}

/**
 * Draws the entire realistic pixel football stadium, pitch, markings, crowd, and 3D goals
 */
export function drawPitch(
  ctx: CanvasRenderingContext2D,
  viewLeft: number,
  viewTop: number,
  viewWidth: number,
  viewHeight: number,
  topNetState?: GoalNetState | number,
  bottomNetState?: GoalNetState | number,
  pitchTilt: number = 0.5
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Normalize net states
  const topNet: GoalNetState = (typeof topNetState === 'object' && topNetState !== null)
    ? topNetState
    : { impactX: PITCH_CONFIG.CENTER_X, impactY: PITCH_CONFIG.PITCH_TOP - 20, impactZ: 10, bulgeAmount: 0, bulgeVel: 0, shake: typeof topNetState === 'number' ? topNetState : 0, ballCaught: false };

  const bottomNet: GoalNetState = (typeof bottomNetState === 'object' && bottomNetState !== null)
    ? bottomNetState
    : { impactX: PITCH_CONFIG.CENTER_X, impactY: PITCH_CONFIG.PITCH_BOTTOM + 20, impactZ: 10, bulgeAmount: 0, bulgeVel: 0, shake: typeof bottomNetState === 'number' ? bottomNetState : 0, ballCaught: false };

  // 1. Draw Stadium Surround & Running Track
  drawStadiumSurrounds(ctx);

  // 2. Draw Textured Regulation Grass Pitch
  const grassCanvas = getPitchPattern();
  const pattern = ctx.createPattern(grassCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
  } else {
    ctx.fillStyle = '#3e8f1c';
  }

  // Draw regulation pitch field plus apron
  ctx.fillRect(
    PITCH_CONFIG.PITCH_LEFT - 70,
    PITCH_CONFIG.PITCH_TOP - 70,
    PITCH_CONFIG.FIELD_WIDTH + 140,
    PITCH_CONFIG.FIELD_HEIGHT + 140
  );

  // 3. Draw Goalmouth Scuffed Turf & Penalty Box Wear (authentic realism)
  drawGoalmouthWear(ctx);

  // 4. Draw Regulation Pitch Markings with embedded chalk depth
  drawPitchMarkings(ctx);

  // 5. Draw Technical Areas & Dugouts outside touchlines
  drawTechnicalAreas(ctx);

  // 6. Corner Flags
  drawCornerFlags(ctx);

  // 7. Draw Grandstands & Crowd at top & bottom
  drawCrowdGrandstand(ctx);
  drawBottomCrowdGrandstand(ctx);

  // 8. Draw Top Goal (Rival Goal with 3D net depth, crossbar, and shadow)
  drawTopGoal(ctx, topNet, pitchTilt);

  // 9. Draw Bottom Goal (Own Goal with 3D net depth, crossbar, and shadow)
  drawBottomGoal(ctx, bottomNet, pitchTilt);

  ctx.restore();
}

/**
 * Draws outer stadium surrounds: red cinder running track and outer concrete wall
 */
function drawStadiumSurrounds(ctx: CanvasRenderingContext2D) {
  const left = PITCH_CONFIG.PITCH_LEFT - 130;
  const top = PITCH_CONFIG.PITCH_TOP - 160;
  const width = PITCH_CONFIG.FIELD_WIDTH + 260;
  const height = PITCH_CONFIG.FIELD_HEIGHT + 320;

  // Outer dark stadium concrete floor
  ctx.fillStyle = '#1e241c';
  ctx.fillRect(left - 40, top - 40, width + 80, height + 80);

  // Red cinder / clay running track perimeter (classic Olympic stadium style)
  ctx.fillStyle = '#873d2f';
  ctx.fillRect(left, top, width, height);

  // Running track lane lines (crisp pixel dashes)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(left + 15, top + 15, width - 30, height - 30);
  ctx.strokeRect(left + 35, top + 35, width - 70, height - 70);
  ctx.setLineDash([]);

  // Running track surface grain
  ctx.fillStyle = '#733327';
  for (let y = top + 8; y < top + height; y += 14) {
    ctx.fillRect(left + 4, y, width - 8, 1);
  }
}

/**
 * Draws authentic goalmouth scuff marks and worn penalty box grass
 * where goalkeepers and penalty takers wear down the turf.
 */
function drawGoalmouthWear(ctx: CanvasRenderingContext2D) {
  const cx = PITCH_CONFIG.CENTER_X;
  const top = PITCH_CONFIG.PITCH_TOP;
  const bottom = PITCH_CONFIG.PITCH_BOTTOM;
  const sixW = PITCH_CONFIG.SIX_YARD_BOX_WIDTH;

  ctx.save();

  // TOP GOALMOUTH SCUFF (Around rival goalkeeper area)
  drawGoalAreaWearPatch(ctx, cx, top + 14, sixW * 0.7, 24);
  // Top penalty spot wear spot
  drawPenaltySpotScuff(ctx, cx, top + PITCH_CONFIG.PENALTY_SPOT_DIST);

  // BOTTOM GOALMOUTH SCUFF (Around home goalkeeper area)
  drawGoalAreaWearPatch(ctx, cx, bottom - 14, sixW * 0.7, 24);
  // Bottom penalty spot wear spot
  drawPenaltySpotScuff(ctx, cx, bottom - PITCH_CONFIG.PENALTY_SPOT_DIST);

  // Center circle kickoff trampled scuff
  drawKickoffScuff(ctx, cx, PITCH_CONFIG.CENTER_Y);

  ctx.restore();
}

function drawGoalAreaWearPatch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number
) {
  // Translucent worn earthy turf base
  ctx.fillStyle = 'rgba(65, 90, 32, 0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Earthy soil flecks in goalmouth
  ctx.fillStyle = '#4d5e28';
  for (let i = -w / 2 + 6; i < w / 2 - 6; i += 7) {
    const py = cy + Math.sin(i * 0.4) * (h * 0.35);
    ctx.fillRect(cx + i, py, 2, 1);
    ctx.fillRect(cx + i + 2, py + 1, 1, 1);
  }

  // Slightly lighter scuffed grass blades
  ctx.fillStyle = 'rgba(105, 138, 55, 0.45)';
  for (let i = -w / 3; i < w / 3; i += 9) {
    const py = cy + Math.cos(i * 0.3) * (h * 0.25);
    ctx.fillRect(cx + i, py - 1, 2, 2);
  }
}

function drawPenaltySpotScuff(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = 'rgba(60, 85, 28, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a5b25';
  ctx.fillRect(cx - 3, cy + 1, 6, 2);
}

function drawKickoffScuff(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = 'rgba(60, 85, 28, 0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the regulation pitch lines with subtle chalk depth and painted grass texture
 */
function drawPitchMarkings(ctx: CanvasRenderingContext2D) {
  ctx.save();

  const left = PITCH_CONFIG.PITCH_LEFT;
  const right = PITCH_CONFIG.PITCH_RIGHT;
  const top = PITCH_CONFIG.PITCH_TOP;
  const bottom = PITCH_CONFIG.PITCH_BOTTOM;
  const cx = PITCH_CONFIG.CENTER_X;
  const cy = PITCH_CONFIG.CENTER_Y;

  // 1. Line Under-Shadow: Gives authentic "painted onto grass blades" appearance
  ctx.strokeStyle = 'rgba(15, 45, 10, 0.5)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'square';

  // Shadow for outer boundary
  ctx.strokeRect(left + 1, top + 1, PITCH_CONFIG.FIELD_WIDTH, PITCH_CONFIG.FIELD_HEIGHT);

  // 2. Pure Crisp Regulation White Chalk Lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  // Outer Boundary Touchlines and Goal Lines
  ctx.strokeRect(left, top, PITCH_CONFIG.FIELD_WIDTH, PITCH_CONFIG.FIELD_HEIGHT);

  // Halfway Line with subtle shadow
  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(right, cy);
  ctx.stroke();

  // Center Circle & Center Spot
  ctx.beginPath();
  ctx.arc(cx, cy, PITCH_CONFIG.CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Center Spot (regulation 22cm chalk circle)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Center line kick-off tick
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.stroke();

  // TOP PENALTY BOX (Rival)
  const penW = PITCH_CONFIG.PENALTY_BOX_WIDTH;
  const penH = PITCH_CONFIG.PENALTY_BOX_HEIGHT;
  ctx.strokeRect(cx - penW / 2, top, penW, penH);

  // Top 6-yard Goal Area
  const sixW = PITCH_CONFIG.SIX_YARD_BOX_WIDTH;
  const sixH = PITCH_CONFIG.SIX_YARD_BOX_HEIGHT;
  ctx.strokeRect(cx - sixW / 2, top, sixW, sixH);

  // Top Penalty Spot
  ctx.beginPath();
  ctx.arc(cx, top + PITCH_CONFIG.PENALTY_SPOT_DIST, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Top Penalty Arc (D-arc outside box)
  ctx.beginPath();
  ctx.arc(cx, top + PITCH_CONFIG.PENALTY_SPOT_DIST, PITCH_CONFIG.CENTER_CIRCLE_RADIUS, 0.65, Math.PI - 0.65);
  ctx.stroke();

  // BOTTOM PENALTY BOX (Own)
  ctx.strokeRect(cx - penW / 2, bottom - penH, penW, penH);

  // Bottom 6-yard Goal Area
  ctx.strokeRect(cx - sixW / 2, bottom - sixH, sixW, sixH);

  // Bottom Penalty Spot
  ctx.beginPath();
  ctx.arc(cx, bottom - PITCH_CONFIG.PENALTY_SPOT_DIST, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Bottom Penalty Arc
  ctx.beginPath();
  ctx.arc(cx, bottom - PITCH_CONFIG.PENALTY_SPOT_DIST, PITCH_CONFIG.CENTER_CIRCLE_RADIUS, Math.PI + 0.65, Math.PI * 2 - 0.65);
  ctx.stroke();

  // Corner Arcs (4 corners with regulation 1m radius)
  const r = PITCH_CONFIG.CORNER_ARC_RADIUS;
  // Top-left
  ctx.beginPath();
  ctx.arc(left, top, r, 0, Math.PI / 2);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.arc(right, top, r, Math.PI / 2, Math.PI);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.arc(left, bottom, r, -Math.PI / 2, 0);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.arc(right, bottom, r, Math.PI, -Math.PI / 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws manager technical areas and substitute dugouts along the touchlines
 */
function drawTechnicalAreas(ctx: CanvasRenderingContext2D) {
  const left = PITCH_CONFIG.PITCH_LEFT;
  const cy = PITCH_CONFIG.CENTER_Y;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  // Home Technical Area (Left touchline, lower half)
  ctx.strokeRect(left - 38, cy + 20, 32, 90);

  // Away Technical Area (Left touchline, upper half)
  ctx.strokeRect(left - 38, cy - 110, 32, 90);

  ctx.setLineDash([]);

  // Dugout Shelters (Transparent blue perspex / metal team shelters)
  // Away Dugout
  drawDugout(ctx, left - 55, cy - 95, 14, 55, AWAY_KIT.primaryColor);
  // Home Dugout
  drawDugout(ctx, left - 55, cy + 35, 14, 55, HOME_KIT.primaryColor);

  ctx.restore();
}

function drawDugout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  teamColor: string
) {
  // Dugout shadow
  ctx.fillStyle = 'rgba(10, 30, 10, 0.45)';
  ctx.fillRect(x - 2, y + 2, w + 4, h + 4);

  // Shelter canopy (translucent tinted acrylic)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.fillRect(x, y, w, h);

  // Metal frame
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Bench seats with team color
  ctx.fillStyle = teamColor;
  for (let seatY = y + 4; seatY < y + h - 6; seatY += 10) {
    ctx.fillRect(x + 3, seatY, w - 6, 6);
  }
}

/**
 * Precomputed, permanently fixed-color crowd system.
 * Each spectator has a 100% fixed shirt color, face skin tone, and scarf,
 * with subtle, organic vertical bobbing up and down.
 */
interface CrowdSpectator {
  x: number;
  baseY: number;
  color: string;
  headColor: string;
  hasScarf: boolean;
  scarfColor: string;
  phase: number;
  bobAmp: number;
}

const CROWD_SHIRT_PALETTE = [
  '#0055b8', // Home Royal Blue
  '#c8102e', // Passion Red
  '#f8fafc', // Crisp Home White
  '#ffd000', // Stadium Gold
  '#1e293b', // Deep Navy
  '#16a34a', // Emerald Green
  '#ea580c', // Vivid Orange
  '#0284c7', // Sky Blue
];

const CROWD_HEAD_PALETTE = ['#f5c898', '#d09868', '#fcd34d', '#c58a5c', '#8d5b32'];
const CROWD_SCARF_PALETTE = ['#facc15', '#ffffff', '#ef4444', '#3b82f6'];

function initGrandstandCrowd(grandstandY: number): CrowdSpectator[] {
  const left = PITCH_CONFIG.PITCH_LEFT - 100;
  const width = PITCH_CONFIG.FIELD_WIDTH + 200;
  const spectators: CrowdSpectator[] = [];

  // Deterministic PRNG seed for identical, unshakeable layout
  let seed = 4217 + Math.floor(grandstandY);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let row = 0; row < 5; row++) {
    const baseY = grandstandY + row * 15 + 4;
    for (let x = left + 8; x < left + width - 8; x += 11) {
      const colIdx = Math.floor(rand() * CROWD_SHIRT_PALETTE.length);
      const headIdx = Math.floor(rand() * CROWD_HEAD_PALETTE.length);
      const hasScarf = rand() < 0.22;
      const scarfIdx = Math.floor(rand() * CROWD_SCARF_PALETTE.length);

      spectators.push({
        x,
        baseY,
        color: CROWD_SHIRT_PALETTE[colIdx],
        headColor: CROWD_HEAD_PALETTE[headIdx],
        hasScarf,
        scarfColor: CROWD_SCARF_PALETTE[scarfIdx],
        phase: (x * 0.022) + (row * 0.65) + rand() * 0.5,
        bobAmp: 1.1 + rand() * 0.7,
      });
    }
  }
  return spectators;
}

const TOP_CROWD_SEATS: CrowdSpectator[] = initGrandstandCrowd(PITCH_CONFIG.PITCH_TOP - 95 - 80);
const BOTTOM_CROWD_SEATS: CrowdSpectator[] = initGrandstandCrowd(PITCH_CONFIG.PITCH_BOTTOM + 95);

/**
 * Draws animated top stadium crowd and retro advertising hoardings with fixed colors
 */
function drawCrowdGrandstand(ctx: CanvasRenderingContext2D) {
  ctx.save();

  const boardY = PITCH_CONFIG.PITCH_TOP - 95;
  const grandstandY = boardY - 80;
  const left = PITCH_CONFIG.PITCH_LEFT - 100;
  const width = PITCH_CONFIG.FIELD_WIDTH + 200;

  // Grandstand steps background
  ctx.fillStyle = '#2b221d';
  ctx.fillRect(left, grandstandY, width, 80);

  // Concrete tier step lines
  ctx.fillStyle = '#3d312a';
  for (let s = 0; s < 5; s++) {
    ctx.fillRect(left, grandstandY + s * 15 + 13, width, 2);
  }

  // Draw spectators: fixed permanent colors, subtle vertical sine-wave bobbing
  const now = Date.now();
  for (let i = 0; i < TOP_CROWD_SEATS.length; i++) {
    const s = TOP_CROWD_SEATS[i];
    const bob = Math.round(Math.sin(now * 0.003 + s.phase) * s.bobAmp);
    const y = s.baseY + bob;

    // Body (fixed color)
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, y + 4, 6, 7);

    // Head (fixed skin tone)
    ctx.fillStyle = s.headColor;
    ctx.fillRect(s.x + 1, y, 4, 4);

    // Cheering fan scarf / banner in occasional fan
    if (s.hasScarf) {
      ctx.fillStyle = s.scarfColor;
      ctx.fillRect(s.x - 2, y - 1, 10, 2);
    }
  }

  // Barrier rail
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(left, boardY - 6, width, 4);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(left, boardY - 2, width, 2);

  // Advertising Hoardings / Ad Boards
  const adHeight = 32;
  const adY = boardY;
  ctx.fillStyle = '#111111';
  ctx.fillRect(left, adY, width, adHeight);

  // Ad board panels with authentic 16-bit sponsors
  const panelWidth = 220;
  const panels = [
    { bg: '#b81212', text: 'SENSIBLE SOCCER', color: '#ffffff' },
    { bg: '#d4d4d4', text: "'95 / '96", color: '#111111' },
    { bg: '#0055b8', text: 'PIXEL CUP', color: '#ffffff' },
    { bg: '#1c7430', text: 'AMIGA POWER', color: '#ffd700' },
    { bg: '#d4d4d4', text: "'95 / '96", color: '#111111' },
    { bg: '#b81212', text: 'WORLD CHAMPION', color: '#ffffff' },
    { bg: '#232b38', text: 'ARCADE FOOTBALL', color: '#00e5ff' },
    { bg: '#d4d4d4', text: "'95 / '96", color: '#111111' },
  ];

  let currentX = left;
  let idx = 0;
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle';

  while (currentX < left + width) {
    const p = panels[idx % panels.length];
    ctx.fillStyle = p.bg;
    ctx.fillRect(currentX, adY, panelWidth - 4, adHeight);

    // Bevel top/bottom of ad board
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(currentX, adY, panelWidth - 4, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(currentX, adY + adHeight - 2, panelWidth - 4, 2);

    ctx.fillStyle = p.color;
    ctx.fillText(p.text, currentX + 12, adY + adHeight / 2 + 1);

    currentX += panelWidth;
    idx++;
  }

  // Pitchside photographers sitting on stools
  for (let px = left + 140; px < left + width - 140; px += 280) {
    // Stool
    ctx.fillStyle = '#444444';
    ctx.fillRect(px - 4, boardY + 36, 8, 8);
    // Photographer
    ctx.fillStyle = '#d09868'; // Face
    ctx.fillRect(px - 3, boardY + 24, 6, 6);
    ctx.fillStyle = '#ff7700'; // Fluorescent bib
    ctx.fillRect(px - 5, boardY + 30, 10, 8);
    // Camera with telephoto lens pointed at pitch
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 2, boardY + 33, 4, 10);
    ctx.fillStyle = '#111111';
    ctx.fillRect(px - 1, boardY + 41, 2, 3); // Lens aperture
  }

  ctx.restore();
}

/**
 * Draws animated bottom stadium crowd and retro advertising hoardings with fixed colors
 */
function drawBottomCrowdGrandstand(ctx: CanvasRenderingContext2D) {
  ctx.save();

  const boardY = PITCH_CONFIG.PITCH_BOTTOM + 65;
  const grandstandY = boardY + 36;
  const left = PITCH_CONFIG.PITCH_LEFT - 100;
  const width = PITCH_CONFIG.FIELD_WIDTH + 200;

  // Advertising Hoardings / Ad Boards
  const adHeight = 32;
  ctx.fillStyle = '#111111';
  ctx.fillRect(left, boardY, width, adHeight);

  // Ad board panels with authentic 16-bit sponsors
  const panelWidth = 220;
  const panels = [
    { bg: '#0055b8', text: 'PIXEL CUP', color: '#ffffff' },
    { bg: '#d4d4d4', text: "'95 / '96", color: '#111111' },
    { bg: '#b81212', text: 'SENSIBLE SOCCER', color: '#ffffff' },
    { bg: '#1c7430', text: 'AMIGA POWER', color: '#ffd700' },
    { bg: '#232b38', text: 'ARCADE FOOTBALL', color: '#00e5ff' },
    { bg: '#d4d4d4', text: "'95 / '96", color: '#111111' },
  ];

  let currentX = left;
  let idx = 0;
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle';

  while (currentX < left + width) {
    const p = panels[idx % panels.length];
    ctx.fillStyle = p.bg;
    ctx.fillRect(currentX, boardY, panelWidth - 4, adHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(currentX, boardY, panelWidth - 4, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(currentX, boardY + adHeight - 2, panelWidth - 4, 2);

    ctx.fillStyle = p.color;
    ctx.fillText(p.text, currentX + 12, boardY + adHeight / 2 + 1);

    currentX += panelWidth;
    idx++;
  }

  // Barrier rail
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(left, boardY + adHeight + 2, width, 4);

  // Grandstand steps background
  ctx.fillStyle = '#2b221d';
  ctx.fillRect(left, grandstandY, width, 80);

  // Concrete tier step lines
  ctx.fillStyle = '#3d312a';
  for (let s = 0; s < 5; s++) {
    ctx.fillRect(left, grandstandY + s * 15 + 13, width, 2);
  }

  // Draw spectators: fixed permanent colors, subtle vertical sine-wave bobbing
  const now = Date.now();
  for (let i = 0; i < BOTTOM_CROWD_SEATS.length; i++) {
    const s = BOTTOM_CROWD_SEATS[i];
    const bob = Math.round(Math.sin(now * 0.003 + s.phase) * s.bobAmp);
    const y = s.baseY + bob;

    // Body (fixed color)
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, y + 4, 6, 7);

    // Head (fixed skin tone)
    ctx.fillStyle = s.headColor;
    ctx.fillRect(s.x + 1, y, 4, 4);

    if (s.hasScarf) {
      ctx.fillStyle = s.scarfColor;
      ctx.fillRect(s.x - 2, y - 1, 10, 2);
    }
  }

  ctx.restore();
}

/**
 * Draws the Top Goal (Rival Goal) with 3D cylindrical posts, crossbar, corner brackets,
 * rear support stanchions, realistic box net cage, ground pegs, and dynamic 3D bulge & ripple physics.
 */
function drawTopGoal(ctx: CanvasRenderingContext2D, net: GoalNetState, pitchTilt: number) {
  ctx.save();

  const cx = PITCH_CONFIG.CENTER_X;
  const w = PITCH_CONFIG.GOAL_WIDTH;
  const depth = PITCH_CONFIG.GOAL_DEPTH;
  const h = PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT * (1.12 - pitchTilt * 0.2);
  const goalLineY = PITCH_CONFIG.PITCH_TOP;

  const leftX = cx - w / 2;
  const rightX = cx + w / 2;
  const backY = goalLineY - depth;
  const topBackY = goalLineY - depth * 0.75; // Continental box net top shelf depth

  const shake = net.shake || 0;
  const bulge = net.bulgeAmount || 0;
  const impX = net.impactX || cx;
  const impY = net.impactY || (goalLineY - depth * 0.5);

  // Bulge & wave deformation function for top net vertices
  const getVertex = (x: number, y: number): { x: number; y: number } => {
    const dx = x - impX;
    const dy = y - impY;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Gaussian bulge backwards (towards negative Y)
    const b = Math.exp(-distSq / (45 * 45)) * bulge;
    // Harmonic wave ripple
    const wave = Math.sin(Date.now() * 0.022 - dist * 0.13) * (shake * Math.exp(-dist / 85)) * 0.5;

    const dispY = -b * 0.88 + wave * 0.45;
    const dispX = (dx / (Math.abs(dx) + 24)) * b * 0.32 + wave * 0.25;
    return { x: x + dispX, y: y + dispY };
  };

  // 1. Goal Net Ground Shadow (trapezoidal shadow cast on turf)
  ctx.fillStyle = 'rgba(8, 28, 8, 0.52)';
  ctx.beginPath();
  ctx.moveTo(leftX - 8, goalLineY + 2);
  ctx.lineTo(rightX + 8, goalLineY + 2);
  ctx.lineTo(rightX + 22, backY - 8);
  ctx.lineTo(leftX - 22, backY - 8);
  ctx.closePath();
  ctx.fill();

  // Subtle interior turf shadow inside the goalmouth
  ctx.fillStyle = 'rgba(0, 20, 0, 0.25)';
  ctx.fillRect(leftX, backY, w, depth);

  // 2. Ground Net Perimeter Tape & Fastening Pegs
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, backY);
  ctx.lineTo(rightX, backY);
  ctx.lineTo(rightX, goalLineY);
  ctx.stroke();

  // Steel ground pegs along back net base
  ctx.fillStyle = '#cbd5e1';
  for (let px = leftX + 10; px <= rightX - 10; px += 18) {
    ctx.fillRect(px - 1, backY - 1, 2, 3);
  }
  for (let py = goalLineY - 12; py >= backY + 8; py -= 16) {
    ctx.fillRect(leftX - 1, py - 1, 2, 3);
    ctx.fillRect(rightX - 1, py - 1, 2, 3);
  }

  // 3. Rear Angled Support Stanchions (Continental Stadium Goal)
  // Left angled steel pole
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftX - 10, backY - 12);
  ctx.lineTo(leftX, topBackY - h * 0.94);
  ctx.stroke();
  // Left Stanchion highlight
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX - 10, backY - 12);
  ctx.lineTo(leftX, topBackY - h * 0.94);
  ctx.stroke();

  // Right angled steel pole
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rightX + 10, backY - 12);
  ctx.lineTo(rightX, topBackY - h * 0.94);
  ctx.stroke();
  // Right Stanchion highlight
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX + 10, backY - 12);
  ctx.lineTo(rightX, topBackY - h * 0.94);
  ctx.stroke();

  // Tension guy ropes holding top rear corners
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(leftX - 10, backY - 12);
  ctx.lineTo(leftX, topBackY - h * 0.94);
  ctx.moveTo(rightX + 10, backY - 12);
  ctx.lineTo(rightX, topBackY - h * 0.94);
  ctx.stroke();

  // 4. Net Mesh (Roof, Back Drop, and Side Walls)
  // --- A. ROOF (Top Shelf) ---
  const roofStepsX = 22; // Cords across goal width
  const roofStepsY = 6;  // Cords from crossbar to top back bar

  // Roof longitudinal cords (front to back)
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(240, 248, 255, 0.78)';
  for (let i = 0; i <= roofStepsX; i++) {
    const fracX = i / roofStepsX;
    const origX = leftX + fracX * w;

    ctx.beginPath();
    for (let j = 0; j <= roofStepsY; j++) {
      const fracY = j / roofStepsY;
      const origY = (goalLineY - h) + fracY * (topBackY - (goalLineY - h));
      const pt = getVertex(origX, origY);
      if (j === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Roof latitudinal cross-cords (side to side)
  for (let j = 0; j <= roofStepsY; j++) {
    const fracY = j / roofStepsY;
    const origY = (goalLineY - h) + fracY * (topBackY - (goalLineY - h));
    ctx.beginPath();
    for (let i = 0; i <= roofStepsX; i++) {
      const fracX = i / roofStepsX;
      const origX = leftX + fracX * w;
      const pt = getVertex(origX, origY);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // --- B. BACK WALL (Vertical drop from top rear bar down to ground) ---
  const backStepsY = 6;
  ctx.strokeStyle = 'rgba(230, 242, 255, 0.75)';

  // Back vertical cords
  for (let i = 0; i <= roofStepsX; i++) {
    const fracX = i / roofStepsX;
    const origX = leftX + fracX * w;

    ctx.beginPath();
    for (let j = 0; j <= backStepsY; j++) {
      const fracY = j / backStepsY;
      const origY = topBackY + fracY * (backY - topBackY);
      const pt = getVertex(origX, origY);
      if (j === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Back horizontal cords
  for (let j = 0; j <= backStepsY; j++) {
    const fracY = j / backStepsY;
    const origY = topBackY + fracY * (backY - topBackY);

    ctx.beginPath();
    for (let i = 0; i <= roofStepsX; i++) {
      const fracX = i / roofStepsX;
      const origX = leftX + fracX * w;
      const pt = getVertex(origX, origY);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // --- C. SIDE NET WALLS (Left and Right) ---
  ctx.strokeStyle = 'rgba(225, 238, 252, 0.70)';
  // Left side netting
  for (let step = 0; step <= 5; step++) {
    const t = step / 5;
    const frontPt = getVertex(leftX, goalLineY - h * (1 - t));
    const backPt = getVertex(leftX, backY + (topBackY - backY) * (1 - t));
    ctx.beginPath();
    ctx.moveTo(frontPt.x, frontPt.y);
    ctx.lineTo(backPt.x, backPt.y);
    ctx.stroke();
  }
  // Right side netting
  for (let step = 0; step <= 5; step++) {
    const t = step / 5;
    const frontPt = getVertex(rightX, goalLineY - h * (1 - t));
    const backPt = getVertex(rightX, backY + (topBackY - backY) * (1 - t));
    ctx.beginPath();
    ctx.moveTo(frontPt.x, frontPt.y);
    ctx.lineTo(backPt.x, backPt.y);
    ctx.stroke();
  }

  // 5. 3D Cylindrical Goal Posts & Crossbar with Metal Highlights & Corner Elbows
  // Post Ground Shadows
  ctx.fillStyle = 'rgba(8, 26, 8, 0.75)';
  ctx.beginPath();
  ctx.ellipse(leftX - 2, goalLineY + 1, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(rightX - 2, goalLineY + 1, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ground Mounting Base Plates
  ctx.fillStyle = '#334155';
  ctx.fillRect(leftX - 4, goalLineY - 2, 8, 4);
  ctx.fillRect(rightX - 4, goalLineY - 2, 8, 4);
  // Hexagonal anchor bolt rivets
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX - 3, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(leftX + 2, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(rightX - 3, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(rightX + 2, goalLineY - 1, 1.5, 1.5);

  // Left Post (Cylindrical metal pipe)
  // Left post outer shadow
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, goalLineY - h);
  ctx.stroke();
  // Left post body
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, goalLineY - h);
  ctx.stroke();
  // Left post specular core highlight
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(leftX - 0.8, goalLineY);
  ctx.lineTo(leftX - 0.8, goalLineY - h);
  ctx.stroke();

  // Right Post
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(rightX, goalLineY);
  ctx.lineTo(rightX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(rightX, goalLineY);
  ctx.lineTo(rightX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(rightX - 0.8, goalLineY);
  ctx.lineTo(rightX - 0.8, goalLineY - h);
  ctx.stroke();

  // Crossbar (Horizontal Beam)
  // Crossbar bottom shadow bevel
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h);
  ctx.lineTo(rightX + 3, goalLineY - h);
  ctx.stroke();
  // Crossbar body
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h);
  ctx.lineTo(rightX + 3, goalLineY - h);
  ctx.stroke();
  // Crossbar top specular highlight line
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h - 1);
  ctx.lineTo(rightX + 3, goalLineY - h - 1);
  ctx.stroke();

  // Reinforced Corner Elbow Joint Brackets
  ctx.fillStyle = '#cbd5e1';
  // Top left elbow bracket
  ctx.beginPath();
  ctx.moveTo(leftX - 2, goalLineY - h + 6);
  ctx.lineTo(leftX + 6, goalLineY - h - 2);
  ctx.lineTo(leftX - 2, goalLineY - h - 2);
  ctx.closePath();
  ctx.fill();
  // Top right elbow bracket
  ctx.beginPath();
  ctx.moveTo(rightX + 2, goalLineY - h + 6);
  ctx.lineTo(rightX - 6, goalLineY - h - 2);
  ctx.lineTo(rightX + 2, goalLineY - h - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws Bottom Goal (Home Goal defended by User) with 3D cylindrical posts, crossbar,
 * realistic box net cage, ground pegs, and dynamic 3D bulge & ripple physics.
 */
function drawBottomGoal(ctx: CanvasRenderingContext2D, net: GoalNetState, pitchTilt: number) {
  ctx.save();

  const cx = PITCH_CONFIG.CENTER_X;
  const w = PITCH_CONFIG.GOAL_WIDTH;
  const depth = PITCH_CONFIG.GOAL_DEPTH;
  const h = PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT * 0.94;
  const goalLineY = PITCH_CONFIG.PITCH_BOTTOM;

  const leftX = cx - w / 2;
  const rightX = cx + w / 2;
  const backY = goalLineY + depth;
  const topBackY = goalLineY + depth * 0.75;

  const shake = net.shake || 0;
  const bulge = net.bulgeAmount || 0;
  const impX = net.impactX || cx;
  const impY = net.impactY || (goalLineY + depth * 0.5);

  // Bulge & wave deformation function for bottom net vertices
  const getVertex = (x: number, y: number): { x: number; y: number } => {
    const dx = x - impX;
    const dy = y - impY;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Bulge pushes forward/downward (towards positive Y)
    const b = Math.exp(-distSq / (45 * 45)) * bulge;
    const wave = Math.sin(Date.now() * 0.022 - dist * 0.13) * (shake * Math.exp(-dist / 85)) * 0.5;

    const dispY = b * 0.88 + wave * 0.45;
    const dispX = (dx / (Math.abs(dx) + 24)) * b * 0.32 + wave * 0.25;
    return { x: x + dispX, y: y + dispY };
  };

  // 1. Goal Net Ground Shadow
  ctx.fillStyle = 'rgba(8, 28, 8, 0.48)';
  ctx.beginPath();
  ctx.moveTo(leftX - 8, goalLineY - 2);
  ctx.lineTo(rightX + 8, goalLineY - 2);
  ctx.lineTo(rightX + 22, backY + 8);
  ctx.lineTo(leftX - 22, backY + 8);
  ctx.closePath();
  ctx.fill();

  // Subtle interior turf shadow
  ctx.fillStyle = 'rgba(0, 20, 0, 0.22)';
  ctx.fillRect(leftX, goalLineY, w, depth);

  // 2. Ground Net Perimeter Tape & Fastening Pegs
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, backY);
  ctx.lineTo(rightX, backY);
  ctx.lineTo(rightX, goalLineY);
  ctx.stroke();

  // Steel ground pegs along base
  ctx.fillStyle = '#cbd5e1';
  for (let px = leftX + 10; px <= rightX - 10; px += 18) {
    ctx.fillRect(px - 1, backY - 1, 2, 3);
  }
  for (let py = goalLineY + 12; py <= backY - 8; py += 16) {
    ctx.fillRect(leftX - 1, py - 1, 2, 3);
    ctx.fillRect(rightX - 1, py - 1, 2, 3);
  }

  // 3. Rear Support Stanchions (Continental Stadium Goal)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftX - 10, backY + 12);
  ctx.lineTo(leftX, topBackY - h * 0.88);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightX + 10, backY + 12);
  ctx.lineTo(rightX, topBackY - h * 0.88);
  ctx.stroke();

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(leftX - 10, backY + 12);
  ctx.lineTo(leftX, topBackY - h * 0.88);
  ctx.moveTo(rightX + 10, backY + 12);
  ctx.lineTo(rightX, topBackY - h * 0.88);
  ctx.stroke();

  // 4. Net Mesh (Roof, Back Drop, and Side Walls)
  const roofStepsX = 22;
  const roofStepsY = 6;

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(240, 248, 255, 0.75)';

  // Roof longitudinal cords
  for (let i = 0; i <= roofStepsX; i++) {
    const fracX = i / roofStepsX;
    const origX = leftX + fracX * w;

    ctx.beginPath();
    for (let j = 0; j <= roofStepsY; j++) {
      const fracY = j / roofStepsY;
      const origY = (goalLineY - h) + fracY * (topBackY - (goalLineY - h));
      const pt = getVertex(origX, origY);
      if (j === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Roof latitudinal cross-cords
  for (let j = 0; j <= roofStepsY; j++) {
    const fracY = j / roofStepsY;
    const origY = (goalLineY - h) + fracY * (topBackY - (goalLineY - h));
    ctx.beginPath();
    for (let i = 0; i <= roofStepsX; i++) {
      const fracX = i / roofStepsX;
      const origX = leftX + fracX * w;
      const pt = getVertex(origX, origY);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Back vertical drop cords
  const backStepsY = 6;
  ctx.strokeStyle = 'rgba(230, 242, 255, 0.72)';
  for (let i = 0; i <= roofStepsX; i++) {
    const fracX = i / roofStepsX;
    const origX = leftX + fracX * w;

    ctx.beginPath();
    for (let j = 0; j <= backStepsY; j++) {
      const fracY = j / backStepsY;
      const origY = topBackY + fracY * (backY - topBackY);
      const pt = getVertex(origX, origY);
      if (j === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Back horizontal cords
  for (let j = 0; j <= backStepsY; j++) {
    const fracY = j / backStepsY;
    const origY = topBackY + fracY * (backY - topBackY);

    ctx.beginPath();
    for (let i = 0; i <= roofStepsX; i++) {
      const fracX = i / roofStepsX;
      const origX = leftX + fracX * w;
      const pt = getVertex(origX, origY);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  // Side netting
  ctx.strokeStyle = 'rgba(225, 238, 252, 0.68)';
  for (let step = 0; step <= 5; step++) {
    const t = step / 5;
    const frontPt = getVertex(leftX, goalLineY - h * (1 - t));
    const backPt = getVertex(leftX, backY - (backY - topBackY) * (1 - t));
    ctx.beginPath();
    ctx.moveTo(frontPt.x, frontPt.y);
    ctx.lineTo(backPt.x, backPt.y);
    ctx.stroke();
  }
  for (let step = 0; step <= 5; step++) {
    const t = step / 5;
    const frontPt = getVertex(rightX, goalLineY - h * (1 - t));
    const backPt = getVertex(rightX, backY - (backY - topBackY) * (1 - t));
    ctx.beginPath();
    ctx.moveTo(frontPt.x, frontPt.y);
    ctx.lineTo(backPt.x, backPt.y);
    ctx.stroke();
  }

  // 5. 3D Cylindrical Goal Posts & Crossbar with Metal Highlights & Corner Elbows
  // Post Ground Shadows
  ctx.fillStyle = 'rgba(8, 26, 8, 0.75)';
  ctx.beginPath();
  ctx.ellipse(leftX - 2, goalLineY + 1, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(rightX - 2, goalLineY + 1, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mounting Base Plates
  ctx.fillStyle = '#334155';
  ctx.fillRect(leftX - 4, goalLineY - 2, 8, 4);
  ctx.fillRect(rightX - 4, goalLineY - 2, 8, 4);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX - 3, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(leftX + 2, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(rightX - 3, goalLineY - 1, 1.5, 1.5);
  ctx.fillRect(rightX + 2, goalLineY - 1, 1.5, 1.5);

  // Left Post
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(leftX, goalLineY);
  ctx.lineTo(leftX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(leftX - 0.8, goalLineY);
  ctx.lineTo(leftX - 0.8, goalLineY - h);
  ctx.stroke();

  // Right Post
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(rightX, goalLineY);
  ctx.lineTo(rightX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(rightX, goalLineY);
  ctx.lineTo(rightX, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(rightX - 0.8, goalLineY);
  ctx.lineTo(rightX - 0.8, goalLineY - h);
  ctx.stroke();

  // Crossbar
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h);
  ctx.lineTo(rightX + 3, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h);
  ctx.lineTo(rightX + 3, goalLineY - h);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(leftX - 3, goalLineY - h - 1);
  ctx.lineTo(rightX + 3, goalLineY - h - 1);
  ctx.stroke();

  // Reinforced Corner Elbow Joint Brackets
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(leftX - 2, goalLineY - h + 6);
  ctx.lineTo(leftX + 6, goalLineY - h - 2);
  ctx.lineTo(leftX - 2, goalLineY - h - 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rightX + 2, goalLineY - h + 6);
  ctx.lineTo(rightX - 6, goalLineY - h - 2);
  ctx.lineTo(rightX + 2, goalLineY - h - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws 4 waving corner flags with checkered quadrants and spring-loaded flexible pole
 */
function drawCornerFlags(ctx: CanvasRenderingContext2D) {
  const flags = [
    { x: PITCH_CONFIG.PITCH_LEFT, y: PITCH_CONFIG.PITCH_TOP },
    { x: PITCH_CONFIG.PITCH_RIGHT, y: PITCH_CONFIG.PITCH_TOP },
    { x: PITCH_CONFIG.PITCH_LEFT, y: PITCH_CONFIG.PITCH_BOTTOM },
    { x: PITCH_CONFIG.PITCH_RIGHT, y: PITCH_CONFIG.PITCH_BOTTOM },
  ];

  ctx.save();
  const wave = Math.sin(Date.now() * 0.007) * 1.5;

  for (const f of flags) {
    // Flag turf insertion socket
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(f.x - 1.5, f.y - 1, 3, 2);

    // Flexible white/yellow pole
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x + wave * 0.4, f.y - 15);
    ctx.stroke();

    // Checkered red and yellow corner flag (official FIFA style)
    const topX = f.x + wave * 0.4;
    const topY = f.y - 15;
    const flagW = 9 + wave;
    const flagH = 7;

    // Top-left quadrant (Yellow)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(topX, topY, flagW / 2, flagH / 2);
    // Bottom-right quadrant (Yellow)
    ctx.fillRect(topX + flagW / 2, topY + flagH / 2, flagW / 2, flagH / 2);

    // Top-right quadrant (Red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(topX + flagW / 2, topY, flagW / 2, flagH / 2);
    // Bottom-left quadrant (Red)
    ctx.fillRect(topX, topY + flagH / 2, flagW / 2, flagH / 2);

    // Flag gold tip
    ctx.fillStyle = '#eab308';
    ctx.fillRect(topX - 1, topY - 1, 2, 2);
  }
  ctx.restore();
}

/**
 * Renders all dynamic grass particles
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: TurfParticle[]) {
  ctx.save();
  for (const pt of particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y - pt.z), pt.size, pt.size);
  }
  ctx.restore();
}

