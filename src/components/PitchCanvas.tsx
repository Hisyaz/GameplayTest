import React, { useEffect, useRef, useState } from 'react';
import { MatchEngine } from '../game/engine';
import { KeyState, PowerBarState, PlayerIndicatorType, PlayerIndicatorStyle } from '../types';
import { drawPitch, drawParticles } from '../game/pitchRenderer';
import { drawPlayerSprite, drawBall, drawReferee } from '../game/sprites';
import { HOME_KIT, AWAY_KIT } from '../game/constants';
import { t } from '../game/i18n';

interface PitchCanvasProps {
  engine: MatchEngine;
  keysRef: React.MutableRefObject<KeyState>;
  onTick?: () => void;
  playerIndicatorType?: PlayerIndicatorType;
  playerIndicatorStyle?: PlayerIndicatorStyle;
}

export const PitchCanvas: React.FC<PitchCanvasProps> = ({
  engine,
  keysRef,
  onTick,
  playerIndicatorType = 'small_arrow',
  playerIndicatorStyle = 'solid',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Handle container and window resizing
  useEffect(() => {
    const updateDimensions = () => {
      const parent = canvasRef.current?.parentElement;
      if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
        setDimensions({ width: parent.clientWidth, height: parent.clientHeight });
      } else {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let resizeObserver: ResizeObserver | null = null;
    if (canvasRef.current?.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  // Main Animation / Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Advance Game Engine
      engine.update(keysRef.current);
      if (onTick) onTick();

      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#1e3814';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Pixel-crisp rendering
      ctx.imageSmoothingEnabled = false;

      // CAMERA TRANSFORMS:
      // Center camera on screen
      ctx.translate(width / 2, height / 2);

      // Camera Zoom & Pitch Tilt Angle:
      // "when you're near the top goal (rival goal) the angle is a bit lower and you see it closer to the ground
      // giving more vertical angle of the goal, but as you go down to your own goal, the camera is higher"
      const zoom = engine.camera.zoom;
      const tilt = engine.camera.pitchTilt; // 0 (top goal) to 1 (bottom goal)
      const scaleY = zoom * (0.94 + tilt * 0.10);

      ctx.scale(zoom, scaleY);
      ctx.translate(-engine.camera.x, -engine.camera.y);

      // 2. Draw Pitch, Line Markings, Stadium Grandstands, and 3D Goals with dynamic net physics
      drawPitch(ctx, 0, 0, 0, 0, engine.topGoalNet, engine.bottomGoalNet, tilt);

      // 3. Draw Turf/Grass Particles
      drawParticles(ctx, engine.particles);

      // 4. Collect and sort all entities by Y position for proper depth layering
      type RenderItem =
        | { type: 'player'; y: number; data: typeof engine.players[0] }
        | { type: 'ball'; y: number; data: typeof engine.ball }
        | { type: 'referee'; y: number; data: typeof engine.referee };

      const items: RenderItem[] = [];

      for (const p of engine.players) {
        items.push({ type: 'player', y: p.y, data: p });
      }
      items.push({ type: 'ball', y: engine.ball.y, data: engine.ball });
      items.push({ type: 'referee', y: engine.referee.y, data: engine.referee });

      items.sort((a, b) => a.y - b.y);

      // 5. Draw Entities in Depth Order
      for (const item of items) {
        if (item.type === 'player') {
          const p = item.data;
          const kit = p.team === 'home' ? HOME_KIT : AWAY_KIT;
          drawPlayerSprite(ctx, p, kit);

          // If this player is controlled by the user, draw retro indicator (strictly single player)
          if (p.id === engine.userControlledPlayerId) {
            drawUserPlayerIndicator(ctx, p, playerIndicatorType as PlayerIndicatorType, playerIndicatorStyle as PlayerIndicatorStyle);
            if (engine.powerBar.isActive) {
              drawPlayerPowerBar(ctx, p, engine.powerBar);
            }
          }

          // Q BALL SHIELDING: Clear, visible tactical ground shield arc & overhead badge
          if (p.isShielding || p.action === 'shielding') {
            drawShieldingVisuals(ctx, p);
          }

          // SLIDING TACKLE: Ground dust & turf spray trail
          if (p.action === 'sliding_tackle') {
            drawTackleSlideEffect(ctx, p);
          }

          // FOULED / FALLING: Ground impact burst & impact badge
          if (p.action === 'fouled_falling') {
            drawFoulVisuals(ctx, p);
          }

          if (p.shirtPulledTimer && p.shirtPulledTimer > 0) {
            drawShirtPullEffect(ctx, p);
          }

          if (p.isGingaLifting || p.gingaActive) {
            drawGingaIndicator(ctx, p);
          }

          // Volley opportunity indicator when airborne ball is within striking distance
          const distToBall = Math.hypot(engine.ball.x - p.x, engine.ball.y - p.y);
          if (p.isUserControlled && (engine.ball.isAirborne || p.gingaActive || engine.ball.z > 2.5) && distToBall < 36 && engine.ball.z > 2.0) {
            drawVolleyOpportunityIndicator(ctx, p, engine.ball);
          }
        } else if (item.type === 'ball') {
          drawBall(ctx, item.data);
          if (item.data.isDividedBall && !item.data.ownerId) {
            drawDividedBallReticle(ctx, item.data);
          }
        } else if (item.type === 'referee') {
          drawReferee(ctx, item.data);
        }
      }

      // 6. Draw Set Piece Aim & Prompt overlay (if active dead-ball phase)
      if (engine.setPiece && (engine.matchPhase === 'penalty' || engine.matchPhase === 'free_kick' || engine.matchPhase === 'corner_kick' || engine.matchPhase === 'goal_kick' || engine.matchPhase === 'throw_in')) {
        drawSetPieceOverlay(ctx, engine);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [engine, keysRef, onTick, playerIndicatorType, playerIndicatorStyle]);

  /**
   * Draws controlled player indicator with selectable shape (small arrow, big arrow, bottom circle)
   * and style (solid, transparent, off), cleanly positioned above or around the player without touching.
   */
  const drawUserPlayerIndicator = (
    ctx: CanvasRenderingContext2D,
    player: typeof engine.players[0],
    type: PlayerIndicatorType,
    style: PlayerIndicatorStyle
  ) => {
    if (style === 'off') return;

    ctx.save();
    const x = Math.round(player.x);
    const isTrans = style === 'transparent';
    ctx.globalAlpha = isTrans ? 0.52 : 1.0;

    if (type === 'circle') {
      // Circle around the bottom / feet of the player on the pitch
      const feetY = Math.round(player.y + 2);
      const pulse = Math.sin(Date.now() / 120) * 1.5;

      // Outer tactical ellipse
      ctx.strokeStyle = isTrans ? '#38bdf8' : '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, feetY, 14 + pulse, 7 + pulse * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dashed contour ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, feetY, 10, 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Direction notch on circle
      const ang = player.facingAngle;
      const notchX = x + Math.cos(ang) * (14 + pulse);
      const notchY = feetY + Math.sin(ang) * (7 + pulse * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(notchX, notchY, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'big_arrow') {
      // Bold 32-bit arcade chevron pointer, floating cleanly above player's head without touching
      const bounceY = Math.sin(Date.now() / 140) * 3;
      const tipY = Math.round(player.y - 42 + bounceY);

      // Outer bold chevron
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, tipY - 11);
      ctx.lineTo(x + 8, tipY - 11);
      ctx.lineTo(x, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden inner highlight bevel
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 6, tipY - 9.5);
      ctx.lineTo(x + 6, tipY - 9.5);
      ctx.stroke();
    } else {
      // 'small_arrow' (default):
      // Small retro triangle pointer, floating cleanly above head without touching
      const bounceY = Math.sin(Date.now() / 150) * 2.5;
      const tipY = Math.round(player.y - 41 + bounceY);

      ctx.fillStyle = '#ffea00';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 5, tipY - 7);
      ctx.lineTo(x + 5, tipY - 7);
      ctx.lineTo(x, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Draws dynamic pixelated power bar beneath player while charging pass/cross/shoot/long pass
   */
  const drawPlayerPowerBar = (
    ctx: CanvasRenderingContext2D,
    player: typeof engine.players[0],
    powerBar: PowerBarState
  ) => {
    ctx.save();
    const x = Math.round(player.x);
    const y = Math.round(player.y + 16);

    const barW = 46;
    const barH = 7;
    const innerW = barW - 2;
    const innerH = barH - 2;

    // Outer container background
    ctx.fillStyle = 'rgba(10, 10, 16, 0.85)';
    ctx.fillRect(x - barW / 2, y, barW, barH);
    ctx.strokeStyle = powerBar.isKnuckle ? '#f472b6' : powerBar.isSpecial ? '#c084fc' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - barW / 2, y, barW, barH);

    // Segmented / gradient power fill
    const fillW = Math.max(1, Math.min(innerW, Math.round(innerW * powerBar.power)));

    if (powerBar.isKnuckle) {
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 4;
    } else if (powerBar.isSpecial) {
      ctx.shadowColor = '#d8b4fe';
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = powerBar.tierColor;
    ctx.fillRect(x - barW / 2 + 1, y + 1, fillW, innerH);

    // Subtle 90% threshold marker (Max output boundary before overpower)
    const threshX = Math.round(x - barW / 2 + 1 + innerW * 0.90);
    ctx.fillStyle = powerBar.isKnuckle ? '#701a31' : powerBar.isSpecial ? '#1e053a' : '#991b1b';
    ctx.fillRect(threshX, y + 1, 1, innerH);

    // Action Name tag
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const actionText = (powerBar.action || 'CHARGE').toUpperCase().replace('_', ' ');
    const tagText = powerBar.isKnuckle
      ? `[E] ${actionText}`
      : powerBar.isSpecial
      ? `[Q] ${actionText}`
      : actionText;

    ctx.fillStyle = powerBar.isKnuckle ? '#fbcfe8' : powerBar.isSpecial ? '#f3e8ff' : '#ffffff';
    ctx.fillText(tagText, x, y + barH + 3);

    ctx.restore();
  };



  /**
   * Draws shirt pull visual tension line
   */
  const drawShirtPullEffect = (ctx: CanvasRenderingContext2D, player: typeof engine.players[0]) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pullOffset = Math.sin(Date.now() / 50) * 2;
    ctx.moveTo(player.x - 4, player.y - 10);
    ctx.lineTo(player.x - 14 + pullOffset, player.y - 6);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText('⚡PULL', player.x - 22, player.y - 14);
    ctx.restore();
  };

  /**
   * Draws golden Ginga juggling / lift status and combo meter
   */
  const drawGingaIndicator = (ctx: CanvasRenderingContext2D, player: typeof engine.players[0]) => {
    ctx.save();
    if (player.isGingaLifting) {
      // Hold spacebar charging ring
      const holdTime = player.gingaHoldTimer || 0;
      const progress = Math.min(1.0, holdTime / 108); // 108 frames = 1.8s
      const isDangerous = holdTime > 90;

      ctx.strokeStyle = isDangerous ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y + 4, 15, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = isDangerous ? '#f87171' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(isDangerous ? 'MAX 1.8S!' : 'LIFTING...', player.x, player.y + 26);
    } else if (player.gingaActive) {
      // Active Ginga juggling state
      const combo = player.gingaCombo || 1;
      const ringRadius = 14 + Math.sin(Date.now() / 90) * 2;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y + 2, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(`GINGA x${combo}`, player.x, player.y + 24);
    }
    ctx.restore();
  };

  /**
   * Draws a target indicator when an aerial ball is ready to be volleyed or flair struck
   */
  const drawVolleyOpportunityIndicator = (
    ctx: CanvasRenderingContext2D,
    player: typeof engine.players[0],
    ball: typeof engine.ball
  ) => {
    ctx.save();
    const bx = Math.round(ball.x);
    const by = Math.round(ball.y);

    // Subtle pulsing aerial crosshair under ball shadow
    const pulse = 8 + Math.sin(Date.now() / 70) * 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(bx, by, pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Floating action hint
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.fillText('VOLLEY [A/E/Q]', bx, by - Math.min(30, ball.z) - 10);

    ctx.restore();
  };

  /**
   * Draws distinct tactical ground shield arc & overhead badge when shielding with [Q]
   * "make the Q ball shielding more visible"
   */
  const drawShieldingVisuals = (ctx: CanvasRenderingContext2D, player: typeof engine.players[0]) => {
    ctx.save();
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const pulse = 18 + Math.sin(Date.now() / 90) * 2;

    // Outer tactical protection aura ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py + 2, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner bright shield crest ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py + 2, pulse - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  /**
   * Draws turf divot slide spray behind player performing a sliding tackle
   */
  const drawTackleSlideEffect = (ctx: CanvasRenderingContext2D, player: typeof engine.players[0]) => {
    ctx.save();
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.65)';
    for (let i = 0; i < 3; i++) {
      const sx = px - (player.slideVelocityX || 0) * 0.4 + (i * 3 - 3);
      const sy = py - (player.slideVelocityY || 0) * 0.4 + (i * 2 - 2);
      ctx.fillRect(sx, sy, 3, 2);
    }
    ctx.restore();
  };

  /**
   * Draws ground impact shock burst & badge when player is fouled
   */
  const drawFoulVisuals = (ctx: CanvasRenderingContext2D, player: typeof engine.players[0]) => {
    ctx.save();
    const px = Math.round(player.x);
    const py = Math.round(player.y);

    // Ground impact ring
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Overhead impact alert
    ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.fillRect(px - 22, py - 38, 44, 13);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 22, py - 38, 44, 13);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡FOUL!', px, py - 31);
    ctx.restore();
  };

  /**
   * Draws golden dynamic reticle indicating a contested "Divided Ball" in play
   */
  const drawDividedBallReticle = (ctx: CanvasRenderingContext2D, ball: typeof engine.ball) => {
    ctx.save();
    const bx = Math.round(ball.x);
    const by = Math.round(ball.y);
    const pulse = 9 + Math.sin(Date.now() / 80) * 2;

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(bx, by, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Draws set piece trajectory line, target point, and controls prompt
   */
  const drawSetPieceOverlay = (ctx: CanvasRenderingContext2D, eng: MatchEngine) => {
    const sp = eng.setPiece;
    if (!sp) return;

    ctx.save();
    const sx = sp.spotX;
    const sy = sp.spotY;
    const ang = sp.aimAngle;
    const isPen = sp.type === 'penalty';
    const isThrow = sp.type === 'throw_in';

    const aimDist = isPen ? 85 : (isThrow ? 95 : 160);
    const targetX = sx + Math.cos(ang) * aimDist;
    const targetY = sy + Math.sin(ang) * aimDist;

    // Dotted trajectory line
    ctx.strokeStyle = isPen ? 'rgba(244, 63, 94, 0.85)' : 'rgba(56, 189, 248, 0.85)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // Target reticle
    ctx.fillStyle = isPen ? '#f43f5e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Outer reticle ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Set piece prompt badge above ball spot
    let promptText = '';
    if (isPen) promptText = t('penaltyShootOnly');
    else if (isThrow) promptText = t('throwInPrompt');
    else if (sp.type === 'corner_kick') promptText = t('cornerPrompt');
    else promptText = t('setPieceAimPrompt');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    const textW = ctx.measureText ? 240 : 200;
    ctx.fillRect(sx - textW / 2, sy - 42, textW, 16);
    ctx.strokeStyle = isPen ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - textW / 2, sy - 42, textW, 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(promptText.slice(0, 36), sx, sy - 34);

    ctx.restore();
  };

  return (
    <canvas
      ref={canvasRef}
      id="football-canvas"
      width={dimensions.width}
      height={dimensions.height}
      className="block w-full h-full cursor-default select-none"
    />
  );
};
