/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MatchScore, MatchPhase, Player } from '../types';
import { HOME_KIT, AWAY_KIT } from '../game/constants';
import { Tv, Radio, Sparkles, Activity } from 'lucide-react';

export type HudDisplayMode = 'solid' | 'transparent' | 'off';

interface MatchHUDProps {
  score: MatchScore;
  matchTimeSeconds: number;
  matchPhase: MatchPhase;
  bannerMessage: string | null;
  controlledPlayer?: Player;
  scoreboardMode?: HudDisplayMode;
  specialActionTextMode?: HudDisplayMode;
  playerInfoMode?: HudDisplayMode;
}

export const MatchHUD: React.FC<MatchHUDProps> = ({
  score,
  matchTimeSeconds,
  bannerMessage,
  controlledPlayer,
  scoreboardMode = 'solid',
  specialActionTextMode = 'solid',
  playerInfoMode = 'solid',
}) => {
  // Format match clock (e.g. 34:12)
  const totalMinutes = Math.min(90, Math.floor(matchTimeSeconds));
  const seconds = Math.floor((matchTimeSeconds % 1) * 60);
  const timeFormatted = `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isFirstHalf = totalMinutes < 45;
  const halfText = isFirstHalf ? '1ST HALF' : '2ND HALF';

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-3.5 select-none z-20">
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* 1. TOP ROW: SCOREBOARD (LEFT) & DRAWSTAR TV LOGO (RIGHT) */}
      {/* ======================================================== */}
      <div className="flex items-start justify-between w-full pointer-events-none">
        {scoreboardMode !== 'off' ? (
          <div
            className={`pointer-events-auto flex flex-col rounded-lg overflow-hidden border-2 transition-all duration-200 ${
              scoreboardMode === 'solid'
                ? 'border-amber-500/90 shadow-[0_8px_25px_rgba(0,0,0,0.85),0_0_12px_rgba(245,158,11,0.25)] bg-[#07131e]'
                : 'border-amber-500/60 shadow-[0_4px_16px_rgba(0,0,0,0.7)] bg-[#07131e]/70 backdrop-blur-md'
            }`}
          >
            {/* TOP 90s TV BROADCAST BUG / CHANNEL BANNER */}
            <div
              className={`flex items-center justify-between px-2.5 py-0.5 border-b ${
                scoreboardMode === 'solid'
                  ? 'bg-gradient-to-r from-[#0c2238] via-[#102a45] to-[#0c2238] border-amber-500/50'
                  : 'bg-black/40 border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Tv className="w-2.5 h-2.5 text-amber-400" />
                <span className="font-['Press_Start_2P'] text-[6px] sm:text-[7px] text-amber-400 font-bold tracking-wider uppercase">
                  MATCHDAY
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_4px_#f43f5e]" />
                <span className="font-['Press_Start_2P'] text-[6px] text-rose-400 font-bold tracking-tighter">
                  LIVE
                </span>
              </div>
            </div>

            {/* MAIN 32-BIT BEVELED SCOREBOARD DECK */}
            <div className="relative flex items-stretch">
              {/* CRT SCANLINE OVERLAY */}
              <div
                className="absolute inset-0 pointer-events-none opacity-15 z-10"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)',
                  backgroundSize: '100% 2px',
                }}
              />

              {/* HOME TEAM MODULE (ROYAL BLUE) */}
              <div
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 border-r-2 border-amber-500/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] ${
                  scoreboardMode === 'solid'
                    ? 'bg-gradient-to-b from-[#0e3c75] to-[#082348]'
                    : 'bg-blue-950/60'
                }`}
              >
                {/* Home Team Badge */}
                <div className="relative flex items-center justify-center">
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-blue-500 ring-1.5 ring-white shadow-sm flex items-center justify-center text-[6px] font-black text-white font-['Press_Start_2P']">
                    H
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-['Press_Start_2P'] text-[9px] sm:text-[10px] font-bold text-white tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {HOME_KIT.shortName}
                  </span>
                  <span className="text-[6px] text-blue-200 uppercase font-mono tracking-tighter hidden sm:inline">
                    ALL-STARS
                  </span>
                </div>
                {/* Score Digit */}
                <div className="ml-1 sm:ml-2 px-1.5 py-0.5 rounded bg-black/60 border border-amber-500/40 shadow-inner flex items-center justify-center min-w-[20px] sm:min-w-[24px]">
                  <span className="font-['Press_Start_2P'] text-xs sm:text-sm font-black text-amber-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
                    {score.home}
                  </span>
                </div>
              </div>

              {/* BROADCAST MATCH CLOCK & HALF PILLAR */}
              <div
                className={`flex flex-col items-center justify-center px-2.5 sm:px-3.5 py-1 border-r-2 border-amber-500/60 min-w-[68px] sm:min-w-[80px] ${
                  scoreboardMode === 'solid'
                    ? 'bg-gradient-to-b from-[#081524] to-[#040b12]'
                    : 'bg-black/60'
                }`}
              >
                {/* Digital Clock Readout */}
                <div className="flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse hidden sm:inline" />
                  <span className="font-['Press_Start_2P'] text-[10px] sm:text-[11px] font-black text-emerald-400 tracking-wider drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">
                    {timeFormatted}
                  </span>
                </div>
                {/* Period Indicator */}
                <span className="font-['Press_Start_2P'] text-[6px] sm:text-[7px] font-bold text-amber-300 tracking-wider mt-0.5">
                  {halfText}
                </span>
              </div>

              {/* AWAY TEAM MODULE (CRIMSON RED) */}
              <div
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] ${
                  scoreboardMode === 'solid'
                    ? 'bg-gradient-to-b from-[#7f1d1d] to-[#450a0a]'
                    : 'bg-red-950/60'
                }`}
              >
                {/* Score Digit */}
                <div className="mr-1 sm:mr-2 px-1.5 py-0.5 rounded bg-black/60 border border-amber-500/40 shadow-inner flex items-center justify-center min-w-[20px] sm:min-w-[24px]">
                  <span className="font-['Press_Start_2P'] text-xs sm:text-sm font-black text-amber-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
                    {score.away}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-['Press_Start_2P'] text-[9px] sm:text-[10px] font-bold text-white tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {AWAY_KIT.shortName}
                  </span>
                  <span className="text-[6px] text-red-200 uppercase font-mono tracking-tighter hidden sm:inline">
                    LEGENDS
                  </span>
                </div>
                {/* Away Team Badge */}
                <div className="relative flex items-center justify-center">
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-600 ring-1.5 ring-white shadow-sm flex items-center justify-center text-[6px] font-black text-white font-['Press_Start_2P']">
                    A
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : <div />}

        {/* TOP RIGHT: AUTHENTIC 90s "DrawStar TV" BROADCAST LOGO (PURE 32-BIT RETRO TEXT, NO BACKGROUND) */}
        <div className="pointer-events-auto flex items-center select-none pt-0.5 sm:pt-1 pr-1 sm:pr-2">
          <div className="flex items-baseline gap-1 sm:gap-1.5">
            {/* 32-bit Star Icon */}
            <span
              className="font-['Press_Start_2P'] text-[10px] sm:text-[13px] text-amber-400 select-none animate-pulse"
              style={{
                textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 3px 3px 0 rgba(0,0,0,0.9), 0 0 8px rgba(251,191,36,0.7)',
              }}
            >
              ★
            </span>
            {/* DrawStar 32-bit 90s Wordmark */}
            <span
              className="font-['Press_Start_2P'] text-[10px] sm:text-[13px] font-black italic tracking-wider sm:tracking-widest uppercase bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent"
              style={{
                filter: 'drop-shadow(2px 2px 0px #000000) drop-shadow(-1px -1px 0px #000000) drop-shadow(3px 3px 2px rgba(0,0,0,0.85))',
              }}
            >
              DRAWSTAR
            </span>
            {/* 90s 32-bit TV Text */}
            <span
              className="font-['Press_Start_2P'] text-[9px] sm:text-[11px] font-black italic tracking-tight uppercase bg-gradient-to-b from-rose-400 via-red-500 to-rose-600 bg-clip-text text-transparent"
              style={{
                filter: 'drop-shadow(2px 2px 0px #000000) drop-shadow(-1px -1px 0px #000000) drop-shadow(3px 3px 2px rgba(0,0,0,0.85))',
              }}
            >
              TV
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BOTTOM LEFT: SPECIAL ACTION TEXT & CONTROLLED PLAYER INFO */}
      {/* Anchored cleanly ABOVE the bottom arcade controller deck */}
      {/* ======================================================== */}
      <div className="absolute bottom-[160px] sm:bottom-[175px] md:bottom-[180px] left-2.5 sm:left-4 pointer-events-auto flex flex-col items-start gap-1.5 max-w-[280px] sm:max-w-sm z-20 select-none">
        {/* TOP ITEM: SPECIAL ACTION NOTIFICATION BANNER (NUTMEG, BULLET SHOT, ETC.) */}
        {bannerMessage && specialActionTextMode !== 'off' && (
          <div
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 animate-in fade-in duration-150 transition-all ${
              specialActionTextMode === 'solid'
                ? 'bg-gradient-to-r from-[#0c2238] via-[#163554] to-[#0c2238] border-amber-400 text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.9),0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-[#07131e]/75 backdrop-blur-sm border-amber-400/80 text-amber-300 shadow-[0_4px_12px_rgba(0,0,0,0.7)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-['Press_Start_2P'] text-[8px] sm:text-[9px] font-bold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {bannerMessage}
            </span>
          </div>
        )}

        {/* BOTTOM ITEM: CONTROLLED PLAYER CARD (NAME, NUMBER, STAMINA) */}
        {controlledPlayer && playerInfoMode !== 'off' && (
          <div
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all ${
              playerInfoMode === 'solid'
                ? 'bg-[#07131e] border-amber-500/80 shadow-[0_4px_16px_rgba(0,0,0,0.85)]'
                : 'bg-[#07131e]/75 backdrop-blur-sm border-amber-500/60 shadow-[0_4px_12px_rgba(0,0,0,0.6)]'
            }`}
          >
            {/* SHIRT NUMBER BADGE */}
            <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <span className="font-['Press_Start_2P'] text-[9px] font-black text-amber-300">
                #{controlledPlayer.number}
              </span>
            </div>

            {/* PLAYER NAME & ROLE */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-['Press_Start_2P'] text-[8px] sm:text-[9px] font-bold text-white tracking-wider">
                  {controlledPlayer.name.toUpperCase()}
                </span>
                <span className="text-[7px] font-mono font-bold px-1 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  {controlledPlayer.role}
                </span>
              </div>

              {/* MINI STAMINA METER */}
              <div className="flex items-center gap-1 mt-1">
                <Activity className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <div className="w-20 sm:w-24 h-1.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.max(5, Math.min(100, controlledPlayer.stamina))}%`,
                      backgroundColor:
                        controlledPlayer.stamina > 50
                          ? '#10b981'
                          : controlledPlayer.stamina > 25
                          ? '#facc15'
                          : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
