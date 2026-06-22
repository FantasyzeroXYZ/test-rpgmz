import React from 'react';
import { AppStage, UIState } from '../types';
import { Bug, Home, Gamepad2, Pause, Settings, MessageSquare, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DevToolbarProps {
  currentStage: AppStage;
  setStage: (stage: AppStage) => void;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
}

export const DevToolbar: React.FC<DevToolbarProps> = ({ currentStage, setStage, uiState, setUIState }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[1000] font-sans">
      <motion.div 
        layout
        className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-hidden flex items-center p-1 gap-1"
      >
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isExpanded ? 'bg-cyan-500 text-black' : 'text-cyan-500 hover:bg-white/5'}`}
        >
          <Bug size={18} className={isExpanded ? 'rotate-0' : 'rotate-12'} />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              key="dev-toolbar-expanded"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex items-center gap-1 overflow-hidden whitespace-nowrap pr-2"
            >
              <div className="w-px h-6 bg-white/10 mx-1" />
              
              <ToolbarButton 
                active={currentStage === 'HOME'} 
                onClick={() => setStage('HOME')} 
                icon={<Home size={14} />}
                label="Home"
              />
              <ToolbarButton 
                active={currentStage === 'PLAYING'} 
                onClick={() => setStage('PLAYING')} 
                icon={<Gamepad2 size={14} />}
                label="Play"
              />

              <div className="w-px h-6 bg-white/10 mx-1" />

              <ToolbarSmallButton 
                active={uiState.isPaused} 
                onClick={() => setUIState({ isPaused: !uiState.isPaused })} 
                icon={<Pause size={14} />}
              />
              <ToolbarSmallButton 
                active={uiState.sidePanelOpen} 
                onClick={() => setUIState({ sidePanelOpen: !uiState.sidePanelOpen })} 
                icon={<Settings size={14} />}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const ToolbarButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all group ${
      active 
        ? 'bg-white/10 text-white border border-white/20' 
        : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
    }`}
  >
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const ToolbarSmallButton = ({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: any }) => (
  <button 
    onClick={onClick}
    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
      active ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-white'
    }`}
  >
    {icon}
  </button>
);
