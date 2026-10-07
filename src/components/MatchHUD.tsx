import React from 'react';
import { MatchScore, MatchPhase } from '../types';
import { HOME_KIT, AWAY_KIT } from '../game/constants';

interface MatchHUDProps {
  score: MatchScore;
  matchTimeSeconds: number;
  matchPhase: MatchPhase;
  bannerMessage: string | null;
}

export const MatchHUD: React.FC<MatchHUDProps> = ({
  score,
  matchTimeSeconds,
  bannerMessage,
}) => {
  // Format match clock (e.g. 34:12)
  const totalMinutes = Math.min(90, Math.floor(matchTimeSeconds));
  const seconds = Math.floor((matchTimeSeconds % 1) * 60);
  const timeFormatted = `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const halfText = totalMinutes < 45 ? '1ST' : '2ND';

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5 sm:p-3.5 select-none z-20">
      {/* TOP LEFT: 32-BIT RETRO SCOREBOARD */}
      <div className="flex items-start justify-start w-full">
        <div className="pointer-events-auto flex items-center bg-[#07131e]/95 backdrop-blur-md border-2 border-amber-500/90 shadow-[0_4px_12px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.15)] rounded-lg overflow-hidden">
          {/* Home Team */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-950/60 border-r border-amber-500/40">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500 ring-1 ring-white/60 inline-block shadow-sm" />
            <span className="font-['Press_Start_2P'] text-[9px] sm:text-[11px] font-bold text-white tracking-wider">
              {HOME_KIT.shortName}
            </span>
            <span className="font-['Press_Start_2P'] text-xs sm:text-sm font-black text-amber-400 ml-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              {score.home}
            </span>
          </div>

          {/* Time & Period */}
          <div className="flex flex-col items-center px-2.5 sm:px-3 py-1 bg-[#050c14]/90 border-r border-amber-500/40">
            <span className="font-['Press_Start_2P'] text-[10px] sm:text-xs text-white tracking-widest drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              {timeFormatted}
            </span>
            <span className="font-['Press_Start_2P'] text-[7px] font-bold text-emerald-400 tracking-wider mt-0.5">
              {halfText} HALF
            </span>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-red-950/60">
            <span className="font-['Press_Start_2P'] text-xs sm:text-sm font-black text-amber-400 mr-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              {score.away}
            </span>
            <span className="font-['Press_Start_2P'] text-[9px] sm:text-[11px] font-bold text-white tracking-wider">
              {AWAY_KIT.shortName}
            </span>
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 ring-1 ring-white/60 inline-block shadow-sm" />
          </div>
        </div>
      </div>

      {/* BANNER NOTIFICATION (GOAL, FOUL, RED CARD, KICKOFF) */}
      {bannerMessage && (
        <div className="self-center my-auto px-5 py-2.5 sm:px-6 sm:py-3 bg-[#081524]/95 border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.6)] rounded-xl text-center animate-bounce z-30">
          <p className="font-['Press_Start_2P'] text-[10px] sm:text-xs text-amber-300 tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
            {bannerMessage}
          </p>
        </div>
      )}
    </div>
  );
};
