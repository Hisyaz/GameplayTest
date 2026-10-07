import { Player, TeamKit, TeamSide, PlayerRole, PlayerAppearance, PlayerStats } from '../types';

export const PITCH_CONFIG = {
  // Playable field area
  FIELD_WIDTH: 1500,
  FIELD_HEIGHT: 2500,
  // Pitch margins for sidelines, hoardings and crowd
  MARGIN_X: 180,
  MARGIN_TOP: 220,
  MARGIN_BOTTOM: 200,

  // Derived boundaries
  get TOTAL_WIDTH() {
    return this.FIELD_WIDTH + this.MARGIN_X * 2;
  },
  get TOTAL_HEIGHT() {
    return this.FIELD_HEIGHT + this.MARGIN_TOP + this.MARGIN_BOTTOM;
  },
  get PITCH_LEFT() {
    return this.MARGIN_X;
  },
  get PITCH_RIGHT() {
    return this.MARGIN_X + this.FIELD_WIDTH;
  },
  get PITCH_TOP() {
    return this.MARGIN_TOP;
  },
  get PITCH_BOTTOM() {
    return this.MARGIN_TOP + this.FIELD_HEIGHT;
  },
  get CENTER_X() {
    return this.MARGIN_X + this.FIELD_WIDTH / 2;
  },
  get CENTER_Y() {
    return this.MARGIN_TOP + this.FIELD_HEIGHT / 2;
  },

  // Goals
  GOAL_WIDTH: 220, // Real proportion (~7.32m)
  GOAL_DEPTH: 60,
  GOAL_CROSSBAR_HEIGHT: 65,

  // Pitch Markings
  PENALTY_BOX_WIDTH: 620,
  PENALTY_BOX_HEIGHT: 320,
  SIX_YARD_BOX_WIDTH: 280,
  SIX_YARD_BOX_HEIGHT: 120,
  CENTER_CIRCLE_RADIUS: 180,
  PENALTY_SPOT_DIST: 220,
  CORNER_ARC_RADIUS: 30,

  // Player sprite metrics
  SPRITE_WIDTH: 24,
  SPRITE_HEIGHT: 28,
  BALL_RADIUS: 5.5,
};

export const PHYSICS = {
  NORMAL_WALK_SPEED: 2.3,
  RUN_SPEED: 3.8,
  ACCELERATION: 0.28,
  DECELERATION: 0.85,
  BALL_FRICTION_GROUND: 0.982,
  BALL_AIR_DRAG: 0.992,
  GRAVITY: 0.24,
  BOUNCE_COEFFICIENT: 0.62,
  TACKLE_SLIDE_SPEED: 5.2,
  TACKLE_DURATION: 26, // frames
  FOUL_KNOCKDOWN_DURATION: 60,
  CARD_DISPLAY_DURATION: 120,
};

export const HOME_KIT: TeamKit = {
  name: 'Retro All-Stars',
  shortName: 'RAS',
  primaryColor: '#0055b8', // Classic Royal Blue
  secondaryColor: '#ffffff',
  shortsColor: '#ffffff',
  socksColor: '#0055b8',
  gkColor: '#ffbb00', // Yellow GK
};

export const AWAY_KIT: TeamKit = {
  name: 'Pixel Legends',
  shortName: 'PXL',
  primaryColor: '#c8102e', // Vivid Red
  secondaryColor: '#ffffff',
  shortsColor: '#1a1a1a',
  socksColor: '#c8102e',
  gkColor: '#00aa55', // Green GK
};

// 4-4-2 normalized positions on the pitch (0 to 1 for x and y relative to field)
// Home team attacks UP towards y=0 (rival top goal)
export const HOME_FORMATION_BASE: Record<PlayerRole, { x: number; y: number; name: string; number: number; appearance: PlayerAppearance; stats: PlayerStats; scale: number }> = {
  GK: {
    x: 0.5,
    y: 0.96,
    name: 'Schmeichel',
    number: 1,
    scale: 1.08, // Imposing tall goalkeeper
    appearance: { skinTone: '#f5c898', hairStyle: 'blond_sweep', hairColor: '#f7d050' },
    stats: { speed: 2.1, sprintSpeed: 3.3, shotPower: 4.5, passing: 3.8, tackling: 4.2, heading: 4.0 },
  },
  LB: {
    x: 0.16,
    y: 0.82,
    name: 'Maldini',
    number: 3,
    scale: 1.02, // Elegant athletic defender
    appearance: { skinTone: '#d09868', hairStyle: 'crop_brown', hairColor: '#3a2212' },
    stats: { speed: 2.3, sprintSpeed: 3.7, shotPower: 3.8, passing: 4.0, tackling: 4.8, heading: 4.4 },
  },
  CB1: {
    x: 0.38,
    y: 0.84,
    name: 'Baresi',
    number: 6,
    scale: 1.01,
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#1a1a1a' },
    stats: { speed: 2.2, sprintSpeed: 3.5, shotPower: 3.5, passing: 4.1, tackling: 4.9, heading: 4.5 },
  },
  CB2: {
    x: 0.62,
    y: 0.84,
    name: 'Koeman',
    number: 4,
    scale: 1.04, // Broad muscular sweeper
    appearance: { skinTone: '#f5c898', hairStyle: 'curly_blond', hairColor: '#e8c040' },
    stats: { speed: 2.1, sprintSpeed: 3.4, shotPower: 5.2, passing: 4.4, tackling: 4.6, heading: 4.2 },
  },
  RB: {
    x: 0.84,
    y: 0.82,
    name: 'Cafu',
    number: 2,
    scale: 0.99,
    appearance: { skinTone: '#8a5230', hairStyle: 'crop_brown', hairColor: '#121212' },
    stats: { speed: 2.5, sprintSpeed: 4.0, shotPower: 3.7, passing: 4.0, tackling: 4.3, heading: 3.8 },
  },
  LM: {
    x: 0.15,
    y: 0.62,
    name: 'Giggs',
    number: 11,
    scale: 0.97, // Lean sprinting winger
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#2b1b11' },
    stats: { speed: 2.6, sprintSpeed: 4.1, shotPower: 4.0, passing: 4.3, tackling: 3.2, heading: 3.4 },
  },
  CM1: {
    x: 0.38,
    y: 0.64,
    name: 'Matthäus',
    number: 10,
    scale: 0.98, // Compact powerhouse captain
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#4d301c' },
    stats: { speed: 2.4, sprintSpeed: 3.8, shotPower: 4.9, passing: 4.6, tackling: 4.4, heading: 4.0 },
  },
  CM2: {
    x: 0.62,
    y: 0.64,
    name: 'Gullit',
    number: 8,
    scale: 1.07, // Towering athletic colossus
    appearance: { skinTone: '#8a5230', hairStyle: 'dreads', hairColor: '#111111', hasBeard: true },
    stats: { speed: 2.4, sprintSpeed: 3.9, shotPower: 4.7, passing: 4.4, tackling: 4.1, heading: 4.8 },
  },
  RM: {
    x: 0.85,
    y: 0.62,
    name: 'Gascoigne',
    number: 7,
    scale: 0.98,
    appearance: { skinTone: '#f5c898', hairStyle: 'blond_sweep', hairColor: '#ecd264' },
    stats: { speed: 2.4, sprintSpeed: 3.8, shotPower: 4.4, passing: 4.5, tackling: 3.6, heading: 3.5 },
  },
  ST1: {
    x: 0.38,
    y: 0.51,
    name: 'Maradona',
    number: 9,
    scale: 0.93, // Iconic compact, stocky wizard
    appearance: { skinTone: '#d09868', hairStyle: 'afro_black', hairColor: '#0a0a0a' },
    stats: { speed: 2.5, sprintSpeed: 4.0, shotPower: 4.8, passing: 4.9, tackling: 3.0, heading: 3.9 },
  },
  ST2: {
    x: 0.62,
    y: 0.51,
    name: 'Van Basten',
    number: 14,
    scale: 1.06, // Tall clinical target striker
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#362115' },
    stats: { speed: 2.4, sprintSpeed: 3.9, shotPower: 5.0, passing: 4.2, tackling: 3.2, heading: 4.7 },
  },
};

// Away team attacks DOWN towards bottom goal (y=1)
export const AWAY_FORMATION_BASE: Record<PlayerRole, { x: number; y: number; name: string; number: number; appearance: PlayerAppearance; stats: PlayerStats; scale: number }> = {
  GK: {
    x: 0.5,
    y: 0.04,
    name: 'Zoff',
    number: 1,
    scale: 1.07,
    appearance: { skinTone: '#d09868', hairStyle: 'crop_brown', hairColor: '#1e140d' },
    stats: { speed: 2.0, sprintSpeed: 3.2, shotPower: 4.3, passing: 3.7, tackling: 4.3, heading: 4.0 },
  },
  RB: {
    x: 0.16,
    y: 0.18,
    name: 'Brehme',
    number: 2,
    scale: 0.99,
    appearance: { skinTone: '#f5c898', hairStyle: 'curly_blond', hairColor: '#e0b830' },
    stats: { speed: 2.3, sprintSpeed: 3.7, shotPower: 4.6, passing: 4.2, tackling: 4.4, heading: 3.9 },
  },
  CB1: {
    x: 0.38,
    y: 0.16,
    name: 'Scirea',
    number: 6,
    scale: 1.03,
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#1c1c1c' },
    stats: { speed: 2.2, sprintSpeed: 3.5, shotPower: 3.4, passing: 4.2, tackling: 4.9, heading: 4.4 },
  },
  CB2: {
    x: 0.62,
    y: 0.16,
    name: 'Desailly',
    number: 4,
    scale: 1.05, // Muscular rock
    appearance: { skinTone: '#543018', hairStyle: 'crop_brown', hairColor: '#0a0a0a' },
    stats: { speed: 2.3, sprintSpeed: 3.6, shotPower: 3.6, passing: 3.9, tackling: 4.8, heading: 4.6 },
  },
  LB: {
    x: 0.84,
    y: 0.18,
    name: 'Roberto Carlos',
    number: 3,
    scale: 0.93, // Famous explosive 1.68m compact powerhouse
    appearance: { skinTone: '#8a5230', hairStyle: 'bald', hairColor: '#111111' },
    stats: { speed: 2.6, sprintSpeed: 4.2, shotPower: 5.4, passing: 4.1, tackling: 4.2, heading: 3.5 },
  },
  RM: {
    x: 0.15,
    y: 0.38,
    name: 'Valderrama',
    number: 10,
    scale: 0.97, // Agile afro wizard
    appearance: { skinTone: '#8a5230', hairStyle: 'afro_black', hairColor: '#e8a810' }, // Iconic yellow afro!
    stats: { speed: 2.1, sprintSpeed: 3.4, shotPower: 4.0, passing: 5.0, tackling: 3.4, heading: 3.3 },
  },
  CM1: {
    x: 0.38,
    y: 0.36,
    name: 'Rijkaard',
    number: 5,
    scale: 1.06, // Commanding giant
    appearance: { skinTone: '#8a5230', hairStyle: 'afro_black', hairColor: '#0a0a0a', hasBeard: true },
    stats: { speed: 2.3, sprintSpeed: 3.7, shotPower: 4.4, passing: 4.4, tackling: 4.7, heading: 4.4 },
  },
  CM2: {
    x: 0.62,
    y: 0.36,
    name: 'Hagi',
    number: 8,
    scale: 0.97, // Nimble playmaker
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#1c1510' },
    stats: { speed: 2.3, sprintSpeed: 3.7, shotPower: 4.8, passing: 4.6, tackling: 3.5, heading: 3.6 },
  },
  LM: {
    x: 0.85,
    y: 0.38,
    name: 'Stoichkov',
    number: 7,
    scale: 1.00,
    appearance: { skinTone: '#f5c898', hairStyle: 'crop_brown', hairColor: '#111111' },
    stats: { speed: 2.5, sprintSpeed: 4.0, shotPower: 4.9, passing: 4.2, tackling: 3.6, heading: 4.0 },
  },
  ST1: {
    x: 0.38,
    y: 0.36,
    name: 'Romário',
    number: 11,
    scale: 0.94, // Compact quick poacher
    appearance: { skinTone: '#8a5230', hairStyle: 'crop_brown', hairColor: '#0c0c0c' },
    stats: { speed: 2.5, sprintSpeed: 4.1, shotPower: 4.9, passing: 4.1, tackling: 2.8, heading: 4.2 },
  },
  ST2: {
    x: 0.62,
    y: 0.36,
    name: 'Baggio',
    number: 9,
    scale: 0.97, // Quick divine ponytail
    appearance: { skinTone: '#d09868', hairStyle: 'ponytail_dark', hairColor: '#141414', hasBeard: true },
    stats: { speed: 2.4, sprintSpeed: 3.9, shotPower: 4.7, passing: 4.8, tackling: 3.0, heading: 3.8 },
  },
};
