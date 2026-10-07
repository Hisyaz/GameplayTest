import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { KeyState } from '../types';

interface TouchControlsProps {
  keys: KeyState;
  hasBall: boolean;
  onKeyChange: (key: keyof KeyState, pressed: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  keys,
  hasBall,
  onKeyChange,
}) => {
  const handleTouch = (key: keyof KeyState, pressed: boolean) => {
    onKeyChange(key, pressed);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 flex justify-between items-end select-none">
      {/* D-PAD (Arrow Keys) & Sprint */}
      <div className="pointer-events-auto flex flex-col items-center gap-1 bg-slate-950/70 p-2 rounded-2xl border border-slate-800 backdrop-blur">
        <button
          onPointerDown={() => handleTouch('ArrowUp', true)}
          onPointerUp={() => handleTouch('ArrowUp', false)}
          onPointerLeave={() => handleTouch('ArrowUp', false)}
          className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
            keys.ArrowUp ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <ArrowUp className="w-5 h-5" />
        </button>

        <div className="flex gap-1">
          <button
            onPointerDown={() => handleTouch('ArrowLeft', true)}
            onPointerUp={() => handleTouch('ArrowLeft', false)}
            onPointerLeave={() => handleTouch('ArrowLeft', false)}
            className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
              keys.ArrowLeft ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onPointerDown={() => handleTouch('Shift', true)}
            onPointerUp={() => handleTouch('Shift', false)}
            onPointerLeave={() => handleTouch('Shift', false)}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center border ${
              keys.Shift ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold' : 'bg-slate-900 border-slate-700 text-amber-400'
            }`}
            title="Sprint"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span className="text-[8px] font-bold">RUN</span>
          </button>

          <button
            onPointerDown={() => handleTouch('ArrowRight', true)}
            onPointerUp={() => handleTouch('ArrowRight', false)}
            onPointerLeave={() => handleTouch('ArrowRight', false)}
            className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
              keys.ArrowRight ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onPointerDown={() => handleTouch('ArrowDown', true)}
          onPointerUp={() => handleTouch('ArrowDown', false)}
          onPointerLeave={() => handleTouch('ArrowDown', false)}
          className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
            keys.ArrowDown ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>

      {/* ACTION BUTTONS (W, A, S, D, Q, E) */}
      <div className="pointer-events-auto flex flex-col items-end gap-1.5 bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800 backdrop-blur">
        {/* Top row: Q (Shield / Nutmeg or Shoulder) + E (Skill / Autopass or Shirt Pull) + SPACE (Ginga) + W (Long pass / Push) */}
        <div className="w-full flex justify-between items-center gap-1.5">
          <div className="flex items-center gap-1">
            <button
              onPointerDown={() => handleTouch('KeyQ', true)}
              onPointerUp={() => handleTouch('KeyQ', false)}
              onPointerLeave={() => handleTouch('KeyQ', false)}
              className={`px-2 h-9 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center transition ${
                keys.KeyQ
                  ? 'bg-purple-600 border-purple-300 text-white shadow-[0_0_12px_#c084fc]'
                  : 'bg-slate-900 border-purple-800 text-purple-300'
              }`}
            >
              <span className="font-['Press_Start_2P'] text-[8px]">Q</span>
              <span className="text-[7px]">{hasBall ? 'SKILL' : 'FLAIR'}</span>
            </button>
            <button
              onPointerDown={() => handleTouch('KeyE', true)}
              onPointerUp={() => handleTouch('KeyE', false)}
              onPointerLeave={() => handleTouch('KeyE', false)}
              className={`px-2 h-9 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center transition ${
                keys.KeyE
                  ? 'bg-pink-600 border-pink-300 text-white shadow-[0_0_12px_#f472b6]'
                  : 'bg-slate-900 border-pink-800 text-pink-300'
              }`}
            >
              <span className="font-['Press_Start_2P'] text-[8px]">E</span>
              <span className="text-[7px]">{hasBall ? 'STEP/PASS' : 'VOLLEY'}</span>
            </button>
            <button
              onPointerDown={() => handleTouch('Space', true)}
              onPointerUp={() => handleTouch('Space', false)}
              onPointerLeave={() => handleTouch('Space', false)}
              className={`px-2 h-9 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center transition ${
                keys.Space
                  ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-[0_0_12px_#f59e0b]'
                  : 'bg-slate-900 border-amber-800 text-amber-300'
              }`}
            >
              <span className="font-['Press_Start_2P'] text-[7px]">GINGA</span>
              <span className="text-[7px]">SPACE</span>
            </button>
          </div>

          <button
            onPointerDown={() => handleTouch('KeyW', true)}
            onPointerUp={() => handleTouch('KeyW', false)}
            onPointerLeave={() => handleTouch('KeyW', false)}
            className="w-16 h-12 rounded-xl bg-slate-800 active:bg-amber-500 border border-slate-600 active:border-amber-300 text-white flex flex-col items-center justify-center shadow"
          >
            <span className="font-['Press_Start_2P'] text-[10px] text-amber-400">W</span>
            <span className="text-[8px] font-bold text-slate-300">
              {hasBall ? 'THROUGH' : 'PUSH'}
            </span>
          </button>
        </div>

        {/* Middle row: A (Shoot / Clear) and D (Cross / Slide) */}
        <div className="flex gap-2">
          <button
            onPointerDown={() => handleTouch('KeyA', true)}
            onPointerUp={() => handleTouch('KeyA', false)}
            onPointerLeave={() => handleTouch('KeyA', false)}
            className="w-16 h-12 rounded-xl bg-slate-800 active:bg-red-600 border border-slate-600 active:border-red-400 text-white flex flex-col items-center justify-center shadow"
          >
            <span className="font-['Press_Start_2P'] text-[10px] text-rose-400">A</span>
            <span className="text-[8px] font-bold text-slate-300">
              {hasBall ? 'SHOOT' : 'CLEAR'}
            </span>
          </button>

          <button
            onPointerDown={() => handleTouch('KeyD', true)}
            onPointerUp={() => handleTouch('KeyD', false)}
            onPointerLeave={() => handleTouch('KeyD', false)}
            className="w-16 h-12 rounded-xl bg-slate-800 active:bg-blue-600 border border-slate-600 active:border-blue-400 text-white flex flex-col items-center justify-center shadow"
          >
            <span className="font-['Press_Start_2P'] text-[10px] text-sky-400">D</span>
            <span className="text-[8px] font-bold text-slate-300">
              {hasBall ? 'CROSS' : 'SLIDE'}
            </span>
          </button>
        </div>

        {/* Bottom button: S (Short pass / Standing tackle) */}
        <div className="w-full flex justify-center">
          <button
            onPointerDown={() => handleTouch('KeyS', true)}
            onPointerUp={() => handleTouch('KeyS', false)}
            onPointerLeave={() => handleTouch('KeyS', false)}
            className="w-16 h-12 rounded-xl bg-slate-800 active:bg-emerald-600 border border-slate-600 active:border-emerald-400 text-white flex flex-col items-center justify-center shadow"
          >
            <span className="font-['Press_Start_2P'] text-[10px] text-emerald-400">S</span>
            <span className="text-[8px] font-bold text-slate-300">
              {hasBall ? 'PASS' : 'TACKLE'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
