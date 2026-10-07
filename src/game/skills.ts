import { Player, Ball, Referee, KeyState } from '../types';
import { PITCH_CONFIG } from './constants';
import { audio } from './audio';
import { t } from './i18n';

/**
 * Normalizes an angle into the range [-PI, PI]
 */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Checks if an incident at (x, y) is within the referee's sight cone.
 * "add also a referee that has a sight angle make it subtle they can only call what they see."
 */
export function isIncidentSeenByReferee(referee: Referee, incidentX: number, incidentY: number): boolean {
  const dx = incidentX - referee.x;
  const dy = incidentY - referee.y;
  const dist = Math.hypot(dx, dy);
  const range = referee.sightRange || 360;
  if (dist > range) return false;

  const fov = referee.sightFov || (110 * Math.PI / 180);
  const angleToIncident = Math.atan2(dy, dx);
  const angleDiff = Math.abs(normalizeAngle(angleToIncident - (referee.facingAngle || 0)));

  return angleDiff <= fov / 2;
}

/**
 * Tracks rapid key taps and hold durations for Q and E mechanics
 */
export class InputSkillTracker {
  private lastReleaseTimeE: number = 0;
  private lastPressTimeE: number = 0;
  private isKeyDownE: boolean = false;
  public isHoldingE: boolean = false;
  public holdFramesE: number = 0;

  private lastReleaseTimeQ: number = 0;
  private lastPressTimeQ: number = 0;
  private isKeyDownQ: boolean = false;

  /**
   * Updates key timings and returns detected actions:
   * doubleTapE, doubleTapQ, releasedEAfterHold, isChargingE
   */
  public update(keys: KeyState): {
    doubleTapE: boolean;
    doubleTapQ: boolean;
    releasedEAfterHold: boolean;
    heldDurationE: number;
  } {
    const now = performance.now();
    let doubleTapE = false;
    let doubleTapQ = false;
    let releasedEAfterHold = false;
    let heldDurationE = 0;

    // --- Key E tracking ---
    if (keys.KeyE && !this.isKeyDownE) {
      // Transitioned to DOWN
      this.isKeyDownE = true;
      this.isHoldingE = true;
      this.holdFramesE = 0;
      if (now - this.lastReleaseTimeE < 290 && now - this.lastPressTimeE < 450) {
        doubleTapE = true;
      }
      this.lastPressTimeE = now;
    } else if (keys.KeyE && this.isKeyDownE) {
      // Held down
      this.holdFramesE++;
    } else if (!keys.KeyE && this.isKeyDownE) {
      // Transitioned to UP
      this.isKeyDownE = false;
      this.isHoldingE = false;
      this.lastReleaseTimeE = now;
      if (this.holdFramesE > 6) {
        releasedEAfterHold = true;
        heldDurationE = this.holdFramesE;
      }
      this.holdFramesE = 0;
    }

    // --- Key Q tracking ---
    if (keys.KeyQ && !this.isKeyDownQ) {
      this.isKeyDownQ = true;
      if (now - this.lastReleaseTimeQ < 290 && now - this.lastPressTimeQ < 450) {
        doubleTapQ = true;
      }
      this.lastPressTimeQ = now;
    } else if (!keys.KeyQ && this.isKeyDownQ) {
      this.isKeyDownQ = false;
      this.lastReleaseTimeQ = now;
    }

    return {
      doubleTapE,
      doubleTapQ,
      releasedEAfterHold,
      heldDurationE,
    };
  }
}

/**
 * Long Autopass / Throw Ahead:
 * "while running pressing E makes you throw the ball longer, the throw is like a long autopass,
 * how long you press E before releasing affects how long ahead you throw the ball,
 * it goes the direction you're pointing with the arrows"
 */
export function executeAutopassLaunch(
  player: Player,
  ball: Ball,
  keys: KeyState,
  chargeFraction: number,
  setBanner: (msg: string, timer?: number) => void
): void {
  // Direction from arrow keys or current facing angle
  let dirX = 0;
  let dirY = 0;
  if (keys.ArrowLeft) dirX -= 1;
  if (keys.ArrowRight) dirX += 1;
  if (keys.ArrowUp) dirY -= 1;
  if (keys.ArrowDown) dirY += 1;

  let angle = player.facingAngle;
  if (dirX !== 0 || dirY !== 0) {
    angle = Math.atan2(dirY, dirX);
    player.facingAngle = angle;
  }

  // Speed ranges from 5.4 (tap/low charge) to 11.2 (full charge long throw ahead)
  const speed = 5.4 + Math.max(0, Math.min(1.0, chargeFraction)) * 5.8;

  ball.ownerId = null;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.z = 0.5;
  ball.vz = 0.4;
  ball.isAirborne = true;
  ball.lastTouchPlayerId = player.id;
  ball.lastTouchTeam = player.team;

  // Player surges into sprint onto it!
  player.dashTimer = 24;
  player.action = 'nutmeg_dash';
  player.vx = Math.cos(angle) * player.stats.sprintSpeed * 1.2;
  player.vy = Math.sin(angle) * player.stats.sprintSpeed * 1.2;

  player.isLongThrowCharging = false;
  player.longThrowCharge = 0;

  audio.playAutopassLaunch();
  setBanner(t('autopassAhead'), 80);
}

/**
 * Double Tap E while standing + defender in front:
 * "if you're standing and double tap E, you do a rainbow flick if a defender is on front."
 */
export function executeRainbowFlick(
  player: Player,
  ball: Ball,
  defender: Player | null,
  setBanner: (msg: string, timer?: number) => void
): void {
  player.action = 'rainbow_flick';
  player.actionTimer = 28;
  player.animFrame = 0;

  const angle = player.facingAngle;

  // Ball arcs high over the defender's head into space behind them
  ball.ownerId = null;
  ball.vx = Math.cos(angle) * 4.6;
  ball.vy = Math.sin(angle) * 4.6;
  ball.z = 6;
  ball.vz = 5.8; // High looping arc
  ball.isAirborne = true;
  ball.lastTouchPlayerId = player.id;
  ball.lastTouchTeam = player.team;

  if (defender) {
    defender.confusedTimer = 110;
    defender.action = 'idle';
  }

  audio.playRainbowFlick();
  audio.playNutmegCheer();
  setBanner(t('rainbowCheer'), 95);
}

/**
 * Double Tap E while running / no defender in front:
 * "if you tap E twice you do step overs they slow down your run but if you change direction with it is more efective,
 * also defenders can't take the ball from a stepover with a tackle without it being a foul"
 */
export function executeStepOvers(
  player: Player,
  setBanner: (msg: string, timer?: number) => void
): void {
  player.action = 'step_overs';
  player.stepOverTimer = 65;
  player.isStepOverActive = true;
  player.stepOverOriginalAngle = player.facingAngle;
  player.stepOverDirChanged = false;
  player.animFrame = 0;

  audio.playStepOver();
  setBanner(t('stepoversActive'), 75);
}

/**
 * Double Tap Q with ball:
 * "if you have the ball and tap Q twice, you do a short skill,
 * if a defender is right behind you, you turn around and nutmeg them,
 * if they're on a side you do a cruyff turn"
 */
export function executeDoubleTapQSkill(
  player: Player,
  ball: Ball,
  allPlayers: Player[],
  setBanner: (msg: string, timer?: number) => void
): void {
  // Find closest opponent
  let closestOpp: Player | null = null;
  let closestDist = Infinity;

  for (const opp of allPlayers) {
    if (opp.team !== player.team && opp.action !== 'fouled_falling') {
      const d = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (d < closestDist) {
        closestDist = d;
        closestOpp = opp;
      }
    }
  }

  if (closestOpp && closestDist < 68) {
    // Relative angle between player facing direction and vector to opponent
    const oppAngle = Math.atan2(closestOpp.y - player.y, closestOpp.x - player.x);
    const relAngle = Math.abs(normalizeAngle(oppAngle - player.facingAngle));

    // Defender is right behind (angle difference > ~125 degrees)
    if (relAngle > 2.2) {
      // TURN AROUND AND NUTMEG THEM!
      player.facingAngle = oppAngle; // Turn 180 to face defender
      player.action = 'nutmeg_dash';
      player.dashTimer = 24;

      // Ball slides right between defender legs
      ball.ownerId = null;
      ball.x = closestOpp.x + Math.cos(oppAngle) * 22;
      ball.y = closestOpp.y + Math.sin(oppAngle) * 22;
      ball.vx = Math.cos(oppAngle) * 5.2;
      ball.vy = Math.sin(oppAngle) * 5.2;
      ball.z = 0;
      ball.isAirborne = false;
      ball.lastTouchPlayerId = player.id;
      ball.lastTouchTeam = player.team;

      closestOpp.confusedTimer = 120;
      closestOpp.action = 'idle';

      audio.playNutmegCheer();
      setBanner(t('nutmegCheer'), 95);
      return;
    }

    // Defender is on a side (between ~45 and ~125 degrees)
    if (relAngle >= 0.75 && relAngle <= 2.2) {
      // CRUYFF TURN!
      // Chop 90 degrees away from the defender
      const angleDiff = normalizeAngle(oppAngle - player.facingAngle);
      const cutAngle = angleDiff > 0 ? player.facingAngle - Math.PI / 2 : player.facingAngle + Math.PI / 2;

      player.action = 'cruyff_turn';
      player.actionTimer = 22;
      player.facingAngle = cutAngle;
      player.animFrame = 0;

      ball.x = player.x + Math.cos(cutAngle) * 16;
      ball.y = player.y + Math.sin(cutAngle) * 16;
      ball.vx = Math.cos(cutAngle) * 4.6;
      ball.vy = Math.sin(cutAngle) * 4.6;
      ball.z = 0;
      ball.isAirborne = false;

      closestOpp.confusedTimer = 65;
      closestOpp.vx *= 0.2;
      closestOpp.vy *= 0.2;

      audio.playCruyffTurn();
      setBanner(t('cruyffTurnCheer'), 85);
      return;
    }
  }

  // General body feint / agile touch if no defender right on back/side
  player.action = 'nutmeg_dash';
  player.dashTimer = 16;
  audio.playStepOver();
  setBanner(t('skillMoveExecuted'), 60);
}

/**
 * Defensive Q: Shoulder Hit / Barge
 * "while defending wihtout the ball, pressing Q is a shoulder hit if you hit right from the side
 * you can move the player away from the ball even if he's shielding"
 */
export function executeShoulderHit(
  player: Player,
  ball: Ball,
  allPlayers: Player[],
  referee: Referee,
  awardFoulCallback: (victim: Player, foulX: number, foulY: number, offender: Player) => void,
  setBanner: (msg: string, timer?: number) => void
): void {
  // Find opponent ball carrier or closest opponent
  const carrier = allPlayers.find(p => p.team !== player.team && ball.ownerId === p.id);
  if (!carrier) return;

  const dist = Math.hypot(carrier.x - player.x, carrier.y - player.y);
  if (dist > 40) return;

  // Angle from carrier to defender
  const approachAngle = Math.atan2(player.y - carrier.y, player.x - carrier.x);
  const relAngle = Math.abs(normalizeAngle(approachAngle - carrier.facingAngle));

  // Hit right from the side (roughly 45 to 135 degrees relative to carrier's facing direction)
  const isFromSide = relAngle >= 0.75 && relAngle <= 2.35;

  if (isFromSide) {
    // Legal clean shoulder barge! Moves player away even if shielding!
    carrier.isShielding = false;
    const pushAngle = approachAngle + Math.PI; // push carrier away from player
    carrier.x += Math.cos(pushAngle) * 18;
    carrier.y += Math.sin(pushAngle) * 18;
    carrier.action = 'idle';
    carrier.actionTimer = 16;
    carrier.vx = Math.cos(pushAngle) * 2.5;
    carrier.vy = Math.sin(pushAngle) * 2.5;

    // Dislodge ball possession! Defender claims or ball loose
    ball.ownerId = player.id;
    ball.lastTouchTeam = player.team;
    ball.lastTouchPlayerId = player.id;
    ball.vx = 0;
    ball.vy = 0;

    audio.playShoulderHit();
    setBanner(t('shoulderBargeSuccess'), 85);
  } else {
    // Hit from behind / reckless push -> Check referee sight!
    const seen = isIncidentSeenByReferee(referee, carrier.x, carrier.y);
    carrier.action = 'fouled_falling';
    carrier.actionTimer = 50;
    ball.ownerId = null;

    if (seen) {
      awardFoulCallback(carrier, carrier.x, carrier.y, player);
      setBanner(t('foulPush'), 120);
    } else {
      audio.playFoul();
      setBanner(t('refMissedIt'), 80);
    }
  }
}

/**
 * Defensive E: Shirt Pull
 * "if you tap E, you can pull their shirt and slow them down, if the referee sees you is a foul."
 */
export function executeShirtPull(
  player: Player,
  allPlayers: Player[],
  referee: Referee,
  awardFoulCallback: (victim: Player, foulX: number, foulY: number, offender: Player) => void,
  setBanner: (msg: string, timer?: number) => void
): void {
  // Find nearest opponent
  let nearestOpp: Player | null = null;
  let minDist = 42;
  for (const opp of allPlayers) {
    if (opp.team !== player.team && opp.action !== 'fouled_falling') {
      const d = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (d < minDist) {
        minDist = d;
        nearestOpp = opp;
      }
    }
  }

  if (!nearestOpp) return;

  player.action = 'shirt_pull';
  player.shirtPullingTimer = 30;
  player.shirtPullTargetId = nearestOpp.id;

  nearestOpp.shirtPulledTimer = 75; // Slows them down by 60%
  audio.playShirtPull();

  // Referee sight check!
  const seen = isIncidentSeenByReferee(referee, nearestOpp.x, nearestOpp.y);
  if (seen) {
    // Foul called!
    awardFoulCallback(nearestOpp, nearestOpp.x, nearestOpp.y, player);
    setBanner(t('shirtPullFoul'), 140);
  } else {
    // Referee didn't see! Play continues with opponent slowed down!
    setBanner(t('shirtPullUnnoticed'), 80);
  }
}

/**
 * Detects rotating the arrow keys (circular input sequence like Left->Down->Right or Up->Right->Down)
 * while holding or pressing E to trigger a Marseille / Zidane Roulette 360° spin!
 */
export class ArrowRotationTracker {
  private accumulatedRotation: number = 0;
  private lastAngle: number | null = null;
  private lastActiveTime: number = 0;

  /**
   * Evaluates current arrow directions and returns true if arrow rotation is completed while E is active.
   */
  public update(keys: KeyState, isEActive: boolean): boolean {
    const now = performance.now();

    if (!isEActive) {
      this.accumulatedRotation = 0;
      this.lastAngle = null;
      return false;
    }

    let dx = 0;
    let dy = 0;
    if (keys.ArrowLeft) dx -= 1;
    if (keys.ArrowRight) dx += 1;
    if (keys.ArrowUp) dy -= 1;
    if (keys.ArrowDown) dy += 1;

    if (dx === 0 && dy === 0) {
      if (now - this.lastActiveTime > 320) {
        this.accumulatedRotation = 0;
        this.lastAngle = null;
      }
      return false;
    }

    this.lastActiveTime = now;
    const currentAngle = Math.atan2(dy, dx);

    if (this.lastAngle === null) {
      this.lastAngle = currentAngle;
      this.accumulatedRotation = 0;
      return false;
    }

    const delta = normalizeAngle(currentAngle - this.lastAngle);

    // If direction changed noticeably (between 25° and 140°)
    if (Math.abs(delta) > 0.4 && Math.abs(delta) < 2.5) {
      if (
        this.accumulatedRotation === 0 ||
        (this.accumulatedRotation > 0 && delta > 0) ||
        (this.accumulatedRotation < 0 && delta < 0)
      ) {
        this.accumulatedRotation += delta;
      } else {
        // Reversed rotation direction
        this.accumulatedRotation = delta;
      }
      this.lastAngle = currentAngle;

      // When accumulated circular rotation reaches >= ~140° (2.35 radians)
      if (Math.abs(this.accumulatedRotation) >= 2.35) {
        this.accumulatedRotation = 0;
        this.lastAngle = null;
        return true;
      }
    }

    return false;
  }

  public reset(): void {
    this.accumulatedRotation = 0;
    this.lastAngle = null;
  }
}

/**
 * Executes a Marseille Roulette 360° spin skill move:
 * "if you rotate the arrow keys while pressing E you do a roullette"
 */
export function executeRoulette(
  player: Player,
  ball: Ball,
  keys: KeyState,
  allPlayers: Player[],
  setBanner: (msg: string, timer?: number) => void
): void {
  // Cancel autopass charge if running
  player.isLongThrowCharging = false;
  player.longThrowCharge = 0;

  // Determine exit direction from arrow keys or player facing
  let dx = 0;
  let dy = 0;
  if (keys.ArrowLeft) dx -= 1;
  if (keys.ArrowRight) dx += 1;
  if (keys.ArrowUp) dy -= 1;
  if (keys.ArrowDown) dy += 1;

  const exitAngle = dx !== 0 || dy !== 0 ? Math.atan2(dy, dx) : player.facingAngle;

  player.action = 'roulette';
  player.actionTimer = 22;
  player.animFrame = 0;

  // Ball stays under control throughout spin
  ball.ownerId = player.id;
  ball.lastTouchPlayerId = player.id;
  ball.lastTouchTeam = player.team;
  ball.isAirborne = false;
  ball.z = 0;
  ball.vz = 0;

  // Player surges through the turn
  const spinSpeed = player.stats.speed * 1.25;
  player.vx = Math.cos(exitAngle) * spinSpeed;
  player.vy = Math.sin(exitAngle) * spinSpeed;
  player.facingAngle = exitAngle;

  // Stun and bypass pressing defenders within 48px
  for (const opp of allPlayers) {
    if (opp.team !== player.team) {
      const dist = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (dist < 48) {
        opp.confusedTimer = 45;
        opp.vx *= 0.2;
        opp.vy *= 0.2;
      }
    }
  }

  audio.playKick(0.3);
  setBanner('ROULETTE 360°!', 75);
}
