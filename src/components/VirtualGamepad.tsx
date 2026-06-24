import React from 'react';
import { motion } from 'motion/react';

export interface VirtualGamepadProps {
  hiddenButtons?: string[];
  opacity?: number;
  mappings?: Record<string, string>;
  /** D-Pad 方向键映射模式: 'wasd' → W/A/S/D 键, 'arrows' → ↑↓←→ 键 */
  dpadMode?: 'wasd' | 'arrows';
}

/** Legacy 项目的按键映射：直接操作 RPG Maker 的 Input._currentState */
const RPG_INPUT_MAP: Record<string, string> = {
  // D-Pad
  'U': 'up',
  'D': 'down',
  'L': 'left',
  'R': 'right',
  // Action buttons (Xbox 布局: Y上/X左/B右/A下)
  'Y': 'menu',
  'X': 'shift',
  'B': 'cancel',
  'A': 'ok',
  // Shoulder buttons
  'L1': 'pageup',
  'R1': 'pagedown',
  // Center buttons
  'Select': 'cancel',
  'Start': 'ok',
};

/** D-Pad 方向 → 键盘事件的 key 映射 */
const DPAD_KEY_EVENTS: Record<string, Record<string, string>> = {
  wasd:   { U: 'w', D: 's', L: 'a', R: 'd' },
  arrows: { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' },
};

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  hiddenButtons = [],
  opacity = 100,
  mappings = {},
  dpadMode = 'arrows',
}) => {
  const getMappedKey = (btn: string): string => {
    return mappings[btn] || '';
  };

  /** 获取 iframe 的 contentWindow */
  const getIframeWindow = (): Window | null => {
    try {
      const iframe = document.getElementById('game-iframe') as HTMLIFrameElement | null;
      return iframe?.contentWindow || null;
    } catch { return null; }
  };

  /** 派发键盘事件到 iframe（用于插件/非标输入处理） */
  const dispatchKeyEvent = (key: string, type: 'keydown' | 'keyup') => {
    const win = getIframeWindow();
    if (!win) return;
    const keyCode = key.startsWith('Arrow') ? { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[key]! : key.toUpperCase().charCodeAt(0);
    const code = key.startsWith('Arrow') ? key : `Key${key.toUpperCase()}`;
    try {
      const event = new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true });
      win.dispatchEvent(event);
      if ((win as any).document) (win as any).document.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true }));
    } catch { /* 静默 */ }
  };

  /**
   * 发送输入：优先设置 Input._currentState（legacy 方式），
   * 同时派发键盘事件以兼容监听原生键盘事件的插件。
   */
  const sendInput = (btn: string, pressed: boolean) => {
    // 1. Legacy 方式：直接操作 RPG Maker 的 Input._currentState
    const mappedKey = getMappedKey(btn);
    const rpgKey = RPG_INPUT_MAP[mappedKey] || RPG_INPUT_MAP[btn];
    if (rpgKey) {
      try {
        const win = getIframeWindow();
        if (win && (win as any).Input && (win as any).Input._currentState) {
          (win as any).Input._currentState[rpgKey] = pressed;
        }
      } catch { /* 静默 */ }
    }

    // 2. D-Pad 额外派发键盘事件（根据 dpadMode）
    //    pressed=true → keydown, pressed=false → keyup（支持长按）
    if (['U', 'D', 'L', 'R'].includes(btn)) {
      const keyMap = DPAD_KEY_EVENTS[dpadMode];
      if (keyMap && keyMap[btn]) {
        dispatchKeyEvent(keyMap[btn], pressed ? 'keydown' : 'keyup');
      }
    }

    // 3. 非 D-Pad 按钮根据 mappings 派发键盘事件（同样支持长按）
    if (!['U', 'D', 'L', 'R'].includes(btn)) {
      const key = getMappedKey(btn);
      if (key) {
        dispatchKeyEvent(key, pressed ? 'keydown' : 'keyup');
      }
    }
  };

  const handlePress = (btn: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    sendInput(btn, true);
  };

  const handleRelease = (btn: string) => () => {
    sendInput(btn, false);
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
      style={{ opacity: opacity / 100 }}
    >
      {/* Left D-Pad Group — 布局位置保持不变 */}
      <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 grid grid-cols-3 grid-rows-3 gap-1.5 md:gap-2 pointer-events-auto scale-75 sm:scale-90 md:scale-100 origin-bottom-left">
        {/* Up */}
        <div className="col-start-2">
          {!hiddenButtons.includes('U') ? (
            <DpadButton direction="up" label="▲" keyHint={dpadMode === 'wasd' ? 'W' : '↑'}
              onPress={handlePress('U')} onRelease={handleRelease('U')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* Left */}
        <div className="row-start-2 col-start-1">
          {!hiddenButtons.includes('L') ? (
            <DpadButton direction="left" label="◀" keyHint={dpadMode === 'wasd' ? 'A' : '←'}
              onPress={handlePress('L')} onRelease={handleRelease('L')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* Center */}
        <div className="row-start-2 col-start-2">
          <div className="w-12 h-12 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
            <div className="w-2 h-2 bg-white/20 rounded-full" />
          </div>
        </div>
        {/* Right */}
        <div className="row-start-2 col-start-3">
          {!hiddenButtons.includes('R') ? (
            <DpadButton direction="right" label="▶" keyHint={dpadMode === 'wasd' ? 'D' : '→'}
              onPress={handlePress('R')} onRelease={handleRelease('R')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* Down */}
        <div className="row-start-3 col-start-2">
          {!hiddenButtons.includes('D') ? (
            <DpadButton direction="down" label="▼" keyHint={dpadMode === 'wasd' ? 'S' : '↓'}
              onPress={handlePress('D')} onRelease={handleRelease('D')} />
          ) : <div className="w-12 h-12" />}
        </div>
      </div>

      {/* Right Action Buttons — Xbox 布局 (Y上/X左/B右/A下)，位置保持不变 */}
      <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 grid grid-cols-3 grid-rows-3 gap-1.5 md:gap-2 pointer-events-auto scale-75 sm:scale-90 md:scale-100 origin-bottom-right">
        {/* Y — 上 (黄色, menu) */}
        <div className="col-start-2">
          {!hiddenButtons.includes('Y') ? (
            <XboxButton label="Y" color="yellow" mappedKey={getMappedKey('Y')}
              onPress={handlePress('Y')} onRelease={handleRelease('Y')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* X — 左 (蓝色, shift/dash) */}
        <div className="row-start-2 col-start-1">
          {!hiddenButtons.includes('X') ? (
            <XboxButton label="X" color="blue" mappedKey={getMappedKey('X')}
              onPress={handlePress('X')} onRelease={handleRelease('X')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* B — 右 (红色, cancel) */}
        <div className="row-start-2 col-start-3">
          {!hiddenButtons.includes('B') ? (
            <XboxButton label="B" color="red" mappedKey={getMappedKey('B')}
              onPress={handlePress('B')} onRelease={handleRelease('B')} />
          ) : <div className="w-12 h-12" />}
        </div>
        {/* A — 下 (绿色, ok) */}
        <div className="row-start-3 col-start-2">
          {!hiddenButtons.includes('A') ? (
            <XboxButton label="A" color="green" mappedKey={getMappedKey('A')}
              onPress={handlePress('A')} onRelease={handleRelease('A')} />
          ) : <div className="w-12 h-12" />}
        </div>
      </div>

      {/* Center Utility Buttons — 位置保持不变 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 md:gap-8 pointer-events-auto items-end scale-75 md:scale-100 origin-bottom">
        {!hiddenButtons.includes('Select') ? (
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.9, backgroundColor: 'rgba(255,255,255,0.2)' }}
              onMouseDown={handlePress('Select')}
              onMouseUp={handleRelease('Select')}
              onMouseLeave={handleRelease('Select')}
              onTouchStart={handlePress('Select')}
              onTouchEnd={handleRelease('Select')}
              className="w-14 h-5 bg-white/10 rounded-full border border-white/10 flex items-center justify-center"
            >
              {getMappedKey('Select') && <span className="text-[7px] font-mono text-white/50">{getMappedKey('Select')}</span>}
            </motion.button>
            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Select</span>
          </div>
        ) : <div className="w-14" />}

        {!hiddenButtons.includes('Start') ? (
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.9, backgroundColor: 'rgba(255,255,255,0.3)' }}
              onMouseDown={handlePress('Start')}
              onMouseUp={handleRelease('Start')}
              onMouseLeave={handleRelease('Start')}
              onTouchStart={handlePress('Start')}
              onTouchEnd={handleRelease('Start')}
              className="w-14 h-5 bg-white/20 rounded-full border border-white/10 flex items-center justify-center"
            >
              {getMappedKey('Start') && <span className="text-[7px] font-mono text-white/60">{getMappedKey('Start')}</span>}
            </motion.button>
            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Start</span>
          </div>
        ) : <div className="w-14" />}
      </div>

      {/* Top Shoulder Buttons — 位置保持不变 */}
      <div className="absolute top-16 md:top-24 inset-x-6 md:inset-x-12 flex justify-between pointer-events-auto scale-75 md:scale-100">
        {!hiddenButtons.includes('L1') ? (
          <motion.button
            whileTap={{ scale: 0.95, backgroundColor: 'rgba(255,255,255,0.15)' }}
            onMouseDown={handlePress('L1')}
            onMouseUp={handleRelease('L1')}
            onMouseLeave={handleRelease('L1')}
            onTouchStart={handlePress('L1')}
            onTouchEnd={handleRelease('L1')}
            className="w-24 h-9 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center px-4"
          >
            <span className="text-[10px] font-black text-white/30 italic">LB</span>
            {getMappedKey('L1') && <span className="text-[8px] font-mono text-white/20">Key: {getMappedKey('L1')}</span>}
          </motion.button>
        ) : <div className="w-24 h-9" />}

        {!hiddenButtons.includes('R1') ? (
          <motion.button
            whileTap={{ scale: 0.95, backgroundColor: 'rgba(255,255,255,0.15)' }}
            onMouseDown={handlePress('R1')}
            onMouseUp={handleRelease('R1')}
            onMouseLeave={handleRelease('R1')}
            onTouchStart={handlePress('R1')}
            onTouchEnd={handleRelease('R1')}
            className="w-24 h-9 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-end px-4"
          >
            <span className="text-[10px] font-black text-white/30 italic">RB</span>
            {getMappedKey('R1') && <span className="text-[8px] font-mono text-white/20">Key: {getMappedKey('R1')}</span>}
          </motion.button>
        ) : <div className="w-24 h-9" />}
      </div>

      {/* Analog Stick Mocks */}
      <div className="hidden lg:flex absolute bottom-28 left-40 w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] items-center justify-center opacity-40">
        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20" />
      </div>
      <div className="hidden lg:flex absolute bottom-28 right-40 w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] items-center justify-center opacity-20">
        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20" />
      </div>
    </div>
  );
};

// ============================================================================
// D-Pad 方向键
// ============================================================================

const DPAD_COLORS: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  up:    { bg: 'bg-white/5',   border: 'border-white/10',   text: 'text-white/50',  activeBg: 'rgba(255,255,255,0.28)' },
  down:  { bg: 'bg-white/5',   border: 'border-white/10',   text: 'text-white/50',  activeBg: 'rgba(255,255,255,0.28)' },
  left:  { bg: 'bg-white/5',   border: 'border-white/10',   text: 'text-white/50',  activeBg: 'rgba(255,255,255,0.28)' },
  right: { bg: 'bg-white/5',   border: 'border-white/10',   text: 'text-white/50',  activeBg: 'rgba(255,255,255,0.28)' },
};

const DpadButton: React.FC<{
  direction: string;
  label: string;
  keyHint: string;
  onPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onRelease: () => void;
}> = ({ label, keyHint, onPress, onRelease }) => {
  const colors = DPAD_COLORS['up']!;
  return (
    <motion.button
      whileTap={{ scale: 0.9, backgroundColor: colors.activeBg }}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-black text-sm transition-all pointer-events-auto cursor-pointer ${colors.bg} ${colors.border} ${colors.text}`}
    >
      <span className="leading-none">{label}</span>
      <span className="text-[8px] font-mono leading-none tracking-tighter opacity-60 mt-0.5">[{keyHint}]</span>
    </motion.button>
  );
};

// ============================================================================
// Xbox 风格动作按钮 (Y上/X左/B右/A下)
// ============================================================================

const XBOX_COLORS: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  yellow: { bg: 'bg-amber-500/15',   border: 'border-amber-400/40',   text: 'text-amber-300',   shadow: 'shadow-amber-500/10' },
  blue:   { bg: 'bg-blue-500/15',    border: 'border-blue-400/40',    text: 'text-blue-300',    shadow: 'shadow-blue-500/10' },
  red:    { bg: 'bg-red-500/15',     border: 'border-red-400/40',     text: 'text-red-300',     shadow: 'shadow-red-500/10' },
  green:  { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-300', shadow: 'shadow-emerald-500/10' },
};

const XBOX_ACTIVE: Record<string, string> = {
  yellow: 'rgba(251,191,36,0.35)',
  blue:   'rgba(59,130,246,0.35)',
  red:    'rgba(239,68,68,0.35)',
  green:  'rgba(16,185,129,0.35)',
};

const XboxButton: React.FC<{
  label: string;
  color: 'yellow' | 'blue' | 'red' | 'green';
  mappedKey?: string;
  onPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onRelease: () => void;
}> = ({ label, color, mappedKey, onPress, onRelease }) => {
  const c = XBOX_COLORS[color]!;
  const activeBg = XBOX_ACTIVE[color]!;
  return (
    <motion.button
      whileTap={{ scale: 0.9, backgroundColor: activeBg }}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 font-black text-sm transition-all pointer-events-auto cursor-pointer ${c.bg} ${c.border} ${c.text} ${c.shadow}`}
    >
      <span className="leading-none text-base">{label}</span>
      {mappedKey && <span className="text-[7px] font-mono leading-none opacity-50 mt-0.5 uppercase">[{mappedKey}]</span>}
    </motion.button>
  );
};
