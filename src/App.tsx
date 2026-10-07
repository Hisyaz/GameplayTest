/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatchEngine } from './game/engine';
import { KeyState, DifficultyLevel } from './types';
import { PitchCanvas } from './components/PitchCanvas';
import { MatchHUD } from './components/MatchHUD';
import { PauseModal } from './components/PauseModal';
import { ArcadeConsole } from './components/ArcadeConsole';
import { getLanguage, setLanguage, Language } from './game/i18n';

export default function App() {
  const engineRef = useRef<MatchEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new MatchEngine();
  }
  const engine = engineRef.current;

  // Key state tracker
  const keysRef = useRef<KeyState>({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Shift: false,
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyQ: false,
    KeyE: false,
  });

  // State synced to React UI
  const [isPaused, setIsPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(engine.difficulty);
  const [gameSpeed, setGameSpeed] = useState<number>(engine.gameSpeed);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [matchTime, setMatchTime] = useState(0);
  const [matchPhase, setMatchPhase] = useState(engine.matchPhase);
  const [bannerMessage, setBannerMessage] = useState<string | null>(engine.bannerMessage);
  const [currentLang, setCurrentLang] = useState<Language>(getLanguage());
  const [hasBall, setHasBall] = useState(false);

  const handleToggleLanguage = () => {
    const nextLang: Language = currentLang === 'en' ? 'es' : 'en';
    setLanguage(nextLang);
    setCurrentLang(nextLang);
  };

  const handleGameSpeedChange = (speed: number) => {
    const clamped = Math.max(1, Math.min(200, Math.round(speed)));
    engine.gameSpeed = clamped;
    setGameSpeed(clamped);
  };

  // Sync tick data to React state (throttled to 10 FPS for UI performance)
  const lastUiUpdateRef = useRef(0);
  const handleTick = useCallback(() => {
    const cp = engine.getControlledPlayer();
    const distToBall = Math.hypot(engine.ball.x - (cp?.x || 0), engine.ball.y - (cp?.y || 0));
    const ownsBall = !!cp && (engine.ball.ownerId === cp.id || (!engine.ball.ownerId && distToBall < 26 && engine.ball.z < 8));
    setHasBall(ownsBall);

    const now = Date.now();
    if (now - lastUiUpdateRef.current > 90) {
      lastUiUpdateRef.current = now;
      setScore({ ...engine.score });
      setMatchTime(engine.matchTimeSeconds);
      setMatchPhase(engine.matchPhase);
      setBannerMessage(engine.bannerMessage);
    }
  }, [engine]);

  // Direct action press/release callbacks for exact-millisecond execution
  const handleActionPress = useCallback((action: 'pass' | 'shoot' | 'cross' | 'long_pass') => {
    engine.triggerActionPress(action, keysRef.current);
  }, [engine]);

  const handleActionRelease = useCallback((action: 'pass' | 'shoot' | 'cross' | 'long_pass') => {
    engine.triggerActionRelease(action, keysRef.current);
  }, [engine]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Pause with Escape key
      if (e.code === 'Escape') {
        const paused = engine.togglePause();
        setIsPaused(paused);
        e.preventDefault();
        return;
      }

      // Intercept navigation keys to prevent browser scrolling
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }

      const k = keysRef.current;
      const code = e.code;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      if (code === 'ArrowUp') k.ArrowUp = true;
      else if (code === 'ArrowDown') k.ArrowDown = true;
      else if (code === 'ArrowLeft') k.ArrowLeft = true;
      else if (code === 'ArrowRight') k.ArrowRight = true;
      else if (e.key === 'Shift' || code === 'ShiftLeft' || code === 'ShiftRight') k.Shift = true;
      else if (code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || code === 'KeyG' || keyLower === 'g') k.Space = true;
      else if (code === 'KeyQ' || keyLower === 'q') k.KeyQ = true;
      else if (code === 'KeyE' || keyLower === 'e') k.KeyE = true;
      // Single letter arcade buttons (instant press execution or power charging):
      // Pass (P):
      else if (code === 'KeyP' || keyLower === 'p') {
        k.KeyS = true;
        engine.triggerActionPress('pass', k);
      }
      // Shoot (S or A):
      else if (code === 'KeyS' || keyLower === 's' || code === 'KeyA' || keyLower === 'a') {
        k.KeyA = true;
        engine.triggerActionPress('shoot', k);
      }
      // Cross (C or D):
      else if (code === 'KeyC' || keyLower === 'c' || code === 'KeyD' || keyLower === 'd') {
        k.KeyD = true;
        engine.triggerActionPress('cross', k);
      }
      // Long Pass (L or W):
      else if (code === 'KeyL' || keyLower === 'l' || code === 'KeyW' || keyLower === 'w') {
        k.KeyW = true;
        engine.triggerActionPress('long_pass', k);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      const code = e.code;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      if (code === 'ArrowUp') k.ArrowUp = false;
      else if (code === 'ArrowDown') k.ArrowDown = false;
      else if (code === 'ArrowLeft') k.ArrowLeft = false;
      else if (code === 'ArrowRight') k.ArrowRight = false;
      else if (e.key === 'Shift' || code === 'ShiftLeft' || code === 'ShiftRight') k.Shift = false;
      else if (code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || code === 'KeyG' || keyLower === 'g') k.Space = false;
      else if (code === 'KeyQ' || keyLower === 'q') k.KeyQ = false;
      else if (code === 'KeyE' || keyLower === 'e') k.KeyE = false;
      // Single letter arcade buttons (instant exact millisecond execution on release):
      // Pass (P):
      else if (code === 'KeyP' || keyLower === 'p') {
        k.KeyS = false;
        k.KeyW = false;
        engine.triggerActionRelease('pass', k);
      }
      // Shoot (S or A):
      else if (code === 'KeyS' || keyLower === 's' || code === 'KeyA' || keyLower === 'a') {
        k.KeyA = false;
        k.KeyS = false;
        engine.triggerActionRelease('shoot', k);
      }
      // Cross (C or D):
      else if (code === 'KeyC' || keyLower === 'c' || code === 'KeyD' || keyLower === 'd') {
        k.KeyD = false;
        engine.triggerActionRelease('cross', k);
      }
      // Long Pass (L or W):
      else if (code === 'KeyL' || keyLower === 'l' || code === 'KeyW' || keyLower === 'w') {
        k.KeyW = false;
        k.KeyA = false;
        engine.triggerActionRelease('long_pass', k);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine]);

  const handleTogglePause = () => {
    const nextPaused = engine.togglePause();
    setIsPaused(nextPaused);
  };

  const handleResetKickoff = () => {
    engine.resetToKickoff(false, true);
    setScore({ home: 0, away: 0 });
    setMatchTime(0);
    setMatchPhase('kickoff_ready');
    setIsPaused(false);
    setBannerMessage('MATCH RESET - 0-0 KICKOFF');
  };

  const handleChangeDifficulty = (newDiff: DifficultyLevel) => {
    engine.difficulty = newDiff;
    setDifficulty(newDiff);
  };

  const handleTouchKeyChange = (key: keyof KeyState, pressed: boolean) => {
    keysRef.current[key] = pressed;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07131e] select-none flex flex-col">
      {/* UPPER 2D CANVAS FOOTBALL FIELD */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <PitchCanvas
          engine={engine}
          keysRef={keysRef}
          onTick={handleTick}
        />

        {/* 32-BIT RETRO SCOREBOARD AT TOP LEFT ONLY */}
        <MatchHUD
          score={score}
          matchTimeSeconds={matchTime}
          matchPhase={matchPhase}
          bannerMessage={bannerMessage}
        />
      </div>

      {/* 32-BIT ARCADE CONSOLE CONTROLLER DOCKED AT THE BOTTOM */}
      <ArcadeConsole
        keys={keysRef.current}
        hasBall={hasBall}
        onKeyChange={handleTouchKeyChange}
        onActionPress={handleActionPress}
        onActionRelease={handleActionRelease}
        onTogglePause={handleTogglePause}
        isPaused={isPaused}
      />

      {/* PAUSE MODAL (All match options, 32-bit style) */}
      <PauseModal
        isOpen={isPaused}
        onResume={handleTogglePause}
        onResetKickoff={handleResetKickoff}
        homeScore={score.home}
        awayScore={score.away}
        currentLang={currentLang}
        onToggleLanguage={handleToggleLanguage}
        difficulty={difficulty}
        onChangeDifficulty={handleChangeDifficulty}
        gameSpeed={gameSpeed}
        onChangeGameSpeed={handleGameSpeedChange}
      />
    </div>
  );
}
