import React from 'react';
import { motion } from 'motion/react';

export interface VirtualGamepadProps {
  hiddenButtons?: string[];
  opacity?: number;
  mappings?: Record<string, string>;
}

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  hiddenButtons = [],
  opacity = 100,
  mappings = {}
}) => {
  const getMappedKey = (btn: string) => {
    return mappings[btn] || '';
  };

  // 将虚拟手柄按钮映射为真实键盘按键，派发到游戏 iframe
  const getKeyCode = (key: string): number => {
    const map: Record<string, number> = {
      'W': 87, 'A': 65, 'S': 83, 'D': 68,
      'K': 75, 'J': 74, 'I': 73, 'U': 85,
      'Q': 81, 'E': 69, 'Enter': 13, 'Space': 32,
      'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39,
      'Escape': 27, 'Shift': 16, 'Control': 17, 'Tab': 9,
    };
    return map[key] ?? key.toUpperCase().charCodeAt(0);
  };

  const dispatchKeyEvent = (btn: string, type: 'keydown' | 'keyup') => {
    const key = getMappedKey(btn);
    if (!key) return;

    const keyCode = getKeyCode(key);
    const eventInit: KeyboardEventInit = {
      key,
      code: /^[A-Za-z]$/.test(key) ? `Key${key.toUpperCase()}` : key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    };

    // 派发到游戏 iframe（如果存在）
    const iframe = document.getElementById('game-iframe') as HTMLIFrameElement | null;
    const target = iframe?.contentWindow || window;
    try {
      target.dispatchEvent(new KeyboardEvent(type, eventInit));
      if (iframe?.contentDocument) {
        iframe.contentDocument.dispatchEvent(new KeyboardEvent(type, eventInit));
      }
    } catch (e) {
      // 跨域限制，回退到当前窗口
      window.dispatchEvent(new KeyboardEvent(type, eventInit));
    }
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
      style={{ opacity: opacity / 100 }}
    >
      {/* Left DPAD Group */}
      <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 grid grid-cols-3 grid-rows-3 gap-1.5 md:gap-2 pointer-events-auto scale-75 sm:scale-90 md:scale-100 origin-bottom-left">
        <div className="col-start-2">
          {!hiddenButtons.includes('U') ? <GamepadButton label="U" mappedKey={getMappedKey('U')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-2 col-start-1">
          {!hiddenButtons.includes('L') ? <GamepadButton label="L" mappedKey={getMappedKey('L')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-2 col-start-2">
          <div className="w-12 h-12 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
            <div className="w-2 h-2 bg-white/20 rounded-full" />
          </div>
        </div>
        <div className="row-start-2 col-start-3">
          {!hiddenButtons.includes('R') ? <GamepadButton label="R" mappedKey={getMappedKey('R')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-3 col-start-2">
          {!hiddenButtons.includes('D') ? <GamepadButton label="D" mappedKey={getMappedKey('D')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
      </div>

      {/* Right Action Buttons Group */}
      <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 grid grid-cols-3 grid-rows-3 gap-1.5 md:gap-2 pointer-events-auto scale-75 sm:scale-90 md:scale-100 origin-bottom-right">
        <div className="col-start-2">
          {!hiddenButtons.includes('X') ? <GamepadButton label="X" variant="action" mappedKey={getMappedKey('X')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-2 col-start-1">
          {!hiddenButtons.includes('Y') ? <GamepadButton label="Y" variant="action" mappedKey={getMappedKey('Y')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-2 col-start-3">
          {!hiddenButtons.includes('A') ? <GamepadButton label="A" variant="action" mappedKey={getMappedKey('A')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
        <div className="row-start-3 col-start-2">
          {!hiddenButtons.includes('B') ? <GamepadButton label="B" variant="action" mappedKey={getMappedKey('B')} onPress={(btn) => dispatchKeyEvent(btn, 'keydown')} onRelease={(btn) => dispatchKeyEvent(btn, 'keyup')} /> : <div className="w-12 h-12" />}
        </div>
      </div>

      {/* Center Utility Buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 md:gap-8 pointer-events-auto items-end scale-75 md:scale-100 origin-bottom">
        {!hiddenButtons.includes('Select') ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-5 bg-white/10 rounded-full border border-white/10 flex items-center justify-center">
              {getMappedKey('Select') && <span className="text-[7px] font-mono text-white/50">{getMappedKey('Select')}</span>}
            </div>
            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Select</span>
          </div>
        ) : <div className="w-14" />}
        
        {!hiddenButtons.includes('Start') ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-5 bg-white/20 rounded-full border border-white/10 flex items-center justify-center">
              {getMappedKey('Start') && <span className="text-[7px] font-mono text-white/60">{getMappedKey('Start')}</span>}
            </div>
            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Start</span>
          </div>
        ) : <div className="w-14" />}
      </div>

      {/* Top Shoulder Buttons */}
      <div className="absolute top-16 md:top-24 inset-x-6 md:inset-x-12 flex justify-between pointer-events-auto scale-75 md:scale-100">
        {!hiddenButtons.includes('L1') ? (
          <div className="w-24 h-9 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center px-4">
            <span className="text-[10px] font-black text-white/30 italic">L1</span>
            {getMappedKey('L1') && <span className="text-[8px] font-mono text-white/20">Key: {getMappedKey('L1')}</span>}
          </div>
        ) : <div className="w-24 h-9" />}
        
        {!hiddenButtons.includes('R1') ? (
          <div className="w-24 h-9 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-end px-4">
            <span className="text-[10px] font-black text-white/30 italic">R1</span>
            {getMappedKey('R1') && <span className="text-[8px] font-mono text-white/20">Key: {getMappedKey('R1')}</span>}
          </div>
        ) : <div className="w-24 h-9" />}
      </div>

      {/* Analog Stick Mocks - Hidden on smaller mobile screens to prevent overlapping */}
      <div className="hidden lg:flex absolute bottom-28 left-40 w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] items-center justify-center opacity-40">
        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20" />
      </div>
      <div className="hidden lg:flex absolute bottom-28 right-40 w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] items-center justify-center opacity-20">
        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20" />
      </div>
    </div>
  );
};

const GamepadButton = ({ label, variant = 'base', mappedKey = '', onPress, onRelease }: {
  label: string;
  variant?: 'base' | 'action';
  mappedKey?: string;
  onPress?: (btn: string) => void;
  onRelease?: (btn: string) => void;
}) => {
  // 根据按键标签派发对应的键盘事件（keydown / keyup）
  const handlePress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    onPress?.(label);
  };
  const handleRelease = () => {
    onRelease?.(label);
  };

  return (
  <motion.button
    whileTap={{ scale: 0.9, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
    onMouseDown={handlePress}
    onMouseUp={handleRelease}
    onMouseLeave={handleRelease}
    onTouchStart={handlePress}
    onTouchEnd={handleRelease}
    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-black text-xs transition-all pointer-events-auto cursor-pointer ${
      variant === 'action'
        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
        : 'bg-white/5 border-white/10 text-white/40'
    }`}
  >
    <span className="leading-none">{label}</span>
    {mappedKey && <span className="text-[8px] font-mono leading-none tracking-tighter opacity-60 mt-0.5 uppercase">[{mappedKey}]</span>}
  </motion.button>
  );
};
