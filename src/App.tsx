/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatchEngine } from './game/engine';
import { KeyState, DifficultyLevel, PlayerIndicatorType, PlayerIndicatorStyle } from './types';
import { PitchCanvas } from './components/PitchCanvas';
import { MatchHUD, HudDisplayMode } from './components/MatchHUD';
import { PauseModal } from './components/PauseModal';
import { ArcadeConsole, ActionModifier, ControllerBgMode, ControllerTheme } from './components/ArcadeConsole';
import { RadarMinimap, MinimapMode, RadarZoom } from './components/RadarMinimap';
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
  const [controlledPlayer, setControlledPlayer] = useState(engine.getControlledPlayer());

  // Camera & Radar focus target ('ball' or 'player')
  const [cameraFocus, setCameraFocus] = useState<'ball' | 'player'>('ball');

  const handleToggleCameraFocus = () => {
    const next = engine.toggleCameraFocus();
    setCameraFocus(next);
    engine.setBanner(`FOCUS: ${next.toUpperCase()}`, 60);
    setBannerMessage(`FOCUS: ${next.toUpperCase()}`);
  };

  // Radar / Minimap settings state
  const [minimapMode, setMinimapMode] = useState<MinimapMode>(() => {
    try {
      const saved = localStorage.getItem('swos_minimap_mode');
      if (saved === 'solid' || saved === 'transparent' || saved === 'off') return saved;
    } catch {}
    return 'transparent';
  });

  const [minimapSonar, setMinimapSonar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('swos_minimap_sonar');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true; // Default to requested neon lights!
  });

  const [radarZoom, setRadarZoom] = useState<RadarZoom>(() => {
    try {
      const saved = localStorage.getItem('swos_radar_zoom');
      if (saved === 'full' || saved === 'zoom1' || saved === 'zoom2') return saved;
    } catch {}
    return 'full';
  });

  // HUD & Scoreboard settings state
  const [scoreboardMode, setScoreboardMode] = useState<HudDisplayMode>(() => {
    try {
      const saved = localStorage.getItem('swos_scoreboard_mode');
      if (saved === 'solid' || saved === 'transparent' || saved === 'off') return saved;
    } catch {}
    return 'solid';
  });

  const [specialActionTextMode, setSpecialActionTextMode] = useState<HudDisplayMode>(() => {
    try {
      const saved = localStorage.getItem('swos_action_text_mode');
      if (saved === 'solid' || saved === 'transparent' || saved === 'off') return saved;
    } catch {}
    return 'solid';
  });

  const [playerInfoMode, setPlayerInfoMode] = useState<HudDisplayMode>(() => {
    try {
      const saved = localStorage.getItem('swos_player_info_mode');
      if (saved === 'solid' || saved === 'transparent' || saved === 'off') return saved;
    } catch {}
    return 'solid';
  });

  // Controller deck customization state
  const [controllerBgMode, setControllerBgMode] = useState<ControllerBgMode>(() => {
    try {
      const saved = localStorage.getItem('swos_controller_bg_mode');
      if (saved === 'solid' || saved === 'transparent' || saved === 'floating') return saved;
    } catch {}
    return 'solid';
  });

  const [controllerTheme, setControllerTheme] = useState<ControllerTheme>(() => {
    try {
      const saved = localStorage.getItem('swos_controller_theme');
      if (saved === 'dark_blue' || saved === 'black' || saved === 'white' || saved === 'camo') return saved;
    } catch {}
    return 'dark_blue';
  });

  // Controlled Player Indicator settings state
  const [playerIndicatorType, setPlayerIndicatorType] = useState<PlayerIndicatorType>(() => {
    try {
      const saved = localStorage.getItem('swos_player_indicator_type');
      if (saved === 'small_arrow' || saved === 'big_arrow' || saved === 'circle') return saved;
    } catch {}
    return 'small_arrow';
  });

  const [playerIndicatorStyle, setPlayerIndicatorStyle] = useState<PlayerIndicatorStyle>(() => {
    try {
      const saved = localStorage.getItem('swos_player_indicator_style');
      if (saved === 'solid' || saved === 'transparent' || saved === 'off') return saved;
    } catch {}
    return 'solid';
  });

  const handlePlayerIndicatorTypeChange = (type: PlayerIndicatorType) => {
    setPlayerIndicatorType(type);
    try {
      localStorage.setItem('swos_player_indicator_type', type);
    } catch {}
  };

  const handlePlayerIndicatorStyleChange = (style: PlayerIndicatorStyle) => {
    setPlayerIndicatorStyle(style);
    try {
      localStorage.setItem('swos_player_indicator_style', style);
    } catch {}
  };

  const handleMinimapModeChange = (mode: MinimapMode) => {
    setMinimapMode(mode);
    try {
      localStorage.setItem('swos_minimap_mode', mode);
    } catch {}
  };

  const handleCycleMinimapMode = () => {
    const next: MinimapMode = minimapMode === 'transparent' ? 'solid' : minimapMode === 'solid' ? 'off' : 'transparent';
    handleMinimapModeChange(next);
  };

  const handleMinimapSonarChange = (sonar: boolean) => {
    setMinimapSonar(sonar);
    try {
      localStorage.setItem('swos_minimap_sonar', String(sonar));
    } catch {}
  };

  const handleToggleMinimapSonar = () => {
    handleMinimapSonarChange(!minimapSonar);
  };

  const handleRadarZoomChange = (zoom: RadarZoom) => {
    setRadarZoom(zoom);
    try {
      localStorage.setItem('swos_radar_zoom', zoom);
    } catch {}
  };

  const handleCycleRadarZoom = () => {
    const next: RadarZoom = radarZoom === 'full' ? 'zoom1' : radarZoom === 'zoom1' ? 'zoom2' : 'full';
    handleRadarZoomChange(next);
  };

  const handleScoreboardModeChange = (mode: HudDisplayMode) => {
    setScoreboardMode(mode);
    try {
      localStorage.setItem('swos_scoreboard_mode', mode);
    } catch {}
  };

  const handleSpecialActionTextModeChange = (mode: HudDisplayMode) => {
    setSpecialActionTextMode(mode);
    try {
      localStorage.setItem('swos_action_text_mode', mode);
    } catch {}
  };

  const handlePlayerInfoModeChange = (mode: HudDisplayMode) => {
    setPlayerInfoMode(mode);
    try {
      localStorage.setItem('swos_player_info_mode', mode);
    } catch {}
  };

  const handleControllerBgModeChange = (mode: ControllerBgMode) => {
    setControllerBgMode(mode);
    try {
      localStorage.setItem('swos_controller_bg_mode', mode);
    } catch {}
  };

  const handleControllerThemeChange = (theme: ControllerTheme) => {
    setControllerTheme(theme);
    try {
      localStorage.setItem('swos_controller_theme', theme);
    } catch {}
  };

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
    setControlledPlayer(cp);

    const now = Date.now();
    if (now - lastUiUpdateRef.current > 90) {
      lastUiUpdateRef.current = now;
      setScore({ ...engine.score });
      setMatchTime(engine.matchTimeSeconds);
      setMatchPhase(engine.matchPhase);
      setBannerMessage(engine.bannerMessage);
    }
  }, [engine]);

  // Direct action press/release callbacks with Q/E modifier support
  const handleActionPress = useCallback((action: 'pass' | 'shoot' | 'cross' | 'long_pass', modifier?: ActionModifier) => {
    engine.triggerActionPress(action, keysRef.current, modifier);
  }, [engine]);

  const handleActionRelease = useCallback((action: 'pass' | 'shoot' | 'cross' | 'long_pass', modifier?: ActionModifier) => {
    engine.triggerActionRelease(action, keysRef.current, modifier);
  }, [engine]);

  const handleModifierChange = useCallback((modifier: ActionModifier) => {
    engine.setActionModifier(modifier);
  }, [engine]);

  const handleDeflectionChange = useCallback((ratio: number) => {
    engine.analogSpeedRatio = ratio;
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#07131e] select-none">
      {/* FULL-VIEWPORT 2D CANVAS FOOTBALL FIELD (100% SCREEN COVERAGE) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <PitchCanvas
          engine={engine}
          keysRef={keysRef}
          onTick={handleTick}
          playerIndicatorType={playerIndicatorType}
          playerIndicatorStyle={playerIndicatorStyle}
        />
      </div>

      {/* 32-BIT RETRO SCOREBOARD, DRAWSTAR TV & BOTTOM-LEFT PLAYER INFO / SPECIAL ACTION TEXT */}
      <MatchHUD
        score={score}
        matchTimeSeconds={matchTime}
        matchPhase={matchPhase}
        bannerMessage={bannerMessage}
        controlledPlayer={controlledPlayer}
        scoreboardMode={scoreboardMode}
        specialActionTextMode={specialActionTextMode}
        playerInfoMode={playerInfoMode}
      />

      {/* 32-BIT RETRO RADAR MINIMAP AT BOTTOM RIGHT ABOVE CONTROLLER */}
      <RadarMinimap
        engine={engine}
        mode={minimapMode}
        sonar={minimapSonar}
        zoom={radarZoom}
        focusTarget={cameraFocus}
        onCycleMode={handleCycleMinimapMode}
        onToggleSonar={handleToggleMinimapSonar}
        onCycleZoom={handleCycleRadarZoom}
      />

      {/* 32-BIT ARCADE CONSOLE CONTROLLER DOCKED AT THE BOTTOM OVERLAYING PITCH */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
        <ArcadeConsole
          keys={keysRef.current}
          hasBall={hasBall}
          onKeyChange={handleTouchKeyChange}
          onActionPress={handleActionPress}
          onActionRelease={handleActionRelease}
          onModifierChange={handleModifierChange}
          onDeflectionChange={handleDeflectionChange}
          onTogglePause={handleTogglePause}
          isPaused={isPaused}
          controllerBgMode={controllerBgMode}
          controllerTheme={controllerTheme}
          cameraFocus={cameraFocus}
          onToggleCameraFocus={handleToggleCameraFocus}
        />
      </div>

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
        minimapMode={minimapMode}
        onChangeMinimapMode={handleMinimapModeChange}
        minimapSonar={minimapSonar}
        onChangeMinimapSonar={handleMinimapSonarChange}
        radarZoom={radarZoom}
        onChangeRadarZoom={handleRadarZoomChange}
        scoreboardMode={scoreboardMode}
        onChangeScoreboardMode={handleScoreboardModeChange}
        specialActionTextMode={specialActionTextMode}
        onChangeSpecialActionTextMode={handleSpecialActionTextModeChange}
        playerInfoMode={playerInfoMode}
        onChangePlayerInfoMode={handlePlayerInfoModeChange}
        controllerBgMode={controllerBgMode}
        onChangeControllerBgMode={handleControllerBgModeChange}
        controllerTheme={controllerTheme}
        onChangeControllerTheme={handleControllerThemeChange}
        playerIndicatorType={playerIndicatorType}
        onChangePlayerIndicatorType={handlePlayerIndicatorTypeChange}
        playerIndicatorStyle={playerIndicatorStyle}
        onChangePlayerIndicatorStyle={handlePlayerIndicatorStyleChange}
      />
    </div>
  );
}
