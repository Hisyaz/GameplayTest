import { Player, Ball, SetPieceState, KeyState, TeamSide } from '../types';
import { PITCH_CONFIG, HOME_KIT, AWAY_KIT } from './constants';
import { audio } from './audio';
import { t } from './i18n';
import type { MatchEngine } from './engine';

/**
 * Checks if a coordinate is inside the defending team's penalty box
 */
export function isInsideDefendingPenaltyBox(x: number, y: number, isAttackingUp: boolean): boolean {
  const boxLeft = PITCH_CONFIG.CENTER_X - PITCH_CONFIG.PENALTY_BOX_WIDTH / 2;
  const boxRight = PITCH_CONFIG.CENTER_X + PITCH_CONFIG.PENALTY_BOX_WIDTH / 2;

  if (isAttackingUp) {
    // Defending team's box is at the top of the pitch
    return x >= boxLeft && x <= boxRight && y >= PITCH_CONFIG.PITCH_TOP && y <= PITCH_CONFIG.PITCH_TOP + PITCH_CONFIG.PENALTY_BOX_HEIGHT;
  } else {
    // Defending team's box is at the bottom of the pitch
    return x >= boxLeft && x <= boxRight && y >= PITCH_CONFIG.PITCH_BOTTOM - PITCH_CONFIG.PENALTY_BOX_HEIGHT && y <= PITCH_CONFIG.PITCH_BOTTOM;
  }
}

/**
 * Sets up a Penalty Kick
 * "add freekicks, and penalties... penalty you can only shoot"
 */
export function setupPenalty(engine: MatchEngine, attackingTeam: TeamSide): void {
  engine.matchPhase = 'penalty';
  engine.phaseTimer = 0;

  const isAttackingUp = attackingTeam === 'home';
  const spotX = PITCH_CONFIG.CENTER_X;
  const spotY = isAttackingUp ? PITCH_CONFIG.PITCH_TOP + 110 : PITCH_CONFIG.PITCH_BOTTOM - 110;

  engine.ball.x = spotX;
  engine.ball.y = spotY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;
  engine.ball.vz = 0;
  engine.ball.ownerId = null;
  engine.ball.isAirborne = false;

  // Select taker: best attacker or user controlled
  const taker =
    engine.players.find(p => p.team === attackingTeam && (p.role === 'ST1' || p.role === 'ST2' || p.isUserControlled)) ||
    engine.players.find(p => p.team === attackingTeam && p.role !== 'GK')!;

  const takerAim = isAttackingUp ? -Math.PI / 2 : Math.PI / 2;
  taker.x = spotX;
  taker.y = isAttackingUp ? spotY + 18 : spotY - 18;
  taker.facingAngle = takerAim;

  // Defending Goalkeeper on the goal line
  const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
  const gk = engine.players.find(p => p.team === defendingTeam && p.role === 'GK');
  if (gk) {
    gk.x = PITCH_CONFIG.CENTER_X;
    gk.y = isAttackingUp ? PITCH_CONFIG.PITCH_TOP + 12 : PITCH_CONFIG.PITCH_BOTTOM - 12;
    gk.facingAngle = isAttackingUp ? Math.PI / 2 : -Math.PI / 2;
    gk.action = 'idle';
  }

  // Clear all other players outside the penalty box
  for (const p of engine.players) {
    if (p.id === taker.id || (gk && p.id === gk.id)) continue;
    if (isAttackingUp) {
      p.y = Math.max(PITCH_CONFIG.PITCH_TOP + PITCH_CONFIG.PENALTY_BOX_HEIGHT + 24, p.y);
    } else {
      p.y = Math.min(PITCH_CONFIG.PITCH_BOTTOM - PITCH_CONFIG.PENALTY_BOX_HEIGHT - 24, p.y);
    }
  }

  engine.setPiece = {
    type: 'penalty',
    takerId: taker.id,
    team: attackingTeam,
    spotX,
    spotY,
    aimAngle: takerAim,
    wallPlayerIds: [],
    isPenalty: true,
  };

  if (attackingTeam === 'home') {
    engine.userControlledPlayerId = taker.id;
    engine.updateUserControlledFlag();
  }

  engine.bannerMessage = t('penaltyShootOnly');
  engine.bannerTimer = 180;
}

/**
 * Sets up a Free Kick outside the box
 * "add freekicks, and penalties. as well as corners, goalkicks and side throw ins., where you can point and hit/pass"
 */
export function setupFreeKick(engine: MatchEngine, attackingTeam: TeamSide, foulX: number, foulY: number): void {
  engine.matchPhase = 'free_kick';
  engine.phaseTimer = 0;

  const isAttackingUp = attackingTeam === 'home';
  const clampedX = Math.max(PITCH_CONFIG.PITCH_LEFT + 20, Math.min(PITCH_CONFIG.PITCH_RIGHT - 20, foulX));
  const clampedY = Math.max(PITCH_CONFIG.PITCH_TOP + 35, Math.min(PITCH_CONFIG.PITCH_BOTTOM - 35, foulY));

  engine.ball.x = clampedX;
  engine.ball.y = clampedY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;
  engine.ball.vz = 0;
  engine.ball.ownerId = null;

  const goalY = isAttackingUp ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
  const initialAim = Math.atan2(goalY - clampedY, PITCH_CONFIG.CENTER_X - clampedX);

  const taker =
    engine.players.find(p => p.team === attackingTeam && (p.isUserControlled || p.role === 'CM1' || p.role === 'ST1')) ||
    engine.players.find(p => p.team === attackingTeam && p.role !== 'GK')!;

  taker.x = clampedX - Math.cos(initialAim) * 14;
  taker.y = clampedY - Math.sin(initialAim) * 14;
  taker.facingAngle = initialAim;

  if (attackingTeam === 'home') {
    engine.userControlledPlayerId = taker.id;
    engine.updateUserControlledFlag();
  }

  const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';

  // Push back all defending players at least 95 units (FIFA 10 yards rule) away from the free kick spot
  for (const p of engine.players) {
    if (p.team === defendingTeam && p.role !== 'GK') {
      const d = Math.hypot(p.x - clampedX, p.y - clampedY);
      if (d < 95) {
        const awayAngle = Math.atan2(p.y - clampedY, p.x - clampedX);
        p.x = clampedX + Math.cos(awayAngle) * 105;
        p.y = clampedY + Math.sin(awayAngle) * 105;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  // Position defensive wall of 3 players 80px away if within shooting distance
  const distToGoal = Math.hypot(PITCH_CONFIG.CENTER_X - clampedX, goalY - clampedY);
  const wallIds: string[] = [];

  if (distToGoal < 380) {
    const defenders = engine.players.filter(p => p.team === defendingTeam && p.role !== 'GK').slice(0, 3);
    const wallDist = 82;
    const wallCenterX = clampedX + Math.cos(initialAim) * wallDist;
    const wallCenterY = clampedY + Math.sin(initialAim) * wallDist;
    const perpAngle = initialAim + Math.PI / 2;

    defenders.forEach((d, idx) => {
      const offset = (idx - 1) * 16;
      d.x = wallCenterX + Math.cos(perpAngle) * offset;
      d.y = wallCenterY + Math.sin(perpAngle) * offset;
      d.facingAngle = initialAim + Math.PI; // Face the ball
      wallIds.push(d.id);
    });
  }

  engine.setPiece = {
    type: 'free_kick',
    takerId: taker.id,
    team: attackingTeam,
    spotX: clampedX,
    spotY: clampedY,
    aimAngle: initialAim,
    wallPlayerIds: wallIds,
    isPenalty: false,
  };

  engine.bannerMessage = t('freekickAwarded');
  engine.bannerTimer = 160;
}

/**
 * Sets up a Corner Kick
 */
export function setupCornerKick(engine: MatchEngine, attackingTeam: TeamSide, cornerX: number, cornerY: number): void {
  engine.matchPhase = 'corner_kick';
  engine.phaseTimer = 0;

  const isAttackingUp = attackingTeam === 'home';
  engine.ball.x = cornerX;
  engine.ball.y = cornerY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;
  engine.ball.vz = 0;
  engine.ball.ownerId = null;

  const boxCenterY = isAttackingUp ? PITCH_CONFIG.PITCH_TOP + 100 : PITCH_CONFIG.PITCH_BOTTOM - 100;
  const initialAim = Math.atan2(boxCenterY - cornerY, PITCH_CONFIG.CENTER_X - cornerX);

  const taker =
    engine.players.find(p => p.team === attackingTeam && (p.role === 'LM' || p.role === 'RM' || p.isUserControlled)) ||
    engine.players.find(p => p.team === attackingTeam && p.role !== 'GK')!;

  taker.x = cornerX - Math.cos(initialAim) * 12;
  taker.y = cornerY - Math.sin(initialAim) * 12;
  taker.facingAngle = initialAim;

  if (attackingTeam === 'home') {
    engine.userControlledPlayerId = taker.id;
    engine.updateUserControlledFlag();
  }

  engine.setPiece = {
    type: 'corner_kick',
    takerId: taker.id,
    team: attackingTeam,
    spotX: cornerX,
    spotY: cornerY,
    aimAngle: initialAim,
    wallPlayerIds: [],
    isPenalty: false,
  };

  engine.bannerMessage = t('cornerPrompt');
  engine.bannerTimer = 160;
}

/**
 * Sets up a Goal Kick
 */
export function setupGoalKick(engine: MatchEngine, defendingTeam: TeamSide): void {
  engine.matchPhase = 'goal_kick';
  engine.phaseTimer = 0;

  const isBottomGoal = defendingTeam === 'home';
  const spotX = PITCH_CONFIG.CENTER_X - 35;
  const spotY = isBottomGoal ? PITCH_CONFIG.PITCH_BOTTOM - 45 : PITCH_CONFIG.PITCH_TOP + 45;

  engine.ball.x = spotX;
  engine.ball.y = spotY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;
  engine.ball.vz = 0;
  engine.ball.ownerId = null;

  const gk = engine.players.find(p => p.team === defendingTeam && p.role === 'GK')!;
  const initialAim = isBottomGoal ? -Math.PI / 2 : Math.PI / 2;

  gk.x = spotX;
  gk.y = isBottomGoal ? spotY + 12 : spotY - 12;
  gk.facingAngle = initialAim;

  if (defendingTeam === 'home') {
    engine.userControlledPlayerId = gk.id;
    engine.updateUserControlledFlag();
  }

  engine.setPiece = {
    type: 'goal_kick',
    takerId: gk.id,
    team: defendingTeam,
    spotX,
    spotY,
    aimAngle: initialAim,
    wallPlayerIds: [],
    isPenalty: false,
  };

  engine.bannerMessage = t('setPieceAimPrompt');
  engine.bannerTimer = 160;
}

/**
 * Sets up a Throw-In from sideline
 */
export function setupThrowIn(engine: MatchEngine, team: TeamSide, touchX: number, touchY: number): void {
  engine.matchPhase = 'throw_in';
  engine.phaseTimer = 0;

  engine.ball.x = touchX;
  engine.ball.y = touchY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;
  engine.ball.vz = 0;
  engine.ball.ownerId = null;

  const isLeftSide = touchX < PITCH_CONFIG.CENTER_X;
  const initialAim = isLeftSide ? 0 : Math.PI;

  const taker =
    engine.players.find(p => p.team === team && (p.role === 'LB' || p.role === 'RB' || p.isUserControlled)) ||
    engine.players.find(p => p.team === team && p.role !== 'GK')!;

  taker.x = touchX - Math.cos(initialAim) * 8;
  taker.y = touchY;
  taker.facingAngle = initialAim;

  if (team === 'home') {
    engine.userControlledPlayerId = taker.id;
    engine.updateUserControlledFlag();
  }

  engine.setPiece = {
    type: 'throw_in',
    takerId: taker.id,
    team,
    spotX: touchX,
    spotY: touchY,
    aimAngle: initialAim,
    wallPlayerIds: [],
    isPenalty: false,
  };

  engine.bannerMessage = t('throwInPrompt');
  engine.bannerTimer = 160;
}

/**
 * Primary set-piece update loop handling both user-controlled and AI-controlled set pieces
 */
export function updateSetPiece(engine: MatchEngine, keys: KeyState): void {
  const sp = engine.setPiece;
  if (!sp) return;

  if (sp.team === 'home') {
    handleSetPieceInput(engine, keys);
  } else {
    // Away team (AI) set-piece execution
    engine.phaseTimer++;
    const taker = engine.players.find(p => p.id === sp.takerId);
    if (!taker) {
      engine.setPiece = null;
      engine.matchPhase = 'in_play';
      return;
    }

    // Keep taker facing spot
    taker.facingAngle = sp.aimAngle;
    taker.x = sp.spotX - Math.cos(sp.aimAngle) * 14;
    taker.y = sp.spotY - Math.sin(sp.aimAngle) * 14;

    // Wait ~65 frames for realism (referee whistle, camera framing, positioning)
    if (engine.phaseTimer > 65) {
      if (sp.isPenalty) {
        // AI Penalty: target bottom goal left or right
        const cornerAim = Math.PI / 2 + (Math.random() < 0.5 ? -0.22 : 0.22);
        executePenaltyShot(engine, taker, cornerAim, 0.65 + Math.random() * 0.25);
      } else if (sp.type === 'corner_kick') {
        // AI Corner: whip cross into Home penalty box
        const targetX = PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 60;
        const targetY = PITCH_CONFIG.PITCH_BOTTOM - 130;
        const aim = Math.atan2(targetY - sp.spotY, targetX - sp.spotX);
        executeSetPieceDelivery(engine, taker, aim, 'cross', 0.65);
      } else if (sp.type === 'goal_kick') {
        // AI Goal Kick: pass to open defender or loft to midfield
        const aim = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        executeSetPieceDelivery(engine, taker, aim, Math.random() < 0.5 ? 'pass' : 'long_pass', 0.7);
      } else if (sp.type === 'throw_in') {
        // AI Throw-in: throw to nearest teammate
        const mates = engine.players.filter(p => p.team === 'away' && p.id !== taker.id);
        const nearMate = mates.sort((a, b) => Math.hypot(a.x - taker.x, a.y - taker.y) - Math.hypot(b.x - taker.x, b.y - taker.y))[0];
        const aim = nearMate ? Math.atan2(nearMate.y - taker.y, nearMate.x - taker.x) : sp.aimAngle;
        executeSetPieceDelivery(engine, taker, aim, 'pass', 0.55);
      } else {
        // AI Free Kick:
        const goalY = taker.team === 'home' ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
        const distToGoal = Math.hypot(PITCH_CONFIG.CENTER_X - sp.spotX, goalY - sp.spotY);
        const isNearWing = sp.spotX < PITCH_CONFIG.PITCH_LEFT + 280 || sp.spotX > PITCH_CONFIG.PITCH_RIGHT - 280;

        if (distToGoal < 380) {
          // Near goal: direct strike on goal!
          const aim = Math.atan2(goalY - sp.spotY, PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 60 - sp.spotX);
          executeSetPieceDelivery(engine, taker, aim, 'shoot', 0.85);
        } else if (isNearWing) {
          // Near wing: cross into penalty box!
          const boxCenterY = taker.team === 'home' ? PITCH_CONFIG.PITCH_TOP + 160 : PITCH_CONFIG.PITCH_BOTTOM - 160;
          const aim = Math.atan2(boxCenterY - sp.spotY, PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 60 - sp.spotX);
          executeSetPieceDelivery(engine, taker, aim, 'cross', 0.80);
        } else {
          // Seek to retain possession and pass to an open teammate!
          const mates = engine.players.filter(p => p.team === taker.team && p.id !== taker.id && p.role !== 'GK');
          const sortedMates = mates.map(m => {
            const dist = Math.hypot(m.x - taker.x, m.y - taker.y);
            let oppDist = Infinity;
            for (const opp of engine.players) {
              if (opp.team !== taker.team) {
                const od = Math.hypot(opp.x - m.x, opp.y - m.y);
                if (od < oppDist) oppDist = od;
              }
            }
            return { mate: m, dist, oppDist, score: oppDist * 1.5 - dist * 0.2 };
          }).sort((a, b) => b.score - a.score);

          const bestMate = sortedMates.length > 0 ? sortedMates[0].mate : null;
          const aim = bestMate ? Math.atan2(bestMate.y - taker.y, bestMate.x - taker.x) : sp.aimAngle;
          executeSetPieceDelivery(engine, taker, aim, 'pass', 0.70);
        }
      }
    }
  }
}

/**
 * Handles user controls during any set piece:
 * Arrow keys: Aim direction
 * In penalty: ONLY Shoot (A)
 * In other set pieces: S (pass), W (through/lofted), A (shoot), D (cross)
 */
export function handleSetPieceInput(engine: MatchEngine, keys: KeyState): void {
  const sp = engine.setPiece;
  if (!sp) return;

  const taker = engine.players.find(p => p.id === sp.takerId);
  if (!taker) return;

  // Aiming with arrow keys
  if (keys.ArrowLeft) sp.aimAngle -= 0.035;
  if (keys.ArrowRight) sp.aimAngle += 0.035;
  if (keys.ArrowUp) {
    // Pitch upwards
    sp.aimAngle = sp.aimAngle * 0.95 + (-Math.PI / 2) * 0.05;
  }
  if (keys.ArrowDown) {
    // Pitch downwards
    sp.aimAngle = sp.aimAngle * 0.95 + (Math.PI / 2) * 0.05;
  }

  taker.facingAngle = sp.aimAngle;
  taker.x = sp.spotX - Math.cos(sp.aimAngle) * 14;
  taker.y = sp.spotY - Math.sin(sp.aimAngle) * 14;

  // --- PENALTY EXECUTION ---
  // "penalty you can only shoot"
  if (sp.isPenalty) {
    if (keys.KeyS || keys.KeyW || keys.KeyD) {
      engine.bannerMessage = t('penaltyShootOnly');
      engine.bannerTimer = 60;
      return;
    }

    // Charging Shoot with A key
    if (keys.KeyA) {
      if (!engine.powerBar.isActive) {
        engine.startChargingPower('shoot', !!keys.KeyQ, !!keys.KeyE);
      } else {
        engine.powerBar.power = Math.min(1.0, engine.powerBar.power + engine.powerBar.fillSpeed * 1.3);
        engine.updatePowerBarTiers();
        if (engine.powerBar.power >= 1.0) {
          executePenaltyShot(engine, taker, sp.aimAngle, engine.powerBar.power);
          keys.KeyA = false;
        }
      }
    } else if (engine.powerBar.isActive && engine.powerBar.action === 'shoot') {
      // Released A: strike penalty!
      executePenaltyShot(engine, taker, sp.aimAngle, engine.powerBar.power);
    }
    return;
  }

  // --- OTHER SET PIECES (Free kick, corner, goal kick, throw-in) ---
  // "where you can point and hit/pass"
  if (!engine.powerBar.isActive) {
    if (keys.KeyS) engine.startChargingPower('pass', !!keys.KeyQ, !!keys.KeyE);
    else if (keys.KeyW) engine.startChargingPower('long_pass', !!keys.KeyQ, !!keys.KeyE);
    else if (keys.KeyA) engine.startChargingPower('shoot', !!keys.KeyQ, !!keys.KeyE);
    else if (keys.KeyD) engine.startChargingPower('cross', !!keys.KeyQ, !!keys.KeyE);
  } else {
    const action = engine.powerBar.action;
    let isHeld = false;
    if (action === 'pass') isHeld = keys.KeyS;
    else if (action === 'long_pass') isHeld = keys.KeyW;
    else if (action === 'shoot') isHeld = keys.KeyA;
    else if (action === 'cross') isHeld = keys.KeyD;

    if (isHeld) {
      engine.powerBar.power = Math.min(1.0, engine.powerBar.power + engine.powerBar.fillSpeed);
      engine.updatePowerBarTiers();
      if (engine.powerBar.power >= 1.0) {
        executeSetPieceDelivery(engine, taker, sp.aimAngle, action, 1.0);
        if (action === 'pass') keys.KeyS = false;
        else if (action === 'long_pass') keys.KeyW = false;
        else if (action === 'shoot') keys.KeyA = false;
        else if (action === 'cross') keys.KeyD = false;
      }
    } else {
      executeSetPieceDelivery(engine, taker, sp.aimAngle, action, engine.powerBar.power);
    }
  }
}

/**
 * Fires the penalty shot and triggers goalkeeper dive
 */
function executePenaltyShot(engine: MatchEngine, taker: Player, aimAngle: number, power: number): void {
  taker.action = 'shooting';
  taker.actionTimer = 20;

  const shotSpeed = 16.0 + power * 8.0;
  engine.ball.ownerId = null;
  engine.ball.lastTouchPlayerId = taker.id;
  engine.ball.lastTouchTeam = taker.team;
  engine.ball.vx = Math.cos(aimAngle) * shotSpeed;
  engine.ball.vy = Math.sin(aimAngle) * shotSpeed;
  engine.ball.vz = 2.0 + power * 2.2;
  engine.ball.isAirborne = true;

  // Defending Goalkeeper anticipates and dives!
  const defendingTeam = taker.team === 'home' ? 'away' : 'home';
  const gk = engine.players.find(p => p.team === defendingTeam && p.role === 'GK');
  if (gk) {
    const diveChoice = Math.random();
    gk.action = 'goalkeeper_dive';
    gk.actionTimer = 30;
    if (diveChoice < 0.42) {
      gk.diveX = -3.8; // Dive left
    } else if (diveChoice < 0.84) {
      gk.diveX = 3.8; // Dive right
    } else {
      gk.diveX = 0; // Stay center
    }
    gk.diveY = taker.team === 'home' ? 1.0 : -1.0;
  }

  audio.playKick(0.95);
  engine.powerBar.isActive = false;
  engine.matchPhase = 'in_play';
  engine.setPiece = null;
  engine.bannerMessage = t('goalCheer');
  engine.bannerTimer = 60;
}

/**
 * Executes delivery for free kick, corner, goal kick, or throw in
 */
function executeSetPieceDelivery(
  engine: MatchEngine,
  taker: Player,
  aimAngle: number,
  action: 'pass' | 'long_pass' | 'shoot' | 'cross' | null,
  power: number
): void {
  taker.action = action === 'shoot' ? 'shooting' : action === 'cross' ? 'crossing' : 'passing';
  taker.actionTimer = 18;

  const mult = Math.max(0.3, power);
  engine.ball.ownerId = null;
  engine.ball.lastTouchPlayerId = taker.id;
  engine.ball.lastTouchTeam = taker.team;

  if (action === 'shoot') {
    const speed = 16.0 + mult * 9.0;
    engine.ball.vx = Math.cos(aimAngle) * speed;
    engine.ball.vy = Math.sin(aimAngle) * speed;
    engine.ball.vz = 2.2 + mult * 2.4;
    engine.ball.isAirborne = true;
    audio.playKick(0.9);
  } else if (action === 'cross') {
    const speed = 15.0 + mult * 7.5;
    engine.ball.vx = Math.cos(aimAngle) * speed;
    engine.ball.vy = Math.sin(aimAngle) * speed;
    engine.ball.vz = 4.2 + mult * 2.0;
    engine.ball.isAirborne = true;
    audio.playKick(0.85);
  } else if (action === 'long_pass') {
    const speed = 13.5 + mult * 6.0;
    engine.ball.vx = Math.cos(aimAngle) * speed;
    engine.ball.vy = Math.sin(aimAngle) * speed;
    engine.ball.vz = 2.8 + mult * 1.8;
    engine.ball.isAirborne = true;
    audio.playKick(0.75);
  } else {
    // Ground pass
    const speed = 12.0 + mult * 5.0;
    engine.ball.vx = Math.cos(aimAngle) * speed;
    engine.ball.vy = Math.sin(aimAngle) * speed;
    engine.ball.vz = 0;
    engine.ball.isAirborne = false;
    audio.playKick(0.65);
  }

  // If passing to a teammate from set-piece, target them and switch control to the recipient
  if (action === 'pass' || action === 'long_pass') {
    const mates = engine.players.filter(p => p.team === taker.team && p.id !== taker.id && p.role !== 'GK');
    let bestReceiver: Player | null = null;
    let bestScore = -Infinity;
    for (const m of mates) {
      const dx = m.x - taker.x;
      const dy = m.y - taker.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 40 && dist < 480) {
        const mAngle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(mAngle - aimAngle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);
        if (angleDiff < 0.95) {
          const score = 100 - angleDiff * 60 - dist * 0.08;
          if (score > bestScore) {
            bestScore = score;
            bestReceiver = m;
          }
        }
      }
    }
    if (bestReceiver) {
      if (taker.team === 'home') {
        engine.userControlledPlayerId = bestReceiver.id;
        engine.updateUserControlledFlag();
      }
    }
  }

  engine.powerBar.isActive = false;
  engine.matchPhase = 'in_play';
  engine.setPiece = null;
  engine.bannerTimer = 40;
}
