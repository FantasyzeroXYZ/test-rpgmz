import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Check, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认删除',
  cancelText = '取消',
  onConfirm,
  onCancel,
  theme,
}) => {
  const isLight = theme === 'light';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-modal-outer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        >
          {/* Backdrop screen */}
          <div
            onClick={onCancel}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal box */}
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            className={`relative w-full max-w-sm border rounded-2xl p-6 shadow-2xl z-10 space-y-4 transition-colors ${
              isLight 
                ? 'bg-white border-red-200 shadow-red-200/50' 
                : 'bg-[#0d131f] border-red-500/20 shadow-red-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</h3>
                <p className={`text-[10px] font-mono font-bold mt-0.5 uppercase tracking-wider ${isLight ? 'text-red-650' : 'text-red-400/80'}`}>Security Access Warning</p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed font-medium ${isLight ? 'text-slate-605' : 'text-slate-350'}`}>
              {message}
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onCancel}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  isLight 
                    ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800' 
                    : 'border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-red-500/10"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
