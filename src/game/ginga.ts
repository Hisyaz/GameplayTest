import { Player, Ball, KeyState, TeamSide } from '../types';
import { PITCH_CONFIG, HOME_KIT } from './constants';
import { audio } from './audio';
import { t } from './i18n';
import { normalizeAngle } from './skills';

/**
 * Normalizes input direction from arrow keys or player facing angle
 */
export function getArrowDirection(keys: KeyState, fallbackAngle: number): { x: number; y: number; hasInput: boolean } {
  let dx = 0;
  let dy = 0;
  if (keys.ArrowLeft) dx -= 1;
  if (keys.ArrowRight) dx += 1;
  if (keys.ArrowUp) dy -= 1;
  if (keys.ArrowDown) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len, hasInput: true };
  }

  return {
    x: Math.cos(fallbackAngle),
    y: Math.sin(fallbackAngle),
    hasInput: false,
  };
}

/**
 * Checks if the ball is within aerial hitting range of the player
 */
export function isBallInAirVolleyRange(player: Player, ball: Ball): { inRange: boolean; dist: number; z: number } {
  const dist = Math.hypot(ball.x - player.x, ball.y - player.y);
  return {
    inRange: dist < 32 && ball.z >= 3.5,
    dist,
    z: ball.z,
  };
}

/**
 * Main Ginga Update Loop:
 * Handles:
 * 1. Spacebar hold charging (< 1.8s lifts ball; > 1.8s overcooks uncontrollably)
 * 2. Sombrero flick over defender if arrow is pressed
 * 3. Lift in place and juggling rhythm if no arrow is pressed
 * 4. Repeating spacebar before ball hits ground to sustain Ginga combo
 */
export function updateGingaSystem(
  player: Player,
  ball: Ball,
  keys: KeyState,
  allPlayers: Player[],
  setBanner: (msg: string, timer?: number) => void
): void {
  // If player lost possession or ball grounded while juggling
  if (player.gingaActive && (!ball.isAirborne || ball.z <= 0.5)) {
    player.gingaActive = false;
    player.gingaCombo = 0;
  }

  // Check if player has the ball or is directly over it
  const isOwner = ball.ownerId === player.id;
  const distToBall = Math.hypot(ball.x - player.x, ball.y - player.y);
  const isBallNear = distToBall < 22;

  // ----------------------------------------------------
  // 1. SPACEBAR PRESSED & HELD (Charging Ginga Lift)
  // ----------------------------------------------------
  if (keys.Space) {
    // If player has the ball on ground or is in juggling range
    if ((isOwner && ball.z < 6) || (isBallNear && ball.z < 6 && !ball.ownerId)) {
      player.isGingaLifting = true;
      player.gingaHoldTimer = (player.gingaHoldTimer || 0) + 1;

      // Overlift check: 1.8 seconds at 60fps is 108 frames
      // "if you press it longer than 1.8 seconds you send it too far to control it"
      if (player.gingaHoldTimer >= 108) {
        // OVERCOOKED! Ball blasted uncontrollably into the distance!
        ball.ownerId = null;
        ball.isAirborne = true;
        ball.z = 10;
        ball.vz = 9.2;
        const blastAngle = player.facingAngle + (Math.random() - 0.5) * 0.8;
        ball.vx = Math.cos(blastAngle) * 9.5;
        ball.vy = Math.sin(blastAngle) * 9.5;
        ball.lastTouchPlayerId = player.id;
        ball.lastTouchTeam = player.team;

        player.isGingaLifting = false;
        player.gingaHoldTimer = 0;
        player.gingaActive = false;
        player.gingaCombo = 0;
        player.action = 'idle';

        audio.playOverpoweredKick();
        setBanner(t('gingaOverlift'), 100);
        return;
      }
    } else if (player.gingaActive && ball.isAirborne && ball.z > 2.5 && isBallNear) {
      // Tapping spacebar while juggling in the air!
      if (!player.isGingaLifting) {
        player.isGingaLifting = true;
        // Keep the juggle going!
        ball.vz = 2.8 + Math.random() * 0.8;
        ball.vx = (Math.random() - 0.5) * 0.6;
        ball.vy = (Math.random() - 0.5) * 0.6;
        player.gingaCombo = (player.gingaCombo || 0) + 1;
        player.action = 'ginga_juggle';
        player.actionTimer = 22;
        audio.playGingaLift();
        setBanner(`${t('gingaJuggle')} x${player.gingaCombo}!`, 50);
      }
    }
  }

  // ----------------------------------------------------
  // 2. SPACEBAR RELEASED (Execute Lift or Sombrero)
  // ----------------------------------------------------
  else if (player.isGingaLifting) {
    const holdFrames = player.gingaHoldTimer || 1;
    player.isGingaLifting = false;
    player.gingaHoldTimer = 0;

    // Calculate lift height ratio (from 0 to 1, capped at 90 frames / 1.5s)
    const holdRatio = Math.min(1.0, Math.max(0.15, holdFrames / 85));
    const arrow = getArrowDirection(keys, player.facingAngle);

    // Release ball from magnetic lock
    ball.ownerId = null;
    ball.isAirborne = true;
    ball.lastTouchPlayerId = player.id;
    ball.lastTouchTeam = player.team;

    if (arrow.hasInput) {
      // --------------------------------------------------
      // SOMBRERO FLICK IN ARROW DIRECTION & SURGE PAST
      // "if you press the arrow you throw it in that direction and your player follows it,
      // you can do sombreros on defenders"
      // --------------------------------------------------
      const flickSpeed = 4.2 + holdRatio * 2.8;
      const flickVz = 3.6 + holdRatio * 2.8;

      ball.vx = arrow.x * flickSpeed;
      ball.vy = arrow.y * flickSpeed;
      ball.vz = flickVz;
      ball.z = 4;

      player.facingAngle = Math.atan2(arrow.y, arrow.x);
      player.action = 'sombrero';
      player.actionTimer = 24;
      // Player accelerates dynamically onto the flicked ball
      player.vx = arrow.x * (player.stats.sprintSpeed * 1.32);
      player.vy = arrow.y * (player.stats.sprintSpeed * 1.32);
      player.dashTimer = 24;

      // Look for rival defenders directly in the flick trajectory to sombrero
      let sombreroedDefender: Player | null = null;
      for (const opp of allPlayers) {
        if (opp.team !== player.team && opp.action !== 'fouled_falling') {
          const toOppX = opp.x - player.x;
          const toOppY = opp.y - player.y;
          const dist = Math.hypot(toOppX, toOppY);
          if (dist > 10 && dist < 65) {
            // Check dot product with flick direction
            const dot = (toOppX * arrow.x + toOppY * arrow.y) / dist;
            if (dot > 0.65) {
              sombreroedDefender = opp;
              break;
            }
          }
        }
      }

      if (sombreroedDefender) {
        sombreroedDefender.confusedTimer = 110;
        sombreroedDefender.action = 'idle';
        sombreroedDefender.vx *= 0.1;
        sombreroedDefender.vy *= 0.1;
        audio.playSombreroCheer();
        setBanner(t('sombreroOverDefender'), 100);
      } else {
        audio.playGingaLift();
        setBanner(t('sombreroFlick'), 75);
      }

      player.gingaActive = false;
      player.gingaCombo = 0;
    } else {
      // --------------------------------------------------
      // LIFT IN PLACE & ENTER GINGA JUGGLING
      // "if you're not pressing an arrow you just lift it in place"
      // --------------------------------------------------
      const liftVz = 2.4 + holdRatio * 3.4;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = liftVz;
      ball.z = 3;

      player.gingaActive = true;
      player.gingaCombo = 1;
      player.action = 'ginga_juggle';
      player.actionTimer = 25;

      audio.playGingaLift();
      setBanner(t('gingaLift'), 85);
    }
  }
}

/**
 * Handles Volleys and Acrobatic Strikes (Bicycle, Scissor, Scorpion, Crisp Volleys):
 * Triggered when pressing Shoot (A), Pass (S), Long Pass (W), or Cross (D) near an airborne ball.
 */
export function tryExecuteVolley(
  player: Player,
  ball: Ball,
  actionType: 'shoot' | 'pass' | 'long_pass' | 'cross',
  powerFraction: number,
  keys: KeyState,
  targetPos: { x: number; y: number } | null,
  setBanner: (msg: string, timer?: number) => void
): boolean {
  const dist = Math.hypot(ball.x - player.x, ball.y - player.y);

  // Must be in hitting vicinity
  if (dist > 34) return false;

  // Miss check:
  // "and if you shoot before it falls or pass, you volley it, but you have to hit it before it falls, otherwise is a miss"
  if (ball.z < 2.5) {
    // MISTIMED MISS! Player scuffs into grass
    player.action = 'kicking';
    player.actionTimer = 20;
    ball.vx *= 0.2;
    ball.vy *= 0.2;
    audio.playVolleyMiss();
    setBanner(t('volleyMiss'), 75);
    return true;
  }

  // Calculate target angle
  let angle = player.facingAngle;
  if (targetPos) {
    angle = Math.atan2(targetPos.y - player.y, targetPos.x - player.x);
  } else {
    // Aim at rival top goal for shoot/cross by default
    const rivalGoalY = player.team === 'home' ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
    angle = Math.atan2(rivalGoalY - player.y, PITCH_CONFIG.CENTER_X - player.x);
  }

  // Angle difference between player facing and ball position
  const angleToBall = Math.atan2(ball.y - player.y, ball.x - player.x);
  const angleDiff = Math.abs(normalizeAngle(angleToBall - player.facingAngle));
  const isBehind = angleDiff > 1.85;

  const power = Math.max(0.35, Math.min(1.0, powerFraction));

  // Determine flair or crisp volley modifier:
  // "if you press E your player will try a volley"
  // "if you press Q your player will try a flair shoot"
  // "if it's too high a bycycle kick, if lower a scissor kick, if it get's behind you a scorpio kick"
  let strikeType: 'scorpion' | 'bicycle' | 'scissor' | 'crisp_volley' | 'standard_volley';

  if (keys.KeyQ) {
    // Flair strikes
    if (isBehind) {
      strikeType = 'scorpion';
    } else if (ball.z > 17) {
      strikeType = 'bicycle';
    } else {
      strikeType = 'scissor';
    }
  } else if (keys.KeyE) {
    strikeType = 'crisp_volley';
  } else {
    strikeType = 'standard_volley';
  }

  // Release possession and assign touch
  ball.ownerId = null;
  ball.isAirborne = true;
  ball.lastTouchPlayerId = player.id;
  ball.lastTouchTeam = player.team;
  player.gingaActive = false;
  player.gingaCombo = 0;

  if (strikeType === 'scorpion') {
    // SCORPION KICK:
    // Flick heels over arched back in forward facing direction!
    player.action = 'scorpion_kick';
    player.actionTimer = 26;
    player.animFrame = 0;

    const speed = 7.5 + power * 5.0;
    ball.vx = Math.cos(player.facingAngle) * speed;
    ball.vy = Math.sin(player.facingAngle) * speed;
    ball.vz = 2.2;
    ball.spin = (Math.random() - 0.5) * 4;

    audio.playAcrobaticStrike();
    setBanner(t('scorpionKick'), 110);
  } else if (strikeType === 'bicycle') {
    // OVERHEAD BICYCLE KICK:
    // Mid-air inverted backflip with explosive strike!
    player.action = 'bicycle_kick';
    player.actionTimer = 28;
    player.animFrame = 0;

    const speed = 8.5 + power * 5.2;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = 2.8;
    ball.spin = (Math.random() - 0.5) * 3;

    audio.playAcrobaticStrike();
    setBanner(t('bicycleKick'), 110);
  } else if (strikeType === 'scissor') {
    // FLYING SCISSOR KICK:
    // Horizontal airborne scissor volley!
    player.action = 'scissor_kick';
    player.actionTimer = 24;
    player.animFrame = 0;

    const speed = 8.0 + power * 4.8;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = 2.0;

    audio.playAcrobaticStrike();
    setBanner(t('scissorKick'), 100);
  } else if (strikeType === 'crisp_volley') {
    // CRISP SIDE-VOLLEY [E]:
    player.action = 'volley';
    player.actionTimer = 22;
    player.animFrame = 0;

    const speed = 7.8 + power * 4.5;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = 1.6;

    audio.playVolleyStrike(power);
    setBanner(t('crispVolley'), 90);
  } else {
    // STANDARD VOLLEY:
    player.action = 'volley';
    player.actionTimer = 20;
    player.animFrame = 0;

    const speed = 6.8 + power * 4.2;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = 2.0;

    audio.playVolleyStrike(power * 0.85);
    setBanner(actionType === 'shoot' ? t('crispVolley') : t('flairVolleyPass'), 75);
  }

  return true;
}

/**
 * Rustic Volley Clearance for Defenders:
 * "defenders can also do volleys for clearance those are more rustic"
 */
export function executeRusticVolleyClearance(
  defender: Player,
  ball: Ball,
  setBanner: (msg: string, timer?: number) => void
): void {
  defender.action = 'volley';
  defender.actionTimer = 22;
  defender.animFrame = 0;

  ball.ownerId = null;
  ball.isAirborne = true;
  ball.lastTouchPlayerId = defender.id;
  ball.lastTouchTeam = defender.team;

  // Big, booming rustic upfield launch with high trajectory
  const clearDirY = defender.team === 'home' ? -1 : 1;
  const clearDirX = (Math.random() - 0.5) * 0.8;
  const speedY = clearDirY * (8.5 + Math.random() * 3.5);
  const speedX = clearDirX * 5.0;

  ball.vx = speedX;
  ball.vy = speedY;
  ball.vz = 6.8; // High, rustic arc

  audio.playRusticClearance();
  setBanner(t('rusticVolleyClearance'), 90);
}

/**
 * Automatic header on incoming aerial cross if no button was pressed:
 * "if you don't press anything your player will try to head it"
 */
export function checkAutomaticHeader(
  player: Player,
  ball: Ball,
  targetGoalY: number,
  setBanner: (msg: string, timer?: number) => void
): boolean {
  if (player.action !== 'idle' && player.action !== 'running') return false;
  if (!ball.isAirborne || ball.z < 13 || ball.z > 36) return false;

  const dist = Math.hypot(ball.x - player.x, ball.y - player.y);
  if (dist > 18) return false;

  // Leap up for the header!
  player.action = 'heading';
  player.actionTimer = 24;
  player.animFrame = 0;

  ball.ownerId = null;
  ball.isAirborne = true;
  ball.lastTouchPlayerId = player.id;
  ball.lastTouchTeam = player.team;

  // Head towards rival goal
  const angle = Math.atan2(targetGoalY - player.y, PITCH_CONFIG.CENTER_X - player.x);
  const speed = 5.8;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.vz = -1.2; // Snapped downwards into turf

  audio.playKick(0.7);
  setBanner(t('headerAttempt'), 70);
  return true;
}
