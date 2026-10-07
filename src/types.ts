export type TeamSide = 'home' | 'away';

export type PlayerRole = 'GK' | 'LB' | 'CB1' | 'CB2' | 'RB' | 'LM' | 'CM1' | 'CM2' | 'RM' | 'ST1' | 'ST2';

export interface PlayerStats {
  speed: number;
  sprintSpeed: number;
  shotPower: number;
  passing: number;
  tackling: number;
  heading: number;
}

export interface PlayerAppearance {
  skinTone: string; // e.g. '#f5c898', '#d09868', '#8a5230', '#543018'
  hairStyle: 'curly_blond' | 'afro_black' | 'ponytail_dark' | 'dreads' | 'crop_brown' | 'blond_sweep' | 'ginger_curly' | 'bald' | 'spiky_black';
  hairColor: string;
  hasBeard?: boolean;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  z: number;
  alpha: number;
  size: number;
  color?: string;
}

export type PlayerAction =
  | 'idle'
  | 'running'
  | 'kicking'
  | 'passing'
  | 'shooting'
  | 'crossing'
  | 'standing_pass'
  | 'standing_pass_low'
  | 'standing_pass_mid'
  | 'standing_pass_high'
  | 'running_pass'
  | 'running_pass_low'
  | 'running_pass_mid'
  | 'running_pass_high'
  | 'standing_shot'
  | 'standing_shot_low'
  | 'standing_shot_mid'
  | 'standing_shot_high'
  | 'running_shot'
  | 'running_shot_low'
  | 'running_shot_mid'
  | 'running_shot_high'
  | 'standing_cross'
  | 'standing_cross_low'
  | 'standing_cross_mid'
  | 'standing_cross_high'
  | 'running_cross'
  | 'running_cross_low'
  | 'running_cross_mid'
  | 'running_cross_high'
  | 'standing_long_pass'
  | 'standing_long_pass_low'
  | 'standing_long_pass_mid'
  | 'standing_long_pass_high'
  | 'running_long_pass'
  | 'running_long_pass_low'
  | 'running_long_pass_mid'
  | 'running_long_pass_high'
  | 'standing_tackle'
  | 'sliding_tackle'
  | 'heading'
  | 'fouled_falling'
  | 'goalkeeper_dive'
  | 'celebrating'
  | 'trapping'
  | 'shielding'
  | 'step_overs'
  | 'nutmeg_dash'
  | 'dribbling'
  | 'special_curl_shot'
  | 'knuckle_shot'
  | 'special_curl_pass'
  | 'knuckle_pass'
  | 'cruyff_turn'
  | 'rainbow_flick'
  | 'shirt_pull'
  | 'volley'
  | 'bicycle_kick'
  | 'scissor_kick'
  | 'scorpion_kick'
  | 'sombrero'
  | 'ginga_juggle'
  | 'roulette'
  | 'clearing'
  | 'pushing_foul';

export interface Player {
  id: string;
  name: string;
  number: number;
  team: TeamSide;
  role: PlayerRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  baseX: number; // Base formation normalized X (0 to 1)
  baseY: number; // Base formation normalized Y (0 to 1)
  facingAngle: number; // In radians
  facingDir: 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
  stats: PlayerStats;
  appearance: PlayerAppearance;
  scale?: number; // Physical player size scale (0.92 - 1.08)
  action: PlayerAction;
  actionTimer: number;
  stamina: number;
  hasYellowCard: boolean;
  isRedCarded: boolean;
  animFrame: number;
  animTimer: number;
  isUserControlled: boolean;
  slideVelocityX: number;
  slideVelocityY: number;
  diveX: number;
  diveY: number;
  confusedTimer?: number; // Subtle confused emoji above defender when nutmegged
  stepOverTimer?: number; // Step-overs active frames
  isStepOverActive?: boolean; // Step-overs active flag
  stepOverDirChanged?: boolean; // Direction change effectiveness boost
  stepOverOriginalAngle?: number; // Original angle before direction change
  isShielding?: boolean; // Q key shielding active
  dashTimer?: number; // E explosive dash timer
  cruyffTurnTimer?: number; // Cruyff turn active
  rainbowFlickTimer?: number; // Rainbow flick active
  longThrowCharge?: number; // E long autopass charge level (0 to 1)
  isLongThrowCharging?: boolean; // E key held down while running
  shirtPulledTimer?: number; // Slowed down by opponent pulling shirt
  shirtPullingTimer?: number; // Defender pulling opponent shirt
  shirtPullTargetId?: string; // ID of player being pulled
  shoulderHitTimer?: number; // Defender shoulder barge timer
  isGingaLifting?: boolean; // Spacebar held to lift ball
  gingaHoldTimer?: number; // Frames spacebar held for Ginga lift
  gingaActive?: boolean; // Ball juggling mode active
  gingaCombo?: number; // Consecutive juggles kept in the air
  gkHoldTimer?: number; // Goalkeeper holding ball before clearing/passing
}

export type DifficultyLevel = 'standing' | 'easy';

export interface Ball {
  x: number;
  y: number;
  z: number; // Height above ground in pixels
  vx: number;
  vy: number;
  vz: number;
  spin: number; // Angular horizontal spin for Magnus curl effect (-6 to +6)
  spinY?: number; // Backspin / topspin affecting lift and bounce check
  ownerId: string | null;
  lastTouchTeam: TeamSide | null;
  lastTouchPlayerId: string | null;
  isAirborne: boolean;
  deformation?: number; // 0 (spherical) to 1 (max oval elongation)
  deformationAngle?: number; // Axis of oval elongation in radians
  squashTimer?: number; // Bounce impact squash frames
  rotationAngle?: number; // Visual rotational angle in radians
  trail?: BallTrailPoint[]; // Pixel motion / curl trail
  isSpecialCurve?: boolean; // Q-modifier extra curve
  isOverpowered?: boolean; // Hit in red / purplish black / burgundy (overdone)
  isKnuckle?: boolean; // E-modifier knuckleball (no curve, rises then dips sharply or skids)
  knuckleDipped?: boolean; // True once knuckleball drops sharply
  lastKickAction?: 'shoot' | 'cross' | 'long_pass' | 'pass' | 'clearance' | 'none';
  lastKickPower?: number; // 0.0 to 1.0 power bar level
  isDividedBall?: boolean; // Contested divided ball in transit
}

export type PowerActionType = 'pass' | 'long_pass' | 'shoot' | 'cross';

export interface PowerBarState {
  isActive: boolean;
  action: PowerActionType | null;
  power: number; // 0.0 to 1.0
  isSpecial: boolean; // Q modifier active
  isKnuckle: boolean; // E modifier active (knuckleball / driven)
  fillSpeed: number; // Filling increment per frame
  tier: 1 | 2 | 3 | 4 | 5;
  tierColor: string;
  tierLabel: string;
}

export interface TeamKit {
  name: string;
  shortName: string;
  primaryColor: string; // Shirt main
  secondaryColor: string; // Shirt trim or stripe
  shortsColor: string;
  socksColor: string;
  gkColor: string;
}

export interface MatchScore {
  home: number;
  away: number;
}

export type MatchPhase =
  | 'kickoff_ready'
  | 'in_play'
  | 'goal_scored'
  | 'foul_stoppage'
  | 'free_kick'
  | 'penalty'
  | 'corner_kick'
  | 'goal_kick'
  | 'throw_in'
  | 'half_time'
  | 'full_time';

export interface Referee {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number; // Sight direction (radians)
  sightRange: number; // Sight distance in field pixels (~360px)
  sightFov: number; // Field of vision cone in radians (~1.9 rad = ~110°)
  whistleTimer: number;
  cardDisplay: 'yellow' | 'red' | null;
  cardPlayerName: string | null;
  sightConeAlpha?: number;
}

export interface GoalNetState {
  impactX: number;
  impactY: number;
  impactZ: number;
  bulgeAmount: number; // Current physical bulge displacement (px)
  bulgeVel: number;    // Elastic spring velocity
  shake: number;       // Wave ripple vibration intensity
  ballCaught: boolean; // Whether ball is currently cushioned inside net
}

export interface SetPieceState {
  type: 'free_kick' | 'penalty' | 'corner_kick' | 'goal_kick' | 'throw_in';
  takerId: string;
  team: TeamSide;
  spotX: number;
  spotY: number;
  aimAngle: number;
  wallPlayerIds: string[];
  isPenalty: boolean;
}

export interface TurfParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface KeyState {
  ArrowUp: boolean;
  ArrowDown: boolean;
  ArrowLeft: boolean;
  ArrowRight: boolean;
  Shift: boolean;
  KeyW: boolean;
  KeyA: boolean;
  KeyS: boolean;
  KeyD: boolean;
  KeyQ: boolean;
  KeyE: boolean;
  Space: boolean;
}
