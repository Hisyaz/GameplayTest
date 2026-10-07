import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Info, Languages, Eye, Zap, Shield, Sparkles, Bot, CheckCircle2, Gauge } from 'lucide-react';
import { HOME_KIT, AWAY_KIT } from '../game/constants';
import { audio } from '../game/audio';
import { t, Language } from '../game/i18n';
import { DifficultyLevel } from '../types';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onResetKickoff: () => void;
  homeScore: number;
  awayScore: number;
  currentLang?: Language;
  onToggleLanguage?: () => void;
  difficulty: DifficultyLevel;
  onChangeDifficulty: (diff: DifficultyLevel) => void;
  gameSpeed?: number;
  onChangeGameSpeed?: (speed: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onResetKickoff,
  homeScore,
  awayScore,
  currentLang = 'en',
  onToggleLanguage,
  difficulty,
  onChangeDifficulty,
  gameSpeed = 100,
  onChangeGameSpeed,
}) => {
  if (!isOpen) return null;

  const [muted, setMuted] = React.useState(audio.getMuted());

  const handleToggleSound = () => {
    const nextMute = audio.toggleMute();
    setMuted(nextMute);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#07131e] border-2 border-amber-500 rounded-xl shadow-[0_0_50px_rgba(245,158,11,0.35),inset_0_2px_4px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
        {/* 4 ORNATE GOLDEN CORNER BRACKETS */}
        <div className="absolute top-1 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute top-1 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute bottom-1 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-400 pointer-events-none z-20" />
        <div className="absolute bottom-1 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-400 pointer-events-none z-20" />

        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-[#0d2136] via-[#091522] to-[#0d2136] border-b-2 border-amber-500/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <h2 className="font-['Press_Start_2P'] text-xs sm:text-sm text-amber-400 tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {t('matchPaused')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onToggleLanguage && (
              <button
                onClick={onToggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0f2842] border border-amber-500/60 hover:border-amber-400 text-amber-400 hover:text-white transition cursor-pointer font-['Press_Start_2P'] text-[9px] shadow-sm"
                title="Switch Language"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{currentLang.toUpperCase()}</span>
              </button>
            )}
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-lg bg-[#0f2842] border border-amber-500/60 hover:border-amber-400 text-slate-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Toggle Sound"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {/* SCORE SUMMARY */}
          <div className="flex items-center justify-center gap-6 py-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="flex flex-col items-center">
              <span className="font-bold text-xs sm:text-sm text-blue-400">{HOME_KIT.name}</span>
              <span className="font-['Press_Start_2P'] text-xl sm:text-2xl text-white mt-1">{homeScore}</span>
            </div>
            <span className="font-['Press_Start_2P'] text-xs text-slate-500">VS</span>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xs sm:text-sm text-red-400">{AWAY_KIT.name}</span>
              <span className="font-['Press_Start_2P'] text-xl sm:text-2xl text-white mt-1">{awayScore}</span>
            </div>
          </div>

          {/* GAME SPEED SLIDER (1% - 200%) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                <Gauge className="w-4 h-4 text-amber-400" />
                <span className="font-mono uppercase tracking-wider">GAME SPEED SLIDER</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                CURRENT: <b className="text-amber-400">{gameSpeed}%</b>
                <span className="text-slate-400 ml-1">
                  {gameSpeed === 100 ? '(BASE 30% SLOWER)' : gameSpeed < 100 ? '(SLOW-MO)' : '(FAST)'}
                </span>
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-slate-400 w-6">1%</span>
                <input
                  id="pause-game-speed-slider"
                  type="range"
                  min="1"
                  max="200"
                  value={gameSpeed}
                  onChange={(e) => onChangeGameSpeed && onChangeGameSpeed(Number(e.target.value))}
                  aria-label="Game Speed Slider (1% to 200%)"
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="font-mono text-[10px] text-slate-400 w-10 text-right">200%</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[
                  { label: '25%', val: 25, title: 'Quarter Speed' },
                  { label: '50%', val: 50, title: 'Half Speed' },
                  { label: '100%', val: 100, title: 'Base Speed (30% Slower)' },
                  { label: '150%', val: 150, title: '1.5x Speed' },
                  { label: '200%', val: 200, title: 'Double Speed' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => onChangeGameSpeed && onChangeGameSpeed(preset.val)}
                    title={preset.title}
                    className={`py-1 px-1 rounded text-center font-mono text-[10px] font-bold border transition cursor-pointer ${
                      gameSpeed === preset.val
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                        : 'bg-slate-900 hover:bg-slate-850 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-slate-400 leading-tight pt-1">
                The game base speed is lowered by 30% at 100%. Move the slider between 1% (tactical slow-motion) and 200% (high-speed arcade intensity) at any moment.
              </p>
            </div>
          </div>

          {/* AI DIFFICULTY SELECTION */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                <Bot className="w-4 h-4 text-sky-400" />
                <span className="font-mono uppercase tracking-wider">AI OPPONENT DIFFICULTY</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                ACTIVE: <b className="text-amber-400">{difficulty.toUpperCase()}</b>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* STANDING (PRACTICE) */}
              <button
                id="diff-standing-btn"
                onClick={() => onChangeDifficulty('standing')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                  difficulty === 'standing'
                    ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/50 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`font-['Press_Start_2P'] text-[10px] ${difficulty === 'standing' ? 'text-amber-400' : 'text-slate-300'}`}>
                    STANDING (PRACTICE)
                  </span>
                  {difficulty === 'standing' && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Opposing team stands still and doesn't do anything. Only the goalkeeper can save and pass out. Perfect for testing skills and passes!
                </p>
              </button>

              {/* EASY (DYNAMIC) */}
              <button
                id="diff-easy-btn"
                onClick={() => onChangeDifficulty('easy')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                  difficulty === 'easy'
                    ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`font-['Press_Start_2P'] text-[10px] ${difficulty === 'easy' ? 'text-emerald-400' : 'text-slate-300'}`}>
                    EASY (DYNAMIC)
                  </span>
                  {difficulty === 'easy' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Opponents defend, pass & score, but automatically relax and give room if 2+ goals ahead, and try harder if losing by 2+ goals.
                </p>
              </button>
            </div>
          </div>

          {/* CONTROLS GUIDE */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <Info className="w-4 h-4 text-amber-400" />
                <span>{t('controlsCheatSheet')}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">11v11 ARCADE</span>
            </div>

            {/* BASIC CONTROLS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('movement')}</div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono text-slate-400">Arrow Keys</span>
                  <span className="font-semibold text-white">{t('movePlayer')}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono text-slate-400">Shift</span>
                  <span className="font-semibold text-amber-300">{t('sprint')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{t('withBall')}</div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono font-bold text-emerald-300">S</span>
                  <span>{t('shortPass')}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono font-bold text-emerald-300">W</span>
                  <span>{t('longPass')}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono font-bold text-emerald-300">A</span>
                  <span>{t('shoot')}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="font-mono font-bold text-emerald-300">D</span>
                  <span>{t('cross')}</span>
                </div>
              </div>
            </div>

            {/* GINGA SYSTEM: JUGGLING, SOMBREROS & ACROBATIC VOLLEYS */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>GINGA SYSTEM & AERIAL VOLLEYS ([G] BUTTON / SPACEBAR)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {/* Spacebar Lift / Sombrero */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-amber-300 text-[10px] block">{t('gingaTitle')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('gingaDesc')}</p>
                </div>

                {/* Acrobatic Flair & Volleys */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-cyan-300 text-[10px] block">{t('volleysTitle')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('volleysDesc')}</p>
                </div>
              </div>
            </div>

            {/* ADVANCED SKILLS: E & Q (Full User Prompt Mechanics) */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>SPECIAL SKILLS & DRIBBLES (E & Q)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {/* E Autopass */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-pink-300 text-[10px] block">{t('eAutopass')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('eAutopassDesc')}</p>
                </div>

                {/* E Step-overs */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-pink-300 text-[10px] block">{t('eStepOvers')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('eStepOversDesc')}</p>
                </div>

                {/* E Rainbow Flick */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-pink-300 text-[10px] block">{t('eRainbowFlick')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('eRainbowFlickDesc')}</p>
                </div>

                {/* Q Short Skills */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-purple-300 text-[10px] block">{t('qNutmegCruyff')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('qNutmegCruyffDesc')}</p>
                </div>
              </div>
            </div>

            {/* DEFENSE: SHOULDER HIT & SHIRT PULL & TACKLES */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>DEFENSE & FOULS (WITHOUT BALL)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {/* Q Shoulder Hit */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-purple-300 text-[10px] block">{t('qShoulderHit')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('qShoulderHitDesc')}</p>
                </div>

                {/* E Shirt Pull */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-pink-300 text-[10px] block">{t('eShirtPull')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('eShirtPullDesc')}</p>
                </div>

                {/* Standard Defense Controls */}
                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <b className="text-emerald-400">S:</b> {t('tackle')}
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <b className="text-sky-400">D:</b> {t('slide')}
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <b className="text-rose-400">A:</b> {t('clear')}
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <b className="text-amber-400">W:</b> {t('pushFoul')}
                  </div>
                </div>
              </div>
            </div>

            {/* REFEREE SIGHT & SET PIECES */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>REFEREE VISION & SET PIECES</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div className="space-y-1">
                  <span className="font-bold text-yellow-300 text-[10px] block">{t('refereeSight')}</span>
                  <p className="text-[10px] text-slate-300 leading-tight">{t('refereeSightDesc')}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-yellow-300 text-[10px] block">Set Pieces Mechanics</span>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Freekicks, Penalties (point & shoot only), Corners, Goal Kicks, and Throw-ins with full arrow pointing, aiming line, and power charge.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 shrink-0">
            <button
              id="resume-btn"
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P'] text-xs shadow-lg transition active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              {t('resume')}
            </button>

            <button
              id="reset-kickoff-btn"
              onClick={() => {
                onResetKickoff();
                onResume();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-400 hover:text-amber-300 font-['Press_Start_2P'] text-[11px] shadow-lg transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              {t('resetKickoff')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
