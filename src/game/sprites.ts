import { Player, PlayerAppearance, TeamKit, Ball, Referee } from '../types';

// High-detail 16-bit arcade pixel art renderer (Sensible Soccer / Neo Geo Super Sidekicks / Kick Off style)
// Crisp procedural pixel art with distinctive multi-frame animations, authentic kit details,
// facial expressions, captain armbands, and realistic ball deformation & curl trails.

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * Draws a pixelated player sprite onto canvas
 */
export function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  player: Player,
  kit: TeamKit,
  scale: number = 1
) {
  const isGk = player.role === 'GK';
  const effectivePrimary = isGk ? kit.gkColor : kit.primaryColor;
  const effectiveSocks = isGk ? '#222222' : kit.socksColor;

  // Draw dynamic pitch shadow first
  drawPlayerShadow(ctx, player);

  // Direction vectors
  let dirX = 0;
  let dirY = 1;
  if (player.facingDir.includes('left')) dirX = -1;
  if (player.facingDir.includes('right')) dirX = 1;
  if (player.facingDir.includes('up')) dirY = -1;
  if (player.facingDir.includes('down')) dirY = 1;

  // Captain check (Home: Matthäus #10, Away: Scirea #6)
  const isCaptain = (player.team === 'home' && player.number === 10) || (player.team === 'away' && player.number === 6);

  const cacheKey = [
    player.appearance.skinTone,
    player.appearance.hairStyle,
    player.appearance.hairColor,
    player.appearance.hasBeard ? 'b' : 'n',
    effectivePrimary,
    kit.secondaryColor,
    kit.shortsColor,
    effectiveSocks,
    player.action,
    player.animFrame,
    dirX,
    dirY,
    isGk ? 'gk' : 'pl',
    isCaptain ? 'c' : 'n',
  ].join('|');

  let cachedCanvas = spriteCache.get(cacheKey);

  if (!cachedCanvas) {
    cachedCanvas = renderPlayerToCanvas(
      player.appearance,
      effectivePrimary,
      kit.secondaryColor,
      kit.shortsColor,
      effectiveSocks,
      player.action,
      player.animFrame,
      dirX,
      dirY,
      player.number,
      isGk,
      isCaptain
    );
    spriteCache.set(cacheKey, cachedCanvas);
  }

  // Centered sprite rendering with player size scaling
  const pScale = player.scale || 1.0;
  const sw = Math.round(cachedCanvas.width * pScale);
  const sh = Math.round(cachedCanvas.height * pScale);
  ctx.drawImage(
    cachedCanvas,
    Math.round(player.x - sw / 2),
    Math.round(player.y - sh + 5 * pScale),
    sw,
    sh
  );

  // Visible Q Ball Shielding Visual Aura, Barrier Arc & Indicator
  // "make the Q ball shielding more visible"
  if (player.isShielding) {
    ctx.save();
    const time = Date.now() * 0.007;
    const pulse = Math.sin(time) * 2;
    // Shield arc angle centered behind the player (protecting against pressing rivals)
    const backAngle = player.facingAngle + Math.PI;

    // Ground protection perimeter ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, 16 + pulse, 10 + pulse * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Protective glowing barrier arc barricading incoming pressure
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 8, 18 + pulse, backAngle - 1.15, backAngle + 1.15);
    ctx.stroke();

    // Shield badge above head
    ctx.shadowBlur = 0;
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('🛡 SHIELD', player.x, player.y - sh - 14);

    ctx.restore();
  }

  // Subtle confused emoji above defender when nutmegged or beaten by roulette
  if (player.confusedTimer && player.confusedTimer > 0) {
    ctx.save();
    const alpha = Math.min(1, player.confusedTimer / 20);
    ctx.globalAlpha = alpha;
    const emojiY = player.y - sh - 5;

    // Small subtle confused emoji face
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('😵‍💫', player.x, emojiY);
    ctx.restore();
  }
}

/**
 * Realistic pitch shadow responding to player actions (jumping, sliding, diving, tumbling)
 */
function drawPlayerShadow(ctx: CanvasRenderingContext2D, player: Player) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 32, 10, 0.42)';

  const sc = player.scale || 1.0;
  const shadowOffsetX = -4 * sc;
  const shadowOffsetY = 5 * sc;

  if (player.action === 'sliding_tackle') {
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX,
      player.y + 3 * sc,
      16 * sc,
      5 * sc,
      -0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else if (
    player.action === 'heading' ||
    player.action === 'bicycle_kick' ||
    player.action === 'scissor_kick' ||
    player.action === 'scorpion_kick'
  ) {
    // Airborne acrobatics: shadow stays anchored on pitch and contracts
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX * 0.6,
      player.y + 4 * sc,
      7 * sc,
      3.8 * sc,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else if (player.action === 'goalkeeper_dive') {
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX,
      player.y + 4 * sc,
      17 * sc,
      5.5 * sc,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else if (player.action === 'fouled_falling') {
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX,
      player.y + 3 * sc,
      12 * sc,
      6 * sc,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else if ((player.action === 'running_shot' || player.action === 'running_long_pass') && player.animFrame === 2) {
    // Airborne follow-through leap: shadow contracts on turf
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX * 0.7,
      player.y + 4 * sc,
      8 * sc,
      3.5 * sc,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    // Upright / Running / Skill moves shadow
    const isSprinting = Math.hypot(player.vx, player.vy) > 3.0;
    ctx.beginPath();
    ctx.ellipse(
      player.x + shadowOffsetX,
      player.y + shadowOffsetY * 0.5,
      (isSprinting ? 11 : 9.5) * sc,
      4.5 * sc,
      -0.25,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Procedural rasterizer: creates detailed, high-craft 16-bit arcade pixel art sprites
 */
function renderPlayerToCanvas(
  appearance: PlayerAppearance,
  shirtColor: string,
  trimColor: string,
  shortsColor: string,
  socksColor: string,
  action: string,
  frame: number,
  dirX: number,
  dirY: number,
  number: number,
  isGk: boolean,
  isCaptain: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = 36;
  const h = 42;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  const cx = 18;
  const groundY = 36;

  // Helper pixel drawers
  const p = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const r = (x: number, y: number, rw: number, rh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), rw, rh);
  };

  const skin = appearance.skinTone;
  const skinShadow = shadeColor(skin, -26);
  const skinHighlight = shadeColor(skin, 15);
  const hair = appearance.hairColor;
  const hairHigh = shadeColor(hair, 22);
  const hairShadow = shadeColor(hair, -32);
  const bootColor = '#141414';
  const bootStuds = '#e4e4e7';
  const bootLace = '#f5f5f5';
  const bootAccent = '#dc2626'; // Iconic red fold-over tongue
  const sockRib = shadeColor(socksColor, -20);
  const sockHigh = shadeColor(socksColor, 18);
  const sockWhite = '#ffffff';
  const shirtHigh = shadeColor(shirtColor, 20);
  const shirtShadow = shadeColor(shirtColor, -24);
  const pinstripeCol = shadeColor(shirtColor, -14);
  const shortsHigh = shadeColor(shortsColor, 18);
  const shortsShadow = shadeColor(shortsColor, -24);

  // ==========================================
  // 1. SLIDING TACKLE ANIMATION (3 Frames)
  // ==========================================
  if (action === 'sliding_tackle') {
    const slideDir = dirX !== 0 ? dirX : 1;
    ctx.save();
    if (slideDir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    const f = frame % 3;
    // Frame 0: Entry thrust, Frame 1: Full turf slide with hooked leg, Frame 2: Recovery sweep
    // "sliding tackle from behind the player tries to come a bit from a side and place the leg in front to cut the ball"
    const slideY = groundY - 4;
    const legReach = f === 1 ? 16 : (f === 0 ? 11 : 14);

    // Outstretched Lead Hooking Leg (front)
    r(15, slideY, legReach, 3, socksColor);
    r(15 + legReach - 2, slideY - 1, 2, 4, sockRib); // Sock cuff
    // Hooked Boot with studs positioned to cut across the ball
    r(15 + legReach, slideY - 2, 6, 4, bootColor);
    p(15 + legReach + 1, slideY - 2, bootAccent); // Boot tongue
    r(15 + legReach + 2, slideY + 2, 4, 2, bootStuds); // Cleat studs hooking turf
    // Dynamic green turf spray pixels at the slide contact point
    if (f === 1) {
      p(15 + legReach + 6, slideY + 1, '#22c55e');
      p(15 + legReach + 7, slideY + 3, '#15803d');
      p(14, slideY + 3, '#166534');
    }

    // Trailing bent leg (under hip)
    r(10, slideY - 1, 6, 3, skin);
    r(8, slideY + 1, 5, 3, socksColor);
    r(6, slideY + 2, 4, 3, bootColor);

    // Shorts
    r(8, slideY - 4, 9, 5, shortsColor);
    r(9, slideY - 4, 1, 5, trimColor); // Side stripe

    // Torso leaned back
    r(3, slideY - 9, 8, 7, shirtColor);
    r(4, slideY - 8, 6, 4, trimColor);

    // Arms bracing
    r(1, slideY - 6, 3, 5, skin);
    r(0, slideY - 2, 3, 3, skinShadow);

    // Head
    r(1, slideY - 15, 7, 7, skin);
    // Determined grimace expression
    p(5, slideY - 12, '#ffffff');
    p(6, slideY - 12, '#111111');
    p(4, slideY - 13, '#111111'); // Eyebrow angled
    p(5, slideY - 10, skinShadow); // Grit mouth

    // Hair
    renderHairStyle(ctx, 4, slideY - 16, appearance.hairStyle, hair, hairHigh, hairShadow, false);

    ctx.restore();
    return canvas;
  }

  // ==========================================
  // 2. GOALKEEPER DIVE ANIMATION (3 Frames)
  // ==========================================
  if (action === 'goalkeeper_dive') {
    const diveDir = dirX !== 0 ? dirX : 1;
    ctx.save();
    if (diveDir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    const f = frame % 3;
    const diveLift = f === 1 ? -6 : -3;
    const dy = groundY - 12 + diveLift;

    // Both Outstretched Arms Reaching
    r(22, dy - 1, 7, 3, skin);
    r(29, dy - 3, 5, 6, '#facc15'); // Padded Goalkeeper Gloves (Fluo Yellow)
    p(31, dy - 2, '#1e293b'); // Glove grip palm details
    p(32, dy, '#1e293b');

    // Head
    r(17, dy - 3, 6, 6, skin);
    p(20, dy - 1, '#ffffff');
    p(21, dy - 1, '#111111');
    renderHairStyle(ctx, 19, dy - 5, appearance.hairStyle, hair, hairHigh, hairShadow, false);

    // Horizontal Torso
    r(9, dy - 2, 10, 7, shirtColor);
    r(10, dy - 1, 8, 2, trimColor);

    // Shorts
    r(4, dy - 1, 6, 6, shortsColor);

    // Horizontal Legs & Boots
    r(-2, dy, 7, 3, socksColor);
    r(-5, dy, 4, 3, bootColor);
    r(-5, dy + 3, 2, 1, bootStuds);

    ctx.restore();
    return canvas;
  }

  // ==========================================
  // 3. FOULED / FALLING ANIMATION (4 Frames)
  // ==========================================
  if (action === 'fouled_falling') {
    const f = frame % 4;
    ctx.save();

    if (f === 0) {
      // Stumble back
      r(cx - 5, groundY - 10, 4, 6, socksColor);
      r(cx - 6, groundY - 4, 5, 4, bootColor);
      r(cx + 2, groundY - 12, 4, 7, skin);
      r(cx - 3, groundY - 16, 9, 6, shortsColor);
      r(cx - 6, groundY - 24, 11, 8, shirtColor);
      r(cx - 4, groundY - 30, 7, 6, skin);
      p(cx - 2, groundY - 28, '#111111'); // Shocked eye
      p(cx + 1, groundY - 28, '#111111');
      r(cx - 5, groundY - 33, 8, 4, hair);
    } else if (f === 1) {
      // Mid-air tumble
      r(cx - 8, groundY - 14, 8, 4, socksColor);
      r(cx - 11, groundY - 15, 4, 4, bootColor);
      r(cx - 3, groundY - 10, 8, 6, shortsColor);
      r(cx + 3, groundY - 13, 9, 7, shirtColor);
      r(cx + 10, groundY - 16, 6, 6, skin);
      r(cx + 9, groundY - 19, 7, 4, hair);
    } else {
      // Down on turf clutching knee
      r(cx - 10, groundY - 5, 8, 4, skin);
      r(cx - 12, groundY - 5, 4, 4, socksColor);
      r(cx - 14, groundY - 5, 3, 3, bootColor);
      r(cx - 5, groundY - 7, 7, 5, shortsColor);
      r(cx + 1, groundY - 8, 8, 6, shirtColor);
      r(cx + 7, groundY - 10, 6, 6, skin);
      r(cx + 7, groundY - 13, 7, 4, hair);
    }

    ctx.restore();
    return canvas;
  }

  // ==========================================
  // 3b. ACROBATIC AERIAL STRIKES (Bicycle, Scissor, Scorpion)
  // ==========================================
  if (action === 'bicycle_kick') {
    ctx.save();
    const kickDir = dirX !== 0 ? dirX : 1;
    if (kickDir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Mid-air inverted backflip 14px above turf
    const midY = groundY - 15;

    // Head tilted back watching strike
    r(cx + 6, midY - 2, 6, 6, skin);
    p(cx + 8, midY, '#ffffff');
    p(cx + 9, midY, '#111111');
    renderHairStyle(ctx, cx + 9, midY - 4, appearance.hairStyle, hair, hairHigh, hairShadow, false);

    // Torso horizontal in mid-air
    r(cx - 4, midY - 3, 10, 7, shirtColor);
    r(cx - 3, midY - 2, 8, 2, trimColor);

    // Outstretched balancing arms
    r(cx + 2, midY + 4, 3, 5, skin);
    r(cx - 5, midY + 4, 3, 5, skin);

    // Shorts angled
    r(cx - 9, midY - 4, 6, 6, shortsColor);

    // Non-kicking trailing leg (bent)
    r(cx - 12, midY + 1, 5, 3, socksColor);
    r(cx - 14, midY + 2, 4, 3, bootColor);

    // Kicking lead leg: reaching skyward in powerful overhead extension!
    r(cx - 11, midY - 10, 3, 8, skin);
    r(cx - 11, midY - 16, 3, 7, socksColor);
    p(cx - 11, midY - 16, sockRib);
    r(cx - 13, midY - 20, 5, 4, bootColor);
    p(cx - 12, midY - 19, bootAccent);
    r(cx - 10, midY - 21, 3, 1, bootStuds); // Studs pointing to heaven

    ctx.restore();
    return canvas;
  }

  if (action === 'scissor_kick') {
    ctx.save();
    const kickDir = dirX !== 0 ? dirX : 1;
    if (kickDir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Horizontal flying side-scissor volley
    const midY = groundY - 12;

    // Torso angled 35 degrees
    r(cx - 3, midY - 4, 9, 7, shirtColor);
    r(cx - 2, midY - 3, 7, 2, trimColor);

    // Head
    r(cx + 5, midY - 7, 6, 6, skin);
    p(cx + 8, midY - 5, '#ffffff');
    p(cx + 9, midY - 5, '#111111');
    renderHairStyle(ctx, cx + 7, midY - 9, appearance.hairStyle, hair, hairHigh, hairShadow, false);

    // Balancing arms
    r(cx + 2, midY + 3, 3, 5, skin);

    // Shorts
    r(cx - 8, midY - 2, 6, 6, shortsColor);

    // Kicking leg whipped sideways like a scissor blade
    r(cx - 16, midY - 1, 9, 3, skin);
    r(cx - 23, midY - 1, 8, 3, socksColor);
    p(cx - 21, midY - 1, sockRib);
    r(cx - 27, midY - 2, 5, 4, bootColor);
    p(cx - 26, midY - 1, bootAccent);
    r(cx - 27, midY + 2, 3, 1, bootStuds);

    // Trailing scissor leg tucked
    r(cx - 10, midY + 4, 5, 3, socksColor);
    r(cx - 12, midY + 6, 4, 3, bootColor);

    ctx.restore();
    return canvas;
  }

  if (action === 'scorpion_kick') {
    ctx.save();
    const kickDir = dirX !== 0 ? dirX : 1;
    if (kickDir < 0) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Diving dolphin arch forward
    const midY = groundY - 8;

    // Head diving low forward
    r(cx + 8, midY + 1, 6, 6, skin);
    p(cx + 11, midY + 3, '#ffffff');
    p(cx + 12, midY + 3, '#111111');
    renderHairStyle(ctx, cx + 9, midY - 1, appearance.hairStyle, hair, hairHigh, hairShadow, false);

    // Torso arched horizontally low to pitch
    r(cx - 1, midY, 10, 6, shirtColor);
    r(cx, midY + 1, 8, 2, trimColor);

    // Outstretched diving arms
    r(cx + 6, midY + 6, 4, 3, skin);

    // Shorts arched upward
    r(cx - 7, midY - 3, 7, 6, shortsColor);

    // Legs curved backwards over the spine (Scorpion sting!)
    r(cx - 11, midY - 9, 4, 7, skin);
    r(cx - 9, midY - 15, 4, 7, socksColor);
    p(cx - 9, midY - 15, sockRib);
    // Heels arched forward over back!
    r(cx - 5, midY - 19, 5, 4, bootColor);
    p(cx - 4, midY - 18, bootAccent);
    r(cx - 3, midY - 16, 3, 1, bootStuds); // Studs flicking forward

    ctx.restore();
    return canvas;
  }

  // ==========================================
  // 4. UPRIGHT & IN-PLAY ANIMATIONS
  // Running, Passing, Shooting, Crossing, Heading, Tackles, Idle
  // ==========================================
  const isFacingUp = dirY < 0;
  const isFacingDown = dirY > 0;
  const isFacingSide = dirX !== 0 && Math.abs(dirX) > Math.abs(dirY * 0.6);

  let legOffset1 = 0;
  let legOffset2 = 0;
  let armOffset1 = 0;
  let armOffset2 = 0;
  let bodyBob = 0;
  let torsoLeanX = 0;
  let kickingLegHigh = false;
  let isMidAirHeader = false;
  let isLowBlockTackle = false;

  // RUNNING: 6-frame smooth high-detail sprint cycle
  if (action === 'running') {
    const f = frame % 6;
    if (f === 0) {
      legOffset1 = -3;
      legOffset2 = 3;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 0;
    } else if (f === 1) {
      legOffset1 = -1;
      legOffset2 = 1;
      armOffset1 = 1;
      armOffset2 = -1;
      bodyBob = 1; // Downward foot plant
    } else if (f === 2) {
      legOffset1 = 2;
      legOffset2 = -1;
      armOffset1 = -1;
      armOffset2 = 2;
      bodyBob = -1; // Mid-stride lift
    } else if (f === 3) {
      legOffset1 = 3;
      legOffset2 = -3;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
    } else if (f === 4) {
      legOffset1 = 1;
      legOffset2 = -1;
      armOffset1 = -1;
      armOffset2 = 1;
      bodyBob = 1;
    } else {
      legOffset1 = -1;
      legOffset2 = 2;
      armOffset1 = 2;
      armOffset2 = -1;
      bodyBob = -1;
    }
  }

  // DRIBBLING: 6-frame tactical close-control dribbling cycle with agile foot touches & body lean
  else if (action === 'dribbling') {
    const f = frame % 6;
    if (f === 0) {
      // Right inside-foot delicate nudge on the ball
      legOffset1 = 4;
      legOffset2 = -2;
      armOffset1 = -3;
      armOffset2 = 4;
      bodyBob = 1;
      torsoLeanX = 2;
    } else if (f === 1) {
      // Plant right foot, driving forward onto the ball
      legOffset1 = 1;
      legOffset2 = 0;
      armOffset1 = 2;
      armOffset2 = -2;
      bodyBob = 0;
      torsoLeanX = 1;
    } else if (f === 2) {
      // Left leg forward stride recovery
      legOffset1 = -2;
      legOffset2 = 3;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 3) {
      // Left inside-foot close touch with knee bent
      legOffset1 = -3;
      legOffset2 = 4;
      armOffset1 = 4;
      armOffset2 = -3;
      bodyBob = 1;
      torsoLeanX = 1;
    } else if (f === 4) {
      // Plant left foot, hips counter-balancing
      legOffset1 = 0;
      legOffset2 = 1;
      armOffset1 = -2;
      armOffset2 = 2;
      bodyBob = 0;
      torsoLeanX = 1;
    } else {
      // Low stride coil ready for next touch
      legOffset1 = 2;
      legOffset2 = -2;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -1;
      torsoLeanX = 2;
    }
  }

  // 1a. STANDING SHORT PASS - LOW POWER (< 60%): Quick nimble inside-foot tap / toe poke
  else if (action === 'standing_pass_low') {
    const f = frame % 3;
    if (f === 0) {
      // Rapid plant, subtle backswing without wasted motion
      legOffset1 = -2;
      legOffset2 = 0;
      armOffset1 = 1;
      armOffset2 = -1;
      bodyBob = 0;
      torsoLeanX = 0;
    } else if (f === 1) {
      // Crisp side-foot tap through ball center
      legOffset1 = 3;
      legOffset2 = -1;
      armOffset1 = -2;
      armOffset2 = 2;
      bodyBob = 0;
      torsoLeanX = 1;
    } else {
      // Clean short grounded follow-through
      legOffset1 = 4;
      legOffset2 = 0;
      armOffset1 = -2;
      armOffset2 = 2;
      bodyBob = 0;
      torsoLeanX = 0;
    }
  }

  // 1b. STANDING SHORT PASS - MID POWER (60% - 70%): Improved athletic side-foot drive
  else if (action === 'standing_pass_mid' || action === 'standing_pass' || action === 'passing') {
    const f = frame % 3;
    if (f === 0) {
      // Windup: solid firm plant foot on turf, kicking leg drawn back, ankle locked
      legOffset1 = -4;
      legOffset2 = 0;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 1;
      torsoLeanX = -1;
    } else if (f === 1) {
      // Impact: sharp crisp inside-boot snap with hip drive
      legOffset1 = 5;
      legOffset2 = -1;
      armOffset1 = -4;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 2;
    } else {
      // Follow-through: guided ground-level extension pointing directly to teammate
      legOffset1 = 6;
      legOffset2 = -1;
      armOffset1 = -4;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 1;
    }
  }

  // 1c. STANDING SHORT PASS - HIGH POWER (71% - 90% & Overpower): Bullet driven laser pass
  else if (action === 'standing_pass_high') {
    const f = frame % 3;
    if (f === 0) {
      // Deep leg windup: deep backward coil, cocked knee, shoulders torqued
      legOffset1 = -6;
      legOffset2 = 1;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = 2;
      torsoLeanX = -2;
    } else if (f === 1) {
      // Bullet strike: violent laces/instep punch, torso lunging forward over ball
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = -1;
      torsoLeanX = 3;
    } else {
      // Violent follow-through scraping turf with high kick recoil
      legOffset1 = 8;
      legOffset2 = -4;
      armOffset1 = -5;
      armOffset2 = 4;
      bodyBob = -2;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // 1d. SPECIAL CURL PASS [Q] (Outside-of-the-boot Trivela curve pass)
  else if (action === 'special_curl_pass') {
    const f = frame % 3;
    if (f === 0) {
      // Hip twist windup: torso tilted away, outside boot cocked
      legOffset1 = -4;
      legOffset2 = -1;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = 1;
      torsoLeanX = -3;
    } else if (f === 1) {
      // Trivela slice: foot slices outward across ball, hips rotating
      legOffset1 = 6;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = 0;
      torsoLeanX = 2;
      kickingLegHigh = true;
    } else {
      // Elegant trivela follow-through across body
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 4;
      bodyBob = -1;
      torsoLeanX = 1;
      kickingLegHigh = true;
    }
  }

  // 1e. KNUCKLE / DRIVEN PASS [E] (Low drilled punch pass)
  else if (action === 'knuckle_pass') {
    const f = frame % 3;
    if (f === 0) {
      // Rigid grounded plant: ankle locked rigid, zero backswing arch
      legOffset1 = -3;
      legOffset2 = 0;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 1;
      torsoLeanX = 0;
    } else if (f === 1) {
      // Low driven punch strike: flat through ball center
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 1;
      torsoLeanX = 2;
    } else {
      // Crisp dead-halt follow-through
      legOffset1 = 4;
      legOffset2 = -1;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 1;
      torsoLeanX = 1;
    }
  }

  // 2a. RUNNING PASS - LOW POWER (< 60%): Fast running poke / flick in full stride
  else if (action === 'running_pass_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -1;
      legOffset2 = 1;
      armOffset1 = 2;
      armOffset2 = -2;
      bodyBob = 0;
      torsoLeanX = 1;
    } else if (f === 1) {
      legOffset1 = 4;
      legOffset2 = -2;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 2;
    } else {
      legOffset1 = 3;
      legOffset2 = -3;
      armOffset1 = -2;
      armOffset2 = 2;
      bodyBob = -1;
      torsoLeanX = 1;
    }
  }

  // 2b. RUNNING PASS - MID POWER (60% - 70%): Fluid one-two push pass in full stride
  else if (action === 'running_pass_mid' || action === 'running_pass') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -3;
      legOffset2 = 2;
      armOffset1 = 4;
      armOffset2 = -4;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 6;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 3;
    } else {
      legOffset1 = 5;
      legOffset2 = -4;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -2;
      torsoLeanX = 2;
    }
  }

  // 2c. RUNNING PASS - HIGH POWER (71% - 90% & Overpower): Full stride driven bullet pass
  else if (action === 'running_pass_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -5;
      legOffset2 = 3;
      armOffset1 = 6;
      armOffset2 = -5;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 8;
      legOffset2 = -4;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = -2;
      torsoLeanX = 4;
    } else {
      legOffset1 = 8;
      legOffset2 = -5;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -3;
      torsoLeanX = 3;
      kickingLegHigh = true;
    }
  }

  // 3a. STANDING LONG PASS - LOW POWER (< 60%): Driven ground punch through-ball
  else if (action === 'standing_long_pass_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -3;
      legOffset2 = 0;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 0;
      torsoLeanX = 0;
    } else if (f === 1) {
      legOffset1 = 5;
      legOffset2 = -1;
      armOffset1 = -4;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 1;
    } else {
      legOffset1 = 5;
      legOffset2 = -1;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 1;
    }
  }

  // 3b. STANDING LONG PASS - MID POWER (60% - 70%): Arced lofted long ball
  else if (action === 'standing_long_pass_mid' || action === 'standing_long_pass') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -5;
      legOffset2 = -1;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = 1;
      torsoLeanX = -2;
    } else if (f === 1) {
      legOffset1 = 6;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = -1;
    } else {
      legOffset1 = 7;
      legOffset2 = -2;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -1;
      torsoLeanX = 0;
      kickingLegHigh = true;
    }
  }

  // 3c. STANDING LONG PASS - HIGH POWER (71% - 90% & Overpower): Booming catapult clearance
  else if (action === 'standing_long_pass_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -7;
      legOffset2 = 0;
      armOffset1 = 7;
      armOffset2 = -6;
      bodyBob = 2;
      torsoLeanX = -4;
    } else if (f === 1) {
      legOffset1 = 9;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = -1;
      torsoLeanX = 1;
    } else {
      legOffset1 = 9;
      legOffset2 = -4;
      armOffset1 = -6;
      armOffset2 = 6;
      bodyBob = -3;
      torsoLeanX = 0;
      kickingLegHigh = true;
    }
  }

  // 4a. RUNNING LONG PASS - LOW POWER (< 60%): Quick running ground punch
  else if (action === 'running_long_pass_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -2;
      legOffset2 = 2;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 0;
      torsoLeanX = 1;
    } else if (f === 1) {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 2;
    } else {
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -1;
      torsoLeanX = 1;
    }
  }

  // 4b. RUNNING LONG PASS - MID POWER (60% - 70%): Driven through-ball sliced in motion
  else if (action === 'running_long_pass_mid' || action === 'running_long_pass') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -4;
      legOffset2 = 3;
      armOffset1 = 5;
      armOffset2 = -4;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -1;
      torsoLeanX = 3;
    } else {
      legOffset1 = 8;
      legOffset2 = -5;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -3;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // 4c. RUNNING LONG PASS - HIGH POWER (71% - 90% & Overpower): Full flight airborne catapult
  else if (action === 'running_long_pass_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -6;
      legOffset2 = 4;
      armOffset1 = 7;
      armOffset2 = -6;
      bodyBob = -2;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 9;
      legOffset2 = -4;
      armOffset1 = -7;
      armOffset2 = 6;
      bodyBob = -2;
      torsoLeanX = 4;
    } else {
      legOffset1 = 10;
      legOffset2 = -6;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -4;
      torsoLeanX = 3;
      kickingLegHigh = true;
    }
  }

  // 5a. STANDING SHOOTING - LOW POWER (< 60%): Placed side-foot placement shot to corner
  else if (action === 'standing_shot_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -3;
      legOffset2 = 0;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 0;
      torsoLeanX = -1;
    } else if (f === 1) {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 1;
    } else {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 1;
    }
  }

  // 5b. STANDING SHOOTING - MID POWER (60% - 70%): Clean controlled laces drive
  else if (action === 'standing_shot_mid' || action === 'standing_shot' || action === 'shooting') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -5;
      legOffset2 = -1;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = 1;
      torsoLeanX = -2;
    } else if (f === 1) {
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -1;
      torsoLeanX = 2;
    } else {
      legOffset1 = 8;
      legOffset2 = -4;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -2;
      torsoLeanX = 1;
      kickingLegHigh = true;
    }
  }

  // 5c. STANDING SHOOTING - HIGH POWER (71% - 90% & Overpower): Thunderous full laces rocket
  else if (action === 'standing_shot_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -8;
      legOffset2 = 0;
      armOffset1 = 7;
      armOffset2 = -7;
      bodyBob = 2;
      torsoLeanX = -4;
    } else if (f === 1) {
      legOffset1 = 9;
      legOffset2 = -4;
      armOffset1 = -7;
      armOffset2 = 6;
      bodyBob = -2;
      torsoLeanX = 3;
    } else {
      legOffset1 = 10;
      legOffset2 = -5;
      armOffset1 = -6;
      armOffset2 = 6;
      bodyBob = -4;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // 6a. RUNNING SHOOTING - LOW POWER (< 60%): Low placed strike in stride
  else if (action === 'running_shot_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -3;
      legOffset2 = 2;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 6;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -1;
      torsoLeanX = 2;
    } else {
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -2;
      torsoLeanX = 2;
    }
  }

  // 6b. RUNNING SHOOTING - MID POWER (60% - 70%): Laces strike in full stride
  else if (action === 'running_shot_mid' || action === 'running_shot') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -5;
      legOffset2 = 3;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = -1;
      torsoLeanX = 3;
    } else if (f === 1) {
      legOffset1 = 8;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = -2;
      torsoLeanX = 4;
    } else {
      legOffset1 = 7;
      legOffset2 = -5;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -4;
      torsoLeanX = 3;
      kickingLegHigh = true;
    }
  }

  // 6c. RUNNING SHOOTING - HIGH POWER (71% - 90% & Overpower): Airborne running thunderbolt
  else if (action === 'running_shot_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -7;
      legOffset2 = 4;
      armOffset1 = 7;
      armOffset2 = -6;
      bodyBob = -2;
      torsoLeanX = 3;
    } else if (f === 1) {
      legOffset1 = 10;
      legOffset2 = -4;
      armOffset1 = -7;
      armOffset2 = 6;
      bodyBob = -3;
      torsoLeanX = 5;
    } else {
      legOffset1 = 9;
      legOffset2 = -6;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -5;
      torsoLeanX = 3;
      kickingLegHigh = true;
    }
  }

  // 6d. SPECIAL BANANA CURL / TRIVELA SHOT [Q]
  else if (action === 'special_curl_shot') {
    const f = frame % 3;
    if (f === 0) {
      // Extreme banana coil: 45° lateral torso tilt, arms spread like wings for angular torque
      legOffset1 = -6;
      legOffset2 = -2;
      armOffset1 = 7;
      armOffset2 = -7;
      bodyBob = 2;
      torsoLeanX = -4;
    } else if (f === 1) {
      // Trivela / banana whip: Outside-of-the-boot diagonal slice across ball center
      legOffset1 = 9;
      legOffset2 = -4;
      armOffset1 = -7;
      armOffset2 = 6;
      bodyBob = -1;
      torsoLeanX = 4;
      kickingLegHigh = true;
    } else {
      // Curled high follow-through swept across the body
      legOffset1 = 8;
      legOffset2 = -5;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -3;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // 6e. KNUCKLEBALL HAMMER SHOT [E]
  else if (action === 'knuckle_shot') {
    const f = frame % 3;
    if (f === 0) {
      // Stiff upright power plant: compact knee draw, zero rotational hip twist
      legOffset1 = -5;
      legOffset2 = -1;
      armOffset1 = 4;
      armOffset2 = -4;
      bodyBob = 1;
      torsoLeanX = -1;
    } else if (f === 1) {
      // Rigid laces hammer impact: foot dead-center through ball, chest directly over sphere
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 3;
    } else {
      // Signature knuckle punch stop: kicking foot abruptly halts immediately after strike
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -3;
      armOffset2 = 2;
      bodyBob = 1;
      torsoLeanX = 3;
      kickingLegHigh = false;
    }
  }

  // 7a. STANDING CROSS - LOW POWER (< 60%): Clipped delicate chip / dink cross
  else if (action === 'standing_cross_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -2;
      legOffset2 = 0;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = 0;
      torsoLeanX = -1;
    } else if (f === 1) {
      legOffset1 = 4;
      legOffset2 = -1;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 0;
    } else {
      legOffset1 = 5;
      legOffset2 = -1;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 0;
      kickingLegHigh = true;
    }
  }

  // 7b. STANDING CROSS - MID POWER (60% - 70%): Whipped curling delivery from wing
  else if (action === 'standing_cross_mid' || action === 'standing_cross' || action === 'crossing') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -4;
      legOffset2 = 0;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = 1;
      torsoLeanX = -2;
    } else if (f === 1) {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -1;
      torsoLeanX = 1;
    } else {
      legOffset1 = 6;
      legOffset2 = -1;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 0;
      kickingLegHigh = true;
    }
  }

  // 7c. STANDING CROSS - HIGH POWER (71% - 90% & Overpower): Whipped thunder-cross
  else if (action === 'standing_cross_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -6;
      legOffset2 = 0;
      armOffset1 = 6;
      armOffset2 = -6;
      bodyBob = 1;
      torsoLeanX = -3;
    } else if (f === 1) {
      legOffset1 = 8;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 5;
      bodyBob = -2;
      torsoLeanX = 3;
    } else {
      legOffset1 = 8;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -3;
      torsoLeanX = 1;
      kickingLegHigh = true;
    }
  }

  // 8a. RUNNING CROSS - LOW POWER (< 60%): Chipped cross on the run
  else if (action === 'running_cross_low') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -2;
      legOffset2 = 2;
      armOffset1 = 3;
      armOffset2 = -3;
      bodyBob = -1;
      torsoLeanX = 1;
    } else if (f === 1) {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 3;
      bodyBob = 0;
      torsoLeanX = 2;
    } else {
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -1;
      torsoLeanX = 1;
      kickingLegHigh = true;
    }
  }

  // 8b. RUNNING CROSS - MID POWER (60% - 70%): Winger cross in full motion
  else if (action === 'running_cross_mid' || action === 'running_cross') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -4;
      legOffset2 = 2;
      armOffset1 = 5;
      armOffset2 = -4;
      bodyBob = -1;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = 6;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 4;
      bodyBob = -1;
      torsoLeanX = 3;
    } else {
      legOffset1 = 6;
      legOffset2 = -4;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -2;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // 8c. RUNNING CROSS - HIGH POWER (71% - 90% & Overpower): Whipped laser thunder-delivery
  else if (action === 'running_cross_high') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = -6;
      legOffset2 = 3;
      armOffset1 = 7;
      armOffset2 = -5;
      bodyBob = -2;
      torsoLeanX = 3;
    } else if (f === 1) {
      legOffset1 = 9;
      legOffset2 = -4;
      armOffset1 = -7;
      armOffset2 = 5;
      bodyBob = -3;
      torsoLeanX = 4;
    } else {
      legOffset1 = 9;
      legOffset2 = -5;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = -4;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // HEADING: Dynamic leaping header with arched back and forehead thrust!
  else if (action === 'heading') {
    const f = frame % 4;
    isMidAirHeader = true;
    if (f === 0) {
      // Jump launch
      bodyBob = -4;
      legOffset1 = -1;
      legOffset2 = -1;
      armOffset1 = -3;
      armOffset2 = -3;
    } else if (f === 1) {
      // Airborne peak: arched back, arms high
      bodyBob = -10;
      legOffset1 = -2;
      legOffset2 = -2;
      armOffset1 = -6;
      armOffset2 = -6;
      torsoLeanX = -1; // Torso arched back
    } else if (f === 2) {
      // Forehead thrust snap!
      bodyBob = -9;
      legOffset1 = -1;
      legOffset2 = -1;
      armOffset1 = 3;
      armOffset2 = 3;
      torsoLeanX = 2; // Head snapped forward
    } else {
      // Landing descent
      bodyBob = -3;
      legOffset1 = 0;
      legOffset2 = 0;
      armOffset1 = 0;
      armOffset2 = 0;
    }
  }

  // STANDING TACKLE: Low lunging block tackle with extended hooking leg (3 Frames)
  // "impvoe the standing, sliding clear ball, push /foul animations, so that they are more easy to see"
  else if (action === 'standing_tackle') {
    isLowBlockTackle = true;
    const f = frame % 3;
    if (f === 0) {
      // Entry lunge: coil low, plant foot digging in
      bodyBob = 2;
      legOffset1 = 6;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      torsoLeanX = 2;
    } else if (f === 1) {
      // Full extended lunging tackle reach with front foot hooking inward around the ball!
      bodyBob = 4;
      legOffset1 = 10;
      legOffset2 = -3;
      armOffset1 = -7;
      armOffset2 = 6;
      torsoLeanX = 4;
    } else {
      // Firm grounded block clamp
      bodyBob = 3;
      legOffset1 = 7;
      legOffset2 = -3;
      armOffset1 = -5;
      armOffset2 = 5;
      torsoLeanX = 2;
    }
  }

  // CLEARING: Massive high-boot defensive clearance into the sky!
  else if (action === 'clearing') {
    const f = frame % 3;
    if (f === 0) {
      // Huge windup coil
      legOffset1 = -6;
      legOffset2 = 1;
      armOffset1 = 6;
      armOffset2 = -6;
      bodyBob = 2;
      torsoLeanX = -3;
    } else if (f === 1) {
      // Explosive upward blast through the ball
      legOffset1 = 8;
      legOffset2 = -3;
      armOffset1 = -6;
      armOffset2 = 6;
      bodyBob = -2;
      torsoLeanX = 1;
      kickingLegHigh = true;
    } else {
      // Sky-high follow-through with player airborne off turf!
      legOffset1 = 9;
      legOffset2 = -5;
      armOffset1 = -5;
      armOffset2 = 5;
      bodyBob = -4;
      torsoLeanX = 2;
      kickingLegHigh = true;
    }
  }

  // PUSHING FOUL: Aggressive two-handed forward shove into opponent!
  else if (action === 'pushing_foul') {
    const f = frame % 3;
    if (f === 0) {
      // Coil forward with elbows back
      legOffset1 = 2;
      legOffset2 = -2;
      armOffset1 = 3;
      armOffset2 = 3;
      bodyBob = 1;
      torsoLeanX = 1;
    } else if (f === 1) {
      // Emphatic forward shove with both hands thrusting forward!
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = 9;
      armOffset2 = 9;
      bodyBob = 0;
      torsoLeanX = 5;
    } else {
      // Follow-through recovery
      legOffset1 = 3;
      legOffset2 = -2;
      armOffset1 = 6;
      armOffset2 = 6;
      bodyBob = 0;
      torsoLeanX = 3;
    }
  }

  // STEP-OVERS [E]: Fluid circular leg sweeps over the ball with dynamic hip feints
  else if (action === 'step_overs') {
    const f = frame % 4;
    bodyBob = -2;
    if (f === 0) {
      // Right leg sweeping outward around the ball, arms swaying left
      legOffset1 = 6;
      legOffset2 = -2;
      armOffset1 = -5;
      armOffset2 = 4;
      torsoLeanX = 3;
      kickingLegHigh = true;
    } else if (f === 1) {
      // Right leg plants wide, head drops right to bait the tackle
      legOffset1 = 3;
      legOffset2 = 0;
      armOffset1 = -2;
      armOffset2 = 2;
      torsoLeanX = 4;
      bodyBob = 0;
    } else if (f === 2) {
      // Left leg sweeping outward around the ball, arms swaying right
      legOffset1 = -2;
      legOffset2 = 6;
      armOffset1 = 4;
      armOffset2 = -5;
      torsoLeanX = -3;
      kickingLegHigh = true;
    } else {
      // Left leg plants wide, head drops left ready for decisive cut
      legOffset1 = 0;
      legOffset2 = 3;
      armOffset1 = 2;
      armOffset2 = -2;
      torsoLeanX = -4;
      bodyBob = 0;
    }
  }

  // NUTMEG DASH: 180° hip swivel, ball flick through legs & explosive low sprint burst
  else if (action === 'nutmeg_dash') {
    const f = frame % 4;
    if (f === 0) {
      // Turn and flick ball through defender legs
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = 4;
      armOffset2 = -4;
      bodyBob = 1;
      torsoLeanX = 2;
    } else if (f === 1) {
      // Low explosive aerodynamic sprint burst past flat-footed defender
      legOffset1 = 8;
      legOffset2 = -5;
      armOffset1 = -6;
      armOffset2 = 6;
      bodyBob = -3;
      torsoLeanX = 4;
    } else if (f === 2) {
      // Full extension sprint stride
      legOffset1 = -4;
      legOffset2 = 6;
      armOffset1 = 5;
      armOffset2 = -5;
      bodyBob = -1;
      torsoLeanX = 3;
    } else {
      // Re-gathering stride in full speed
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 2;
    }
  }

  // SHIELDING [Q]: Solid wide athletic shielding stance facing away with back to rival
  // "make the Q ball shielding more visible"
  else if (action === 'shielding') {
    const f = frame % 3;
    if (f === 0) {
      // Anchored athletic stance: low center of gravity, arms wide
      bodyBob = 3;
      legOffset1 = 5;
      legOffset2 = -4;
      armOffset1 = 8;
      armOffset2 = -7;
      torsoLeanX = -3;
    } else if (f === 1) {
      // Firm body barrier: shoulder dropped into challenge, stiff-arm barring opponent
      bodyBob = 4;
      legOffset1 = 6;
      legOffset2 = -5;
      armOffset1 = 9;
      armOffset2 = -8;
      torsoLeanX = -4;
    } else {
      // Rooted protector stance: legs wide clamping space over ball
      bodyBob = 3;
      legOffset1 = 5;
      legOffset2 = -5;
      armOffset1 = 8;
      armOffset2 = -7;
      torsoLeanX = -3;
    }
  }

  // CRUYFF TURN: Fake kick into sudden inside chop behind standing leg
  else if (action === 'cruyff_turn') {
    const f = frame % 3;
    if (f === 0) {
      legOffset1 = 5;
      legOffset2 = -3;
      armOffset1 = 4;
      torsoLeanX = 2;
    } else if (f === 1) {
      legOffset1 = -4;
      legOffset2 = 4;
      bodyBob = -2;
      torsoLeanX = -2;
    } else {
      legOffset1 = -2;
      legOffset2 = 3;
      torsoLeanX = -1;
    }
  }

  // RAINBOW FLICK: Heel lift, arched flick into sprint
  else if (action === 'rainbow_flick') {
    const f = frame % 4;
    bodyBob = f === 1 ? -6 : -2;
    legOffset1 = f === 1 ? -6 : 3;
    legOffset2 = f === 1 ? 5 : -2;
    armOffset1 = 5;
    armOffset2 = -5;
    torsoLeanX = 2;
  }

  // SHIRT PULL: Arm outstretched grabbing opponent jersey
  else if (action === 'shirt_pull') {
    bodyBob = 1;
    legOffset1 = -2;
    legOffset2 = 3;
    armOffset1 = 6;
    armOffset2 = -2;
    torsoLeanX = -2;
  }

  // VOLLEY: Horizontal hip-high driven side volley
  else if (action === 'volley') {
    bodyBob = -3;
    legOffset1 = 7;
    legOffset2 = -3;
    armOffset1 = -5;
    armOffset2 = 5;
    torsoLeanX = -2;
    kickingLegHigh = true;
  }

  // SOMBRERO: Fluid scoop and explosive acceleration follow-through
  else if (action === 'sombrero') {
    const f = frame % 3;
    bodyBob = f === 1 ? -4 : -2;
    legOffset1 = 6;
    legOffset2 = 1;
    armOffset1 = 4;
    armOffset2 = -4;
    torsoLeanX = 2;
  }

  // GINGA JUGGLE: Brazilian samba rhythm, Capoeira ginga sway & high aerial knee pops
  else if (action === 'ginga_juggle') {
    const f = frame % 4;
    if (f === 0) {
      // Deep swaying base stance (Ginga sway)
      bodyBob = 2;
      legOffset1 = 4;
      legOffset2 = -4;
      armOffset1 = 5;
      armOffset2 = -5;
      torsoLeanX = -3;
    } else if (f === 1) {
      // High knee flick / thigh pop lifting the ball!
      bodyBob = -4;
      legOffset1 = 7;
      legOffset2 = -2;
      armOffset1 = -4;
      armOffset2 = 4;
      torsoLeanX = 1;
      kickingLegHigh = true;
    } else if (f === 2) {
      // Instep pop / toe stall cushioning ball at chest height
      bodyBob = -2;
      legOffset1 = 6;
      legOffset2 = -1;
      armOffset1 = 3;
      armOffset2 = -3;
      torsoLeanX = 2;
      kickingLegHigh = true;
    } else {
      // Rhythm arm flourish & sway
      bodyBob = 0;
      legOffset1 = -3;
      legOffset2 = 4;
      armOffset1 = -4;
      armOffset2 = 4;
      torsoLeanX = 0;
    }
  }

  // ROULETTE (MARSEILLE 360° SPIN): Sole drag, 180° back pivot, hook exit!
  else if (action === 'roulette') {
    const f = frame % 4;
    if (f === 0) {
      legOffset1 = 4;
      legOffset2 = -3;
      armOffset1 = 4;
      armOffset2 = -4;
      bodyBob = 0;
      torsoLeanX = -1;
    } else if (f === 1) {
      legOffset1 = -2;
      legOffset2 = 4;
      armOffset1 = -3;
      armOffset2 = 3;
      bodyBob = -1;
      torsoLeanX = 0;
    } else if (f === 2) {
      legOffset1 = 5;
      legOffset2 = -2;
      armOffset1 = 4;
      armOffset2 = -3;
      bodyBob = -1;
      torsoLeanX = 2;
    } else {
      legOffset1 = 4;
      legOffset2 = -4;
      armOffset1 = -4;
      armOffset2 = 4;
      bodyBob = 0;
      torsoLeanX = 3;
    }
  }

  const yBase = groundY + bodyBob;

  // ----------------------------------------------------
  // LEGS, SOCKS & BOOTS RENDERING (16-Bit Detailed Arcade)
  // ----------------------------------------------------
  if (isFacingSide) {
    const flip = dirX < 0;
    ctx.save();
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Back leg
    r(cx - 3 + legOffset2, yBase - 9, 3, 5, skin); // Thigh
    p(cx - 3 + legOffset2, yBase - 9, skinShadow); // Hamstring shadow
    r(cx - 3 + legOffset2, yBase - 4, 3, 4, socksColor); // Shin
    p(cx - 2 + legOffset2, yBase - 3, sockHigh); // Shin guard vertical ridge
    r(cx - 3 + legOffset2, yBase - 4, 3, 1, sockWhite); // Turnover cuff
    p(cx - 3 + legOffset2, yBase - 3, sockRib);
    // Boot (Classic leather with white stripes & red tongue)
    r(cx - 4 + legOffset2, yBase, 4, 3, bootColor);
    p(cx - 3 + legOffset2, yBase + 1, '#ffffff'); // Boot stripe 1
    p(cx - 2 + legOffset2, yBase + 1, '#ffffff'); // Boot stripe 2
    p(cx - 4 + legOffset2, yBase, bootAccent); // Red tongue fold-over
    r(cx - 3 + legOffset2, yBase + 3, 2, 1, bootStuds); // Cleat studs

    // Front leg
    const frontY = kickingLegHigh ? yBase - 5 : yBase;
    r(cx + legOffset1, frontY - 9, 3, 5, skin); // Thigh
    p(cx + 1 + legOffset1, frontY - 8, skinHighlight); // Quad muscle highlight
    r(cx + legOffset1, frontY - 4, 3, 4, socksColor); // Shin sock
    p(cx + 1 + legOffset1, frontY - 3, sockHigh); // Shin guard 3D contour
    r(cx + legOffset1, frontY - 4, 3, 1, sockWhite); // White sock turnover
    p(cx + legOffset1, frontY - 3, sockRib);
    // Front Boot
    r(cx - 1 + legOffset1, frontY, 5, 3, bootColor);
    p(cx + legOffset1, frontY, bootAccent); // Red fold-over tongue
    p(cx + 1 + legOffset1, frontY + 1, '#ffffff'); // Adidas-style stripes
    p(cx + 2 + legOffset1, frontY + 1, '#ffffff');
    p(cx + legOffset1, frontY + 2, bootLace);
    r(cx + legOffset1, frontY + 3, 3, 1, bootStuds); // Ground cleat studs

    ctx.restore();
  } else {
    // Left Leg
    r(cx - 4, yBase - 9 + legOffset1, 3, 5, skin);
    p(cx - 3, yBase - 8 + legOffset1, skinHighlight); // Thigh muscle highlight
    r(cx - 4, yBase - 4 + legOffset1, 3, 4, socksColor);
    p(cx - 3, yBase - 3 + legOffset1, sockHigh); // Shin guard vertical highlight
    r(cx - 4, yBase - 4 + legOffset1, 3, 1, sockWhite); // Folded sock cuff
    p(cx - 4, yBase - 3 + legOffset1, sockRib);
    // Left Boot
    r(cx - 5, yBase + legOffset1, 4, 3, bootColor);
    p(cx - 4, yBase + legOffset1, bootAccent); // Red tongue
    p(cx - 3, yBase + 1 + legOffset1, '#ffffff'); // White stripe flash
    p(cx - 2, yBase + legOffset1, bootLace);
    r(cx - 4, yBase + 3 + legOffset1, 2, 1, bootStuds);

    // Right Leg
    const rLegY = kickingLegHigh ? yBase - 5 : yBase;
    r(cx + 1, rLegY - 9 + legOffset2, 3, 5, skin);
    p(cx + 2, rLegY - 8 + legOffset2, skinHighlight);
    r(cx + 1, rLegY - 4 + legOffset2, 3, 4, socksColor);
    p(cx + 2, rLegY - 3 + legOffset2, sockHigh); // Shin guard vertical highlight
    r(cx + 1, rLegY - 4 + legOffset2, 3, 1, sockWhite); // Folded sock cuff
    p(cx + 1, rLegY - 3 + legOffset2, sockRib);
    // Right Boot
    r(cx + 1, rLegY + legOffset2, 4, 3, bootColor);
    p(cx + 2, rLegY + legOffset2, bootAccent); // Red tongue
    p(cx + 3, rLegY + 1 + legOffset2, '#ffffff'); // White stripe flash
    p(cx + 3, rLegY + legOffset2, bootLace);
    r(cx + 2, rLegY + 3 + legOffset2, 2, 1, bootStuds);
  }

  // ----------------------------------------------------
  // SHORTS (Athletic cut with waistband, trim & leg hem)
  // ----------------------------------------------------
  const shortsY = yBase - 15;
  r(cx - 6, shortsY, 12, 6, shortsColor);
  // Waistband highlight
  r(cx - 6, shortsY, 12, 1, shortsHigh);
  // Contrasting lateral side stripes
  r(cx - 6, shortsY, 1, 6, trimColor);
  r(cx + 5, shortsY, 1, 6, trimColor);
  // Lower leg opening hem shadows
  r(cx - 5, shortsY + 5, 4, 1, shortsShadow);
  r(cx + 1, shortsY + 5, 4, 1, shortsShadow);
  // Inner leg seam divider
  if (isFacingDown || isFacingUp) {
    p(cx - 1, shortsY + 4, '#0f172a');
    p(cx, shortsY + 4, '#0f172a');
  }

  // ----------------------------------------------------
  // TORSO (Shirt with Jacquard Pinstripes, Collar & Team Crest)
  // ----------------------------------------------------
  const shirtY = yBase - 25;
  const torsoX = cx - 7 + torsoLeanX;

  // Base jersey and shoulder highlight
  r(torsoX, shirtY + 1, 14, 9, shirtColor);
  r(torsoX, shirtY, 14, 1, shirtHigh); // Top shoulder sheen
  // Lateral rib contour shadows
  r(torsoX, shirtY + 1, 1, 9, shirtShadow);
  r(torsoX + 13, shirtY + 1, 1, 9, shirtShadow);
  r(torsoX + 1, shirtY + 9, 12, 1, shirtShadow); // Bottom hem

  // Retro kit subtle vertical pinstripes (classic 90s jersey texture)
  if (!isGk) {
    r(torsoX + 3, shirtY + 2, 1, 7, pinstripeCol);
    r(torsoX + 6, shirtY + 2, 1, 7, pinstripeCol);
    r(torsoX + 9, shirtY + 2, 1, 7, pinstripeCol);
    r(torsoX + 12, shirtY + 2, 1, 7, pinstripeCol);
  } else {
    // 90s iconic goalkeeper chest diamond graphic
    p(cx - 3 + torsoLeanX, shirtY + 3, '#38bdf8');
    p(cx - 2 + torsoLeanX, shirtY + 2, '#38bdf8');
    p(cx - 1 + torsoLeanX, shirtY + 3, '#38bdf8');
    p(cx - 2 + torsoLeanX, shirtY + 4, '#38bdf8');
    p(cx + 1 + torsoLeanX, shirtY + 3, '#f43f5e');
    p(cx + 2 + torsoLeanX, shirtY + 2, '#f43f5e');
    p(cx + 3 + torsoLeanX, shirtY + 3, '#f43f5e');
    p(cx + 2 + torsoLeanX, shirtY + 4, '#f43f5e');
  }

  // Collar & Neckline
  r(torsoX + 3, shirtY, 8, 1, trimColor); // Collar band
  if (isFacingDown) {
    p(cx - 1 + torsoLeanX, shirtY + 1, trimColor); // V-neck trim
    p(cx + 1 + torsoLeanX, shirtY + 1, trimColor);
    p(cx + torsoLeanX, shirtY + 2, trimColor);
    p(cx + torsoLeanX, shirtY + 1, skinShadow); // Throat shadow dip

    // Embroidered metallic team crest badge on left chest
    p(cx - 4 + torsoLeanX, shirtY + 3, '#fbbf24'); // Gold shield
    p(cx - 3 + torsoLeanX, shirtY + 3, '#f59e0b');
    p(cx - 4 + torsoLeanX, shirtY + 4, '#d97706');
    p(cx - 3 + torsoLeanX, shirtY + 4, '#b45309');
  } else if (isFacingUp) {
    // Back squad number in crisp pixel font
    drawPixelNumber(ctx, cx - 2 + torsoLeanX, shirtY + 2, number, trimColor);
  }

  // Captain's Armband (Distinctive golden band with black 'C')
  if (isCaptain) {
    r(torsoX, shirtY + 3, 3, 3, '#facc15');
    p(torsoX + 1, shirtY + 3, '#111111');
    p(torsoX, shirtY + 4, '#111111');
    p(torsoX + 1, shirtY + 5, '#111111');
  }

  // ----------------------------------------------------
  // ARMS & HANDS (with Cuff Trim, Forearms & GK Gloves)
  // ----------------------------------------------------
  if (isFacingSide) {
    const flip = dirX < 0;
    ctx.save();
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    // Sleeve with shoulder highlight and cuff trim
    r(cx - 7 + armOffset1, shirtY + 1, 4, 3, shirtColor);
    p(cx - 7 + armOffset1, shirtY + 1, shirtHigh);
    r(cx - 7 + armOffset1, shirtY + 4, 4, 1, trimColor); // Sleeve cuff band
    // Forearm & Hand
    r(cx - 7 + armOffset1, shirtY + 5, 3, 5, isGk ? '#facc15' : skin);
    if (!isGk) {
      p(cx - 6 + armOffset1, shirtY + 6, skinHighlight); // Forearm muscle
      p(cx - 7 + armOffset1, shirtY + 9, skinShadow); // Clenched fingers
    } else {
      p(cx - 6 + armOffset1, shirtY + 8, '#0f172a'); // Glove palm grip
    }
    ctx.restore();
  } else {
    // Left Arm
    r(cx - 9, shirtY + 1 + armOffset1, 3, 3, shirtColor);
    p(cx - 9, shirtY + 1 + armOffset1, shirtHigh);
    r(cx - 9, shirtY + 4 + armOffset1, 3, 1, trimColor); // Left cuff
    r(cx - 9, shirtY + 5 + armOffset1, 2, 5, isGk ? '#facc15' : skin);
    if (isGk) p(cx - 9, shirtY + 8 + armOffset1, '#0f172a');

    // Right Arm
    r(cx + 6, shirtY + 1 + armOffset2, 3, 3, shirtColor);
    p(cx + 8, shirtY + 1 + armOffset2, shirtHigh);
    r(cx + 6, shirtY + 4 + armOffset2, 3, 1, trimColor); // Right cuff
    r(cx + 7, shirtY + 5 + armOffset2, 2, 5, isGk ? '#facc15' : skin);
    if (isGk) p(cx + 8, shirtY + 8 + armOffset2, '#0f172a');
  }

  // ----------------------------------------------------
  // HEAD & EXPRESSIVE FACE (Tri-Tone Skin & Expressive Eyes)
  // ----------------------------------------------------
  const headY = shirtY - 7;
  const headX = cx - 4 + torsoLeanX;

  // Neck with shadow
  r(cx - 2 + torsoLeanX, shirtY - 1, 4, 2, skin);
  r(cx - 2 + torsoLeanX, shirtY - 1, 4, 1, skinShadow);

  // Face Base & Tri-tone shading
  r(headX, headY, 8, 7, skin);
  r(headX + 1, headY + 1, 6, 1, skinHighlight); // Forehead highlight
  p(headX + 1, headY + 4, skinHighlight); // Left cheek highlight
  p(headX + 6, headY + 4, skinHighlight); // Right cheek highlight
  r(headX, headY + 6, 8, 1, skinShadow); // Jawline shadow
  p(headX, headY + 3, skinShadow); // Left ear
  p(headX + 7, headY + 3, skinShadow); // Right ear

  if (isFacingDown) {
    // Dynamic Eyebrows (reactive to sprint, tackle, shot)
    const browColor = '#09090b';
    const isHighIntensity = action.includes('shot') || action.includes('cross') || action.includes('shoot') || action.includes('tackle') || action.includes('sprint');
    if (isHighIntensity) {
      // Determined V-shaped aggressive brows
      p(headX + 1, headY + 2, browColor);
      p(headX + 2, headY + 3, browColor);
      p(headX + 5, headY + 3, browColor);
      p(headX + 6, headY + 2, browColor);
    } else {
      // Focused level match brows
      r(headX + 1, headY + 2, 2, 1, browColor);
      r(headX + 5, headY + 2, 2, 1, browColor);
    }

    // Expressive 16-Bit Eyes (white sclera + focused dark pupil)
    r(headX + 1, headY + 3, 2, 2, '#ffffff');
    p(headX + (dirX < 0 ? 1 : 2), headY + 4, '#09090b'); // Left pupil
    r(headX + 5, headY + 3, 2, 2, '#ffffff');
    p(headX + (dirX < 0 ? 5 : 6), headY + 4, '#09090b'); // Right pupil

    // Defined nose bridge & nostrils
    p(headX + 3, headY + 4, skinShadow);
    p(headX + 4, headY + 4, skinHighlight);
    p(headX + 4, headY + 5, skinShadow);

    // Mouth / Expression
    if (isHighIntensity) {
      r(headX + 3, headY + 6, 2, 1, skinShadow); // Focused grit
    } else {
      p(headX + 3, headY + 6, skinShadow);
    }

    // Facial hair / Beard / Goatee
    if (appearance.hasBeard) {
      r(headX + 1, headY + 5, 6, 2, hair);
      p(headX + 3, headY + 5, skinShadow);
      p(headX + 4, headY + 5, skinShadow);
    }
  } else if (isFacingUp) {
    // Back of head covered by rich hair texture
    r(headX, headY + 1, 8, 6, hair);
    r(headX + 1, headY + 2, 6, 2, hairHigh);
    p(headX + 1, headY + 5, hairShadow);
    p(headX + 6, headY + 5, hairShadow);
  } else {
    // Side profile with expressive eye & nose
    const flip = dirX < 0;
    ctx.save();
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    r(headX + 3, headY + 3, 2, 2, '#ffffff');
    p(headX + 4, headY + 4, '#09090b');
    p(headX + 6, headY + 4, skin); // Nose projection
    p(headX + 6, headY + 5, skinShadow);
    p(headX + 1, headY + 3, skinShadow); // Ear on profile
    ctx.restore();
  }

  // ----------------------------------------------------
  // DISTINCTIVE HAIR STYLES (Valderrama, Gullit, Baggio, etc.)
  // ----------------------------------------------------
  renderHairStyle(ctx, cx + torsoLeanX, headY, appearance.hairStyle, hair, hairHigh, hairShadow, isFacingUp);

  return canvas;
}

/**
 * Renders small retro pixel numbers on the back of jerseys (1 to 14)
 */
function drawPixelNumber(ctx: CanvasRenderingContext2D, x: number, y: number, num: number, color: string) {
  ctx.fillStyle = color;
  const p = (px: number, py: number) => ctx.fillRect(x + px, y + py, 1, 1);

  if (num === 1) {
    p(1, 0); p(2, 0); p(2, 1); p(2, 2); p(2, 3); p(1, 3); p(3, 3);
  } else if (num === 10) {
    // '1'
    p(0, 0); p(1, 0); p(1, 1); p(1, 2); p(1, 3);
    // '0'
    p(3, 0); p(4, 0); p(3, 1); p(5, 1); p(3, 2); p(5, 2); p(3, 3); p(4, 3);
  } else {
    // Generic crisp 3x4 pixel number representation
    p(0, 0); p(1, 0); p(2, 0);
    p(0, 1); p(2, 1);
    p(0, 2); p(1, 2); p(2, 2);
    p(2, 3);
  }
}

/**
 * Hair styles matching the legends from user's uploaded picture:
 * Valderrama afro, Gullit dreads, Baggio ponytail, Voller curls, clean crops
 */
function renderHairStyle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  style: string,
  hair: string,
  hairHigh: string,
  hairShadow: string,
  isFacingUp: boolean
) {
  const r = (x: number, y: number, rw: number, rh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), rw, rh);
  };
  const p = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };

  switch (style) {
    case 'afro_black': // Valderrama golden afro / Maradona puff
    case 'curly_blond': {
      // Big voluminous curly afro with textured perimeter and depth
      r(cx - 7, headY - 6, 14, 7, hair);
      r(cx - 9, headY - 3, 18, 6, hair);
      r(cx - 8, headY + 3, 4, 3, hairShadow);
      r(cx + 4, headY + 3, 4, 3, hairShadow);
      // Textured curl flecks & highlights
      p(cx - 6, headY - 4, hairHigh);
      p(cx - 4, headY - 5, hairHigh);
      p(cx - 1, headY - 6, hairHigh);
      p(cx + 2, headY - 6, hairHigh);
      p(cx + 5, headY - 4, hairHigh);
      p(cx - 2, headY - 3, hairHigh);
      p(cx + 3, headY - 2, hairHigh);
      p(cx - 5, headY - 1, hairShadow);
      p(cx + 4, headY - 1, hairShadow);
      break;
    }

    case 'dreads': {
      // Ruud Gullit dreadlocks with golden beads
      r(cx - 5, headY - 4, 10, 5, hair);
      p(cx - 2, headY - 4, hairHigh);
      p(cx + 2, headY - 4, hairHigh);
      r(cx - 7, headY, 3, 10, hair); // Left long dread strands
      r(cx + 4, headY, 3, 10, hair); // Right long dread strands
      p(cx - 7, headY + 4, hairShadow);
      p(cx + 6, headY + 4, hairShadow);
      // Golden dread beads
      p(cx - 6, headY + 8, '#facc15');
      p(cx + 5, headY + 8, '#facc15');
      p(cx - 7, headY + 6, '#fbbf24');
      if (isFacingUp) {
        r(cx - 4, headY + 3, 8, 7, hair);
        p(cx - 2, headY + 7, '#facc15');
        p(cx + 2, headY + 7, '#facc15');
      }
      break;
    }

    case 'ponytail_dark': {
      // Roberto Baggio "Il Divin Codino" (Divine Ponytail)
      r(cx - 5, headY - 3, 10, 5, hair);
      p(cx - 2, headY - 3, hairHigh);
      p(cx + 1, headY - 3, hairHigh);
      r(cx - 6, headY + 1, 2, 3, hair);
      r(cx + 4, headY + 1, 2, 3, hair);
      // Ponytail sticking out back with blue band
      if (isFacingUp) {
        r(cx - 1, headY + 6, 2, 7, hairShadow);
        p(cx, headY + 13, hair);
        r(cx - 1, headY + 6, 2, 1, '#0284c7'); // Blue hair tie band
      } else {
        r(cx + 3, headY + 5, 2, 6, hairShadow);
        r(cx + 3, headY + 5, 2, 1, '#0284c7');
        p(cx + 4, headY + 10, hair);
      }
      break;
    }

    case 'blond_sweep': {
      // Gascoigne / Klinsmann swept fringe
      r(cx - 5, headY - 4, 10, 5, hair);
      r(cx - 4, headY - 5, 8, 2, hairHigh);
      p(cx - 2, headY - 3, hairHigh);
      p(cx + 1, headY - 3, hairHigh);
      r(cx - 6, headY - 1, 3, 4, hair);
      r(cx + 4, headY - 1, 2, 3, hair);
      break;
    }

    case 'ginger_curly': {
      r(cx - 5, headY - 4, 10, 6, hair);
      r(cx - 6, headY, 2, 4, hairShadow);
      r(cx + 4, headY, 2, 4, hairShadow);
      p(cx - 2, headY - 4, hairHigh);
      p(cx + 1, headY - 4, hairHigh);
      p(cx - 3, headY - 2, hairHigh);
      p(cx + 2, headY - 2, hairHigh);
      break;
    }

    case 'bald': {
      // Shaved scalp (Roberto Carlos) with sleek top shine highlight
      r(cx - 3, headY - 1, 6, 1, hairHigh);
      p(cx - 2, headY - 2, hairHigh);
      p(cx + 1, headY - 2, hairHigh);
      break;
    }

    case 'crop_brown':
    default: {
      // Classic 90s footballer crop (Maldini, Baresi, Romario)
      r(cx - 5, headY - 3, 10, 5, hair);
      r(cx - 6, headY + 1, 2, 3, hairShadow);
      r(cx + 4, headY + 1, 2, 3, hairShadow);
      r(cx - 3, headY - 3, 6, 1, hairHigh);
      p(cx - 4, headY - 2, hairHigh);
      p(cx + 3, headY - 2, hairHigh);
      break;
    }
  }
}

/**
 * Draws the football with:
 * - Oval squash & stretch deformation along the movement vector
 * - Dynamic curling motion vapor trail
 * - Realistic height-based pitch shadow
 * - 3D rotating Telstar pentagons
 */
export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.save();

  // 1. DYNAMIC MOTION / CURL VAPOR TRAIL
  // Displays the banana curve arc as the ball swerves through the air!
  if (ball.trail && ball.trail.length > 0) {
    for (let i = 0; i < ball.trail.length; i++) {
      const pt = ball.trail[i];
      if (pt.alpha <= 0.02) continue;

      ctx.save();
      if (ball.isSpecialCurve || pt.color?.includes('#')) {
        const pColor = pt.color || '#a855f7';
        ctx.fillStyle = pColor;
        ctx.globalAlpha = pt.alpha * 0.75;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${pt.alpha * 0.45})`;
      }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1 - (i / ball.trail.length) * 0.4), 0, Math.PI * 2);
      ctx.fill();

      // Air cut swirl lines
      if (Math.abs(ball.spin || 0) > 1.5 && i % 2 === 0) {
        ctx.strokeStyle = ball.isSpecialCurve
          ? `rgba(216, 180, 254, ${pt.alpha * 0.5})`
          : `rgba(220, 240, 255, ${pt.alpha * 0.35})`;
        ctx.lineWidth = ball.isSpecialCurve ? 1.5 : 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 2. BALL PITCH SHADOW (scales and offsets based on 3D z height)
  const shadowScale = Math.max(0.25, 1 - ball.z / 220);
  const shadowAlpha = Math.max(0.12, 0.46 - (ball.z / 220) * 0.32);
  const shadowOffsetX = -3 - ball.z * 0.09;
  const shadowOffsetY = 5 + ball.z * 0.16;

  ctx.fillStyle = `rgba(8, 28, 8, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(
    ball.x + shadowOffsetX,
    ball.y + shadowOffsetY,
    6.5 * shadowScale,
    3.8 * shadowScale,
    -0.2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 3. BALL SPRITE WITH OVAL DEFORMATION & TELSTAR SEAMS
  const drawY = ball.y - ball.z;
  const baseRadius = 5.2;

  ctx.save();
  ctx.translate(ball.x, drawY);

  // Apply oval deformation (squash & stretch)
  const deform = ball.deformation || 0;
  if (deform !== 0) {
    ctx.rotate(ball.deformationAngle || 0);
    if (deform > 0) {
      // Elongate in flight direction (oval shape)
      const stretchX = 1 + deform * 0.42;
      const stretchY = 1 - deform * 0.22;
      ctx.scale(stretchX, stretchY);
    } else {
      // Squash on turf bounce
      const squashX = 1 + Math.abs(deform) * 0.35;
      const squashY = 1 - Math.abs(deform) * 0.35;
      ctx.scale(squashX, squashY);
    }
  }

  // Ball core body
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
  ctx.fill();

  // Bottom edge sphere shading
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0.25 * Math.PI, 0.95 * Math.PI);
  ctx.arc(0, 0, baseRadius - 1.2, 0.95 * Math.PI, 0.25 * Math.PI, true);
  ctx.closePath();
  ctx.fill();

  // Outer seam ring
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3D Rotating Telstar Pentagon Patches
  ctx.fillStyle = '#18181b';
  const spinOffset = ball.rotationAngle || ((Date.now() * 0.005) % (Math.PI * 2));

  // Center patch
  const cx1 = Math.cos(spinOffset) * 2;
  const cy1 = Math.sin(spinOffset) * 2;
  ctx.fillRect(Math.round(cx1 - 1), Math.round(cy1 - 1), 2, 2);

  // Orbiting patches with 3D spherical depth
  const cx2 = Math.cos(spinOffset + 2.1) * 3.2;
  const cy2 = Math.sin(spinOffset + 2.1) * 3.2;
  ctx.fillRect(Math.round(cx2 - 1), Math.round(cy2 - 1), 2, 2);

  const cx3 = Math.cos(spinOffset + 4.2) * 3.0;
  const cy3 = Math.sin(spinOffset + 4.2) * 3.0;
  ctx.fillRect(Math.round(cx3 - 1), Math.round(cy3 - 1), 2, 2);

  // Specular top highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(-2, -3, 2, 1);

  ctx.restore();
  ctx.restore();
}

/**
 * Draws the referee in authentic black uniform with whistle and card display,
 * along with a subtle, delicate sight angle cone representing the referee's vision
 */
export function drawReferee(ctx: CanvasRenderingContext2D, ref: Referee) {
  ctx.save();

  // Subtle Referee Sight Cone (subtle field of vision cone)
  const facing = ref.facingAngle || 0;
  const fov = ref.sightFov || (110 * Math.PI / 180);
  const range = ref.sightRange || 360;
  const halfFov = fov / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ref.x, ref.y - 14);
  ctx.arc(ref.x, ref.y - 14, range, facing - halfFov, facing + halfFov);
  ctx.closePath();

  // Soft translucent golden radial gradient
  const grad = ctx.createRadialGradient(ref.x, ref.y - 14, 10, ref.x, ref.y - 14, range);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.08)');
  grad.addColorStop(0.5, 'rgba(254, 240, 138, 0.035)');
  grad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle dashed vision edge boundary
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.12)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Shadow (standard average adult player shadow)
  ctx.fillStyle = 'rgba(10, 32, 10, 0.45)';
  ctx.beginPath();
  ctx.ellipse(ref.x - 4, ref.y + 4, 11, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  const groundY = ref.y;
  const cx = ref.x;

  // 1. Boots (Adult regulation: 5px wide, 4px tall with adidas style stripes)
  ctx.fillStyle = '#09090b';
  ctx.fillRect(cx - 6, groundY - 4, 5, 4);
  ctx.fillRect(cx + 1, groundY - 4, 5, 4);
  // White boot stripes
  ctx.fillStyle = '#e4e4e7';
  ctx.fillRect(cx - 5, groundY - 3, 2, 1);
  ctx.fillRect(cx - 4, groundY - 2, 2, 1);
  ctx.fillRect(cx + 2, groundY - 3, 2, 1);
  ctx.fillRect(cx + 3, groundY - 2, 2, 1);

  // 2. Legs & Black Socks (Adult athletic proportion: 8px tall, 4px wide each)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(cx - 5, groundY - 12, 4, 8);
  ctx.fillRect(cx + 1, groundY - 12, 4, 8);
  // White sock turn-over rings at top
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(cx - 5, groundY - 12, 4, 2);
  ctx.fillRect(cx + 1, groundY - 12, 4, 2);

  // 3. Official Referee Shorts (15px wide, 9px tall, matching outfield players)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(cx - 7, groundY - 20, 15, 9);
  // Elastic waistband & subtle seam highlight
  ctx.fillStyle = '#27272a';
  ctx.fillRect(cx - 7, groundY - 20, 15, 2);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(cx, groundY - 17, 1, 6); // Crotch seam

  // 4. Official Referee Shirt (17px wide, 13px tall, athletic adult torso)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(cx - 8, groundY - 32, 17, 13);

  // Two chest pockets with button flaps
  ctx.fillStyle = '#27272a';
  ctx.fillRect(cx - 6, groundY - 28, 5, 5);
  ctx.fillRect(cx + 2, groundY - 28, 5, 5);
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(cx - 6, groundY - 28, 5, 1); // Pocket flap
  ctx.fillRect(cx + 2, groundY - 28, 5, 1);

  // Official FIFA gold referee badge on left chest pocket
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 5, groundY - 27, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 4, groundY - 26, 1, 1);

  // Crisp white collar & V-neck
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(cx - 3, groundY - 33, 6, 2);
  ctx.fillRect(cx - 2, groundY - 31, 4, 2);
  ctx.fillRect(cx - 1, groundY - 29, 2, 2);

  // 5. Athletic Arms (4px wide, adult reach, digital match watch)
  ctx.fillStyle = '#d09868';
  // Left arm
  ctx.fillRect(cx - 11, groundY - 31, 4, 11);
  // Right arm
  ctx.fillRect(cx + 8, groundY - 31, 4, 11);
  // Black digital referee watch on left wrist
  ctx.fillStyle = '#09090b';
  ctx.fillRect(cx - 11, groundY - 23, 4, 3);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(cx - 10, groundY - 22, 2, 1); // Cyan LCD display

  // 6. Neck & Whistle
  ctx.fillStyle = '#c58a5c';
  ctx.fillRect(cx - 2, groundY - 35, 5, 3);
  // Neon cyan lanyard loop around neck
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(cx - 1, groundY - 32, 3, 2);
  // Metallic whistle
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(cx, groundY - 30, 2, 3);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + 1, groundY - 28, 1, 1);

  // 7. Head (10px wide, 8px tall, adult facial structure)
  ctx.fillStyle = '#d09868';
  ctx.fillRect(cx - 5, groundY - 42, 10, 8);
  // Chin shadow
  ctx.fillStyle = '#b8794c';
  ctx.fillRect(cx - 4, groundY - 35, 8, 1);

  // Focused referee eyes & brow
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(cx - 4, groundY - 39, 3, 1); // Left brow
  ctx.fillRect(cx + 1, groundY - 39, 3, 1); // Right brow
  ctx.fillStyle = '#18181b';
  ctx.fillRect(cx - 3, groundY - 38, 2, 2); // Left eye
  ctx.fillRect(cx + 2, groundY - 38, 2, 2); // Right eye
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 2, groundY - 38, 1, 1); // Catchlight
  ctx.fillRect(cx + 3, groundY - 38, 1, 1);

  // 8. Hair (12px wide, neat professional dark haircut)
  ctx.fillStyle = '#27272a';
  ctx.fillRect(cx - 6, groundY - 44, 12, 4);
  ctx.fillRect(cx - 6, groundY - 40, 2, 3); // Left sideburn
  ctx.fillRect(cx + 4, groundY - 40, 2, 3); // Right sideburn
  // Subtle hair highlight
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(cx - 4, groundY - 44, 6, 1);

  // 9. Card Display (held high overhead with extended arm when active)
  if (ref.cardDisplay) {
    ctx.save();
    // Arm extended fully upward
    ctx.fillStyle = '#d09868';
    ctx.fillRect(cx + 8, groundY - 45, 4, 14);
    // Card held aloft
    ctx.fillStyle = ref.cardDisplay === 'yellow' ? '#facc15' : '#ef4444';
    ctx.fillRect(cx + 7, groundY - 54, 7, 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 7, groundY - 54, 7, 10);
    ctx.restore();
  }

  // 10. Whistle text indicator
  if (ref.whistleTimer > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('♫ TWEET!', cx - 22, groundY - 48);
  }

  ctx.restore();
}

/**
 * Utility color shade modifier
 */
function shadeColor(color: string, percent: number): string {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = Math.min(255, Math.max(0, Math.round(R * (100 + percent) / 100)));
  G = Math.min(255, Math.max(0, Math.round(G * (100 + percent) / 100)));
  B = Math.min(255, Math.max(0, Math.round(B * (100 + percent) / 100)));

  const RR = R.toString(16).padStart(2, '0');
  const GG = G.toString(16).padStart(2, '0');
  const BB = B.toString(16).padStart(2, '0');

  return `#${RR}${GG}${BB}`;
}
