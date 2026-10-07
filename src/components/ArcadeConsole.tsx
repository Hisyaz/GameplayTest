/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { KeyState } from '../types';
import {
  resolveStickState,
  getStickSprite,
  getButtonSprite,
} from '../game/arcadeSprites';

interface ArcadeConsoleProps {
  keys: KeyState;
  hasBall: boolean;
  onKeyChange: (key: keyof KeyState, pressed: boolean) => void;
  onActionPress?: (action: 'pass' | 'shoot' | 'cross' | 'long_pass') => void;
  onActionRelease?: (action: 'pass' | 'shoot' | 'cross' | 'long_pass') => void;
  onTogglePause: () => void;
  isPaused: boolean;
}

export const ArcadeConsole: React.FC<ArcadeConsoleProps> = ({
  keys,
  hasBall,
  onKeyChange,
  onActionPress,
  onActionRelease,
  onTogglePause,
  isPaused,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [touchTilt, setTouchTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const [touchPressed, setTouchPressed] = useState<{ [key: string]: boolean }>({});

  // Active directional tilt from keyboard arrow keys (or touch)
  const keyboardX = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const keyboardY = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);

  // Use touch drag if active, otherwise reflect keyboard arrow keys
  const activeX = isTouchDragging ? touchTilt.x : keyboardX;
  const activeY = isTouchDragging ? touchTilt.y : keyboardY;

  // Resolve 32-bit fixed sprite frame for stick (neutral, 8 half-tilt in-between, 8 full-tilt)
  const stickState = useMemo(() => resolveStickState(activeX, activeY), [activeX, activeY]);
  const stickSpriteSrc = useMemo(() => getStickSprite(stickState), [stickState]);

  // Joystick touch/mouse drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsTouchDragging(true);
    updateJoystickPos(e.clientX, e.clientY);
  };

  const updateJoystickPos = useCallback((clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 8;

    const clampedDist = Math.min(maxRadius, dist);
    const normX = dist > 0 ? (dx / dist) * (clampedDist / maxRadius) : 0;
    const normY = dist > 0 ? (dy / dist) * (clampedDist / maxRadius) : 0;

    setTouchTilt({ x: normX, y: normY });

    // Map to arrow keys with standard deadzone
    const threshold = 0.28;
    onKeyChange('ArrowLeft', normX < -threshold);
    onKeyChange('ArrowRight', normX > threshold);
    onKeyChange('ArrowUp', normY < -threshold);
    onKeyChange('ArrowDown', normY > threshold);

    // Sprint when pushed far to edge
    onKeyChange('Shift', clampedDist / maxRadius > 0.88);
  }, [onKeyChange]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    updateJoystickPos(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    setIsTouchDragging(false);
    setTouchTilt({ x: 0, y: 0 });
    onKeyChange('ArrowLeft', false);
    onKeyChange('ArrowRight', false);
    onKeyChange('ArrowUp', false);
    onKeyChange('ArrowDown', false);
    onKeyChange('Shift', false);
  };

  // Button Action Triggers (Press and release for power bar / tap kicks)
  // Left: S (Shoot / Standing Tackle)
  const handleShootDown = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, S: true }));
    if (onActionPress) onActionPress('shoot');
    else if (hasBall) onKeyChange('KeyA', true);
    else onKeyChange('KeyS', true);
  };
  const handleShootUp = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, S: false }));
    if (onActionRelease) onActionRelease('shoot');
    else {
      onKeyChange('KeyA', false);
      onKeyChange('KeyS', false);
    }
  };

  // Bottom: P (Pass / Push)
  const handlePassDown = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, P: true }));
    if (onActionPress) onActionPress('pass');
    else if (hasBall) onKeyChange('KeyS', true);
    else onKeyChange('KeyW', true);
  };
  const handlePassUp = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, P: false }));
    if (onActionRelease) onActionRelease('pass');
    else {
      onKeyChange('KeyS', false);
      onKeyChange('KeyW', false);
    }
  };

  // Right: C (Cross / Sliding Tackle)
  const handleCrossDown = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, C: true }));
    if (onActionPress) onActionPress('cross');
    else onKeyChange('KeyD', true);
  };
  const handleCrossUp = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, C: false }));
    if (onActionRelease) onActionRelease('cross');
    else onKeyChange('KeyD', false);
  };

  // Top: L (Long Pass / Clear)
  const handleLongPassDown = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, L: true }));
    if (onActionPress) onActionPress('long_pass');
    else if (hasBall) onKeyChange('KeyW', true);
    else onKeyChange('KeyA', true);
  };
  const handleLongPassUp = (e?: React.PointerEvent) => {
    e?.preventDefault();
    setTouchPressed(prev => ({ ...prev, L: false }));
    if (onActionRelease) onActionRelease('long_pass');
    else {
      onKeyChange('KeyW', false);
      onKeyChange('KeyA', false);
    }
  };

  // Button active press states (from keyboard or touch)
  const isQPressed = !!keys.KeyQ || !!touchPressed.Q;
  const isEPressed = !!keys.KeyE || !!touchPressed.E;
  const isGPressed = !!keys.Space || !!touchPressed.G;
  const isShootPressed = (hasBall ? !!keys.KeyA : !!keys.KeyS) || !!touchPressed.S;
  const isPassPressed = (hasBall ? !!keys.KeyS : !!keys.KeyW) || !!touchPressed.P;
  const isCrossPressed = !!keys.KeyD || !!touchPressed.C;
  const isLongPassPressed = (hasBall ? !!keys.KeyW : !!keys.KeyA) || !!touchPressed.L;

  // Pre-rendered 32-bit button sprites
  const qSprite = getButtonSprite('Q', isQPressed);
  const eSprite = getButtonSprite('E', isEPressed);
  const gSprite = getButtonSprite('G', isGPressed);
  const pauseSprite = getButtonSprite('PAUSE', isPaused);
  const lSprite = getButtonSprite('L', isLongPassPressed);
  const sSprite = getButtonSprite('S', isShootPressed);
  const cSprite = getButtonSprite('C', isCrossPressed);
  const pSprite = getButtonSprite('P', isPassPressed);

  return (
    <footer className="relative w-full shrink-0 select-none bg-[#07131e] border-t-2 border-amber-500/90 shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),0_-8px_25px_rgba(0,0,0,0.85)] z-30">
      {/* 32-BIT MICRO-DOT TEXTURE OVERLAY */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />

      {/* 4 ORNATE GOLDEN FILIGREE CORNER BRACKETS */}
      <div className="absolute top-1 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400 pointer-events-none flex items-start justify-start">
        <div className="w-1 h-1 bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
      </div>
      <div className="absolute top-1 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400 pointer-events-none flex items-start justify-end">
        <div className="w-1 h-1 bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
      </div>
      <div className="absolute bottom-1 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400 pointer-events-none flex items-end justify-start">
        <div className="w-1 h-1 bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
      </div>
      <div className="absolute bottom-1 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400 pointer-events-none flex items-end justify-end">
        <div className="w-1 h-1 bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
      </div>

      {/* MAIN ARCADE CONSOLE CONTROL DECK (IMPROVED MOBILE DISTRIBUTION) */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between px-2 sm:px-5 md:px-8 py-1.5 sm:py-2.5">
        {/* ======================================================== */}
        {/* 1. LEFT: JOYSTICK FLANKED BY SPECIAL [Q] (WHITE) & [E] (BLACK) */}
        {/* ======================================================== */}
        <div className="relative flex items-center justify-center p-0.5 shrink-0">
          {/* Composite Stick Zone with Q at top-left and E at top-right */}
          <div className="relative w-32 h-34 sm:w-38 sm:h-38 flex items-center justify-center">
            {/* SPECIAL Q BUTTON: TOP-LEFT OF STICK (WHITE) */}
            <div className="absolute top-0 left-0 flex flex-col items-center z-20">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setTouchPressed(prev => ({ ...prev, Q: true }));
                  onKeyChange('KeyQ', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  setTouchPressed(prev => ({ ...prev, Q: false }));
                  onKeyChange('KeyQ', false);
                }}
                onPointerLeave={() => {
                  setTouchPressed(prev => ({ ...prev, Q: false }));
                  onKeyChange('KeyQ', false);
                }}
                onPointerCancel={() => {
                  setTouchPressed(prev => ({ ...prev, Q: false }));
                  onKeyChange('KeyQ', false);
                }}
                aria-label="Q: Ball Shielding / Nutmeg"
                title="Q: Ball Shielding / Nutmeg Skill (White)"
                className="w-9 h-9 sm:w-10 sm:h-10 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
              >
                <img
                  src={qSprite}
                  alt="Q"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
                />
              </button>
              <span className="font-['Press_Start_2P'] text-[6px] text-slate-300 mt-0.5 tracking-tighter">
                SHIELD
              </span>
            </div>

            {/* SPECIAL E BUTTON: TOP-RIGHT OF STICK (BLACK) */}
            <div className="absolute top-0 right-0 flex flex-col items-center z-20">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setTouchPressed(prev => ({ ...prev, E: true }));
                  onKeyChange('KeyE', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  setTouchPressed(prev => ({ ...prev, E: false }));
                  onKeyChange('KeyE', false);
                }}
                onPointerLeave={() => {
                  setTouchPressed(prev => ({ ...prev, E: false }));
                  onKeyChange('KeyE', false);
                }}
                onPointerCancel={() => {
                  setTouchPressed(prev => ({ ...prev, E: false }));
                  onKeyChange('KeyE', false);
                }}
                aria-label="E: Step-overs / Dash / Shirt Pull"
                title="E: Step-overs / Dash / Shirt Pull (Black)"
                className="w-9 h-9 sm:w-10 sm:h-10 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
              >
                <img
                  src={eSprite}
                  alt="E"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
                />
              </button>
              <span className="font-['Press_Start_2P'] text-[6px] text-slate-400 mt-0.5 tracking-tighter">
                SKILL
              </span>
            </div>

            {/* JOYSTICK BASE WITH 32-BIT FIXED SPRITE ANIMATION */}
            <div
              ref={joystickBaseRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute bottom-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center"
              title="32-Bit Arcade Joystick (Arrow keys or touch drag)"
            >
              <img
                src={stickSpriteSrc}
                alt="Joystick"
                width={100}
                height={100}
                className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. CENTER: PAUSE BUTTON ON TOP & [G] (GINGA) TOWARDS BOTTOM */}
        {/* ======================================================== */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-2 shrink-0 gap-1.5 sm:gap-2">
          {/* TOP: CIRCULAR PAUSE BUTTON */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              id="arcade-console-pause-btn"
              onClick={onTogglePause}
              aria-label="Pause Match"
              title="Pause Match (Options & Settings)"
              className="w-10 h-10 sm:w-12 sm:h-12 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
            >
              <img
                src={pauseSprite}
                alt="Pause"
                width={44}
                height={44}
                className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
              />
            </button>
            <span className="font-['Press_Start_2P'] text-[6px] sm:text-[7px] text-amber-400 mt-0.5 tracking-widest uppercase">
              {isPaused ? 'RESUME' : 'PAUSE'}
            </span>
          </div>

          {/* BOTTOM: G BUTTON (GINGA / SPACEBAR) */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setTouchPressed(prev => ({ ...prev, G: true }));
                onKeyChange('Space', true);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setTouchPressed(prev => ({ ...prev, G: false }));
                onKeyChange('Space', false);
              }}
              onPointerLeave={() => {
                setTouchPressed(prev => ({ ...prev, G: false }));
                onKeyChange('Space', false);
              }}
              onPointerCancel={() => {
                setTouchPressed(prev => ({ ...prev, G: false }));
                onKeyChange('Space', false);
              }}
              aria-label="G: Ginga Lift / Juggling / Sombrero"
              title="G: Ginga Aerial Lift / Juggling / Sombreros (Spacebar)"
              className="w-9 h-9 sm:w-10 sm:h-10 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
            >
              <img
                src={gSprite}
                alt="Ginga"
                width={40}
                height={40}
                className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
              />
            </button>
            <span className="font-['Press_Start_2P'] text-[6px] sm:text-[7px] text-amber-300 mt-0.5 tracking-wider uppercase">
              GINGA
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. RIGHT: 4 ARCADE BUTTONS IN DIAMOND FORMATION         */}
        {/* Top: L (Red) | Left: S (Blue) | Right: C (Yellow) | Bot: P (Green) */}
        {/* ======================================================== */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center p-0.5 shrink-0">
          {/* TOP BUTTON: L (Long Pass / Clearance) - RED */}
          <button
            type="button"
            onPointerDown={handleLongPassDown}
            onPointerUp={handleLongPassUp}
            onPointerLeave={handleLongPassUp}
            onPointerCancel={handleLongPassUp}
            aria-label="L: Long Pass / Aerial Clearance"
            title="L: Long Pass / Aerial Clearance"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 sm:w-11 sm:h-11 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
          >
            <img
              src={lSprite}
              alt="L"
              width={48}
              height={48}
              className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
            />
          </button>

          {/* LEFT BUTTON: S (Shoot / Standing Tackle) - BLUE */}
          <button
            type="button"
            onPointerDown={handleShootDown}
            onPointerUp={handleShootUp}
            onPointerLeave={handleShootUp}
            onPointerCancel={handleShootUp}
            aria-label="S: Shoot at Goal / Standing Tackle"
            title="S: Shoot at Goal / Standing Tackle"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
          >
            <img
              src={sSprite}
              alt="S"
              width={48}
              height={48}
              className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
            />
          </button>

          {/* RIGHT BUTTON: C (Cross / Sliding Tackle) - YELLOW */}
          <button
            type="button"
            onPointerDown={handleCrossDown}
            onPointerUp={handleCrossUp}
            onPointerLeave={handleCrossUp}
            onPointerCancel={handleCrossUp}
            aria-label="C: Curled Cross into Box / Sliding Tackle"
            title="C: Curled Cross into Box / Sliding Tackle"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
          >
            <img
              src={cSprite}
              alt="C"
              width={48}
              height={48}
              className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
            />
          </button>

          {/* BOTTOM BUTTON: P (Pass / Push) - GREEN */}
          <button
            type="button"
            onPointerDown={handlePassDown}
            onPointerUp={handlePassUp}
            onPointerLeave={handlePassUp}
            onPointerCancel={handlePassUp}
            aria-label="P: Short Ground Pass / Push Foul"
            title="P: Short Ground Pass / Push Foul"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 sm:w-11 sm:h-11 cursor-pointer active:scale-95 transition-transform select-none touch-manipulation focus:outline-none"
          >
            <img
              src={pSprite}
              alt="P"
              width={48}
              height={48}
              className="w-full h-full object-contain pointer-events-none [image-rendering:pixelated]"
            />
          </button>
        </div>
      </div>
    </footer>
  );
};
