import {
  Player,
  Ball,
  Referee,
  TurfParticle,
  KeyState,
  MatchPhase,
  MatchScore,
  TeamSide,
  PlayerRole,
  PowerBarState,
  PowerActionType,
  SetPieceState,
  DifficultyLevel,
  GoalNetState,
} from '../types';
import {
  PITCH_CONFIG,
  PHYSICS,
  HOME_KIT,
  AWAY_KIT,
  HOME_FORMATION_BASE,
  AWAY_FORMATION_BASE,
} from './constants';
import { updateBallPhysics, GoalEvent } from './physics';
import { updatePlayerAI, updateFacingDirection } from './ai';
import { audio } from './audio';
import { t } from './i18n';
import {
  InputSkillTracker,
  ArrowRotationTracker,
  executeAutopassLaunch,
  executeRainbowFlick,
  executeStepOvers,
  executeDoubleTapQSkill,
  executeRoulette,
  executeShoulderHit,
  executeShirtPull,
  isIncidentSeenByReferee,
  normalizeAngle,
} from './skills';
import {
  isInsideDefendingPenaltyBox,
  setupPenalty,
  setupFreeKick,
  setupCornerKick,
  setupGoalKick,
  setupThrowIn,
  updateSetPiece,
} from './setPieces';
import {
  updateGingaSystem,
  tryExecuteVolley,
  executeRusticVolleyClearance,
  checkAutomaticHeader,
} from './ginga';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  pitchTilt: number; // 0 (top/low angle) to 1 (bottom/high angle)
}

export function isKickingAction(action: string): boolean {
  return (
    action === 'running_pass' ||
    action === 'running_pass_low' ||
    action === 'running_pass_mid' ||
    action === 'running_pass_high' ||
    action === 'running_long_pass' ||
    action === 'running_long_pass_low' ||
    action === 'running_long_pass_mid' ||
    action === 'running_long_pass_high' ||
    action === 'running_shot' ||
    action === 'running_shot_low' ||
    action === 'running_shot_mid' ||
    action === 'running_shot_high' ||
    action === 'running_cross' ||
    action === 'running_cross_low' ||
    action === 'running_cross_mid' ||
    action === 'running_cross_high' ||
    action === 'standing_pass' ||
    action === 'standing_pass_low' ||
    action === 'standing_pass_mid' ||
    action === 'standing_pass_high' ||
    action === 'standing_long_pass' ||
    action === 'standing_long_pass_low' ||
    action === 'standing_long_pass_mid' ||
    action === 'standing_long_pass_high' ||
    action === 'standing_shot' ||
    action === 'standing_shot_low' ||
    action === 'standing_shot_mid' ||
    action === 'standing_shot_high' ||
    action === 'standing_cross' ||
    action === 'standing_cross_low' ||
    action === 'standing_cross_mid' ||
    action === 'standing_cross_high' ||
    action === 'special_curl_shot' ||
    action === 'knuckle_shot' ||
    action === 'special_curl_pass' ||
    action === 'knuckle_pass' ||
    action === 'passing' ||
    action === 'shooting' ||
    action === 'crossing' ||
    action === 'kicking'
  );
}

export class MatchEngine {
  public players: Player[] = [];
  public ball: Ball = {
    x: PITCH_CONFIG.CENTER_X,
    y: PITCH_CONFIG.CENTER_Y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    ownerId: null,
    lastTouchTeam: null,
    lastTouchPlayerId: null,
    isAirborne: false,
  };
  public referee: Referee = {
    x: PITCH_CONFIG.CENTER_X + 60,
    y: PITCH_CONFIG.CENTER_Y + 40,
    vx: 0,
    vy: 0,
    facingAngle: 0,
    sightRange: 360,
    sightFov: (110 * Math.PI) / 180,
    whistleTimer: 0,
    cardDisplay: null,
    cardPlayerName: null,
  };

  public camera: CameraState = {
    x: PITCH_CONFIG.CENTER_X,
    y: PITCH_CONFIG.CENTER_Y,
    zoom: 1.05,
    pitchTilt: 0.5,
  };

  /**
   * Camera and Radar focus mode:
   * 'ball' = follows ball (default)
   * 'player' = follows user-controlled player
   */
  public cameraFocus: 'ball' | 'player' = 'ball';

  public toggleCameraFocus(): 'ball' | 'player' {
    this.cameraFocus = this.cameraFocus === 'ball' ? 'player' : 'ball';
    return this.cameraFocus;
  }

  public score: MatchScore = { home: 0, away: 0 };
  public difficulty: DifficultyLevel = 'easy';
  public matchPhase: MatchPhase = 'kickoff_ready';
  public phaseTimer: number = 0;
  public matchTimeSeconds: number = 0; // 90 min match scaled
  public isPaused: boolean = false;
  public userControlledPlayerId: string = '';

  /**
   * Game speed slider setting (ranges from 1% to 200%, default 100%).
   * "slow down the game by 30% add a game speed slider that ranges from 1% to 200%, the current speed lowered by 30% will be the base speed at 100%"
   */
  public gameSpeed: number = 100;

  /**
   * Returns current effective simulation time multiplier.
   * At 100% slider, speed is lowered by 30% (multiplier = 0.70).
   */
  public getTimeScale(): number {
    const clamped = Math.max(1, Math.min(200, this.gameSpeed));
    return (clamped / 100) * 0.70;
  }

  public setPiece: SetPieceState | null = null;
  public skillTracker: InputSkillTracker = new InputSkillTracker();
  public arrowRotationTracker: ArrowRotationTracker = new ArrowRotationTracker();

  public particles: TurfParticle[] = [];
  public bannerMessage: string | null = 'PRESS PASS (S) OR SHOOT (A) TO KICK OFF';
  public bannerTimer: number = 240;

  // Power bar system for Pass / Cross / Shoot / Long Pass + Q-modifier extra curve + E-modifier knuckleball
  public powerBar: PowerBarState = {
    isActive: false,
    action: null,
    power: 0,
    isSpecial: false,
    isKnuckle: false,
    fillSpeed: 1 / 35, // 3x faster default fill speed (~0.58s full charge)
    tier: 1,
    tierColor: '#86efac',
    tierLabel: 'LOW POWER',
  };

  /**
   * Analog deflection ratio from virtual stick (1.0 = normal keyboard/full stick).
   * Used for smooth walking speed when stick is pulled slightly.
   */
  public analogSpeedRatio: number = 1.0;

  public goalNetShake: number = 0;
  private outOfBoundsDelay: number = 0;

  public topGoalNet: GoalNetState = {
    impactX: PITCH_CONFIG.CENTER_X,
    impactY: PITCH_CONFIG.PITCH_TOP - 20,
    impactZ: 10,
    bulgeAmount: 0,
    bulgeVel: 0,
    shake: 0,
    ballCaught: false,
  };

  public bottomGoalNet: GoalNetState = {
    impactX: PITCH_CONFIG.CENTER_X,
    impactY: PITCH_CONFIG.PITCH_BOTTOM + 20,
    impactZ: 10,
    bulgeAmount: 0,
    bulgeVel: 0,
    shake: 0,
    ballCaught: false,
  };

  /**
   * Starts charging a power bar action:
   * Power bar fills 3x faster than originally (1/35), and a further 25% faster for short passes (1/28)
   */
  public startChargingPower(action: PowerActionType, isSpecial: boolean = false, isKnuckle: boolean = false) {
    this.powerBar.isActive = true;
    this.powerBar.action = action;
    this.powerBar.power = 0.05;
    this.powerBar.isSpecial = isSpecial;
    this.powerBar.isKnuckle = isKnuckle;

    const baseSpeed = 1 / 35; // 3 times faster than previous 1/105
    this.powerBar.fillSpeed = action === 'pass' ? baseSpeed * 1.25 : baseSpeed; // 25% faster for short passes
    this.updatePowerBarTiers();
  }

  /**
   * Dynamically updates the power bar color & tier based on level, Q-modifier, and E-modifier
   */
  public updatePowerBarTiers() {
    const p = this.powerBar.power;
    const isQ = this.powerBar.isSpecial;
    const isE = this.powerBar.isKnuckle;

    // Progression:
    // Normal: Light Green -> Green -> Yellow -> Orange (Maximum output) -> Red (Overpowered)
    // Q-Special: White -> Light Purple -> Purple -> Dark Purple (Maximum output) -> Purplish Black (Overpotency violent bend)
    // E-Knuckle: Pink -> Dark Pink -> Red (Maximum output) -> Burgundy (Overpower: stays up into the stands)
    if (isE) {
      if (p < 0.25) {
        this.powerBar.tier = 1;
        this.powerBar.tierColor = '#f472b6'; // Pink
        this.powerBar.tierLabel = 'KNUCKLE / DRIVEN';
      } else if (p < 0.55) {
        this.powerBar.tier = 2;
        this.powerBar.tierColor = '#ec4899'; // Medium Pink
        this.powerBar.tierLabel = 'KNUCKLE STRIKE';
      } else if (p < 0.75) {
        this.powerBar.tier = 3;
        this.powerBar.tierColor = '#be185d'; // Dark Pink
        this.powerBar.tierLabel = 'DARK PINK POWER';
      } else if (p < 0.90) {
        this.powerBar.tier = 4;
        this.powerBar.tierColor = '#ef4444'; // Red (Max Output)
        this.powerBar.tierLabel = 'RED (MAX OUTPUT)';
      } else {
        this.powerBar.tier = 5;
        this.powerBar.tierColor = '#701a31'; // Burgundy (Overpower)
        this.powerBar.tierLabel = 'BURGUNDY (OVERPOWER)!';
      }
    } else if (isQ) {
      if (p < 0.25) {
        this.powerBar.tier = 1;
        this.powerBar.tierColor = '#ffffff';
        this.powerBar.tierLabel = 'Q-TOUCH';
      } else if (p < 0.55) {
        this.powerBar.tier = 2;
        this.powerBar.tierColor = '#d8b4fe';
        this.powerBar.tierLabel = 'Q-CURVE';
      } else if (p < 0.75) {
        this.powerBar.tier = 3;
        this.powerBar.tierColor = '#a855f7';
        this.powerBar.tierLabel = 'Q-SWERVE';
      } else if (p < 0.90) {
        this.powerBar.tier = 4;
        this.powerBar.tierColor = '#7e22ce';
        this.powerBar.tierLabel = 'MAX SPECIAL OUTPUT';
      } else {
        this.powerBar.tier = 5;
        this.powerBar.tierColor = '#2e1065';
        this.powerBar.tierLabel = 'VIOLENT OVERPOTENCY!';
      }
    } else {
      if (p < 0.25) {
        this.powerBar.tier = 1;
        this.powerBar.tierColor = '#86efac';
        this.powerBar.tierLabel = 'LOW POWER';
      } else if (p < 0.55) {
        this.powerBar.tier = 2;
        this.powerBar.tierColor = '#22c55e';
        this.powerBar.tierLabel = 'MEDIUM POWER';
      } else if (p < 0.75) {
        this.powerBar.tier = 3;
        this.powerBar.tierColor = '#facc15';
        this.powerBar.tierLabel = 'STRONG POWER';
      } else if (p < 0.90) {
        this.powerBar.tier = 4;
        this.powerBar.tierColor = '#f97316';
        this.powerBar.tierLabel = 'MAXIMUM OUTPUT';
      } else {
        this.powerBar.tier = 5;
        this.powerBar.tierColor = '#ef4444';
        this.powerBar.tierLabel = 'OVERPOWERED!';
      }
    }
  }

  /**
   * Evaluates shooting/passing accuracy based on:
   * 1. Standing vs Running: Standing has highest accuracy (1.0). Running/sprinting has natural momentum variance.
   * 2. Defender Physical Contact: If an opposing defender is touching the player (< 28 units), accuracy is lowered by 50%!
   */
  private evaluateKickAccuracy(player: Player, keys?: KeyState) {
    const isMoving = Math.hypot(player.vx, player.vy) > 0.35;
    const hasArrowInput = !!(keys && (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight));
    const isRunning = isMoving || hasArrowInput || player.action === 'running';
    const isStanding = !isRunning;
    const isSprinting = isRunning && !!(keys?.Shift || (player.dashTimer && player.dashTimer > 0));

    // Defender physical contact check (< 28 units = physical contact / body jostle / touching)
    let isDefenderTouching = false;
    let touchingDefender: Player | null = null;
    let minOppDist = Infinity;

    for (const opp of this.players) {
      if (opp.team !== player.team && opp.role !== 'GK' && opp.action !== 'fouled_falling') {
        const dist = Math.hypot(opp.x - player.x, opp.y - player.y);
        if (dist < 28 && dist < minOppDist) {
          minOppDist = dist;
          isDefenderTouching = true;
          touchingDefender = opp;
        }
      }
    }

    // Base accuracy: Standing is 1.0 (highest accuracy), Running is 0.82, Sprinting is 0.70
    let accuracy = isStanding ? 1.0 : (isSprinting ? 0.70 : 0.82);

    // "also if a defender is tocuhing us lower accuracy by 50%"
    if (isDefenderTouching) {
      accuracy *= 0.50; // Accuracy halved under defender physical contact!
    }

    // Error spread multiplier is inversely proportional to accuracy
    const errorSpreadMultiplier = 1.0 / accuracy;

    return {
      accuracy,
      isStanding,
      isRunning,
      isSprinting,
      isDefenderTouching,
      touchingDefender,
      errorSpreadMultiplier,
    };
  }

  /**
   * Executes the charged action immediately
   */
  public executeChargedAction(player: Player, keys: KeyState) {
    if (!this.powerBar.isActive || !this.powerBar.action) return;

    const action = this.powerBar.action;
    // Ensure minimal punchy kick on quick taps
    const power = Math.max(0.18, this.powerBar.power);
    const isSpecial = this.powerBar.isSpecial;
    const isKnuckle = this.powerBar.isKnuckle;

    this.powerBar.isActive = false;

    if (action === 'pass') {
      this.executeShortPass(player, power, isSpecial, isKnuckle, keys);
    } else if (action === 'long_pass') {
      this.executeLongPass(player, power, isSpecial, isKnuckle, keys);
    } else if (action === 'shoot') {
      this.executeShot(player, power, isSpecial, isKnuckle, keys);
    } else if (action === 'cross') {
      this.executeCross(player, power, isSpecial, isKnuckle, keys);
    }
  }

  /**
   * Updates current charging action modifier (Q special curve or E knuckle) on the fly
   * when sliding buttons downward (Q) or upward (E) on touch controls.
   */
  public setActionModifier(modifier: 'normal' | 'Q' | 'E') {
    if (this.powerBar.isActive) {
      if (modifier === 'Q') {
        this.powerBar.isSpecial = true;
        this.powerBar.isKnuckle = false;
        this.updatePowerBarTiers();
      } else if (modifier === 'E') {
        this.powerBar.isKnuckle = true;
        this.powerBar.isSpecial = false;
        this.updatePowerBarTiers();
      } else {
        this.powerBar.isSpecial = false;
        this.powerBar.isKnuckle = false;
        this.updatePowerBarTiers();
      }
    }
  }

  /**
   * Called the exact millisecond user presses an action button or key down (Pass, Shoot, Cross, Long Pass)
   * Supports modifier: 'Q' (downward slide) or 'E' (upward slide)
   */
  public triggerActionPress(action: PowerActionType, keys?: KeyState, modifier?: 'normal' | 'Q' | 'E') {
    const player = this.getControlledPlayer();
    if (!player) return;

    const distToBall = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    const hasBall = this.ball.ownerId === player.id || (!this.ball.ownerId && distToBall < 26 && this.ball.z < 8);

    if (hasBall) {
      const k = keys || (this as any)._lastKeys || {};
      const wantsKnuckle = modifier === 'E' || (modifier !== 'Q' && !!k.KeyE && !player.isLongThrowCharging);
      const wantsSpecial = modifier === 'Q' || (modifier !== 'E' && !!k.KeyQ && !player.isShielding);
      this.startChargingPower(action, wantsSpecial, wantsKnuckle);
    } else {
      // Without ball: Q slide triggers Shoulder Hit; E slide triggers Shirt Pull
      if (modifier === 'Q') {
        executeShoulderHit(player, this.ball, this.players, this.referee, this.awardFoul.bind(this), this.setBanner.bind(this));
        return;
      } else if (modifier === 'E') {
        executeShirtPull(player, this.players, this.referee, this.awardFoul.bind(this), this.setBanner.bind(this));
        return;
      }

      if (action === 'shoot') {
        this.executeStandingTackle(player);
      } else if (action === 'cross') {
        this.executeSlidingTackle(player);
      } else if (action === 'long_pass') {
        this.executeClearance(player);
      } else if (action === 'pass') {
        this.executePushFoul(player);
      }
    }
  }

  /**
   * Called the exact millisecond user releases an action button or key up (P, S, C, L)
   * The player executes the pass/shoot/cross/long pass animation the exact millisecond of release.
   */
  public triggerActionRelease(action: PowerActionType, keys?: KeyState, modifier?: 'normal' | 'Q' | 'E') {
    const player = this.getControlledPlayer();
    if (!player) return;

    const k = keys || (this as any)._lastKeys || {};
    if (modifier === 'Q') {
      this.powerBar.isSpecial = true;
      this.powerBar.isKnuckle = false;
      this.updatePowerBarTiers();
    } else if (modifier === 'E') {
      this.powerBar.isKnuckle = true;
      this.powerBar.isSpecial = false;
      this.updatePowerBarTiers();
    }

    if (this.powerBar.isActive && this.powerBar.action === action) {
      this.executeChargedAction(player, k);
    } else {
      // Quick tap without waiting for charge frame: execute immediately with crisp low power
      const distToBall = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
      const hasBall = this.ball.ownerId === player.id || (!this.ball.ownerId && distToBall < 26 && this.ball.z < 8);
      if (hasBall) {
        const wantsKnuckle = modifier === 'E' || (modifier !== 'Q' && !!k.KeyE);
        const wantsSpecial = modifier === 'Q' || (modifier !== 'E' && !!k.KeyQ);
        this.startChargingPower(action, wantsSpecial, wantsKnuckle);
        this.powerBar.power = 0.25;
        this.executeChargedAction(player, k as KeyState);
      }
    }
  }

  constructor() {
    this.initSquads();
    this.resetToKickoff(true);
  }

  /**
   * Initializes both 11-player squads
   */
  public initSquads() {
    this.players = [];

    // HOME TEAM (User controlled by default, attacks UP)
    const homeRoles = Object.keys(HOME_FORMATION_BASE) as PlayerRole[];
    for (const role of homeRoles) {
      const info = HOME_FORMATION_BASE[role];
      const player: Player = {
        id: `home_${role}`,
        name: info.name,
        number: info.number,
        team: 'home',
        role: role,
        x: PITCH_CONFIG.PITCH_LEFT + info.x * PITCH_CONFIG.FIELD_WIDTH,
        y: PITCH_CONFIG.PITCH_TOP + info.y * PITCH_CONFIG.FIELD_HEIGHT,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        baseX: info.x,
        baseY: info.y,
        facingAngle: -Math.PI / 2, // Facing UP
        facingDir: 'up',
        stats: { ...info.stats },
        appearance: { ...info.appearance },
        scale: info.scale || 1.0,
        action: 'idle',
        actionTimer: 0,
        stamina: 100,
        hasYellowCard: false,
        isRedCarded: false,
        animFrame: 0,
        animTimer: 0,
        isUserControlled: false,
        slideVelocityX: 0,
        slideVelocityY: 0,
        diveX: 0,
        diveY: 0,
      };
      this.players.push(player);
    }

    // AWAY TEAM (AI opponent, attacks DOWN)
    const awayRoles = Object.keys(AWAY_FORMATION_BASE) as PlayerRole[];
    for (const role of awayRoles) {
      const info = AWAY_FORMATION_BASE[role];
      const player: Player = {
        id: `away_${role}`,
        name: info.name,
        number: info.number,
        team: 'away',
        role: role,
        x: PITCH_CONFIG.PITCH_LEFT + info.x * PITCH_CONFIG.FIELD_WIDTH,
        y: PITCH_CONFIG.PITCH_TOP + info.y * PITCH_CONFIG.FIELD_HEIGHT,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        baseX: info.x,
        baseY: info.y,
        facingAngle: Math.PI / 2, // Facing DOWN
        facingDir: 'down',
        stats: { ...info.stats },
        appearance: { ...info.appearance },
        scale: info.scale || 1.0,
        action: 'idle',
        actionTimer: 0,
        stamina: 100,
        hasYellowCard: false,
        isRedCarded: false,
        animFrame: 0,
        animTimer: 0,
        isUserControlled: false,
        slideVelocityX: 0,
        slideVelocityY: 0,
        diveX: 0,
        diveY: 0,
      };
      this.players.push(player);
    }

    // Set initial user-controlled player (Home ST1 - Maradona)
    this.userControlledPlayerId = 'home_ST1';
    const userPlayer = this.players.find(p => p.id === this.userControlledPlayerId);
    if (userPlayer) userPlayer.isUserControlled = true;
  }

  /**
   * Resets players to base kickoff positions and places ball at center circle
   */
  public resetToKickoff(isFirstKickoff: boolean = false, resetScore: boolean = false) {
    if (resetScore) {
      this.score = { home: 0, away: 0 };
      this.matchTimeSeconds = 0;
    }

    const fieldW = PITCH_CONFIG.FIELD_WIDTH;
    const fieldH = PITCH_CONFIG.FIELD_HEIGHT;

    for (const p of this.players) {
      p.x = PITCH_CONFIG.PITCH_LEFT + p.baseX * fieldW;
      p.y = PITCH_CONFIG.PITCH_TOP + p.baseY * fieldH;
      p.vx = 0;
      p.vy = 0;
      p.action = 'idle';
      p.actionTimer = 0;
      p.animFrame = 0;
      p.facingDir = p.team === 'home' ? 'up' : 'down';
    }

    // Put ST1 and ST2 right around the center circle
    const homeSt1 = this.players.find(p => p.id === 'home_ST1');
    if (homeSt1) {
      homeSt1.x = PITCH_CONFIG.CENTER_X - 10;
      homeSt1.y = PITCH_CONFIG.CENTER_Y + 12;
    }
    const homeSt2 = this.players.find(p => p.id === 'home_ST2');
    if (homeSt2) {
      homeSt2.x = PITCH_CONFIG.CENTER_X + 25;
      homeSt2.y = PITCH_CONFIG.CENTER_Y + 20;
    }

    // Ball to center
    this.ball.x = PITCH_CONFIG.CENTER_X;
    this.ball.y = PITCH_CONFIG.CENTER_Y;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.spin = 0;
    this.ball.spinY = 0;
    this.ball.deformation = 0;
    this.ball.deformationAngle = 0;
    this.ball.trail = [];
    this.ball.isAirborne = false;
    this.ball.ownerId = 'home_ST1'; // User kicks off
    this.ball.lastTouchTeam = 'home';
    this.ball.lastTouchPlayerId = 'home_ST1';

    // Referee near center circle
    this.referee.x = PITCH_CONFIG.CENTER_X + 70;
    this.referee.y = PITCH_CONFIG.CENTER_Y - 40;
    this.referee.whistleTimer = 30;
    this.referee.cardDisplay = null;
    this.referee.cardPlayerName = null;

    this.matchPhase = 'kickoff_ready';
    this.phaseTimer = 0;
    this.userControlledPlayerId = 'home_ST1';
    this.updateUserControlledFlag();

    if (!isFirstKickoff) {
      this.bannerMessage = 'KICK OFF - PLAY BALL!';
      this.bannerTimer = 150;
      audio.playWhistle(true);
    }
  }

  /**
   * Main game tick (60 FPS)
   */
  public update(keys: KeyState) {
    if (this.isPaused) return;

    // Strict single controlled player synchronization
    this.updateUserControlledFlag();

    const timeScale = this.getTimeScale();

    // Advance match clock scaled by game speed
    if (this.matchPhase === 'in_play') {
      this.matchTimeSeconds += (1 / 20) * timeScale; // 90 min match scaled
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - timeScale);
      if (this.bannerTimer === 0) this.bannerMessage = null;
    }

    if (this.referee.whistleTimer > 0) {
      this.referee.whistleTimer = Math.max(0, this.referee.whistleTimer - timeScale);
    }
    if (this.goalNetShake > 0) this.goalNetShake *= Math.pow(0.92, timeScale);

    // Top goal net spring physics decay
    if (this.topGoalNet.bulgeAmount > 0.05 || this.topGoalNet.shake > 0.05) {
      this.topGoalNet.bulgeVel += (0 - this.topGoalNet.bulgeAmount) * 0.15 * timeScale;
      this.topGoalNet.bulgeVel *= Math.pow(0.82, timeScale);
      this.topGoalNet.bulgeAmount = Math.max(0, this.topGoalNet.bulgeAmount + this.topGoalNet.bulgeVel * timeScale);
      this.topGoalNet.shake *= Math.pow(0.92, timeScale);
      if (this.topGoalNet.shake < 0.1) this.topGoalNet.shake = 0;
    } else {
      this.topGoalNet.bulgeAmount = 0;
      this.topGoalNet.bulgeVel = 0;
      this.topGoalNet.shake = 0;
    }

    // Bottom goal net spring physics decay
    if (this.bottomGoalNet.bulgeAmount > 0.05 || this.bottomGoalNet.shake > 0.05) {
      this.bottomGoalNet.bulgeVel += (0 - this.bottomGoalNet.bulgeAmount) * 0.15 * timeScale;
      this.bottomGoalNet.bulgeVel *= Math.pow(0.82, timeScale);
      this.bottomGoalNet.bulgeAmount = Math.max(0, this.bottomGoalNet.bulgeAmount + this.bottomGoalNet.bulgeVel * timeScale);
      this.bottomGoalNet.shake *= Math.pow(0.92, timeScale);
      if (this.bottomGoalNet.shake < 0.1) this.bottomGoalNet.shake = 0;
    } else {
      this.bottomGoalNet.bulgeAmount = 0;
      this.bottomGoalNet.bulgeVel = 0;
      this.bottomGoalNet.shake = 0;
    }

    // Clear caught flag if ball is outside goalmouth
    if (this.ball.y > PITCH_CONFIG.PITCH_TOP + 10) {
      this.topGoalNet.ballCaught = false;
    }
    if (this.ball.y < PITCH_CONFIG.PITCH_BOTTOM - 10) {
      this.bottomGoalNet.ballCaught = false;
    }

    // Handle phase delays (Goal scored or Foul stoppage)
    if (this.matchPhase === 'goal_scored') {
      this.phaseTimer += timeScale;
      if (this.phaseTimer > 180) {
        this.resetToKickoff();
      }
    } else if (this.matchPhase === 'foul_stoppage') {
      this.phaseTimer += timeScale;
      if (this.phaseTimer > 140) {
        this.matchPhase = 'in_play';
        this.referee.cardDisplay = null;
        this.referee.cardPlayerName = null;
      }
    }

    // 1. Process User Player Input
    this.handleUserInput(keys);

    // 1.5 Goalkeeper Possession & Distribution Handler (handles composed stance and auto-distribution)
    this.handleGoalkeeperPossession();

    // 2. Process AI for all non-user controlled players
    this.handleAI();

    // 3. Update Ball Physics with 3D Goal Net catch and crossbar bounce
    const newParticles = updateBallPhysics(
      this.ball,
      event => this.onGoal(event),
      this.topGoalNet,
      this.bottomGoalNet,
      timeScale
    );
    if (newParticles.length > 0) {
      this.particles.push(...newParticles);
    }

    // 4. Ball Possession & Player Proximity Check
    this.updateBallPossession();

    // 4.5 Check out of bounds / overpowered balls in stands
    this.checkOutOfBounds();

    // 5. Update Actions & Animations for all players
    this.updatePlayerStates(timeScale);

    // 6. Update Referee AI (moves along sideline & follows action)
    this.updateReferee(timeScale);

    // 7. Update Particles
    this.updateParticles(timeScale);

    // 8. Update Camera smoothly with dynamic angle
    this.updateCamera();

    // 9. Auto-switch user control to closest Home player to ball (if not holding ball)
    this.autoSwitchUserPlayer();
  }

  /**
   * Handles user keyboard controls:
   * Arrows = Move, Shift = Run
   * With ball: W = Long Pass to space, A = Shoot, S = Short Pass to feet, D = Cross to box
   * Without ball: S = Standing tackle, D = Sliding tackle, A = Clear ball, W = Push / Foul
   */
  private handleUserInput(keys: KeyState) {
    // Set piece phase control (penalty, free kick, corner, goal kick, throw-in)
    if (this.setPiece && (this.matchPhase === 'free_kick' || this.matchPhase === 'penalty' || this.matchPhase === 'corner_kick' || this.matchPhase === 'goal_kick' || this.matchPhase === 'throw_in')) {
      updateSetPiece(this, keys);
      return;
    }

    const player = this.players.find(p => p.id === this.userControlledPlayerId);
    if (!player) return;

    if (player.action === 'sliding_tackle' || player.action === 'fouled_falling' || player.action === 'cruyff_turn' || player.action === 'rainbow_flick') {
      return; // Cannot steer while performing locked skill action, slide or knocked down
    }

    const hasBall = this.ball.ownerId === player.id;
    const skillEvents = this.skillTracker.update(keys);

    // Movement directional input
    let dx = 0;
    let dy = 0;
    if (keys.ArrowLeft) dx -= 1;
    if (keys.ArrowRight) dx += 1;
    if (keys.ArrowUp) dy -= 1;
    if (keys.ArrowDown) dy += 1;

    // --- WITH BALL SKILL DISPATCH ---
    if (hasBall) {
      // If user is controlling the goalkeeper and presses keys to distribute:
      if (player.role === 'GK') {
        if (keys.KeyS) {
          this.executeGoalkeeperDistribution(player, player.team === 'home', 'short');
          return;
        }
        if (keys.KeyA || keys.KeyW) {
          this.executeGoalkeeperDistribution(player, player.team === 'home', 'long');
          return;
        }
      }

      // 0. Rotate arrow keys while pressing E -> Marseille Roulette 360° spin!
      const isRotatingArrows = this.arrowRotationTracker.update(keys, !!keys.KeyE);
      if (isRotatingArrows) {
        executeRoulette(player, this.ball, keys, this.players, this.setBanner.bind(this));
        return;
      }

      // 1. Double-tap Q: short skill (nutmeg if defender behind, Cruyff turn if on side)
      if (skillEvents.doubleTapQ) {
        executeDoubleTapQSkill(player, this.ball, this.players, this.setBanner.bind(this));
        return;
      }

      // 2. Double-tap E:
      // If standing and defender in front -> Rainbow flick
      // Otherwise -> Step-overs
      if (skillEvents.doubleTapE) {
        if (dx === 0 && dy === 0) {
          let defInFront: Player | null = null;
          for (const opp of this.players) {
            if (opp.team !== player.team) {
              const d = Math.hypot(opp.x - player.x, opp.y - player.y);
              if (d < 58) {
                const ang = Math.atan2(opp.y - player.y, opp.x - player.x);
                if (Math.abs(normalizeAngle(ang - player.facingAngle)) < 0.85) {
                  defInFront = opp;
                  break;
                }
              }
            }
          }
          if (defInFront) {
            executeRainbowFlick(player, this.ball, defInFront, this.setBanner.bind(this));
            return;
          } else {
            executeStepOvers(player, this.setBanner.bind(this));
          }
        } else {
          executeStepOvers(player, this.setBanner.bind(this));
        }
      }

      // 3. While running pressing E makes you throw the ball longer (autopass ahead)
      const isMovingOrRunning = dx !== 0 || dy !== 0 || player.action === 'running' || player.action === 'nutmeg_dash';
      if (keys.KeyE && isMovingOrRunning && !this.powerBar.isActive && !player.isStepOverActive) {
        player.isLongThrowCharging = true;
        player.longThrowCharge = Math.min(1.0, (player.longThrowCharge || 0) + 0.034);
      }

      if (skillEvents.releasedEAfterHold && (player.longThrowCharge || 0) > 0.06) {
        executeAutopassLaunch(player, this.ball, keys, player.longThrowCharge || 0.5, this.setBanner.bind(this));
        player.longThrowCharge = 0;
        player.isLongThrowCharging = false;
        return;
      }
    }

    // --- GINGA SYSTEM: SPACEBAR BALL LIFTING, JUGGLING & SOMBREROS ---
    updateGingaSystem(player, this.ball, keys, this.players, this.setBanner.bind(this));

    // --- [Q] SHIELDING MECHANIC (when with ball and not charging action) ---
    // "when with the ball Q makes you shield the ball, your back faces coming pressing rivals, and you move the ball away from them automatically"
    // "if you're running pressing Q stops your run and allows to manouver, turn faster and avoid rivals, you can't run while pressing Q but you turn much faster than normal"
    const isShieldingKey = hasBall && keys.KeyQ && !this.powerBar.isActive && !keys.KeyA && !keys.KeyS && !keys.KeyD && !keys.KeyW && !skillEvents.doubleTapQ;
    player.isShielding = isShieldingKey;

    // --- [E] STEP-OVERS & DASH MECHANIC (when with ball and not charging action) ---
    const isStepOverKey = hasBall && keys.KeyE && !this.powerBar.isActive && !keys.KeyA && !keys.KeyS && !keys.KeyD && !keys.KeyW && !player.isLongThrowCharging;

    if (isShieldingKey) {
      // Cannot sprint/run while shielding: stops run, provides nimble tight maneuvering
      const timeScale = this.getTimeScale();
      const shieldSpeed = player.stats.speed * 0.44 * timeScale;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        player.vx = (dx / len) * shieldSpeed;
        player.vy = (dy / len) * shieldSpeed;
        player.x += player.vx;
        player.y += player.vy;

        // Turn much faster than normal
        player.facingAngle = Math.atan2(dy, dx);
        updateFacingDirection(player, dx / len, dy / len);
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      // Automatically shield from nearest incoming rival
      let nearestRival: Player | null = null;
      let minRivalDist = 130;
      for (const opp of this.players) {
        if (opp.team !== player.team) {
          const d = Math.hypot(opp.x - player.x, opp.y - player.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            nearestRival = opp;
          }
        }
      }

      if (nearestRival) {
        // Back faces coming rival! Player faces away from rival
        const awayAngle = Math.atan2(player.y - nearestRival.y, player.x - nearestRival.x);
        player.facingAngle = awayAngle;
        updateFacingDirection(player, Math.cos(awayAngle), Math.sin(awayAngle));
        // Move ball away from rival automatically
        this.ball.x = player.x + Math.cos(awayAngle) * 12;
        this.ball.y = player.y + Math.sin(awayAngle) * 12;
      } else {
        this.ball.x = player.x + Math.cos(player.facingAngle) * 10;
        this.ball.y = player.y + Math.sin(player.facingAngle) * 10;
      }
      this.ball.z = 0;
      this.ball.vx = 0;
      this.ball.vy = 0;

      player.action = 'shielding';
      player.animFrame = 0;
    } else if (isStepOverKey && dx === 0 && dy === 0) {
      // Stopped on the ball: do slow step-overs hovering above it
      player.vx = 0;
      player.vy = 0;
      player.action = 'step_overs';
      player.stepOverTimer = (player.stepOverTimer || 0) + 1;
      player.animFrame = Math.floor(player.stepOverTimer / 7) % 4;

      if (player.stepOverTimer % 18 === 1) {
        audio.playStepOver();
      }

      // Ball sits still under feet
      this.ball.x = player.x;
      this.ball.y = player.y + 4;
      this.ball.z = 0;
      this.ball.vx = 0;
      this.ball.vy = 0;
    } else {
      // Step-over direction change effectiveness check:
      if (player.isStepOverActive && (dx !== 0 || dy !== 0)) {
        const inputAngle = Math.atan2(dy, dx);
        if (Math.abs(normalizeAngle(inputAngle - (player.stepOverOriginalAngle || player.facingAngle))) > 0.6) {
          player.stepOverDirChanged = true;
          player.dashTimer = 22;
          player.isStepOverActive = false;
          player.action = 'nutmeg_dash';
          audio.playStepOver();
          for (const def of this.players) {
            if (def.team !== player.team) {
              const d = Math.hypot(def.x - player.x, def.y - player.y);
              if (d < 50) def.confusedTimer = 65;
            }
          }
          this.setBanner(t('stepoverCut'), 60);
        }
      }

      // Normal running / sprinting OR longer dash after step-overs [E]
      const wasStepOverOrDash = (player.stepOverTimer && player.stepOverTimer > 5) || (player.action === 'step_overs') || (player.dashTimer && player.dashTimer > 0) || (keys.KeyE && (dx !== 0 || dy !== 0));

      if (wasStepOverOrDash && (dx !== 0 || dy !== 0) && (!player.dashTimer || player.dashTimer === 0) && !player.isLongThrowCharging) {
        // Trigger longer explosive dash
        player.dashTimer = 26;
        player.action = 'nutmeg_dash';

        // Check for automatic nutmeg if defender is in front and not in standing tackle!
        const dashDirX = dx / Math.hypot(dx, dy);
        const dashDirY = dy / Math.hypot(dx, dy);
        const dashAngle = Math.atan2(dashDirY, dashDirX);

        for (const def of this.players) {
          if (def.team !== player.team) {
            const d = Math.hypot(def.x - player.x, def.y - player.y);
            if (d < 54) {
              const angleToDef = Math.atan2(def.y - player.y, def.x - player.x);
              let angleDiff = Math.abs(angleToDef - dashAngle);
              while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

              if (angleDiff < 0.95) {
                const isTackling = def.action === 'standing_tackle' || def.action === 'sliding_tackle';
                if (!isTackling) {
                  def.confusedTimer = 110; // Subtle small confused emoji
                  def.action = 'idle';

                  // Ball nutmegs between defender's legs into space ahead
                  this.ball.ownerId = null;
                  this.ball.x = def.x + Math.cos(dashAngle) * 22;
                  this.ball.y = def.y + Math.sin(dashAngle) * 22;
                  this.ball.vx = Math.cos(dashAngle) * 5.2;
                  this.ball.vy = Math.sin(dashAngle) * 5.2;
                  this.ball.z = 0;
                  this.ball.vz = 0;
                  this.ball.lastTouchPlayerId = player.id;
                  this.ball.lastTouchTeam = player.team;

                  audio.playNutmegCheer();
                  this.setBanner(t('nutmegDash'), 90);
                  break;
                }
              }
            }
          }
        }
        player.stepOverTimer = 0;
      }

      const isDashing = player.dashTimer && player.dashTimer > 0;
      const isSprinting = (keys.Shift || isDashing) && (dx !== 0 || dy !== 0) && player.stamina > 10;
      let currentSpeed = isDashing
        ? player.stats.sprintSpeed * 1.55
        : (isSprinting
            ? player.stats.sprintSpeed
            : player.stats.speed * Math.max(0.65, Math.min(1.0, this.analogSpeedRatio)));

      // Step-overs slow down the run
      if (player.isStepOverActive) {
        currentSpeed *= 0.54;
      }

      // Shirt pulled slows down player
      if (player.shirtPulledTimer && player.shirtPulledTimer > 0) {
        currentSpeed *= 0.42;
      }

      if (isSprinting && !isDashing) {
        player.stamina = Math.max(0, player.stamina - 0.25);
      } else if (!isSprinting) {
        player.stamina = Math.min(100, player.stamina + 0.15);
      }

      if (dx !== 0 || dy !== 0) {
        // Normalize vector
        const len = Math.hypot(dx, dy);
        const ndx = dx / len;
        const ndy = dy / len;

        const timeScale = this.getTimeScale();
        player.vx = ndx * currentSpeed * timeScale;
        player.vy = ndy * currentSpeed * timeScale;
        player.x += player.vx;
        player.y += player.vy;

        player.facingAngle = Math.atan2(ndy, ndx);
        updateFacingDirection(player, ndx, ndy);

        // Maintain shooting/passing/crossing kick animation while running
        if (player.actionTimer <= 0 || !isKickingAction(player.action)) {
          const isDashing = player.dashTimer && player.dashTimer > 0;
          player.action = isDashing ? 'nutmeg_dash' : (player.isStepOverActive ? 'step_overs' : (hasBall ? 'dribbling' : 'running'));
          player.animTimer = (player.animTimer || 0) + 1;
          const animSpeed = hasBall ? 4 : (isSprinting ? 3 : 5);
          if (player.animTimer % animSpeed === 0) {
            player.animFrame = (player.animFrame + 1) % 6;
          }
        }
      } else {
        player.vx = 0;
        player.vy = 0;
        if (player.actionTimer <= 0 && (player.action === 'running' || player.action === 'dribbling' || player.action === 'nutmeg_dash')) {
          player.action = player.isStepOverActive ? 'step_overs' : 'idle';
          player.animFrame = 0;
        }
      }
    }

    // Keep within pitch bounds
    player.x = Math.max(PITCH_CONFIG.PITCH_LEFT, Math.min(PITCH_CONFIG.PITCH_RIGHT, player.x));
    player.y = Math.max(PITCH_CONFIG.PITCH_TOP, Math.min(PITCH_CONFIG.PITCH_BOTTOM, player.y));

    // ACTION BUTTONS (W, A, S, D)
    if (hasBall) {
      // Check Q / E key modifiers for special curve or knuckleball modes
      const wantsKnuckle = !!keys.KeyE && !player.isLongThrowCharging;
      const wantsSpecial = !!keys.KeyQ && !player.isShielding;

      // 1. If not currently charging, start charging when key is pressed
      if (!this.powerBar.isActive) {
        if (keys.KeyS) {
          this.startChargingPower('pass', wantsSpecial, wantsKnuckle);
        } else if (keys.KeyW) {
          this.startChargingPower('long_pass', wantsSpecial, wantsKnuckle);
        } else if (keys.KeyA) {
          this.startChargingPower('shoot', wantsSpecial, wantsKnuckle);
        } else if (keys.KeyD) {
          this.startChargingPower('cross', wantsSpecial, wantsKnuckle);
        }
      }

      // 2. If charging an action:
      if (this.powerBar.isActive) {
        const action = this.powerBar.action;
        let isKeyHeld = false;
        if (action === 'pass') isKeyHeld = keys.KeyS;
        else if (action === 'long_pass') isKeyHeld = keys.KeyW;
        else if (action === 'shoot') isKeyHeld = keys.KeyA;
        else if (action === 'cross') isKeyHeld = keys.KeyD;

        if (keys.KeyE) {
          this.powerBar.isKnuckle = true;
          this.powerBar.isSpecial = false;
          this.updatePowerBarTiers();
        } else if (keys.KeyQ) {
          this.powerBar.isSpecial = true;
          this.powerBar.isKnuckle = false;
          this.updatePowerBarTiers();
        }

        if (isKeyHeld) {
          this.powerBar.power = Math.min(1.0, this.powerBar.power + this.powerBar.fillSpeed);
          this.updatePowerBarTiers();

          if (this.powerBar.power >= 1.0) {
            this.executeChargedAction(player, keys);
            if (action === 'pass') keys.KeyS = false;
            else if (action === 'long_pass') keys.KeyW = false;
            else if (action === 'shoot') keys.KeyA = false;
            else if (action === 'cross') keys.KeyD = false;
          }
        } else {
          this.executeChargedAction(player, keys);
        }
      }
    } else {
      // WITHOUT THE BALL:
      if (this.powerBar.isActive) {
        this.powerBar.isActive = false;
      }

      // --- AERIAL BALL MECHANICS: VOLLEYS, FLAIR SHOTS, SOMBREROS & HEADERS ---
      const distToBall = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
      const isBallAirborneNear = (this.ball.isAirborne || player.gingaActive || this.ball.z > 2.0) && distToBall < 36;

      if (isBallAirborneNear) {
        // 1. Shoot Volley / Acrobatic Flair (A)
        if (keys.KeyA) {
          const isOwnDefensiveHalf = player.team === 'home'
            ? player.y > PITCH_CONFIG.CENTER_Y + 50
            : player.y < PITCH_CONFIG.CENTER_Y - 50;
          const isDefender = player.role === 'CB1' || player.role === 'CB2' || player.role === 'LB' || player.role === 'RB';

          if (isOwnDefensiveHalf && isDefender && !keys.KeyQ && !keys.KeyE) {
            // "defenders can also do volleys for clearance those are more rustic"
            executeRusticVolleyClearance(player, this.ball, this.setBanner.bind(this));
          } else {
            tryExecuteVolley(player, this.ball, 'shoot', 0.85, keys, null, this.setBanner.bind(this));
          }
          keys.KeyA = false;
          return;
        }

        // 2. Short Pass Volley / Flair (S)
        if (keys.KeyS) {
          tryExecuteVolley(player, this.ball, 'pass', 0.65, keys, null, this.setBanner.bind(this));
          keys.KeyS = false;
          return;
        }

        // 3. Long Pass Volley / Flair (W)
        if (keys.KeyW) {
          tryExecuteVolley(player, this.ball, 'long_pass', 0.8, keys, null, this.setBanner.bind(this));
          keys.KeyW = false;
          return;
        }

        // 4. Cross Volley / Flair (D)
        if (keys.KeyD) {
          tryExecuteVolley(player, this.ball, 'cross', 0.8, keys, null, this.setBanner.bind(this));
          keys.KeyD = false;
          return;
        }

        // 5. Automatic Header if no button pressed on incoming aerial cross/ball:
        // "if you don't press anything you player will try to head it"
        if (!keys.KeyA && !keys.KeyS && !keys.KeyD && !keys.KeyW && !keys.KeyE && !keys.KeyQ) {
          const rivalGoalY = player.team === 'home' ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
          if (checkAutomaticHeader(player, this.ball, rivalGoalY, this.setBanner.bind(this))) {
            return;
          }
        }
      }

      // Manual Header contest check: if airborne ball is right overhead
      if (this.ball.isAirborne && this.ball.z > 14 && this.ball.z < 45 && distToBall < 30) {
        if (keys.KeyA || keys.KeyS || keys.KeyD || keys.KeyW) {
          this.executeHeader(player);
          return;
        }
      }

      // --- Q: SHOULDER HIT DEFENDING ---
      if (keys.KeyQ) {
        executeShoulderHit(player, this.ball, this.players, this.referee, this.awardFoul.bind(this), this.setBanner.bind(this));
        keys.KeyQ = false;
        return;
      }

      // --- E: SHIRT PULL DEFENDING ---
      if (keys.KeyE) {
        executeShirtPull(player, this.players, this.referee, this.awardFoul.bind(this), this.setBanner.bind(this));
        keys.KeyE = false;
        return;
      }

      // --- S: STANDING TACKLE ---
      if (keys.KeyS) {
        this.executeStandingTackle(player);
        keys.KeyS = false;
      }

      // --- D: SLIDING TACKLE ---
      else if (keys.KeyD) {
        this.executeSlidingTackle(player);
        keys.KeyD = false;
      }

      // --- A: CLEARING THE BALL ---
      else if (keys.KeyA) {
        if (this.ball.isAirborne && this.ball.z >= 3.5 && distToBall < 35) {
          executeRusticVolleyClearance(player, this.ball, this.setBanner.bind(this));
        } else {
          this.executeClearance(player);
        }
        keys.KeyA = false;
      }

      // --- W: PUSHING / FOULING OPPONENT ---
      else if (keys.KeyW) {
        this.executePushFoul(player);
        keys.KeyW = false;
      }
    }
  }

  /**
   * S: Short pass directly to teammate's feet with power scaling, Q-curl, and E-driven pass
   * Supports passing while running, standing accuracy precision, and -50% accuracy under defender contact.
   */
  private executeShortPass(player: Player, power: number = 0.5, isSpecial: boolean = false, isKnuckle: boolean = false, keys?: KeyState) {
    if (this.matchPhase === 'kickoff_ready') {
      this.matchPhase = 'in_play';
    }

    const acc = this.evaluateKickAccuracy(player, keys);

    if (isSpecial) {
      player.action = 'special_curl_pass';
      player.actionTimer = 16;
    } else if (isKnuckle) {
      player.action = 'knuckle_pass';
      player.actionTimer = 14;
    } else if (power < 0.60) {
      // Low power (< 60%): Quick nimble side-foot tap / flick
      player.action = acc.isRunning ? 'running_pass_low' : 'standing_pass_low';
      player.actionTimer = acc.isRunning ? 11 : 9;
    } else if (power <= 0.70) {
      // Mid power (60% - 70%): Improved athletic side-foot drive
      player.action = acc.isRunning ? 'running_pass_mid' : 'standing_pass_mid';
      player.actionTimer = acc.isRunning ? 14 : 12;
    } else {
      // High power (71% - 90% & Overpower): Bullet driven laser pass
      player.action = acc.isRunning ? 'running_pass_high' : 'standing_pass_high';
      player.actionTimer = acc.isRunning ? 17 : 15;
    }
    player.animFrame = 0;

    // Find best teammate in current facing direction
    const mates = this.players.filter(p => p.team === player.team && p.id !== player.id);
    let bestMate: Player | null = null;
    let bestScore = -Infinity;

    for (const m of mates) {
      const dx = m.x - player.x;
      const dy = m.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) continue;

      const angleToMate = Math.atan2(dy, dx);
      let angleDiff = Math.abs(angleToMate - player.facingAngle);
      while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      const forwardBonus = (player.team === 'home' ? -dy : dy) * 0.4;
      const rangePenalty = dist > 350 ? (dist - 350) * 1.5 : 0;
      const score = 1000 - dist - angleDiff * 250 + forwardBonus - rangePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestMate = m;
      }
    }

    if (!bestMate && mates.length > 0) {
      bestMate = mates[0];
    }

    if (bestMate) {
      // Standing has highest precision directly to feet.
      // Running leads recipient in stride.
      // Defender touching adds deviation (-50% accuracy).
      let targetX = bestMate.x;
      let targetY = bestMate.y;

      if (acc.isRunning) {
        targetX += bestMate.vx * 3.2;
        targetY += bestMate.vy * 3.2;
      }

      if (acc.isDefenderTouching) {
        targetX += (Math.random() - 0.5) * 42 * (acc.errorSpreadMultiplier * 0.5);
        targetY += (Math.random() - 0.5) * 42 * (acc.errorSpreadMultiplier * 0.5);
      }

      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.hypot(dx, dy) || 1;

      this.ball.ownerId = null;
      this.ball.lastTouchTeam = player.team;
      this.ball.lastTouchPlayerId = player.id;
      this.ball.lastKickAction = 'pass';
      this.ball.lastKickPower = power;
      this.ball.isDividedBall = true;
      this.ball.isKnuckle = isKnuckle;

      if (isKnuckle) {
        this.ball.spin = 0;
        this.ball.spinY = 0;
        this.ball.isSpecialCurve = false;

        if (power >= 0.90) {
          // Overpower Burgundy driven pass: rolls right past teammate with blistering pace
          const overSpeed = 16.5;
          this.ball.vx = (dx / dist) * overSpeed;
          this.ball.vy = (dy / dist) * overSpeed;
          this.ball.vz = 0.2;
          this.ball.z = 0;
          this.ball.isAirborne = false;
          this.ball.isOverpowered = true;
          this.bannerMessage = 'BLISTERING DRIVEN PASS OVERCOOKED! (BURGUNDY)';
          audio.playKnuckleStrike(1.0);
        } else {
          // Faster and more precise driven short pass
          const speed = Math.min(18.0, Math.max(11.5, dist * 0.08)) * (1.05 + power * 0.5);
          this.ball.vx = (dx / dist) * speed;
          this.ball.vy = (dy / dist) * speed;
          this.ball.vz = 0.1;
          this.ball.z = 0;
          this.ball.isOverpowered = false;
          audio.playKnuckleStrike(0.65);
          this.bannerMessage = power >= 0.75 ? 'DRIVEN BULLET PASS! (RED MAX)' : 'DRIVEN GROUND PASS! [E]';
        }
      } else if (power >= 0.90) {
        // OVERPOWERED (Red / Purplish Black):
        const overSpeed = 14.5;
        this.ball.vx = (dx / dist) * overSpeed;
        this.ball.vy = (dy / dist) * overSpeed;
        this.ball.vz = 0.4;
        this.ball.z = 0;
        this.ball.isAirborne = false;
        this.ball.isOverpowered = true;

        if (isSpecial) {
          this.ball.spin = (Math.random() > 0.5 ? 8.8 : -8.8);
          this.ball.isSpecialCurve = true;
          this.bannerMessage = 'VIOLENT HOOK PASS PAST TEAMMATE!';
          audio.playOverpoweredKick();
        } else {
          this.ball.spin = (Math.random() - 0.5) * 1.5;
          this.ball.isSpecialCurve = false;
          this.bannerMessage = 'OVERHIT PASS! ROLLED PAST TEAMMATE!';
          audio.playOverpoweredKick();
        }
      } else {
        // FAST, CRISP ARCADE SHORT PASS
        const speed = Math.min(15.0, Math.max(8.5, dist * 0.065)) * (0.95 + power * 0.45);
        this.ball.vx = (dx / dist) * speed;
        this.ball.vy = (dy / dist) * speed;
        this.ball.vz = 0.2;
        this.ball.z = 0;
        this.ball.isOverpowered = false;

        if (isSpecial) {
          this.ball.spin = (player.x < PITCH_CONFIG.CENTER_X ? 4.5 : -4.5);
          this.ball.isSpecialCurve = true;
          this.bannerMessage = 'CURVED SHORT PASS! [Q]';
          audio.playSpecialCurveKick();
        } else {
          this.ball.spin = (Math.random() - 0.5) * 1.5;
          this.ball.isSpecialCurve = false;
          audio.playKick(0.5 + power * 0.35);
          if (power >= 0.75) {
            this.bannerMessage = 'CRISP ZIP PASS! (MAX OUTPUT)';
          }
        }
      }

      // If running, incorporate runner velocity momentum
      if (acc.isRunning) {
        this.ball.vx += player.vx * 0.16;
        this.ball.vy += player.vy * 0.16;
      }

      // If defender is touching player, apply 50% accuracy penalty
      if (acc.isDefenderTouching) {
        this.ball.vz = Math.max(this.ball.vz, 0.45); // slight contested bounce
        this.bannerMessage = 'PASS UNDER DEFENDER PRESSURE (-50% ACCURACY)';
      }

      this.bannerTimer = 65;

      // Switch control to recipient
      if (player.team === 'home') {
        this.userControlledPlayerId = bestMate.id;
        this.updateUserControlledFlag();
      }
    }
  }

  /**
   * W: Long pass to space (makes receiving player run towards ball) with power scaling, Q-curl, and E-driven pass
   * Supports passing on the run, standing accuracy precision, and -50% accuracy under defender contact.
   */
  private executeLongPass(player: Player, power: number = 0.5, isSpecial: boolean = false, isKnuckle: boolean = false, keys?: KeyState) {
    if (this.matchPhase === 'kickoff_ready') {
      this.matchPhase = 'in_play';
    }

    const acc = this.evaluateKickAccuracy(player, keys);

    // "for long pass, the ball moves faster than regular long pass and has less curve but it takes longer for you to hit the ball"
    if (power < 0.60) {
      player.action = acc.isRunning ? 'running_long_pass_low' : 'standing_long_pass_low';
      player.actionTimer = acc.isRunning ? 13 : 11;
    } else if (power <= 0.70) {
      player.action = acc.isRunning ? 'running_long_pass_mid' : 'standing_long_pass_mid';
      player.actionTimer = acc.isRunning ? 17 : 15;
    } else {
      player.action = acc.isRunning ? 'running_long_pass_high' : 'standing_long_pass_high';
      player.actionTimer = isKnuckle ? 26 : (acc.isRunning ? 21 : 19);
    }
    player.animFrame = 0;

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.lastKickAction = 'long_pass';
    this.ball.lastKickPower = power;
    this.ball.isDividedBall = true;
    this.ball.isKnuckle = isKnuckle;

    const dirY = player.team === 'home' ? -1 : 1;

    if (isKnuckle) {
      this.ball.spin = 0; // Strictly less/no curve
      this.ball.spinY = 0;
      this.ball.isSpecialCurve = false;

      if (power >= 0.90) {
        // Burgundy overpower: travels uncatchable deep into stands
        this.ball.vx = Math.cos(player.facingAngle) * 3.4;
        this.ball.vy = dirY * 16.5;
        this.ball.vz = 7.0;
        this.ball.isAirborne = true;
        this.ball.isOverpowered = true;
        this.bannerMessage = 'UNCATCHABLE DRIVEN LONG PASS! (BURGUNDY)';
        audio.playOverpoweredKick();
      } else {
        const passAngle = player.facingAngle;
        const passDist = 220 + power * 310;
        let targetX = player.x + Math.cos(passAngle) * passDist;
        let targetY = player.y + Math.sin(passAngle) * passDist;

        if (acc.isDefenderTouching) {
          targetX += (Math.random() - 0.5) * 55 * (acc.errorSpreadMultiplier * 0.5);
          targetY += (Math.random() - 0.5) * 55 * (acc.errorSpreadMultiplier * 0.5);
        }

        const tdx = targetX - player.x;
        const tdy = targetY - player.y;
        const tdist = Math.hypot(tdx, tdy) || 1;

        // Moves faster than regular long pass (7.6 + power * 5.0 vs 5.2 + power * 3.6)
        const speed = 7.6 + power * 5.0;
        this.ball.vx = (tdx / tdist) * speed;
        this.ball.vy = (tdy / tdist) * speed;

        if (acc.isRunning) {
          this.ball.vx += player.vx * 0.18;
          this.ball.vy += player.vy * 0.18;
        }

        this.ball.vz = 2.0 + power * 1.8;
        this.ball.isAirborne = true;
        this.ball.isOverpowered = false;

        audio.playKnuckleStrike(0.8);
        if (acc.isDefenderTouching) {
          this.bannerMessage = 'LONG PASS UNDER DEFENDER PRESSURE (-50% ACCURACY)';
        } else {
          this.bannerMessage = power >= 0.75 ? 'DRIVEN ROCKET LONG PASS! (RED MAX)' : 'DRIVEN LONG PASS! [E]';
        }

        // Alert nearest teammate to run to target space
        let bestMate: Player | null = null;
        let closestDist = Infinity;
        for (const m of this.players) {
          if (m.team === player.team && m.id !== player.id) {
            const d = Math.hypot(m.x - targetX, m.y - targetY);
            if (d < closestDist) {
              closestDist = d;
              bestMate = m;
            }
          }
        }
        if (bestMate) {
          bestMate.targetX = targetX;
          bestMate.targetY = targetY;
        }
      }
    } else if (power >= 0.90) {
      // OVERPOWERED (Red / Purplish Black):
      const speed = 15.0;
      this.ball.vx = Math.cos(player.facingAngle) * 3.8;
      this.ball.vy = dirY * speed;
      this.ball.vz = 4.5;
      this.ball.isAirborne = true;
      this.ball.isOverpowered = true;

      if (isSpecial) {
        this.ball.spin = (Math.random() > 0.5 ? 9.5 : -9.5);
        this.ball.isSpecialCurve = true;
        this.bannerMessage = 'VIOLENTLY CURVED LONG PASS! UNREACHABLE!';
        audio.playOverpoweredKick();
      } else {
        this.ball.spin = (Math.random() - 0.5) * 3.0;
        this.ball.isSpecialCurve = false;
        this.bannerMessage = 'UNCATCHABLE LONG PASS! OVERCOOKED!';
        audio.playOverpoweredKick();
      }
    } else {
      // NORMAL / CONTROLLED LONG PASS:
      const passAngle = player.facingAngle;
      const passDist = 200 + power * 280;
      let targetX = player.x + Math.cos(passAngle) * passDist;
      let targetY = player.y + Math.sin(passAngle) * passDist;

      if (acc.isDefenderTouching) {
        // -50% accuracy under defender contact
        targetX += (Math.random() - 0.5) * 60 * (acc.errorSpreadMultiplier * 0.5);
        targetY += (Math.random() - 0.5) * 60 * (acc.errorSpreadMultiplier * 0.5);
      }

      const tdx = targetX - player.x;
      const tdy = targetY - player.y;
      const tdist = Math.hypot(tdx, tdy) || 1;

      const speed = 5.2 + power * 3.6;
      this.ball.vx = (tdx / tdist) * speed;
      this.ball.vy = (tdy / tdist) * speed;

      if (acc.isRunning) {
        this.ball.vx += player.vx * 0.18;
        this.ball.vy += player.vy * 0.18;
      }

      this.ball.vz = 2.6 + power * 2.0;
      this.ball.spinY = 1.6;
      this.ball.isAirborne = true;
      this.ball.isOverpowered = false;

      if (isSpecial) {
        this.ball.spin = (passAngle > 0 ? 5.5 : -5.5);
        this.ball.isSpecialCurve = true;
        this.bannerMessage = acc.isDefenderTouching ? 'CURVED LONG PASS UNDER PRESSURE (-50% ACCURACY)' : 'CURVED TRIVELA PASS! [Q]';
        audio.playSpecialCurveKick();
      } else {
        this.ball.spin = (Math.random() - 0.5) * 2.6;
        this.ball.isSpecialCurve = false;
        audio.playKick(0.7 + power * 0.3);
        if (acc.isDefenderTouching) {
          this.bannerMessage = 'LONG PASS UNDER DEFENDER PRESSURE (-50% ACCURACY)';
        } else if (power >= 0.75) {
          this.bannerMessage = 'PERFECT THROUGH BALL! (MAX OUTPUT)';
        } else if (acc.isRunning) {
          this.bannerMessage = 'THROUGH BALL ON THE RUN!';
        } else {
          this.bannerMessage = 'THROUGH BALL INTO SPACE!';
        }
      }

      // Alert nearest forward/winger to sprint to that space!
      let bestMate: Player | null = null;
      let closestDist = Infinity;
      for (const m of this.players) {
        if (m.team === player.team && m.id !== player.id) {
          const d = Math.hypot(m.x - targetX, m.y - targetY);
          if (d < closestDist) {
            closestDist = d;
            bestMate = m;
          }
        }
      }
      if (bestMate) {
        bestMate.targetX = targetX;
        bestMate.targetY = targetY;
      }
    }
    this.bannerTimer = 70;
  }

  /**
   * A: Power shot towards rival goal with realistic curl, dip, overpowered stands outcome, or E-knuckleball
   * Supports shooting while running, standing precision bonus, and -50% accuracy under defender contact.
   */
  private executeShot(player: Player, power: number = 0.5, isSpecial: boolean = false, isKnuckle: boolean = false, keys?: KeyState) {
    if (this.matchPhase === 'kickoff_ready') {
      this.matchPhase = 'in_play';
    }

    const acc = this.evaluateKickAccuracy(player, keys);

    // "the shoots should always go towards the goal... the ball should go pretty far at high power shoots, all shoots should go near the goal, the power is how strong the ball goes, not how far, only if you breach the limit it goes outside bounds or further away than the target."
    if (isSpecial) {
      player.action = 'special_curl_shot';
      player.actionTimer = 22;
    } else if (isKnuckle) {
      player.action = 'knuckle_shot';
      player.actionTimer = 20;
    } else if (power < 0.60) {
      player.action = acc.isRunning ? 'running_shot_low' : 'standing_shot_low';
      player.actionTimer = acc.isRunning ? 14 : 12;
    } else if (power <= 0.70) {
      player.action = acc.isRunning ? 'running_shot_mid' : 'standing_shot_mid';
      player.actionTimer = acc.isRunning ? 18 : 16;
    } else {
      player.action = acc.isRunning ? 'running_shot_high' : 'standing_shot_high';
      player.actionTimer = acc.isRunning ? 23 : 21;
    }
    player.animFrame = 0;

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.lastKickAction = 'shoot';
    this.ball.lastKickPower = power;
    this.ball.isDividedBall = true;
    this.ball.isKnuckle = isKnuckle;

    const isHome = player.team === 'home';
    const targetGoalY = isHome ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
    const dirY = isHome ? -1 : 1;

    // Target is ALWAYS within or skimming the opposing goal mouth (between the posts)
    let aimX = PITCH_CONFIG.CENTER_X;
    if (keys?.ArrowLeft) {
      aimX = PITCH_CONFIG.CENTER_X - 48; // Aim towards left post / corner
    } else if (keys?.ArrowRight) {
      aimX = PITCH_CONFIG.CENTER_X + 48; // Aim towards right post / corner
    } else {
      aimX = PITCH_CONFIG.CENTER_X;
    }

    // ACCURACY ADJUSTMENT:
    // Standing: pristine precision directly on target (±6px)
    // Running: natural motion variance (±16px) + momentum
    // Defender touching: lower accuracy by 50% (spread up to ±44px)
    if (acc.isStanding) {
      aimX += (Math.random() - 0.5) * 8;
    } else if (acc.isRunning) {
      aimX += (Math.random() - 0.5) * 16 + (player.vx * 0.28);
    }

    if (acc.isDefenderTouching) {
      aimX += (Math.random() - 0.5) * 44 * (acc.errorSpreadMultiplier * 0.5);
    }

    if (isKnuckle) {
      this.ball.spin = 0; // Strictly no curve
      this.ball.spinY = 0;
      this.ball.isSpecialCurve = false;

      audio.playKnuckleStrike(power);

      if (power >= 0.90) {
        // Burgundy Overpower:
        // "when overpower the hit never comes back down it just keeps going up and to the stands"
        const blastSpeed = 27.0 + Math.random() * 3.5;
        const dx = (aimX + (Math.random() - 0.5) * 60) - player.x;
        const dy = targetGoalY - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.ball.vx = (dx / dist) * blastSpeed;
        this.ball.vy = (dy / dist) * blastSpeed;
        this.ball.vz = 9.2; // Sky-high flight over crossbar into grandstands
        this.ball.isAirborne = true;
        this.ball.isOverpowered = true;
        this.bannerMessage = 'KNUCKLE BLAST TO THE STANDS! (BURGUNDY OVERPOWER)';
        audio.playCrowdGasp();
      } else {
        const dx = aimX - player.x;
        const dy = targetGoalY - player.y;
        const dist = Math.hypot(dx, dy) || 1;

        // High power shoots go fast and reach the goal with immense velocity
        let shotSpeed = (17.0 + power * 11.0) * (player.stats.shotPower / 4.4);
        if (acc.isDefenderTouching) {
          shotSpeed *= 0.90; // Physical contact slightly impedes strike
        }

        this.ball.vx = (dx / dist) * shotSpeed;
        this.ball.vy = (dy / dist) * shotSpeed;

        if (acc.isRunning) {
          this.ball.vx += player.vx * 0.16;
          this.ball.vy += player.vy * 0.16;
        }

        this.ball.isAirborne = true;
        this.ball.isOverpowered = false;

        if (power < 0.50) {
          // "at lower potency it bounds off the ground and keeps going still more powerful than normal shoots"
          this.ball.vz = 0.9;
          this.bannerMessage = acc.isDefenderTouching ? 'KNUCKLE SHOT UNDER PRESSURE (-50% ACCURACY)' : 'SKIDDING GROUND KNUCKLE! [E]';
        } else {
          // "ball goes up then falls down, no curve, more powerful"
          this.ball.vz = 2.4 + power * 1.8;
          if (acc.isDefenderTouching) {
            this.bannerMessage = 'KNUCKLE ROCKET UNDER PRESSURE (-50% ACCURACY)';
          } else {
            this.bannerMessage = power >= 0.75 ? 'DIPPING KNUCKLE ROCKET! (RED MAX)' : 'KNUCKLEBALL STRIKE! [E]';
          }
        }
      }
    } else if (power >= 0.90) {
      // OVERPOWERED (Red / Purplish Black):
      const blastSpeed = 28.0 + Math.random() * 3.5;
      const dx = (aimX + (Math.random() - 0.5) * 70) - player.x;
      const dy = targetGoalY - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.ball.vx = (dx / dist) * blastSpeed;
      this.ball.vy = (dy / dist) * blastSpeed;
      this.ball.vz = 9.8; // Continues high over crossbar into stands
      this.ball.isAirborne = true;
      this.ball.isOverpowered = true;

      if (isSpecial) {
        const curveDir = player.x < PITCH_CONFIG.CENTER_X ? 8.5 : -8.5;
        this.ball.spin = curveDir;
        this.ball.isSpecialCurve = true;
        this.bannerMessage = 'VIOLENT SWERVE INTO THE STANDS! (OVERHIT)';
        audio.playOverpoweredKick();
        audio.playCrowdGasp();
      } else {
        this.ball.spin = (Math.random() - 0.5) * 3.0;
        this.ball.isSpecialCurve = false;
        this.bannerMessage = 'BLASTED INTO THE STANDS! (OVERHIT)';
        audio.playOverpoweredKick();
        audio.playCrowdGasp();
      }
    } else {
      // NORMAL / CONTROLLED SHOT: Always towards the goal!
      const dx = aimX - player.x;
      const dy = targetGoalY - player.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Power determines speed and impact force
      let shotSpeed = (16.0 + power * 11.5) * (player.stats.shotPower / 4.5);
      if (acc.isDefenderTouching) {
        shotSpeed *= 0.90; // Contested strike
      }

      this.ball.vx = (dx / dist) * shotSpeed;
      this.ball.vy = (dy / dist) * shotSpeed;

      if (acc.isRunning) {
        this.ball.vx += player.vx * 0.16;
        this.ball.vy += player.vy * 0.16;
      }

      this.ball.vz = 1.6 + power * 2.2;
      this.ball.isAirborne = true;
      this.ball.isOverpowered = false;

      if (isSpecial) {
        let shotSpin = 0;
        if (player.x < PITCH_CONFIG.CENTER_X || keys?.ArrowRight) {
          shotSpin = 4.6; // Controlled banana curl towards corners
        } else {
          shotSpin = -4.6;
        }
        this.ball.spin = shotSpin;
        this.ball.spinY = -1.2;
        this.ball.isSpecialCurve = true;
        this.bannerMessage = acc.isDefenderTouching ? 'CURVED STRIKE UNDER PRESSURE (-50% ACCURACY)' : 'BANANA BEND STRIKE! [Q SPECIAL]';
        audio.playSpecialCurveKick();
      } else {
        let shotSpin = 0;
        if (player.x < PITCH_CONFIG.CENTER_X - 50 || keys?.ArrowRight) {
          shotSpin = 2.4;
        } else if (player.x > PITCH_CONFIG.CENTER_X + 50 || keys?.ArrowLeft) {
          shotSpin = -2.4;
        } else {
          shotSpin = (Math.random() - 0.5) * 1.5;
        }
        this.ball.spin = shotSpin;
        this.ball.spinY = -0.8;
        this.ball.isSpecialCurve = false;
        audio.playKick(0.7 + power * 0.4);

        if (acc.isDefenderTouching) {
          this.bannerMessage = 'SHOT UNDER DEFENDER PRESSURE (-50% ACCURACY)';
        } else if (power >= 0.75) {
          this.bannerMessage = acc.isStanding ? 'CLEAN POWER STRIKE! (HIGH ACCURACY)' : 'ROCKET STRIKE ON THE RUN!';
        } else if (acc.isRunning) {
          this.bannerMessage = `${player.name.toUpperCase()} STRIKES ON THE RUN!`;
        } else {
          this.bannerMessage = `${player.name.toUpperCase()} STRIKES! (STANDING ACCURACY)`;
        }
      }
    }
    this.bannerTimer = 70;
  }

  /**
   * D: Cross high curling ball towards opposing team's box with Q-curl, overpowered out-of-stands outcome, or E-drilled low cross
   * Supports crossing on the run, standing accuracy, and -50% accuracy under defender contact.
   */
  private executeCross(player: Player, power: number = 0.5, isSpecial: boolean = false, isKnuckle: boolean = false, keys?: KeyState) {
    if (this.matchPhase === 'kickoff_ready') {
      this.matchPhase = 'in_play';
    }

    const acc = this.evaluateKickAccuracy(player, keys);

    // "The crosses should always head in the direction of the opossing team's box... the crosses should always move towards the opossing team's box, the power is how strong the ball goes, not how far, only if you breach the limit it goes outside bounds or further away than the target."
    if (power < 0.60) {
      player.action = acc.isRunning ? 'running_cross_low' : 'standing_cross_low';
      player.actionTimer = acc.isRunning ? 14 : 12;
    } else if (power <= 0.70) {
      player.action = acc.isRunning ? 'running_cross_mid' : 'standing_cross_mid';
      player.actionTimer = acc.isRunning ? 18 : 16;
    } else {
      player.action = acc.isRunning ? 'running_cross_high' : 'standing_cross_high';
      player.actionTimer = isKnuckle ? 24 : (acc.isRunning ? 21 : 19);
    }
    player.animFrame = 0;

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.lastKickAction = 'cross';
    this.ball.lastKickPower = power;
    this.ball.isDividedBall = true;
    this.ball.isKnuckle = isKnuckle;

    const isHome = player.team === 'home';
    const fromLeftWing = player.x < PITCH_CONFIG.CENTER_X;

    // Opposing team's penalty box center coordinates
    let targetBoxX = PITCH_CONFIG.CENTER_X;
    let targetBoxY = isHome ? PITCH_CONFIG.PITCH_TOP + 115 : PITCH_CONFIG.PITCH_BOTTOM - 115;

    // Directional arrow fine-tuning towards near post, penalty spot, or far post inside the box
    if (keys?.ArrowLeft) {
      targetBoxX -= 65;
    } else if (keys?.ArrowRight) {
      targetBoxX += 65;
    }

    if (keys?.ArrowUp) {
      targetBoxY += isHome ? -45 : 45; // deeper towards 6-yard box
    } else if (keys?.ArrowDown) {
      targetBoxY += isHome ? 45 : -45; // towards penalty spot / top of box
    }

    // Apply accuracy penalty if defender is touching
    if (acc.isDefenderTouching) {
      targetBoxX += (Math.random() - 0.5) * 50 * (acc.errorSpreadMultiplier * 0.5);
      targetBoxY += (Math.random() - 0.5) * 35 * (acc.errorSpreadMultiplier * 0.5);
    }

    const dx = targetBoxX - player.x;
    const dy = targetBoxY - player.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (isKnuckle) {
      this.ball.spin = 0;
      this.ball.spinY = 0;
      this.ball.isSpecialCurve = false;

      if (power >= 0.90) {
        // Burgundy Overpower: elevates high and blasts out past the far wing into the stands
        const overSpeed = 23.0;
        const overX = fromLeftWing ? PITCH_CONFIG.PITCH_RIGHT + 140 : PITCH_CONFIG.PITCH_LEFT - 140;
        const odx = overX - player.x;
        const ody = targetBoxY - player.y;
        const odist = Math.hypot(odx, ody) || 1;
        this.ball.vx = (odx / odist) * overSpeed;
        this.ball.vy = (ody / odist) * overSpeed;
        this.ball.vz = 8.8;
        this.ball.isAirborne = true;
        this.ball.isOverpowered = true;
        this.bannerMessage = 'BLASTED DRIVEN CROSS TO STANDS! (BURGUNDY)';
        audio.playCrowdGasp();
        audio.playOverpoweredKick();
      } else {
        // High power = strong/fast delivery towards opposing box
        const speed = (15.5 + power * 6.5) * (player.stats.shotPower / 4.4);
        this.ball.vx = (dx / dist) * speed;
        this.ball.vy = (dy / dist) * speed;

        if (acc.isRunning) {
          this.ball.vx += player.vx * 0.16;
          this.ball.vy += player.vy * 0.16;
        }

        this.ball.isAirborne = true;
        this.ball.isOverpowered = false;

        if (acc.isDefenderTouching) {
          this.ball.vz = 2.5;
          this.bannerMessage = 'CROSS UNDER DEFENDER PRESSURE (-50% ACCURACY)';
        } else if (power >= 0.75) {
          this.ball.vz = 3.6; // Driven elevated cross
          audio.playKnuckleStrike(0.9);
          this.bannerMessage = 'WHIPPED ELEVATED DRIVEN CROSS! (RED MAX)';
        } else {
          this.ball.vz = 0.8 + power * 0.4; // Low driven skim across turf into box
          audio.playKnuckleStrike(0.7);
          this.bannerMessage = 'DEADLY LOW DRILLED CROSS! [E]';
        }
      }
    } else if (power >= 0.90) {
      // OVERPOWERED (Red / Purplish Black):
      const overSpeed = 22.5;
      const overX = fromLeftWing ? PITCH_CONFIG.PITCH_RIGHT + 150 : PITCH_CONFIG.PITCH_LEFT - 150;
      const odx = overX - player.x;
      const ody = targetBoxY - player.y;
      const odist = Math.hypot(odx, ody) || 1;
      this.ball.vx = (odx / odist) * overSpeed;
      this.ball.vy = (ody / odist) * overSpeed;
      this.ball.vz = 8.4;
      this.ball.isAirborne = true;
      this.ball.isOverpowered = true;

      if (isSpecial) {
        this.ball.spin = fromLeftWing ? 8.2 : -8.2;
        this.ball.isSpecialCurve = true;
        this.bannerMessage = 'VIOLENT HOOK CROSS INTO FAR STANDS!';
      } else {
        this.ball.spin = fromLeftWing ? 4.5 : -4.5;
        this.ball.isSpecialCurve = false;
        this.bannerMessage = 'OVERHIT CROSS! OUT TO THE STANDS!';
      }
      audio.playOverpoweredKick();
      audio.playCrowdGasp();
    } else {
      // NORMAL / CONTROLLED CROSS: Directly heads into opposing team's box!
      const speed = (15.0 + power * 6.5) * (player.stats.shotPower / 4.5);
      this.ball.vx = (dx / dist) * speed;
      this.ball.vy = (dy / dist) * speed;

      if (acc.isRunning) {
        this.ball.vx += player.vx * 0.16;
        this.ball.vy += player.vy * 0.16;
      }

      this.ball.vz = 3.6 + power * 1.6;
      this.ball.spinY = 1.8;
      this.ball.isAirborne = true;
      this.ball.isOverpowered = false;

      if (acc.isDefenderTouching) {
        this.bannerMessage = 'CROSS UNDER DEFENDER PRESSURE (-50% ACCURACY)';
      } else if (isSpecial) {
        const crossSpin = fromLeftWing ? 5.2 : -5.2;
        this.ball.spin = crossSpin;
        this.ball.isSpecialCurve = true;
        this.bannerMessage = 'WHIPPED SPECIAL IN-SWINGER! [Q]';
        audio.playSpecialCurveKick();
      } else {
        const crossSpin = fromLeftWing ? 3.0 : -3.0;
        this.ball.spin = crossSpin;
        this.ball.isSpecialCurve = false;
        audio.playKick(0.65 + power * 0.35);
        if (power >= 0.75) {
          this.bannerMessage = 'PERFECT WHIPPED CROSS! (MAX OUTPUT)';
        } else if (acc.isRunning) {
          this.bannerMessage = 'WHIPPED CROSS ON THE RUN!';
        } else {
          this.bannerMessage = 'WHIPPED CROSS INTO THE BOX! (HIGH ACCURACY)';
        }
      }
    }
    this.bannerTimer = 70;
  }

  /**
   * S (Without ball): Standing tackle
   */
  /**
   * Checks whether the ball-carrier's physical body is directly blocking the defender's reach to the ball
   * "if they place their body in front you can't reach the ball so the opossing player's body can block your path"
   */
  public isBodyBlockingBall(defender: Player, carrier: Player): boolean {
    const dDefToBall = Math.hypot(this.ball.x - defender.x, this.ball.y - defender.y);
    const dDefToCarrier = Math.hypot(carrier.x - defender.x, carrier.y - defender.y);

    if (carrier.isShielding) {
      // When shielding [Q], the carrier actively positions their back between defender and ball
      return dDefToCarrier < dDefToBall + 8;
    }

    if (dDefToCarrier >= dDefToBall) {
      // Ball is closer to defender than carrier's center (ball is exposed on defender's side)
      return false;
    }

    // Project carrier onto line segment from defender to ball
    const segX = this.ball.x - defender.x;
    const segY = this.ball.y - defender.y;
    const lenSq = segX * segX + segY * segY;
    if (lenSq === 0) return false;

    const t = Math.max(0, Math.min(1, ((carrier.x - defender.x) * segX + (carrier.y - defender.y) * segY) / lenSq));
    const projX = defender.x + t * segX;
    const projY = defender.y + t * segY;
    const distToLine = Math.hypot(carrier.x - projX, carrier.y - projY);

    // Carrier body blocking radius: 14px
    return distToLine <= 14 && t > 0.05 && t < 0.95;
  }

  /**
   * Defender touches the ball from an opposing player without body obstruction:
   * Defender tries to tap the ball away, freeing it into open space ("Divided Ball")
   * "make it so that if you touch the ball from an opossing player your player tries to tap it away from them"
   */
  public executeBallTapAway(defender: Player, carrier: Player) {
    if (carrier.role === 'GK') return;

    this.ball.ownerId = null;
    this.ball.isDividedBall = true;
    this.ball.lastTouchTeam = defender.team;
    this.ball.lastTouchPlayerId = defender.id;

    // Tap/poke velocity away from defender into contested space
    const pokeAngle = Math.atan2(this.ball.y - defender.y, this.ball.x - defender.x);
    this.ball.vx = Math.cos(pokeAngle) * 4.6;
    this.ball.vy = Math.sin(pokeAngle) * 4.6;
    this.ball.vz = 0.3;

    audio.playKick(0.5);
    this.setBanner(`BALL POKED FREE BY ${defender.name.toUpperCase()}!`, 65);
  }

  /**
   * Resolves physical tackle contact between tackler and ball-carrier:
   * - Sliding from behind: tries to place leg in front; mistimed kicks opponent from behind -> CLEAR RED CARD!
   * - Standing from behind: tries to place leg in front; mistimed kicks legs -> FOUL + YELLOW CARD!
   * - From sides and front: sliding and standing are MUCH MORE EFFECTIVE!
   * - Body blocking: if carrier places body in front, defender cannot reach the ball!
   */
  public resolveTackleContact(tackler: Player, victim: Player, isSlide: boolean): boolean {
    if (victim.role === 'GK' || victim.action === 'fouled_falling' || victim.isRedCarded) return false;

    // Relative angle from victim to tackler
    const angleVictimToTackler = Math.atan2(tackler.y - victim.y, tackler.x - victim.x);
    let relAngle = angleVictimToTackler - victim.facingAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const isFromBehind = Math.abs(relAngle) > 2.0; // > ~115 degrees (approaching from rear)
    const isFromSide = Math.abs(relAngle) >= 0.85 && Math.abs(relAngle) <= 2.0;
    const isFromFront = Math.abs(relAngle) < 0.85;

    const isBodyBlocking = this.isBodyBlockingBall(tackler, victim);

    // Rule: Cannot take ball from step-over with a tackle without a foul
    if (victim.isStepOverActive) {
      const seen = isIncidentSeenByReferee(this.referee, victim.x, victim.y);
      if (seen) {
        this.awardFoul(victim, victim.x, victim.y, tackler, isSlide ? 'yellow' : 'yellow');
        this.setBanner(t('illegalTackleOnStepover'), 140);
      } else {
        this.setBanner(t('refMissedIt'), 75);
      }
      return false;
    }

    if (isSlide) {
      // --- SLIDING TACKLE ---
      if (isFromBehind) {
        // "sliding tackle from behind the player tries to come a bit from a side and place the leg in front to cut the ball,
        // it misstimed it kicks the opponent from behind resuklting in a clear red"
        const isDirectBehind = Math.abs(relAngle) > 2.55;
        const tackleSkill = tackler.stats.tackling || 75;
        // Clean cut chance is low from behind; requires angled entry & timing
        const cleanCutChance = isDirectBehind ? 0.08 : (isBodyBlocking ? 0.12 : (tackleSkill > 82 ? 0.35 : 0.22));

        if (Math.random() < cleanCutChance && !victim.isShielding) {
          // Perfectly timed slide hook around side! Cuts ball in front
          this.ball.ownerId = null;
          this.ball.isDividedBall = true;
          this.ball.vx = tackler.slideVelocityX * 0.75;
          this.ball.vy = tackler.slideVelocityY * 0.75;
          this.ball.lastTouchTeam = tackler.team;
          this.ball.lastTouchPlayerId = tackler.id;
          this.setBanner(`CLEAN SLIDE HOOK FROM BEHIND!`, 80);
          audio.playKick(0.8);
          return true;
        } else {
          // MISTIMED! Kicks the opponent from behind -> CLEAR RED CARD!
          victim.action = 'fouled_falling';
          victim.actionTimer = 55;
          victim.vx = tackler.slideVelocityX * 0.45;
          victim.vy = tackler.slideVelocityY * 0.45;
          if (this.ball.ownerId === victim.id) {
            this.ball.ownerId = null;
            this.ball.isDividedBall = true;
          }
          const seen = isIncidentSeenByReferee(this.referee, victim.x, victim.y);
          if (seen) {
            this.awardFoul(victim, victim.x, victim.y, tackler, 'red');
            this.setBanner(`RED CARD FOR ${tackler.name.toUpperCase()}! DANGEROUS SLIDE FROM BEHIND!`, 180);
          } else {
            this.setBanner(t('refMissedIt'), 75);
          }
          return false;
        }
      } else {
        // SLIDING FROM SIDES OR FRONT: MUCH MORE EFFECTIVE!
        const cleanChance = isBodyBlocking ? 0.60 : 0.92;
        if (Math.random() < cleanChance) {
          this.ball.ownerId = null;
          this.ball.isDividedBall = true;
          this.ball.vx = tackler.slideVelocityX * 0.85;
          this.ball.vy = tackler.slideVelocityY * 0.85;
          this.ball.lastTouchTeam = tackler.team;
          this.ball.lastTouchPlayerId = tackler.id;
          this.setBanner(isFromFront ? `FRONT SLIDE BLOCK!` : `SIDE SLIDE HOOK!`, 65);
          audio.playKick(0.75);
          return true;
        } else {
          // Clumsy foul
          victim.action = 'fouled_falling';
          victim.actionTimer = 45;
          if (this.ball.ownerId === victim.id) this.ball.ownerId = null;
          const seen = isIncidentSeenByReferee(this.referee, victim.x, victim.y);
          if (seen) {
            this.awardFoul(victim, victim.x, victim.y, tackler, 'yellow');
          }
          return false;
        }
      }
    } else {
      // --- STANDING TACKLE ---
      if (isFromBehind) {
        // "for standing from behind the player will try to place the leg in front of the opponent from behind coming from a side
        // misttime means you kick their legs, leads to a foul sometimes even a yellow"
        const isDirectBehind = Math.abs(relAngle) > 2.5;
        const cleanChance = isDirectBehind ? 0.15 : (isBodyBlocking ? 0.20 : 0.40);

        if (Math.random() < cleanChance && !victim.isShielding) {
          // Successfully places leg in front from side and pokes the ball
          this.executeBallTapAway(tackler, victim);
          this.setBanner(`POKED FREE FROM BEHIND!`, 65);
          return true;
        } else {
          // Mistimed: kicks their legs from behind! Leads to foul + yellow card
          victim.action = 'fouled_falling';
          victim.actionTimer = 50;
          victim.vx = (victim.x - tackler.x) * 0.18;
          victim.vy = (victim.y - tackler.y) * 0.18;
          if (this.ball.ownerId === victim.id) {
            this.ball.ownerId = null;
            this.ball.isDividedBall = true;
          }
          const seen = isIncidentSeenByReferee(this.referee, victim.x, victim.y);
          if (seen) {
            this.awardFoul(victim, victim.x, victim.y, tackler, 'yellow');
            this.setBanner(`FOUL FROM BEHIND! YELLOW CARD FOR ${tackler.name.toUpperCase()}!`, 150);
          } else {
            this.setBanner(t('refMissedIt'), 75);
          }
          return false;
        }
      } else {
        // STANDING TACKLE FROM SIDES OR FRONT: MUCH MORE EFFECTIVE!
        if (isBodyBlocking) {
          // Carrier places body in front: defender cannot reach through!
          this.setBanner(`BODY BLOCKED BY ${victim.name.toUpperCase()}!`, 55);
          return false;
        }
        // Clean strip or tap away
        this.ball.ownerId = tackler.id;
        this.ball.lastTouchTeam = tackler.team;
        this.ball.lastTouchPlayerId = tackler.id;
        this.setBanner(isFromFront ? `FRONT STANDING BLOCK!` : `SIDE STANDING STRIP!`, 60);
        audio.playKick(0.6);
        return true;
      }
    }
  }

  /**
   * S (Without ball): Standing tackle with lunging block & angle resolution
   */
  private executeStandingTackle(player: Player) {
    player.action = 'standing_tackle';
    player.actionTimer = 16;
    audio.playKick(0.35);

    // Check if opponent with ball is within 34px
    const opp = this.players.find(p => p.team !== player.team && this.ball.ownerId === p.id && !p.isRedCarded);
    if (opp) {
      const dist = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (dist < 34) {
        this.resolveTackleContact(player, opp, false);
      }
    }
  }

  /**
   * D (Without ball): Sliding tackle with hooked leg sweep & angle resolution
   */
  private executeSlidingTackle(player: Player) {
    player.action = 'sliding_tackle';
    player.actionTimer = PHYSICS.TACKLE_DURATION;

    const slideAngle = player.facingAngle;
    player.slideVelocityX = Math.cos(slideAngle) * PHYSICS.TACKLE_SLIDE_SPEED;
    player.slideVelocityY = Math.sin(slideAngle) * PHYSICS.TACKLE_SLIDE_SPEED;

    audio.playSlide();

    // Turf particles from slide
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: player.x - Math.cos(slideAngle) * 8,
        y: player.y - Math.sin(slideAngle) * 8,
        z: 0,
        vx: -Math.cos(slideAngle) * 2 + (Math.random() - 0.5),
        vy: -Math.sin(slideAngle) * 2 + (Math.random() - 0.5),
        vz: Math.random() * 2.8,
        color: '#2a5e1e',
        life: 0,
        maxLife: 22,
        size: 2.5,
      });
    }

    // Check collision with ball carrier
    const opp = this.players.find(p => p.team !== player.team && this.ball.ownerId === p.id && !p.isRedCarded);
    if (opp) {
      const dist = Math.hypot(opp.x - player.x, opp.y - player.y);
      if (dist < 40) {
        this.resolveTackleContact(player, opp, true);
      }
    }
  }

  /**
   * A (Without ball): Clear the ball up the pitch with massive high clearance animation!
   */
  private executeClearance(player: Player) {
    const dist = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    if (dist < 42) {
      player.action = 'clearing';
      player.actionTimer = 20;
      this.ball.ownerId = null;
      this.ball.lastTouchTeam = player.team;
      this.ball.lastTouchPlayerId = player.id;
      this.ball.lastKickAction = 'clearance';
      this.ball.lastKickPower = 0.90;
      this.ball.isDividedBall = true;

      // Clear upwards towards rival half
      const clearDirY = player.team === 'home' ? -1 : 1;
      this.ball.vx = (Math.random() - 0.5) * 4;
      this.ball.vy = clearDirY * 9.5;
      this.ball.vz = 6.2; // Massive towering high clearing boot!
      this.ball.isAirborne = true;

      this.bannerMessage = 'HOOFED CLEAR OF DANGER!';
      this.bannerTimer = 75;
      audio.playKick(1.0);
    }
  }

  /**
   * W (Without ball): Push opponent AKA foul them with emphatic two-handed shove animation!
   */
  private executePushFoul(player: Player) {
    // Find closest opponent
    let closestOpp: Player | null = null;
    let closestDist = Infinity;
    for (const opp of this.players) {
      if (opp.team !== player.team && opp.action !== 'fouled_falling' && !opp.isRedCarded) {
        const d = Math.hypot(opp.x - player.x, opp.y - player.y);
        if (d < closestDist) {
          closestDist = d;
          closestOpp = opp;
        }
      }
    }

    if (closestOpp && closestDist < 40) {
      // Execute push! Pusher plays the aggressive shove animation
      player.action = 'pushing_foul';
      player.actionTimer = 18;

      // Knock opponent down with dramatic stumble & turf tumble
      closestOpp.action = 'fouled_falling';
      closestOpp.actionTimer = PHYSICS.FOUL_KNOCKDOWN_DURATION;
      closestOpp.vx = (closestOpp.x - player.x) * 0.32;
      closestOpp.vy = (closestOpp.y - player.y) * 0.32;

      // Strip ball if opponent had it -> becomes divided ball
      if (this.ball.ownerId === closestOpp.id) {
        this.ball.ownerId = null;
        this.ball.isDividedBall = true;
        this.ball.vx = (Math.random() - 0.5) * 3;
        this.ball.vy = (Math.random() - 0.5) * 3;
      }

      audio.playFoul();

      // Check if referee sees the push!
      const seen = isIncidentSeenByReferee(this.referee, player.x, player.y);
      if (seen) {
        this.awardFoul(closestOpp, closestOpp.x, closestOpp.y, player, 'yellow');
        this.setBanner(`FOUL! DELIBERATE PUSH BY ${player.name.toUpperCase()}!`, 120);
      } else {
        this.setBanner(t('refMissedIt'), 80);
      }
    }
  }

  public awardFoul(
    victim: Player,
    foulX: number,
    foulY: number,
    offender?: Player,
    cardType: 'yellow' | 'red' | 'none' = 'yellow'
  ) {
    this.referee.whistleTimer = 45;
    this.referee.x = foulX + 25;
    this.referee.y = foulY - 15;
    audio.playWhistle(true);
    audio.playFoul();

    let isRed = cardType === 'red';

    if (offender) {
      if (cardType === 'yellow') {
        if (offender.hasYellowCard) {
          // Second yellow card -> RED!
          isRed = true;
        } else {
          offender.hasYellowCard = true;
          this.referee.cardDisplay = 'yellow';
          this.referee.cardPlayerName = offender.name;
        }
      }

      if (isRed) {
        offender.isRedCarded = true;
        this.referee.cardDisplay = 'red';
        this.referee.cardPlayerName = offender.name;

        // Sent off to sideline / dugout
        offender.x = PITCH_CONFIG.PITCH_LEFT - 75;
        offender.y = PITCH_CONFIG.CENTER_Y;
        offender.vx = 0;
        offender.vy = 0;
        offender.action = 'idle';

        // Auto-switch user control if offender was controlled
        if (this.userControlledPlayerId === offender.id) {
          const nextMate = this.players.find(p => p.team === offender.team && !p.isRedCarded && p.role !== 'GK');
          if (nextMate) {
            this.userControlledPlayerId = nextMate.id;
            this.updateUserControlledFlag();
          }
        }
      }
    }

    const victimTeam = victim.team;
    const isVictimAttackingUp = victimTeam === 'home';
    const isInsideBox = isInsideDefendingPenaltyBox(foulX, foulY, isVictimAttackingUp);
    const teamName = victimTeam === 'home' ? HOME_KIT.name.toUpperCase() : AWAY_KIT.name.toUpperCase();
    const cardText = isRed ? 'RED CARD' : cardType === 'yellow' ? 'YELLOW CARD' : 'FOUL';

    if (isInsideBox) {
      setupPenalty(this, victimTeam);
      this.setBanner(`PENALTY FOR ${teamName}! ${cardText} FOR ${offender ? offender.name.toUpperCase() : 'DEFENDER'}!`, 180);
    } else {
      setupFreeKick(this, victimTeam, foulX, foulY);
      this.setBanner(`FREE KICK FOR ${teamName}! ${cardText} FOR ${offender ? offender.name.toUpperCase() : 'DEFENDER'}!`, 180);
    }
  }

  public setBanner(message: string, timer: number = 90) {
    this.bannerMessage = message;
    this.bannerTimer = timer;
  }

  /**
   * Header contest when ball is in the air
   */
  private executeHeader(player: Player) {
    player.action = 'heading';
    player.actionTimer = 16;

    const targetGoalY = player.team === 'home' ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM;
    const dx = PITCH_CONFIG.CENTER_X - player.x;
    const dy = targetGoalY - player.y;
    const dist = Math.hypot(dx, dy);

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    this.ball.vx = (dx / dist) * 6.5;
    this.ball.vy = (dy / dist) * 6.5;
    this.ball.vz = -2.2; // Downward forehead snap towards turf!
    this.ball.z = 20;
    this.ball.spin = (Math.random() - 0.5) * 2.0;
    this.ball.spinY = -1.6; // Topspin driven down into the net!

    this.bannerMessage = `${player.name.toUpperCase()} HEADER!`;
    this.bannerTimer = 60;
    audio.playKick(0.7);
  }

  /**
   * Runs AI update for non-user-controlled players
   */
  private handleAI() {
    // If during a dead-ball set piece waiting for kick/throw, non-takers hold position
    if (this.setPiece && (this.matchPhase === 'penalty' || this.matchPhase === 'free_kick' || this.matchPhase === 'corner_kick' || this.matchPhase === 'goal_kick' || this.matchPhase === 'throw_in')) {
      return;
    }

    const isKickoff = this.matchPhase === 'kickoff_ready';
    const scoreDiff = this.score.away - this.score.home;

    for (const p of this.players) {
      if (p.id === this.userControlledPlayerId) continue;

      const isAttackingUp = p.team === 'home';
      const decision = updatePlayerAI(p, this.players, this.ball, isAttackingUp, this.difficulty, scoreDiff, isKickoff, this.getTimeScale());

      if (decision) {
        if (decision.action === 'shoot') {
          const isMoving = Math.hypot(p.vx, p.vy) > 0.5;
          p.action = isMoving ? 'running_shot' : 'standing_shot';
          p.actionTimer = 16;
          const tx = decision.targetX || PITCH_CONFIG.CENTER_X;
          const ty = decision.targetY || (isAttackingUp ? PITCH_CONFIG.PITCH_TOP : PITCH_CONFIG.PITCH_BOTTOM);
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          this.ball.ownerId = null;
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastKickAction = 'shoot';
          this.ball.lastKickPower = 0.80;
          this.ball.isDividedBall = true;
          this.ball.vx = (dx / dist) * 8.5;
          this.ball.vy = (dy / dist) * 8.5;
          this.ball.vz = 2.0;
          this.ball.spin = p.x < PITCH_CONFIG.CENTER_X ? 3.0 : -3.0; // AI curling shot
          this.ball.spinY = -1.0;
          this.ball.isAirborne = true;
          audio.playKick(0.9);
        } else if (decision.action === 'pass') {
          const isGK = p.role === 'GK';
          const isMoving = Math.hypot(p.vx, p.vy) > 0.5;
          p.action = isMoving ? 'running_pass' : 'standing_pass';
          p.actionTimer = isGK ? 16 : 12;
          const tx = decision.targetX || p.x;
          const ty = decision.targetY || (isAttackingUp ? p.y - 80 : p.y + 80);
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const aimAngle = Math.atan2(dy, dx);
          p.facingAngle = aimAngle;

          this.ball.ownerId = null;
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastKickAction = 'pass';
          this.ball.lastKickPower = 0.45;
          this.ball.isDividedBall = true;

          if (isGK) {
            // Position ball 32px forward outside goalkeeper pickup radius
            this.ball.x = p.x + Math.cos(aimAngle) * 32;
            this.ball.y = p.y + Math.sin(aimAngle) * 32;
            p.gkHoldTimer = -75; // Release cooldown prevents immediate re-grabbing!
          }

          const passSpeed = isGK ? 10.5 : Math.min(13.5, Math.max(8.0, dist * 0.065));
          this.ball.vx = (dx / dist) * passSpeed;
          this.ball.vy = (dy / dist) * passSpeed;
          this.ball.vz = 0.15;
          this.ball.spin = (Math.random() - 0.5) * 1.5;
          this.ball.spinY = 0;
          this.ball.isAirborne = false;
          audio.playKick(0.65);

          // Alert receiver and switch user control if Home team
          if (decision.receiverId) {
            const receiver = this.players.find(pl => pl.id === decision.receiverId);
            if (receiver) {
              receiver.targetX = decision.targetX || this.ball.x;
              receiver.targetY = decision.targetY || this.ball.y;
            }
            if (p.team === 'home') {
              this.userControlledPlayerId = decision.receiverId;
              this.updateUserControlledFlag();
              if (isGK) {
                this.setBanner(`GOALKEEPER DISTRIBUTES TO BUILD PLAY!`, 75);
              }
            }
          }
        } else if (decision.action === 'cross') {
          const isMoving = Math.hypot(p.vx, p.vy) > 0.5;
          p.action = isMoving ? 'running_cross' : 'standing_cross';
          p.actionTimer = 16;
          const tx = decision.targetX || PITCH_CONFIG.CENTER_X;
          const ty = decision.targetY || (isAttackingUp ? PITCH_CONFIG.PITCH_TOP + 150 : PITCH_CONFIG.PITCH_BOTTOM - 150);
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          this.ball.ownerId = null;
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastKickAction = 'cross';
          this.ball.lastKickPower = 0.72;
          this.ball.isDividedBall = true;
          this.ball.vx = (dx / dist) * 6.0;
          this.ball.vy = (dy / dist) * 6.0;
          this.ball.vz = 5.8;
          this.ball.spin = p.x < PITCH_CONFIG.CENTER_X ? 4.2 : -4.2; // AI inward banana cross
          this.ball.spinY = 2.4;
          this.ball.isAirborne = true;
          audio.playKick(0.8);

          if (decision.receiverId && p.team === 'home') {
            this.userControlledPlayerId = decision.receiverId;
            this.updateUserControlledFlag();
          }
        } else if (decision.action === 'kick') {
          // Goalkeeper clearance / long punt upfield to midfield
          const isGK = p.role === 'GK';
          p.action = 'kicking';
          p.actionTimer = 22;
          const tx = decision.targetX || PITCH_CONFIG.CENTER_X;
          const ty = decision.targetY || PITCH_CONFIG.CENTER_Y;
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const aimAngle = Math.atan2(dy, dx);
          p.facingAngle = aimAngle;

          this.ball.ownerId = null;
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastKickAction = 'clearance';
          this.ball.lastKickPower = 0.85;
          this.ball.isDividedBall = true;

          if (isGK) {
            // Position ball 36px forward outside goalkeeper pickup radius
            this.ball.x = p.x + Math.cos(aimAngle) * 36;
            this.ball.y = p.y + Math.sin(aimAngle) * 36;
            p.gkHoldTimer = -75; // Release cooldown prevents immediate re-grabbing!
          }

          const kickSpeed = 14.5 + Math.random() * 1.5;
          this.ball.vx = (dx / dist) * kickSpeed;
          this.ball.vy = (dy / dist) * kickSpeed;
          this.ball.vz = 6.8; // High towering aerial drop kick to midfield!
          this.ball.isAirborne = true;
          audio.playKick(0.95);

          if (isGK) {
            this.setBanner(`${p.name.toUpperCase()} PUNTS FAR TO MIDFIELD!`, 80);
          }
        } else if (decision.action === 'slide') {
          // Check if carrier is goalkeeper: cannot tackle GK!
          const ballCarrier = this.players.find(pl => pl.id === this.ball.ownerId);
          if (ballCarrier && ballCarrier.role === 'GK') {
            return;
          }
          p.action = 'sliding_tackle';
          p.actionTimer = PHYSICS.TACKLE_DURATION;
          const dx = this.ball.x - p.x;
          const dy = this.ball.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          p.slideVelocityX = (dx / dist) * PHYSICS.TACKLE_SLIDE_SPEED;
          p.slideVelocityY = (dy / dist) * PHYSICS.TACKLE_SLIDE_SPEED;
          audio.playSlide();
        } else if (decision.action === 'tackle') {
          p.action = 'standing_tackle';
          p.actionTimer = 14;
          if (this.ball.ownerId && this.ball.ownerId !== p.id) {
            const ballCarrier = this.players.find(pl => pl.id === this.ball.ownerId);
            if (ballCarrier && ballCarrier.role === 'GK') {
              // Goalkeeper cannot be tackled in possession!
              return;
            }
            if (ballCarrier && ballCarrier.isStepOverActive) {
              // "also defenders can't take the ball from a stepover with a tackle without it being a foul"
              const seen = isIncidentSeenByReferee(this.referee, ballCarrier.x, ballCarrier.y);
              if (seen) {
                this.awardFoul(ballCarrier, ballCarrier.x, ballCarrier.y, p);
                this.setBanner(t('illegalTackleOnStepover'), 140);
              } else {
                this.setBanner(t('refMissedIt'), 75);
              }
            } else if (ballCarrier && (this.powerBar.isActive || isKickingAction(ballCarrier.action)) && ballCarrier.id === this.userControlledPlayerId) {
              // The player is charging or releasing a kick while running or being closed down.
              // Defender contact is detected by evaluateKickAccuracy and lowers accuracy by 50% without canceling the kick!
            } else {
              this.ball.ownerId = p.id;
              this.ball.lastTouchTeam = p.team;
              this.ball.lastTouchPlayerId = p.id;
            }
          }
        } else if (decision.action === 'header') {
          this.executeHeader(p);
        }
      } else {
        // AI Defender rustic volley clearance for incoming aerial cross or lob
        const isDefender = p.role === 'CB1' || p.role === 'CB2' || p.role === 'LB' || p.role === 'RB';
        const inDefensiveArea = isAttackingUp ? p.y > PITCH_CONFIG.CENTER_Y : p.y < PITCH_CONFIG.CENTER_Y;
        if (isDefender && inDefensiveArea && this.ball.isAirborne && this.ball.z >= 3.0 && this.ball.z <= 28) {
          const distToAirBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
          if (distToAirBall < 24 && p.action !== 'sliding_tackle' && p.action !== 'volley') {
            executeRusticVolleyClearance(p, this.ball, this.setBanner.bind(this));
          }
        }
      }
    }
  }

  /**
   * Goalkeeper Possession Handler:
   * "when the goalkeeper has the ball it doest nothing and there iis a buggy motion there,
   * adjust it so that when the goalkeeper has the ball it eiter passes it short to a teammate
   * or kicks it far away around the middle of the pitch"
   *
   * Maintains steady composed stance holding ball in chest hands,
   * then auto-distributes after ~42 frames if user doesn't manually press S (pass) or A/W (kick).
   */
  private handleGoalkeeperPossession() {
    if (!this.ball.ownerId) return;
    const gk = this.players.find(p => p.id === this.ball.ownerId && p.role === 'GK');
    if (!gk) return;

    // Do not interfere while goalkeeper is already playing an active kick or dive animation
    if (gk.action === 'kicking' || gk.action === 'standing_pass' || gk.action === 'goalkeeper_dive') {
      return;
    }

    const isAttackingUp = gk.team === 'home';
    gk.facingAngle = isAttackingUp ? -Math.PI / 2 : Math.PI / 2;
    gk.vx = 0;
    gk.vy = 0;
    gk.action = 'idle';

    gk.gkHoldTimer = (gk.gkHoldTimer || 0) + 1;

    // After ~42 frames (~0.7s) of composed stance, automatically distribute!
    if (gk.gkHoldTimer > 42) {
      this.executeGoalkeeperDistribution(gk, isAttackingUp);
    }
  }

  /**
   * Executes clean distribution from the goalkeeper:
   * Either a crisp short ground pass to an open outfield teammate,
   * or a towering punt kick far away around the middle of the pitch.
   */
  public executeGoalkeeperDistribution(gk: Player, isAttackingUp: boolean, forceMode?: 'short' | 'long') {
    gk.gkHoldTimer = -75; // Release cooldown: prevents goalkeeper from re-grabbing its own delivery

    const chooseShort = forceMode ? forceMode === 'short' : Math.random() < 0.5;

    const teammates = this.players.filter(p => p.team === gk.team && p.id !== gk.id && p.role !== 'GK');
    let bestMate: Player | null = null;
    let bestScore = -Infinity;

    for (const m of teammates) {
      const isUpfield = isAttackingUp ? m.y < gk.y - 70 : m.y > gk.y + 70;
      if (!isUpfield) continue;

      const dist = Math.hypot(m.x - gk.x, m.y - gk.y);
      if (dist > 85 && dist < 450) {
        let oppPressure = 0;
        for (const opp of this.players) {
          if (opp.team !== gk.team) {
            const dOpp = Math.hypot(opp.x - m.x, opp.y - m.y);
            if (dOpp < 48) oppPressure++;
          }
        }
        const score = 1000 - dist - oppPressure * 260;
        if (score > bestScore) {
          bestScore = score;
          bestMate = m;
        }
      }
    }

    if (chooseShort && bestMate) {
      // Option A: Short pass to an open teammate to build play
      const dx = bestMate.x - gk.x;
      const dy = bestMate.y - gk.y;
      const dist = Math.hypot(dx, dy) || 1;
      const aimAngle = Math.atan2(dy, dx);
      gk.facingAngle = aimAngle;
      gk.action = 'standing_pass';
      gk.actionTimer = 18;

      this.ball.ownerId = null;
      this.ball.lastTouchTeam = gk.team;
      this.ball.lastTouchPlayerId = gk.id;

      // Position ball 32px forward outside goalkeeper pickup zone
      this.ball.x = gk.x + Math.cos(aimAngle) * 32;
      this.ball.y = gk.y + Math.sin(aimAngle) * 32;
      this.ball.z = 0;
      this.ball.isAirborne = false;

      const passSpeed = 10.5;
      this.ball.vx = (dx / dist) * passSpeed;
      this.ball.vy = (dy / dist) * passSpeed;
      this.ball.vz = 0.15;
      this.ball.spin = (Math.random() - 0.5) * 1.5;
      this.ball.spinY = 0;
      audio.playKick(0.7);

      if (gk.team === 'home') {
        this.userControlledPlayerId = bestMate.id;
        this.updateUserControlledFlag();
        this.setBanner(`GOALKEEPER PASSES OUT SHORT TO BUILD PLAY!`, 85);
      } else {
        this.setBanner(`${AWAY_KIT.name.toUpperCase()} GOALKEEPER PASSES SHORT`, 75);
      }
    } else {
      // Option B: Far kick around the middle of the pitch
      const midX = PITCH_CONFIG.CENTER_X + (Math.random() - 0.5) * 160;
      const midY = PITCH_CONFIG.CENTER_Y + (isAttackingUp ? 45 : -45) + (Math.random() - 0.5) * 60;
      const dx = midX - gk.x;
      const dy = midY - gk.y;
      const dist = Math.hypot(dx, dy) || 1;
      const aimAngle = Math.atan2(dy, dx);
      gk.facingAngle = aimAngle;
      gk.action = 'kicking';
      gk.actionTimer = 22;

      this.ball.ownerId = null;
      this.ball.lastTouchTeam = gk.team;
      this.ball.lastTouchPlayerId = gk.id;

      // Position ball 36px forward outside goalkeeper pickup zone
      this.ball.x = gk.x + Math.cos(aimAngle) * 36;
      this.ball.y = gk.y + Math.sin(aimAngle) * 36;
      this.ball.z = 2;
      this.ball.isAirborne = true;

      const kickSpeed = 14.5 + Math.random() * 1.5;
      this.ball.vx = (dx / dist) * kickSpeed;
      this.ball.vy = (dy / dist) * kickSpeed;
      this.ball.vz = 6.8; // High soaring aerial punt to midfield
      this.ball.spin = (Math.random() - 0.5) * 2.0;
      this.ball.spinY = -1.0;
      audio.playKick(0.95);

      if (gk.team === 'home') {
        this.setBanner(`GOALKEEPER PUNTS FAR TO MIDFIELD!`, 85);
      } else {
        this.setBanner(`${AWAY_KIT.name.toUpperCase()} GOALKEEPER CLEARS TO MIDFIELD!`, 80);
      }
    }
  }

  /**
   * Checks ball possession, physical body blocking, touch tap-aways,
   * loose ball pickups, and power-dependent interceptions ("Divided Ball" system)
   */
  private updateBallPossession() {
    if (this.ball.ownerId) {
      const owner = this.players.find(p => p.id === this.ball.ownerId);
      if (owner) {
        if (owner.isGingaLifting) {
          const fAngle = owner.facingAngle;
          const dist = 9;
          this.ball.x = owner.x + Math.cos(fAngle) * dist;
          this.ball.y = owner.y + Math.sin(fAngle) * dist;
          this.ball.z = Math.min(3.5, (owner.gingaHoldTimer || 0) * 0.05);
          this.ball.vx = owner.vx;
          this.ball.vy = owner.vy;
          return;
        }

        if (owner.role === 'GK') {
          // Goalkeeper holds ball securely in both hands at chest level with composed stance
          const fAngle = owner.facingAngle;
          const dist = 12;
          this.ball.x = owner.x + Math.cos(fAngle) * dist;
          this.ball.y = owner.y + Math.sin(fAngle) * dist;
          this.ball.z = 10;
          this.ball.vx = 0;
          this.ball.vy = 0;
          this.ball.vz = 0;
          return;
        }

        // Keep ball at player's feet slightly forward in facing direction
        const fAngle = owner.facingAngle;
        const dist = 11;
        this.ball.x = owner.x + Math.cos(fAngle) * dist;
        this.ball.y = owner.y + Math.sin(fAngle) * dist;
        this.ball.z = 0;
        this.ball.vx = owner.vx;
        this.ball.vy = owner.vy;

        // --- PHYSICALITY SYSTEM: BODY BLOCKING & TOUCHING THE BALL ---
        // "make it so that if you touch the ball from an opossing player your player tries to tap it away from them
        // however if they place their body in front you can't reach the ball so the opossing player's body can block your path,
        // let's work on this physicality system, to recognize the opposing player's body and the ball as dinstictive entities and one can block the other."
        for (const opp of this.players) {
          if (opp.team === owner.team || opp.isRedCarded || opp.action === 'fouled_falling') continue;

          const dOppCarrier = Math.hypot(opp.x - owner.x, opp.y - owner.y);
          const dOppBall = Math.hypot(opp.x - this.ball.x, opp.y - this.ball.y);

          // 1. Physical body clash / repulsion (opposing player cannot ghost through the carrier's body)
          const minBodyDist = 18;
          if (dOppCarrier < minBodyDist && dOppCarrier > 0) {
            const angle = Math.atan2(opp.y - owner.y, opp.x - owner.x);
            const overlap = minBodyDist - dOppCarrier;
            if (owner.isShielding) {
              // Shielding player is rooted with wide stance; defender is pushed back
              opp.x += Math.cos(angle) * overlap * 0.9;
              opp.y += Math.sin(angle) * overlap * 0.9;
            } else {
              opp.x += Math.cos(angle) * (overlap * 0.5);
              opp.y += Math.sin(angle) * (overlap * 0.5);
              owner.x -= Math.cos(angle) * (overlap * 0.5);
              owner.y -= Math.sin(angle) * (overlap * 0.5);
            }
          }

          // 2. Ball touch vs Body blocking
          const touchBallRadius = 18;
          if (dOppBall < touchBallRadius && opp.action !== 'sliding_tackle') {
            const isBlockedByBody = this.isBodyBlockingBall(opp, owner);
            if (isBlockedByBody) {
              // Carrier's body is between opponent and ball! Opponent cannot reach through!
              // Body blocks opponent's path to ball
            } else {
              // Path to ball is unblocked! Opponent touches ball directly and taps it away into space!
              this.executeBallTapAway(opp, owner);
              break;
            }
          }
        }
      } else {
        this.ball.ownerId = null;
      }
      return;
    }

    // --- INTERCEPTIONS & DIVIDED BALL SYSTEM ---
    // "let's also work on interceptions any ball that's going near one of the players if it comes from a rival be a shoot or a pass cross etc,
    // the player will attempt to intercept it, depending on the power it has (shoot is more power, cross power but as much, long pass a bit less power, short pass the least powerful)
    // on top of that consider the power bar meter, the higher the power the more errsatic the interception becomes so if it has low poweer the interception is clean
    // the player who intercept instantly controls the ball if it has lots of power then the intercepting player barely tocuhed and the ball rebounds further away
    // and consider all the in between powers let's call these a system as well 'divided ball' this system means the ball is free until a player controls it."
    for (const p of this.players) {
      if (
        p.action === 'fouled_falling' ||
        p.action === 'bicycle_kick' ||
        p.action === 'scissor_kick' ||
        p.action === 'scorpion_kick' ||
        p.action === 'sombrero' ||
        p.isRedCarded
      ) continue;

      if (p.gingaActive && this.ball.z > 3.0) continue;

      const isGK = p.role === 'GK';

      // Goalkeeper release cooldown prevents immediate re-grabbing
      if (isGK && p.gkHoldTimer !== undefined && p.gkHoldTimer < 0) continue;

      // Players who just kicked or passed cannot immediately vacuum the ball back
      if (p.actionTimer > 0 && (p.action === 'kicking' || p.action === 'standing_pass' || p.action === 'running_pass' || p.action === 'clearing')) continue;

      const pickupRadius = isGK ? 36 : 19;
      const maxZ = isGK ? 45 : 8;

      if (this.ball.z > maxZ) continue;

      const dist = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      if (dist < pickupRadius) {
        // Is this a rival attempting an interception?
        const isRivalInterception = this.ball.lastTouchTeam !== null && p.team !== this.ball.lastTouchTeam;

        if (isRivalInterception && !isGK) {
          // INTERCEPTION EVALUATION BY POWER & ACTION TYPE
          let basePower = 0.40;
          if (this.ball.lastKickAction === 'shoot') basePower = 0.85;
          else if (this.ball.lastKickAction === 'clearance') basePower = 0.85;
          else if (this.ball.lastKickAction === 'cross') basePower = 0.72;
          else if (this.ball.lastKickAction === 'long_pass') basePower = 0.58;
          else if (this.ball.lastKickAction === 'pass') basePower = 0.32;

          const kickPower = this.ball.lastKickPower !== undefined ? this.ball.lastKickPower : 0.5;
          const combinedPower = (basePower * 0.45) + (kickPower * 0.55);
          const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
          // Decayed speed allows clean control if the ball has slowed down
          const speedFactor = Math.min(1.2, Math.max(0.25, ballSpeed / 7.5));
          const effectivePower = combinedPower * speedFactor;

          if (effectivePower < 0.38 || ballSpeed < 3.0) {
            // LOW POWER: Clean, instant interception! Controls ball directly
            this.ball.ownerId = p.id;
            this.ball.lastTouchTeam = p.team;
            this.ball.lastTouchPlayerId = p.id;
            this.ball.isDividedBall = false;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
            this.ball.z = 0;
            this.ball.isAirborne = false;
            p.action = 'trapping';
            p.actionTimer = 10;
            audio.playKick(0.35);
            this.setBanner(`CLEAN INTERCEPTION BY ${p.name.toUpperCase()}!`, 75);
            if (p.team === 'home') {
              this.userControlledPlayerId = p.id;
              this.updateUserControlledFlag();
            }
            break;
          } else if (effectivePower < 0.58) {
            // MEDIUM-LOW POWER: Cushioned control with slight first touch
            this.ball.ownerId = p.id;
            this.ball.lastTouchTeam = p.team;
            this.ball.lastTouchPlayerId = p.id;
            this.ball.isDividedBall = false;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
            this.ball.z = 0;
            this.ball.isAirborne = false;
            p.action = 'trapping';
            p.actionTimer = 14;
            audio.playKick(0.5);
            this.setBanner(`INTERCEPTED & CONTROLLED BY ${p.name.toUpperCase()}!`, 70);
            if (p.team === 'home') {
              this.userControlledPlayerId = p.id;
              this.updateUserControlledFlag();
            }
            break;
          } else if (effectivePower < 0.78) {
            // MEDIUM-HIGH POWER: Erratic touch / heavy deflection into divided ball
            this.ball.ownerId = null;
            this.ball.lastTouchTeam = p.team;
            this.ball.lastTouchPlayerId = p.id;
            this.ball.isDividedBall = true;
            // Rebounds 20-35px away in deflected direction
            const deflectAngle = Math.atan2(this.ball.vy, this.ball.vx) + (Math.random() - 0.5) * 1.6 + Math.PI;
            const reboundSpeed = Math.max(3.5, ballSpeed * 0.45);
            this.ball.vx = Math.cos(deflectAngle) * reboundSpeed;
            this.ball.vy = Math.sin(deflectAngle) * reboundSpeed;
            this.ball.vz = 0.8;
            p.action = 'trapping';
            p.actionTimer = 16;
            audio.playKick(0.7);
            this.setBanner(`DEFLECTED INTERCEPTION! DIVIDED BALL!`, 80);

            // Spawn turf particles on deflection
            for (let i = 0; i < 4; i++) {
              this.particles.push({
                x: this.ball.x,
                y: this.ball.y,
                z: 0,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                vz: Math.random() * 2.2,
                color: '#2a5e1e',
                life: 0,
                maxLife: 18,
                size: 2,
              });
            }
            break;
          } else {
            // HIGH / MAXIMUM POWER: Glancing erratic deflection, barely touched, rebounds further away!
            this.ball.ownerId = null;
            this.ball.lastTouchTeam = p.team;
            this.ball.lastTouchPlayerId = p.id;
            this.ball.isDividedBall = true;
            // Wild glancing rebound 35-60px away
            const deflectAngle = Math.atan2(this.ball.vy, this.ball.vx) + (Math.random() - 0.5) * 2.2 + Math.PI;
            const reboundSpeed = Math.max(5.5, ballSpeed * 0.62);
            this.ball.vx = Math.cos(deflectAngle) * reboundSpeed;
            this.ball.vy = Math.sin(deflectAngle) * reboundSpeed;
            this.ball.vz = 1.3;
            p.action = 'trapping';
            p.actionTimer = 18;
            audio.playKick(0.85);
            this.setBanner(`ERRATIC TOUCH ON HIGH-POWER BALL!`, 85);

            for (let i = 0; i < 6; i++) {
              this.particles.push({
                x: this.ball.x,
                y: this.ball.y,
                z: 0,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                vz: Math.random() * 2.8,
                color: '#2a5e1e',
                life: 0,
                maxLife: 22,
                size: 2.2,
              });
            }
            break;
          }
        }

        // Clean control for teammates or standard loose ball pickup / Goalkeeper
        this.ball.ownerId = p.id;
        this.ball.lastTouchTeam = p.team;
        this.ball.lastTouchPlayerId = p.id;
        this.ball.isDividedBall = false;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.z = isGK ? 10 : 0;
        this.ball.isAirborne = false;
        p.gingaActive = false;
        p.gingaCombo = 0;
        if (isGK) {
          p.action = 'idle';
          p.actionTimer = 0;
          p.gkHoldTimer = 0;
        }
        if (p.team === 'home') {
          this.userControlledPlayerId = p.id;
          this.updateUserControlledFlag();
        }
        break;
      }
    }
  }

  /**
   * Updates state timers for sliding tackles, falls, and dives,
   * driving multi-frame action animations
   */
  private updatePlayerStates(timeScale: number = 1) {
    const isKickoff = this.matchPhase === 'kickoff_ready';

    for (const p of this.players) {
      // Release cooldown for goalkeeper after kicking or passing out
      if (p.gkHoldTimer !== undefined && p.gkHoldTimer < 0) {
        p.gkHoldTimer += timeScale;
      }
      // Enforcement of Kickoff Boundary:
      if (isKickoff && p.team === 'away') {
        const maxAllowedY = PITCH_CONFIG.CENTER_Y - 20;
        if (p.y > maxAllowedY) p.y = maxAllowedY;
        const distCenter = Math.hypot(p.x - PITCH_CONFIG.CENTER_X, p.y - PITCH_CONFIG.CENTER_Y);
        if (distCenter < 195) {
          const ang = Math.atan2(p.y - PITCH_CONFIG.CENTER_Y, p.x - PITCH_CONFIG.CENTER_X);
          p.x = PITCH_CONFIG.CENTER_X + Math.cos(ang) * 200;
          p.y = PITCH_CONFIG.CENTER_Y + Math.sin(ang) * 200;
          if (p.y > maxAllowedY) p.y = maxAllowedY;
        }
        p.vx = 0;
        p.vy = 0;
      }

      // Standing difficulty: away outfielders strictly stand still
      if (this.difficulty === 'standing' && p.team === 'away' && p.role !== 'GK') {
        p.vx = 0;
        p.vy = 0;
        if (p.action === 'running') p.action = 'idle';
      }

      if (p.confusedTimer && p.confusedTimer > 0) {
        p.confusedTimer = Math.max(0, p.confusedTimer - timeScale);
      }

      if (p.shirtPulledTimer && p.shirtPulledTimer > 0) {
        p.shirtPulledTimer = Math.max(0, p.shirtPulledTimer - timeScale);
      }

      if (p.shirtPullingTimer && p.shirtPullingTimer > 0) {
        p.shirtPullingTimer = Math.max(0, p.shirtPullingTimer - timeScale);
        if (p.shirtPullingTimer === 0 && p.action === 'shirt_pull') {
          p.action = 'idle';
        }
      }

      if (p.stepOverTimer && p.stepOverTimer > 0) {
        p.stepOverTimer = Math.max(0, p.stepOverTimer - timeScale);
        p.animFrame = Math.floor(p.stepOverTimer / 7) % 4;
        if (p.stepOverTimer === 0) {
          p.isStepOverActive = false;
          if (p.action === 'step_overs') {
            p.action = 'idle';
          }
        }
      }

      if (p.dashTimer && p.dashTimer > 0) {
        p.dashTimer = Math.max(0, p.dashTimer - timeScale);
        p.animFrame = Math.floor((24 - p.dashTimer) / 6) % 4;
        if (p.dashTimer === 0 && p.action === 'nutmeg_dash') {
          p.action = 'running';
        }
      }

      // If ball has completely touched down, end Ginga aerial state
      if (this.ball.z <= 0.1 && p.gingaActive && p.action !== 'ginga_juggle') {
        p.gingaActive = false;
        p.gingaCombo = 0;
      }

      if (p.actionTimer > 0) {
        p.actionTimer = Math.max(0, p.actionTimer - timeScale);

        // Action animation frame progression
        if (p.action === 'standing_shot_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'standing_shot_mid' || p.action === 'standing_shot' || p.action === 'shooting') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'standing_shot_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'running_shot_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'running_shot_mid' || p.action === 'running_shot') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'running_shot_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'special_curl_shot') {
          if (p.actionTimer > 14) p.animFrame = 0;
          else if (p.actionTimer > 7) p.animFrame = 1;
          else p.animFrame = 2;
        } else if (p.action === 'knuckle_shot') {
          if (p.actionTimer > 13) p.animFrame = 0;
          else if (p.actionTimer > 6) p.animFrame = 1;
          else p.animFrame = 2;
        } else if (p.action === 'standing_pass_low') {
          p.animFrame = p.actionTimer > 5 ? 0 : p.actionTimer > 2 ? 1 : 2;
        } else if (p.action === 'standing_pass_mid' || p.action === 'standing_pass' || p.action === 'passing' || p.action === 'kicking') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'standing_pass_high') {
          p.animFrame = p.actionTimer > 10 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'running_pass_low') {
          p.animFrame = p.actionTimer > 6 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'running_pass_mid' || p.action === 'running_pass') {
          p.animFrame = p.actionTimer > 8 ? 0 : p.actionTimer > 4 ? 1 : 2;
        } else if (p.action === 'running_pass_high') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'special_curl_pass') {
          if (p.actionTimer > 10) p.animFrame = 0;
          else if (p.actionTimer > 5) p.animFrame = 1;
          else p.animFrame = 2;
        } else if (p.action === 'knuckle_pass') {
          if (p.actionTimer > 9) p.animFrame = 0;
          else if (p.actionTimer > 4) p.animFrame = 1;
          else p.animFrame = 2;
        } else if (p.action === 'standing_long_pass_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'standing_long_pass_mid' || p.action === 'standing_long_pass') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'standing_long_pass_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'running_long_pass_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'running_long_pass_mid' || p.action === 'running_long_pass') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'running_long_pass_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'standing_cross_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'standing_cross_mid' || p.action === 'standing_cross' || p.action === 'crossing') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'standing_cross_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'running_cross_low') {
          p.animFrame = p.actionTimer > 7 ? 0 : p.actionTimer > 3 ? 1 : 2;
        } else if (p.action === 'running_cross_mid' || p.action === 'running_cross') {
          p.animFrame = p.actionTimer > 11 ? 0 : p.actionTimer > 5 ? 1 : 2;
        } else if (p.action === 'running_cross_high') {
          p.animFrame = p.actionTimer > 14 ? 0 : p.actionTimer > 7 ? 1 : 2;
        } else if (p.action === 'cruyff_turn') {
          p.animFrame = p.actionTimer > 12 ? 0 : p.actionTimer > 6 ? 1 : 2;
        } else if (p.action === 'roulette') {
          p.animFrame = Math.floor((22 - p.actionTimer) / 5.5) % 4;
          // Rotate facing angle through 360 degrees
          p.facingAngle += (Math.PI * 2) / 22;
          this.ball.x = p.x + Math.cos(p.facingAngle) * 6;
          this.ball.y = p.y + Math.sin(p.facingAngle) * 6;
          this.ball.ownerId = p.id;
        } else if (p.action === 'rainbow_flick') {
          p.animFrame = p.actionTimer > 18 ? 0 : p.actionTimer > 10 ? 1 : p.actionTimer > 4 ? 2 : 3;
        } else if (p.action === 'bicycle_kick') {
          if (p.actionTimer > 18) p.animFrame = 0; // Inverted launch
          else if (p.actionTimer > 8) p.animFrame = 1; // Mid-air overhead bicycle strike
          else p.animFrame = 2; // Landing roll
        } else if (p.action === 'scissor_kick') {
          if (p.actionTimer > 16) p.animFrame = 0; // Horizontal leap
          else if (p.actionTimer > 8) p.animFrame = 1; // Scissor legs whip
          else p.animFrame = 2; // Touch down
        } else if (p.action === 'scorpion_kick') {
          if (p.actionTimer > 18) p.animFrame = 0; // Forward dive
          else if (p.actionTimer > 9) p.animFrame = 1; // Double heel reverse sting
          else p.animFrame = 2; // Slide recovery
        } else if (p.action === 'volley') {
          if (p.actionTimer > 14) p.animFrame = 0; // Side-on torso pivot
          else if (p.actionTimer > 7) p.animFrame = 1; // Full laces thunderbolt
          else p.animFrame = 2; // Follow-through
        } else if (p.action === 'sombrero') {
          p.animFrame = p.actionTimer > 16 ? 0 : p.actionTimer > 8 ? 1 : 2;
        } else if (p.action === 'ginga_juggle') {
          p.animFrame = Math.floor((25 - p.actionTimer) / 6) % 4;
        } else if (p.action === 'heading') {
          if (p.actionTimer > 13) p.animFrame = 0; // Jump load
          else if (p.actionTimer > 9) p.animFrame = 1; // Airborne arched back
          else if (p.actionTimer > 4) p.animFrame = 2; // Forehead thrust snap
          else p.animFrame = 3; // Landing
        } else if (p.action === 'sliding_tackle') {
          p.x += p.slideVelocityX * timeScale;
          p.y += p.slideVelocityY * timeScale;
          p.slideVelocityX *= Math.pow(0.92, timeScale);
          p.slideVelocityY *= Math.pow(0.92, timeScale);

          // Spawn sliding turf spray particles
          if (Math.random() < 0.6) {
            this.particles.push({
              x: p.x - Math.sign(p.slideVelocityX) * 6,
              y: p.y - Math.sign(p.slideVelocityY) * 6,
              z: 0,
              vx: -p.slideVelocityX * 0.15 + (Math.random() - 0.5),
              vy: -p.slideVelocityY * 0.15 + (Math.random() - 0.5),
              vz: Math.random() * 2.2,
              color: '#2a5e1e',
              life: 0,
              maxLife: 18,
              size: 2.2,
            });
          }

          // Slide tackle collision against opposing players
          for (const opp of this.players) {
            if (opp.team !== p.team && opp.role !== 'GK' && opp.action !== 'fouled_falling' && !opp.isRedCarded) {
              const dOpp = Math.hypot(opp.x - p.x, opp.y - p.y);
              if (dOpp < 26) {
                this.resolveTackleContact(p, opp, true);
                break;
              }
            }
          }

          if (p.actionTimer > 18) p.animFrame = 0; // Entry thrust
          else if (p.actionTimer > 8) p.animFrame = 1; // Full turf slide
          else p.animFrame = 2; // Recovery brake
        } else if (p.action === 'standing_tackle') {
          p.animFrame = p.actionTimer > 8 ? 0 : 1;
        } else if (p.action === 'goalkeeper_dive') {
          p.x += p.diveX * timeScale;
          p.y += p.diveY * timeScale;
          p.diveX *= Math.pow(0.9, timeScale);
          p.diveY *= Math.pow(0.9, timeScale);

          if (p.actionTimer > 16) p.animFrame = 0; // Push-off
          else if (p.actionTimer > 8) p.animFrame = 1; // Horizontal flight
          else p.animFrame = 2; // Fingertip save & roll
        } else if (p.action === 'fouled_falling') {
          if (p.actionTimer > 45) p.animFrame = 0; // Stumble
          else if (p.actionTimer > 30) p.animFrame = 1; // Mid-air tumble
          else if (p.actionTimer > 15) p.animFrame = 2; // Turf impact
          else p.animFrame = 3; // Down on grass
        }

        if (p.actionTimer === 0) {
          p.action = 'idle';
          p.animFrame = 0;
        }
      }
    }

    // General physicality & body collision between opposing outfield players
    // "to recognize the opposing player's body and the ball as dinstictive entities and one can block the other"
    for (let i = 0; i < this.players.length; i++) {
      const p1 = this.players[i];
      if (p1.action === 'fouled_falling' || p1.isRedCarded) continue;
      for (let j = i + 1; j < this.players.length; j++) {
        const p2 = this.players[j];
        if (p2.team === p1.team || p2.action === 'fouled_falling' || p2.isRedCarded) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minBodyDist = 17;

        if (dist > 0 && dist < minBodyDist) {
          const overlap = minBodyDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          if (p1.isShielding && this.ball.ownerId === p1.id) {
            // Rooted shielding stance
            p2.x += nx * overlap * 0.9;
            p2.y += ny * overlap * 0.9;
          } else if (p2.isShielding && this.ball.ownerId === p2.id) {
            p1.x -= nx * overlap * 0.9;
            p1.y -= ny * overlap * 0.9;
          } else {
            p1.x -= nx * overlap * 0.5;
            p1.y -= ny * overlap * 0.5;
            p2.x += nx * overlap * 0.5;
            p2.y += ny * overlap * 0.5;
          }
        }
      }
    }
  }

  /**
   * Moves referee near play without interfering
   */
  private updateReferee(timeScale: number = 1) {
    const targetX = this.ball.x + 50;
    const targetY = this.ball.y + 30;
    const dx = targetX - this.referee.x;
    const dy = targetY - this.referee.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 70) {
      this.referee.vx = (dx / dist) * 2.2;
      this.referee.vy = (dy / dist) * 2.2;
      this.referee.x += this.referee.vx * timeScale;
      this.referee.y += this.referee.vy * timeScale;
    }

    // Referee faces the ball and focal play area
    this.referee.facingAngle = Math.atan2(this.ball.y - this.referee.y, this.ball.x - this.referee.x);

    if (this.referee.whistleTimer > 0) {
      this.referee.whistleTimer = Math.max(0, this.referee.whistleTimer - timeScale);
    }
  }

  /**
   * Updates turf/grass divot particles
   */
  private updateParticles(timeScale: number = 1) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * timeScale;
      pt.y += pt.vy * timeScale;
      pt.z += pt.vz * timeScale;
      pt.vz -= 0.2 * timeScale;
      pt.life += timeScale;
      if (pt.life >= pt.maxLife || pt.z < 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Dynamic camera following ball smoothly:
   * "the camera should have a bit of an angle when you're near the top goal (which is the rival team's goal)
   * the angle is a bit lower and you see it closer to the ground giving more vertical angle of the goal,
   * but as you go down to your own goal, the camera is higher and more above the ground"
   */
  private updateCamera() {
    // Smooth lerp towards ball or user-controlled player based on cameraFocus toggle
    const controlledPlayer = this.getControlledPlayer();
    const targetX = this.cameraFocus === 'player' && controlledPlayer ? controlledPlayer.x : this.ball.x;
    const targetY = this.cameraFocus === 'player' && controlledPlayer ? controlledPlayer.y : this.ball.y;

    this.camera.x += (targetX - this.camera.x) * 0.08;
    this.camera.y += (targetY - this.camera.y) * 0.08;

    // Calculate vertical position ratio on field (0 at rival top goal, 1 at own bottom goal)
    const normY = Math.max(0, Math.min(1, (this.camera.y - PITCH_CONFIG.PITCH_TOP) / PITCH_CONFIG.FIELD_HEIGHT));
    this.camera.pitchTilt = normY;

    // Zoom: when normY is 0 (near top goal), zoom is 1.18 (closer to ground, dramatic goal angle)
    // When normY is 1 (near bottom goal), zoom is 0.92 (higher up, wide tactical overview)
    const targetZoom = 1.18 - normY * 0.26;
    this.camera.zoom += (targetZoom - this.camera.zoom) * 0.05;
  }

  /**
   * Automatically assigns user control to the Home player closest to the ball
   */
  private autoSwitchUserPlayer() {
    // If current controlled player has the ball, don't switch
    if (this.ball.ownerId === this.userControlledPlayerId) return;

    // If current controlled player is completing an active kick animation, finish it before switching
    const curr = this.getControlledPlayer();
    if (curr && curr.actionTimer > 0 && isKickingAction(curr.action)) return;

    let closestHome: Player | null = null;
    let minDistance = Infinity;

    for (const p of this.players) {
      if (p.team === 'home' && p.role !== 'GK') {
        const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
        if (d < minDistance) {
          minDistance = d;
          closestHome = p;
        }
      }
    }

    if (closestHome && closestHome.id !== this.userControlledPlayerId && minDistance < 280) {
      this.userControlledPlayerId = closestHome.id;
      this.updateUserControlledFlag();
    }
  }

  public updateUserControlledFlag() {
    for (const p of this.players) {
      p.isUserControlled = p.id === this.userControlledPlayerId;
    }
  }

  /**
   * Called when ball crosses goal line into net
   */
  private onGoal(event: GoalEvent) {
    if (this.matchPhase === 'goal_scored') return;

    this.matchPhase = 'goal_scored';
    this.phaseTimer = 0;
    this.goalNetShake = 28;

    if (event.teamScored === 'home') {
      this.score.home++;
      this.topGoalNet.shake = 35;
      this.topGoalNet.bulgeAmount = Math.max(this.topGoalNet.bulgeAmount, 22);
      this.bannerMessage = `GOOOOOAL FOR ${HOME_KIT.name.toUpperCase()}!`;
    } else {
      this.score.away++;
      this.bottomGoalNet.shake = 35;
      this.bottomGoalNet.bulgeAmount = Math.max(this.bottomGoalNet.bulgeAmount, 22);
      this.bannerMessage = `GOAL FOR ${AWAY_KIT.name.toUpperCase()}!`;
    }
    this.bannerTimer = 180;

    audio.playGoalCheer();
    audio.playWhistle(true);
  }

  /**
   * Recovers play if ball was kicked out of pitch, over crossbar, or into stands
   * Proper football rules:
   * - Crosses endline & last touched by defending team -> Corner kick for attacking team
   * - Crosses endline & last touched by attacking team -> Goal kick for defending team
   * - Crosses sideline -> Throw-in for opponent of team that touched last
   */
  private checkOutOfBounds() {
    if (this.matchPhase !== 'in_play' && this.matchPhase !== 'kickoff_ready') return;

    const goalLeft = PITCH_CONFIG.CENTER_X - PITCH_CONFIG.GOAL_WIDTH / 2;
    const goalRight = PITCH_CONFIG.CENTER_X + PITCH_CONFIG.GOAL_WIDTH / 2;

    // Inside top/bottom goal mouth/net area
    const inTopGoal =
      this.ball.y <= PITCH_CONFIG.PITCH_TOP &&
      this.ball.y >= PITCH_CONFIG.PITCH_TOP - PITCH_CONFIG.GOAL_DEPTH - 15 &&
      this.ball.x >= goalLeft + 2 &&
      this.ball.x <= goalRight - 2 &&
      this.ball.z <= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT + 3;
    const inBottomGoal =
      this.ball.y >= PITCH_CONFIG.PITCH_BOTTOM &&
      this.ball.y <= PITCH_CONFIG.PITCH_BOTTOM + PITCH_CONFIG.GOAL_DEPTH + 15 &&
      this.ball.x >= goalLeft + 2 &&
      this.ball.x <= goalRight - 2 &&
      this.ball.z <= PITCH_CONFIG.GOAL_CROSSBAR_HEIGHT + 3;

    if (inTopGoal || inBottomGoal) {
      return; // Handled by goal detection & net physics
    }

    const isPastSideline = this.ball.x < PITCH_CONFIG.PITCH_LEFT - 3 || this.ball.x > PITCH_CONFIG.PITCH_RIGHT + 3;
    const isPastEndline = this.ball.y < PITCH_CONFIG.PITCH_TOP - 3 || this.ball.y > PITCH_CONFIG.PITCH_BOTTOM + 3;

    if (isPastSideline || isPastEndline) {
      // If a player carried the ball out of bounds, strip ownership and award to opponent!
      if (this.ball.ownerId) {
        const carrier = this.players.find(p => p.id === this.ball.ownerId);
        if (carrier) {
          this.ball.lastTouchTeam = carrier.team;
          this.ball.lastTouchPlayerId = carrier.id;
        }
        this.ball.ownerId = null;
      }

      if (this.ball.isOverpowered) {
        // Let overpowered rocket ball fly high into the stands for ~28 frames so player sees the blast
        this.outOfBoundsDelay++;
        if (this.outOfBoundsDelay > 28) {
          this.outOfBoundsDelay = 0;
          this.resetOutOfBounds();
        }
      } else {
        // Standard ball crosses line: whistle blown immediately!
        this.outOfBoundsDelay = 0;
        this.resetOutOfBounds();
      }
    } else {
      this.outOfBoundsDelay = 0;
    }
  }

  private resetOutOfBounds() {
    this.ball.isOverpowered = false;
    this.ball.isSpecialCurve = false;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.z = 0;
    audio.playWhistle(false);

    // "if the ball goes out of bounds at the back of the goal if it was taken out by the opossing team is a goal kick if it was the defending team is a corner for their rivals, if it goes outside on a sida is a throw in and so on."
    // If ball went past top goal line (Away's defending end)
    if (this.ball.y < PITCH_CONFIG.PITCH_TOP) {
      if (this.ball.lastTouchTeam === 'away') {
        // Defending Away team touched it last -> Corner for Home!
        const cornerX = this.ball.x < PITCH_CONFIG.CENTER_X ? PITCH_CONFIG.PITCH_LEFT + 8 : PITCH_CONFIG.PITCH_RIGHT - 8;
        setupCornerKick(this, 'home', cornerX, PITCH_CONFIG.PITCH_TOP + 8);
        this.setBanner(`CORNER KICK FOR ${HOME_KIT.name.toUpperCase()}!`, 140);
      } else {
        // Attacking team kicked it out -> Goal kick for Away!
        setupGoalKick(this, 'away');
        this.setBanner(`GOAL KICK FOR ${AWAY_KIT.name.toUpperCase()}`, 140);
      }
    } else if (this.ball.y > PITCH_CONFIG.PITCH_BOTTOM) {
      // Past bottom goal line (Home's defending end)
      if (this.ball.lastTouchTeam === 'home') {
        // Defending Home team touched it last -> Corner for Away!
        const cornerX = this.ball.x < PITCH_CONFIG.CENTER_X ? PITCH_CONFIG.PITCH_LEFT + 8 : PITCH_CONFIG.PITCH_RIGHT - 8;
        setupCornerKick(this, 'away', cornerX, PITCH_CONFIG.PITCH_BOTTOM - 8);
        this.setBanner(`CORNER KICK FOR ${AWAY_KIT.name.toUpperCase()}!`, 140);
      } else {
        // Attacking team kicked it out -> Goal kick for Home!
        setupGoalKick(this, 'home');
        this.setBanner(`GOAL KICK FOR ${HOME_KIT.name.toUpperCase()}`, 140);
      }
    } else {
      // Touchline throw-in: awarded to rival of last touch team
      const throwX = this.ball.x < PITCH_CONFIG.CENTER_X ? PITCH_CONFIG.PITCH_LEFT + 8 : PITCH_CONFIG.PITCH_RIGHT - 8;
      const throwY = Math.max(PITCH_CONFIG.PITCH_TOP + 45, Math.min(PITCH_CONFIG.PITCH_BOTTOM - 45, this.ball.y));
      const throwTeam = this.ball.lastTouchTeam === 'home' ? 'away' : 'home';
      setupThrowIn(this, throwTeam, throwX, throwY);
      this.setBanner(`THROW-IN FOR ${throwTeam === 'home' ? HOME_KIT.name.toUpperCase() : AWAY_KIT.name.toUpperCase()}`, 140);
    }

    this.updateUserControlledFlag();
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public getControlledPlayer(): Player | undefined {
    return this.players.find(p => p.id === this.userControlledPlayerId);
  }
}
