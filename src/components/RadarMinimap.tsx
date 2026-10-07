/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { MatchEngine } from '../game/engine';
import { PITCH_CONFIG, HOME_KIT, AWAY_KIT } from '../game/constants';
import { Eye, Sparkles, ZoomIn } from 'lucide-react';

export type MinimapMode = 'transparent' | 'solid' | 'off';
export type RadarZoom = 'full' | 'zoom1' | 'zoom2';

interface RadarMinimapProps {
  engine: MatchEngine;
  mode: MinimapMode;
  sonar: boolean;
  zoom?: RadarZoom;
  focusTarget?: 'ball' | 'player';
  onCycleMode?: () => void;
  onToggleSonar?: () => void;
  onCycleZoom?: () => void;
}

export const RadarMinimap: React.FC<RadarMinimapProps> = ({
  engine,
  mode,
  sonar,
  zoom = 'full',
  focusTarget = 'ball',
  onCycleMode,
  onToggleSonar,
  onCycleZoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode === 'off') return;

    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Padded field area on radar canvas
      const padX = 5;
      const padY = 5;
      const radarW = w - padX * 2;
      const radarH = h - padY * 2;

      // Determine focal point (Ball or Controlled Player)
      const controlledPlayer = engine.getControlledPlayer();
      const focalX = focusTarget === 'player' && controlledPlayer ? controlledPlayer.x : engine.ball.x;
      const focalY = focusTarget === 'player' && controlledPlayer ? controlledPlayer.y : engine.ball.y;

      // Calculate view window based on zoom level:
      // 'full' = 1.0x (entire pitch 1500x2500)
      // 'zoom1' = 1.7x (closer tactical sector around ball/player)
      // 'zoom2' = 2.8x (close-up action area around ball/player)
      let viewWidth = PITCH_CONFIG.FIELD_WIDTH;
      let viewHeight = PITCH_CONFIG.FIELD_HEIGHT;

      if (zoom === 'zoom1') {
        viewWidth = PITCH_CONFIG.FIELD_WIDTH / 1.7;
        viewHeight = PITCH_CONFIG.FIELD_HEIGHT / 1.7;
      } else if (zoom === 'zoom2') {
        viewWidth = PITCH_CONFIG.FIELD_WIDTH / 2.8;
        viewHeight = PITCH_CONFIG.FIELD_HEIGHT / 2.8;
      }

      let viewLeft = focalX - viewWidth / 2;
      let viewTop = focalY - viewHeight / 2;

      if (zoom === 'full') {
        viewLeft = PITCH_CONFIG.PITCH_LEFT;
        viewTop = PITCH_CONFIG.PITCH_TOP;
      } else {
        // Clamp to pitch boundaries with small padding
        viewLeft = Math.max(PITCH_CONFIG.PITCH_LEFT - 40, Math.min(PITCH_CONFIG.PITCH_RIGHT + 40 - viewWidth, viewLeft));
        viewTop = Math.max(PITCH_CONFIG.PITCH_TOP - 40, Math.min(PITCH_CONFIG.PITCH_BOTTOM + 40 - viewHeight, viewTop));
      }

      // Coordinate mapping from pitch world coords to minimap coords
      const mapX = (worldX: number) => {
        const norm = (worldX - viewLeft) / viewWidth;
        return padX + norm * radarW;
      };

      const mapY = (worldY: number) => {
        const norm = (worldY - viewTop) / viewHeight;
        return padY + norm * radarH;
      };

      // 1. CLEAR & DRAW BACKGROUND
      ctx.clearRect(0, 0, w, h);

      if (sonar) {
        // --- SONAR RADAR ---
        if (mode === 'solid') {
          ctx.fillStyle = '#02120a';
          ctx.fillRect(0, 0, w, h);
        } else {
          // Transparent mode: live pitch shows through underneath!
          ctx.fillStyle = 'rgba(2, 18, 10, 0.15)';
          ctx.fillRect(0, 0, w, h);
        }

        // Faint scanlines (only in solid mode)
        if (mode === 'solid') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
          for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1);
          }
        }

        // Concentric sonar range rings centered on focal point (no rotating sweep beam!)
        const fx = mapX(focalX);
        const fy = mapY(focalY);

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fx, fy, radarW * 0.28, 0, Math.PI * 2);
        ctx.arc(fx, fy, radarW * 0.58, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
        ctx.lineWidth = 1;
      } else {
        // --- CLASSIC 90S RADAR MODE ---
        if (mode === 'solid') {
          ctx.fillStyle = '#0f381a';
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
          const stripeH = radarH / 8;
          for (let i = 0; i < 8; i += 2) {
            ctx.fillRect(padX, padY + i * stripeH, radarW, stripeH);
          }
        }
        // When transparent: canvas stays clear so the pitch underneath is 100% visible!

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1;
      }

      // CLIP FIELD DRAWINGS TO RADAR DISPLAY BOUNDS
      ctx.save();
      ctx.beginPath();
      ctx.rect(padX, padY, radarW, radarH);
      ctx.clip();

      // 2. DRAW PITCH OUTLINE & MARKINGS MAPPED TO ZOOM VIEW
      const pitchLeft = mapX(PITCH_CONFIG.PITCH_LEFT);
      const pitchRight = mapX(PITCH_CONFIG.PITCH_RIGHT);
      const pitchTop = mapY(PITCH_CONFIG.PITCH_TOP);
      const pitchBottom = mapY(PITCH_CONFIG.PITCH_BOTTOM);

      // Pitch boundary rectangle
      ctx.strokeRect(pitchLeft, pitchTop, pitchRight - pitchLeft, pitchBottom - pitchTop);

      // Halfway line
      const halfY = mapY(PITCH_CONFIG.CENTER_Y);
      ctx.beginPath();
      ctx.moveTo(pitchLeft, halfY);
      ctx.lineTo(pitchRight, halfY);
      ctx.stroke();

      // Center circle
      const rCenterX = mapX(PITCH_CONFIG.CENTER_X);
      const rRadiusX = (PITCH_CONFIG.CENTER_CIRCLE_RADIUS / viewWidth) * radarW;
      ctx.beginPath();
      ctx.arc(rCenterX, halfY, rRadiusX, 0, Math.PI * 2);
      ctx.stroke();

      // Top Goal & Penalty Box (Away goal)
      const boxLeft = mapX(PITCH_CONFIG.CENTER_X - PITCH_CONFIG.PENALTY_BOX_WIDTH / 2);
      const boxRight = mapX(PITCH_CONFIG.CENTER_X + PITCH_CONFIG.PENALTY_BOX_WIDTH / 2);
      const topBoxBottom = mapY(PITCH_CONFIG.PITCH_TOP + PITCH_CONFIG.PENALTY_BOX_HEIGHT);
      ctx.strokeRect(boxLeft, pitchTop, boxRight - boxLeft, topBoxBottom - pitchTop);

      // Bottom Goal & Penalty Box (Home goal)
      const botBoxTop = mapY(PITCH_CONFIG.PITCH_BOTTOM - PITCH_CONFIG.PENALTY_BOX_HEIGHT);
      ctx.strokeRect(boxLeft, botBoxTop, boxRight - boxLeft, pitchBottom - botBoxTop);

      // 3. DRAW PLAYERS (LIGHTS IN SONAR, PIPS IN CLASSIC)
      for (const p of engine.players) {
        if (p.isRedCarded) continue;

        const px = mapX(p.x);
        const py = mapY(p.y);

        // Cull if way outside radar canvas
        if (px < padX - 8 || px > padX + radarW + 8 || py < padY - 8 || py > padY + radarH + 8) {
          continue;
        }

        const isUser = p.isUserControlled;
        const isGK = p.role === 'GK';
        const isHome = p.team === 'home';
        const dotScale = zoom === 'zoom2' ? 1.4 : zoom === 'zoom1' ? 1.2 : 1.0;

        if (sonar) {
          // --- SONAR NEON SHINE: EACH DOT IS AN ILLUMINATED LIGHT ---
          ctx.save();
          if (isHome) {
            const lightColor = isGK ? '#facc15' : '#38bdf8';
            ctx.shadowColor = lightColor;
            ctx.shadowBlur = (isUser ? 10 : 6) * dotScale;

            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(px, py, (isUser ? 3.8 : 2.8) * dotScale, 0, Math.PI * 2);
            ctx.fill();

            // Bright white photon core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 1.2 * dotScale, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const lightColor = isGK ? '#10b981' : '#f43f5e';
            ctx.shadowColor = lightColor;
            ctx.shadowBlur = 6 * dotScale;

            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(px, py, 2.8 * dotScale, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 1.1 * dotScale, 0, Math.PI * 2);
            ctx.fill();
          }

          // User-controlled player glowing beacon ring
          if (isUser) {
            const pulse = (4.5 + Math.sin(Date.now() / 120) * 1.8) * dotScale;
            ctx.strokeStyle = '#facc15';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(px, py, pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // --- CLASSIC 90S PIXEL PIPS ---
          ctx.save();
          const dotRadius = (isUser ? 3.5 : 2.5) * dotScale;

          if (isHome) {
            ctx.fillStyle = isGK ? '#ffbb00' : HOME_KIT.primaryColor;
            ctx.strokeStyle = '#ffffff';
          } else {
            ctx.fillStyle = isGK ? '#00aa55' : AWAY_KIT.primaryColor;
            ctx.strokeStyle = '#ffffff';
          }

          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (isUser) {
            const pulse = (4.2 + Math.sin(Date.now() / 130) * 1.5) * dotScale;
            ctx.strokeStyle = '#ffea00';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(px, py, pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 4. DRAW BALL
      const bx = mapX(engine.ball.x);
      const by = mapY(engine.ball.y);
      const bz = Math.min(40, engine.ball.z || 0);
      const isAirborne = engine.ball.isAirborne || bz > 3;
      const dotScale = zoom === 'zoom2' ? 1.4 : zoom === 'zoom1' ? 1.2 : 1.0;

      ctx.save();
      if (sonar) {
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 12 * dotScale;

        if (isAirborne) {
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, (3.5 + bz * 0.12) * dotScale, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx, by, 2.6 * dotScale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, (isAirborne ? 3.2 : 2.4) * dotScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isAirborne) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, 4.2 * dotScale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.restore(); // Restore clip

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [engine, mode, sonar, zoom, focusTarget]);

  if (mode === 'off') return null;

  const zoomLabel = zoom === 'zoom2' ? 'Z:2' : zoom === 'zoom1' ? 'Z:1' : 'FULL';

  return (
    <div
      className={`absolute bottom-[165px] sm:bottom-[175px] md:bottom-[180px] right-2 sm:right-3.5 z-20 pointer-events-auto select-none rounded-lg overflow-hidden transition-all duration-200 border-2 ${
        sonar
          ? mode === 'solid'
            ? 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.45)] bg-slate-950/90'
            : 'border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.35)] bg-emerald-950/20'
          : mode === 'solid'
          ? 'border-amber-500/80 shadow-[0_4px_16px_rgba(0,0,0,0.85)] bg-[#07131e]'
          : 'border-amber-500/60 shadow-[0_4px_12px_rgba(0,0,0,0.6)] bg-transparent'
      }`}
      style={{
        width: '104px',
      }}
      title="Tactical Radar (Bottom Right above controller)"
    >
      {/* 32-BIT RETRO RADAR HEADER BAR */}
      <div
        className={`w-full px-1.5 py-0.5 flex items-center justify-between border-b ${
          sonar
            ? (mode === 'solid' ? 'bg-emerald-950/90' : 'bg-emerald-950/40') + ' border-emerald-500/50 text-emerald-300'
            : (mode === 'solid' ? 'bg-gradient-to-r from-blue-950 via-slate-950 to-blue-950' : 'bg-blue-950/40') + ' border-amber-500/50 text-amber-400'
        }`}
      >
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              sonar ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-amber-400'
            }`}
          />
          <span className="font-['Press_Start_2P'] text-[6px] font-bold tracking-tighter">
            {sonar ? 'SONAR' : 'RADAR'}
          </span>
        </div>

        {/* CONTROLS: ZOOM TOGGLE, SONAR TOGGLE & DISPLAY MODE CYCLE */}
        <div className="flex items-center gap-1">
          {/* ZOOM CYCLE BUTTON (FULL -> Z1 -> Z2) */}
          {onCycleZoom && (
            <button
              type="button"
              onClick={onCycleZoom}
              title={`Radar Zoom: ${zoom.toUpperCase()} (Click to cycle Full / Zoom 1 / Zoom 2)`}
              aria-label="Cycle Radar Zoom"
              className="px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-amber-300 hover:text-white font-['Press_Start_2P'] text-[5px] transition cursor-pointer"
            >
              {zoomLabel}
            </button>
          )}

          {onToggleSonar && (
            <button
              type="button"
              onClick={onToggleSonar}
              title={sonar ? 'Switch to Classic 90s Radar' : 'Activate Neon Lights'}
              aria-label="Toggle Sonar"
              className={`p-0.5 rounded cursor-pointer transition ${
                sonar ? 'text-emerald-300 hover:text-white' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
            </button>
          )}

          {onCycleMode && (
            <button
              type="button"
              onClick={onCycleMode}
              title={`Mode: ${mode.toUpperCase()} (Click to cycle)`}
              aria-label="Cycle Radar Mode"
              className="p-0.5 rounded cursor-pointer text-slate-300 hover:text-amber-300 transition"
            >
              <Eye className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* CANVAS RENDERING 22 PLAYERS + BALL */}
      <div className="relative w-full h-[166px] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={104}
          height={166}
          className="w-full h-full block [image-rendering:pixelated]"
        />

        {/* CRT MICRO SCANLINE OVERLAY */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
            backgroundSize: '100% 3px',
          }}
        />

        {/* FOCUS TARGET PILL (BALL vs PLAYER) IN ZOOM MODES */}
        {zoom !== 'full' && (
          <div className="absolute top-1 left-1.5 px-1 py-0.2 rounded bg-black/70 border border-amber-500/50 text-[5px] font-['Press_Start_2P'] text-amber-300 pointer-events-none">
            {focusTarget === 'player' ? 'P1' : 'BALL'}
          </div>
        )}
      </div>
    </div>
  );
};
