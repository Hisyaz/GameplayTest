import { Player, Ball, TeamSide, PlayerRole, DifficultyLevel } from '../types';
import { PITCH_CONFIG, PHYSICS } from './constants';
import { audio } from './audio';
import { isKickingAction } from './engine';

export interface AiActionOutput {
  action?: 'kick' | 'pass' | 'shoot' | 'cross' | 'tackle' | 'slide' | 'header';
  targetX?: number;
  targetY?: number;
  power?: number;
  receiverId?: string;
}

/**
 * Calculates smart tactical positioning and behavior for 11v11 players
 */
export function updatePlayerAI(
  player: Player,
  allPlayers: Player[],
  ball: Ball,
  isAttackingUp: boolean, // true for Home (attacks top goal), false for Away (attacks bottom goal)
  difficulty: DifficultyLevel = 'easy',
  scoreDiff: number = 0, // awayScore - homeScore: positive = AI winning, negative = AI losing
  isKickoffActive: boolean = false,
  timeScale: number = 1
): AiActionOutput | null {
  // If player is currently executing a fixed action (sliding, stunned by foul, diving, or kicking), wait for it to finish
  if (
    player.action === 'fouled_falling' ||
    player.action === 'sliding_tackle' ||
    player.action === 'goalkeeper_dive' ||
    (player.actionTimer > 0 && isKickingAction(player.action))
  ) {
    return null;
  }

  // --- KICK OFF PROTECTION RULE ---
  // "opposing players should not invade the middle circle of the pitch while on kick off, until you pass it they can't enter the circle at the middle or cross the middle of the pitch"
  if (isKickoffActive && player.team === 'away') {
    enforceKickoffBoundary(player);
    player.vx = 0;
    player.vy = 0;
    player.action = 'idle';
    return null;
  }

  // --- DIFFICULTY: STANDING MODE ---
  // "standing where the opossing team jsut stands and doens't do anything only the goalkeeper can save and pass"
  if (difficulty === 'standing' && player.team === 'away' && player.role !== 'GK') {
    player.vx = 0;
    player.vy = 0;
    player.action = 'idle';
    return null;
  }

  const isOwner = ball.ownerId === player.id;
  const teamHasBall = allPlayers.some(p => p.team === player.team && ball.ownerId === p.id);

  // 1. GOALKEEPER SPECIFIC AI
  if (player.role === 'GK') {
    return updateGoalkeeperAI(player, allPlayers, ball, isAttackingUp, timeScale);
  }

  // 2. BALL CARRIER DECISION MAKING (If AI has the ball)
  if (isOwner) {
    return updateBallCarrierAI(player, allPlayers, ball, isAttackingUp, difficulty, scoreDiff, timeScale);
  }

  // 3. OUT-OF-POSSESSION & OFF-THE-BALL POSITIONING
  return updateOffTheBallAI(player, allPlayers, ball, isAttackingUp, teamHasBall, difficulty, scoreDiff, timeScale);
}

/**
 * Enforces that opposing players remain in their own half and outside the center circle during kickoff
 */
function enforceKickoffBoundary(player: Player) {
  const maxAllowedY = PITCH_CONFIG.CENTER_Y - 20;
  if (player.y > maxAllowedY) {
    player.y = maxAllowedY;
  }

  const distToCenter = Math.hypot(player.x - PITCH_CONFIG.CENTER_X, player.y - PITCH_CONFIG.CENTER_Y);
  if (distToCenter < 195) {
    const angle = Math.atan2(player.y - PITCH_CONFIG.CENTER_Y, player.x - PITCH_CONFIG.CENTER_X);
    player.x = PITCH_CONFIG.CENTER_X + Math.cos(angle) * 200;
    player.y = PITCH_CONFIG.CENTER_Y + Math.sin(angle) * 200;
    if (player.y > maxAllowedY) player.y = maxAllowedY;
  }
}

/**
 * Goalkeeper AI:
 * - Secures loose balls & saves shots
 * - Opponents cannot tackle GK
 * - Actively scans upfield and distributes/passes the ball out!
 */
function updateGoalkeeperAI(
  player: Player,
  allPlayers: Player[],
  ball: Ball,
  isAttackingUp: boolean,
  timeScale: number = 1
): AiActionOutput | null {
  const goalLineY = isAttackingUp ? PITCH_CONFIG.PITCH_BOTTOM - 20 : PITCH_CONFIG.PITCH_TOP + 20;
  const goalLeft = PITCH_CONFIG.CENTER_X - PITCH_CONFIG.GOAL_WIDTH / 2;
  const goalRight = PITCH_CONFIG.CENTER_X + PITCH_CONFIG.GOAL_WIDTH / 2;

  // A. IF GOALKEEPER CURRENTLY HAS POSSESSION:
  // "when the goalkeeper has the ball it either passes it short to a teammate or kicks it far away around the middle of the pitch"
  if (ball.ownerId === player.id) {
    player.gkHoldTimer = (player.gkHoldTimer || 0) + 1;
    // Composed stance facing upfield towards opposing half
    player.facingAngle = isAttackingUp ? -Math.PI / 2 : Math.PI / 2;
    player.vx = 0;
    player.vy = 0;
    player.action = 'idle';

    // Hold ball for ~42 frames (~0.7s) to compose distribution and eliminate glitchy motion
    if (player.gkHoldTimer > 42) {
      player.gkHoldTimer = 0;

      // 50% chance short pass, 50% chance long punt to midfield
      const chooseShort = Math.random() < 0.5;

      const teammates = allPlayers.filter(p => p.team === player.team && p.id !== player.id && p.role !== 'GK');
      let bestMate: Player | null = null;
      let bestScore = -Infinity;

      for (const m of teammates) {
        const isUpfield = isAttackingUp ? m.y < player.y - 65 : m.y > player.y + 65;
        if (!isUpfield) continue;

        const dist = Math.hypot(m.x - player.x, m.y - player.y);
        // Short pass range between 85 and 440 units
        if (dist > 85 && dist < 440) {
          // Check opponent pressure on receiver
          let oppPressure = 0;
          for (const opp of allPlayers) {
            if (opp.team !== player.team) {
              const dOpp = Math.hypot(opp.x - m.x, opp.y - m.y);
              if (dOpp < 45) oppPressure += 1;
            }
          }
          const score = 1000 - dist - oppPressure * 300;
          if (score > bestScore) {
            bestScore = score;
            bestMate = m;
          }
        }
      }

      if (chooseShort && bestMate) {
        // Option A: Clean short pass to teammate
        return {
          action: 'pass',
          targetX: bestMate.x,
          targetY: bestMate.y,
          power: 0.82,
          receiverId: bestMate.id,
        };
      } else {
        // Option B: Far kick around the middle of the pitch
        const midX = PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 160;
        const midY = PITCH_CONFIG.CENTER_Y + (isAttackingUp ? 40 : -40) + (Math.random() - 0.5) * 60;
        return {
          action: 'kick',
          targetX: midX,
          targetY: midY,
          power: 0.95,
        };
      }
    }
    return null;
  }

  // B. GOALKEEPER SAVING & POSITIONING
  // If GK is on release cooldown after kicking or passing, do not intercept or dive
  if (player.gkHoldTimer && player.gkHoldTimer < 0) {
    player.vx = 0;
    player.vy = 0;
    return null;
  }

  // Lateral movement tracking ball X within goalmouth
  const targetX = Math.max(goalLeft + 15, Math.min(goalRight - 15, ball.x));
  let targetY = goalLineY;

  // Penalty Box bounds
  const boxTop = isAttackingUp ? PITCH_CONFIG.PITCH_BOTTOM - PITCH_CONFIG.PENALTY_BOX_HEIGHT : PITCH_CONFIG.PITCH_TOP;
  const boxBottom = isAttackingUp ? PITCH_CONFIG.PITCH_BOTTOM : PITCH_CONFIG.PITCH_TOP + PITCH_CONFIG.PENALTY_BOX_HEIGHT;
  const boxLeft = PITCH_CONFIG.CENTER_X - PITCH_CONFIG.PENALTY_BOX_WIDTH / 2;
  const boxRight = PITCH_CONFIG.CENTER_X + PITCH_CONFIG.PENALTY_BOX_WIDTH / 2;

  const isBallInBox = ball.x >= boxLeft && ball.x <= boxRight && ball.y >= boxTop && ball.y <= boxBottom;
  const distToBall = Math.hypot(player.x - ball.x, player.y - ball.y);

  // If ball is loose inside the penalty box, GK gathers it securely
  if (isBallInBox && !ball.ownerId && (!player.gkHoldTimer || player.gkHoldTimer >= 0)) {
    if (distToBall < 36 && ball.z < 45) {
      // Secure catch / save!
      ball.ownerId = player.id;
      ball.lastTouchTeam = player.team;
      ball.lastTouchPlayerId = player.id;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      ball.z = 10; // Held securely in hands at chest level
      ball.isAirborne = false;
      player.action = 'idle';
      player.actionTimer = 0;
      player.gkHoldTimer = 0;
      audio.playKick(0.75);
      return null;
    } else {
      // Move out to intercept ball
      targetY = ball.y;
    }
  }

  // Shot interception / dive save when shot comes towards goal
  const isShotComing = isAttackingUp ? (ball.vy > 1.5 && ball.y > PITCH_CONFIG.CENTER_Y) : (ball.vy < -1.5 && ball.y < PITCH_CONFIG.CENTER_Y);
  if (isShotComing && distToBall < 55 && !ball.ownerId && (!player.gkHoldTimer || player.gkHoldTimer >= 0)) {
    player.action = 'goalkeeper_dive';
    player.actionTimer = 22;
    player.diveX = (ball.x - player.x) * 0.5;
    player.diveY = (ball.y - player.y) * 0.5;

    // Secure catch if close enough
    if (distToBall < 40 && ball.z < 50) {
      ball.ownerId = player.id;
      ball.lastTouchTeam = player.team;
      ball.lastTouchPlayerId = player.id;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      ball.z = 10;
      ball.isAirborne = false;
      player.gkHoldTimer = 0;
      audio.playKick(0.8);
    }
    return null;
  }

  moveTowards(player, targetX, targetY, player.stats.speed, timeScale);
  return null;
}

/**
 * AI Ball Carrier Decision Making:
 * "teams will seek to retain posession and pass it to a teammate if they're near the goal they'll shoot if they're near the wigns they'll cross"
 */
function updateBallCarrierAI(
  player: Player,
  allPlayers: Player[],
  ball: Ball,
  isAttackingUp: boolean,
  difficulty: DifficultyLevel,
  scoreDiff: number,
  timeScale: number = 1
): AiActionOutput | null {
  const rivalGoalX = PITCH_CONFIG.CENTER_X;
  const rivalGoalY = isAttackingUp ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
  const distToRivalGoal = Math.hypot(rivalGoalX - player.x, rivalGoalY - player.y);

  const isRelaxed = difficulty === 'easy' && scoreDiff >= 2;

  // 1. NEAR THE GOAL -> SHOOT!
  // If within ~430px of rival goal, strike towards goal corners away from goalkeeper
  if (distToRivalGoal < 430) {
    const isGoalReachable = !allPlayers.some(
      opp => opp.team !== player.team && opp.role !== 'GK' && distanceToSegment(opp.x, opp.y, player.x, player.y, rivalGoalX, rivalGoalY) < 22
    );
    const shotProb = distToRivalGoal < 260 ? 0.35 : (isGoalReachable ? 0.22 : 0.12);
    if (Math.random() < shotProb) {
      // Aim at bottom or top corners with lateral spread
      const targetCornerX = player.x < PITCH_CONFIG.CENTER_X
        ? PITCH_CONFIG.CENTER_X + 65 + (Math.random() - 0.5) * 20
        : PITCH_CONFIG.CENTER_X - 65 + (Math.random() - 0.5) * 20;
      return {
        action: 'shoot',
        targetX: targetCornerX,
        targetY: rivalGoalY + (isAttackingUp ? -15 : 15),
        power: isRelaxed ? 0.70 : 0.88,
      };
    }
  }

  // 2. NEAR THE WINGS -> CROSS!
  // If on the flanks in the attacking half or attacking third, whip crosses into the box
  const isWideWing = player.x < PITCH_CONFIG.PITCH_LEFT + 280 || player.x > PITCH_CONFIG.PITCH_RIGHT - 280;
  const isAttackingHalf = isAttackingUp
    ? player.y < PITCH_CONFIG.CENTER_Y + 120
    : player.y > PITCH_CONFIG.CENTER_Y - 120;

  if (isWideWing && isAttackingHalf) {
    const crossProb = isRelaxed ? 0.08 : 0.22;
    if (Math.random() < crossProb) {
      const penaltyBoxCenterY = isAttackingUp ? PITCH_CONFIG.PITCH_TOP + 170 : PITCH_CONFIG.PITCH_BOTTOM - 170;
      // Target an attacking teammate in the box, or penalty area center
      const matesInBox = allPlayers.filter(
        p => p.team === player.team && p.id !== player.id && p.role !== 'GK' &&
             Math.abs(p.x - PITCH_CONFIG.CENTER_X) < 260 &&
             (isAttackingUp ? p.y < PITCH_CONFIG.PITCH_TOP + 320 : p.y > PITCH_CONFIG.PITCH_BOTTOM - 320)
      );
      const targetMate = matesInBox.length > 0
        ? matesInBox[Math.floor(Math.random() * matesInBox.length)]
        : null;

      const targetX = targetMate ? targetMate.x : PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 80;
      const targetY = targetMate ? targetMate.y : penaltyBoxCenterY;

      return {
        action: 'cross',
        targetX,
        targetY,
        power: 0.80,
        receiverId: targetMate ? targetMate.id : undefined,
      };
    }
  }

  // 3. RETAIN POSSESSION -> PASS TO AN OPEN TEAMMATE
  // Check pressure on ball carrier from nearest defender
  let nearestOppDist = Infinity;
  let pressingOpp: Player | null = null;
  for (const opp of allPlayers) {
    if (opp.team !== player.team && opp.role !== 'GK' && opp.action !== 'fouled_falling') {
      const d = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (d < nearestOppDist) {
        nearestOppDist = d;
        pressingOpp = opp;
      }
    }
  }

  const isUnderPressure = nearestOppDist < 125;

  // Scan teammates for possession retention passing
  const teammates = allPlayers.filter(
    p => p.team === player.team && p.id !== player.id && p.role !== 'GK' && p.action !== 'fouled_falling'
  );

  interface ScoredMate {
    mate: Player;
    score: number;
    dist: number;
  }
  const candidateMates: ScoredMate[] = [];

  for (const mate of teammates) {
    const distToMate = Math.hypot(mate.x - player.x, mate.y - player.y);
    if (distToMate < 75 || distToMate > 440) continue;

    // Check passing lane clearance
    const isPassingLaneBlocked = allPlayers.some(
      opp => opp.team !== player.team && distanceToSegment(opp.x, opp.y, player.x, player.y, mate.x, mate.y) < 32
    );
    if (isPassingLaneBlocked) continue;

    // Check teammate's own space (distance to teammate's nearest opponent)
    let mateOppDist = Infinity;
    for (const opp of allPlayers) {
      if (opp.team !== player.team) {
        const d = Math.hypot(opp.x - mate.x, opp.y - mate.y);
        if (d < mateOppDist) mateOppDist = d;
      }
    }

    // Teammate must have at least decent breathing space to safely receive
    if (mateOppDist < 45) continue;

    const isAhead = isAttackingUp ? mate.y < player.y - 30 : mate.y > player.y + 30;
    const isLateral = Math.abs(mate.y - player.y) <= 45;

    let score = mateOppDist * 1.5; // reward open space
    if (isAhead) score += 120; // reward forward progression
    if (isLateral) score += 50; // reward supporting possession reset
    score -= distToMate * 0.25; // slight preference for crisp medium passes

    candidateMates.push({ mate, score, dist: distToMate });
  }

  candidateMates.sort((a, b) => b.score - a.score);

  if (candidateMates.length > 0) {
    const bestCandidate = candidateMates[0];
    // Under pressure: strongly pass to retain possession rather than losing the ball!
    const passTriggerChance = isUnderPressure ? 0.70 : (isRelaxed ? 0.10 : 0.26);
    if (Math.random() < passTriggerChance) {
      return {
        action: 'pass',
        targetX: bestCandidate.mate.x,
        targetY: bestCandidate.mate.y,
        power: Math.min(0.9, Math.max(0.45, bestCandidate.dist / 380)),
        receiverId: bestCandidate.mate.id,
      };
    }
  }

  // 4. DRIBBLE TO RETAIN POSSESSION AND ADVANCE
  const speedScale = isRelaxed ? 0.65 : (scoreDiff <= -2 ? 0.95 : 0.82);
  let targetX = player.x;
  let targetY = isAttackingUp ? player.y - 120 : player.y + 120;

  // If defender is close in front, steer slightly laterally into space to protect the ball
  if (pressingOpp && nearestOppDist < 90) {
    const evadeDir = player.x > pressingOpp.x ? 1 : -1;
    targetX = player.x + evadeDir * 50;
  }

  moveTowards(player, targetX, targetY, player.stats.speed * speedScale, timeScale);
  return null;
}

/**
 * Out of possession positioning & pressing:
 * - Scales speed based on Difficulty and Score difference
 * - AI relaxes if 2+ goals above
 * - AI tries harder if 2+ goals below
 */
function updateOffTheBallAI(
  player: Player,
  allPlayers: Player[],
  ball: Ball,
  isAttackingUp: boolean,
  teamHasBall: boolean,
  difficulty: DifficultyLevel,
  scoreDiff: number,
  timeScale: number = 1
): AiActionOutput | null {
  const distToBall = Math.hypot(ball.x - player.x, ball.y - player.y);

  // Check if carrier is a Goalkeeper: NO TACKLING THE GOALKEEPER!
  const ballCarrier = allPlayers.find(p => p.id === ball.ownerId);
  const isCarrierGK = ballCarrier && ballCarrier.role === 'GK';

  // Find who is the closest player on this team to the ball
  let closestDist = Infinity;
  let closestPlayerId = '';
  for (const p of allPlayers) {
    if (p.team === player.team && p.role !== 'GK') {
      const d = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (d < closestDist) {
        closestDist = d;
        closestPlayerId = p.id;
      }
    }
  }

  const isClosest = closestPlayerId === player.id;

  // SPEED & AGGRESSION SCALING:
  // Default easy: 0.80x speed
  // If AI is 2+ goals above: relax! 0.58x speed, no slide tackles, gives player room!
  // If AI is 2+ goals below: try harder! 0.94x speed
  let speedMultiplier = 0.80;
  let canSlideTackle = true;
  let tackleChance = 0.08;

  if (player.team === 'away' && difficulty === 'easy') {
    if (scoreDiff >= 2) {
      // AI is comfortably ahead by 2+ goals: relax!
      speedMultiplier = 0.58;
      canSlideTackle = false;
      tackleChance = 0.02; // Very gentle
    } else if (scoreDiff <= -2) {
      // AI is losing by 2+ goals: try harder!
      speedMultiplier = 0.94;
      canSlideTackle = true;
      tackleChance = 0.12;
    }
  }

  // 1. If closest defender and opponent has ball -> PRESS & TACKLE
  if (!teamHasBall && isClosest && !isCarrierGK) {
    if (distToBall < 26 && ball.z < 25) {
      if (canSlideTackle && Math.random() < tackleChance * 0.5) {
        return { action: 'slide' };
      } else if (Math.random() < tackleChance) {
        return { action: 'tackle' };
      }
    }

    // Sprint towards ball/carrier to close down (scaled by difficulty)
    moveTowards(player, ball.x, ball.y, player.stats.sprintSpeed * speedMultiplier, timeScale);
    return null;
  }

  // 2. Heading contest if ball is airborne and dropping near player
  if (ball.isAirborne && ball.z < 45 && distToBall < 25) {
    if (Math.random() < 0.18) {
      return { action: 'header' };
    }
  }

  // 3. DYNAMIC FORMATION SHIFT
  const fieldW = PITCH_CONFIG.FIELD_WIDTH;
  const fieldH = PITCH_CONFIG.FIELD_HEIGHT;
  const anchorX = PITCH_CONFIG.PITCH_LEFT + player.baseX * fieldW;
  const anchorY = PITCH_CONFIG.PITCH_TOP + player.baseY * fieldH;

  const ballShiftY = (ball.y - PITCH_CONFIG.CENTER_Y) * 0.38;
  const ballShiftX = (ball.x - PITCH_CONFIG.CENTER_X) * 0.22;

  let targetX = anchorX + ballShiftX;
  let targetY = anchorY + ballShiftY;

  if (teamHasBall && (player.role === 'ST1' || player.role === 'ST2' || player.role === 'LM' || player.role === 'RM')) {
    const runForwardY = isAttackingUp ? -110 : 110;
    targetY += runForwardY;
  }

  targetX = Math.max(PITCH_CONFIG.PITCH_LEFT + 30, Math.min(PITCH_CONFIG.PITCH_RIGHT - 30, targetX));
  targetY = Math.max(PITCH_CONFIG.PITCH_TOP + 40, Math.min(PITCH_CONFIG.PITCH_BOTTOM - 40, targetY));

  const speed = distToBall < 120 ? player.stats.sprintSpeed * speedMultiplier * 0.85 : player.stats.speed * speedMultiplier;
  moveTowards(player, targetX, targetY, speed, timeScale);

  return null;
}

/**
 * Move player smoothly towards target
 */
function moveTowards(player: Player, targetX: number, targetY: number, maxSpeed: number, timeScale: number = 1) {
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 5) {
    const moveDist = Math.min(dist, maxSpeed * timeScale);
    player.vx = (dx / dist) * moveDist;
    player.vy = (dy / dist) * moveDist;
    player.x += player.vx;
    player.y += player.vy;

    player.facingAngle = Math.atan2(dy, dx);
    updateFacingDirection(player, dx, dy);

    if (player.actionTimer <= 0 || !isKickingAction(player.action)) {
      player.action = 'running';
      player.animTimer = (player.animTimer || 0) + 1;
      if (player.animTimer % 4 === 0) {
        player.animFrame = (player.animFrame + 1) % 6;
      }
    }
  } else {
    player.vx = 0;
    player.vy = 0;
    if (player.actionTimer <= 0 && player.action === 'running') {
      player.action = 'idle';
      player.animFrame = 0;
    }
  }
}

/**
 * Updates player 8-way facing direction based on movement vector
 */
export function updateFacingDirection(player: Player, dx: number, dy: number) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX > absY * 1.8) {
    player.facingDir = dx > 0 ? 'right' : 'left';
  } else if (absY > absX * 1.8) {
    player.facingDir = dy > 0 ? 'down' : 'up';
  } else {
    if (dx > 0 && dy > 0) player.facingDir = 'down-right';
    else if (dx > 0 && dy < 0) player.facingDir = 'up-right';
    else if (dx < 0 && dy > 0) player.facingDir = 'down-left';
    else player.facingDir = 'up-left';
  }
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}
