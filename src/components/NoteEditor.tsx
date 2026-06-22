import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, StickyNote, Camera, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { UIState, NoteEntry } from '../types';
import { MOCK_SCREENSHOTS } from '../mockData';
// localStorage 持久化服务
import { getStoredNotes, saveNotes } from '../services/storageService';

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
}

const NOTE_COLORS = [
  { name: '天蓝', value: '#06b6d4' },
  { name: '赤红', value: '#f43f5e' },
  { name: '金黄', value: '#eab308' },
  { name: '翠绿', value: '#10b981' },
  { name: '幽紫', value: '#a855f7' },
];

const NOTE_CATEGORIES = [
  { value: 'none', label: '无分类' },
  { value: 'todo', label: '待办事务' },
  { value: 'unprocessed', label: '未处理' },
  { value: 'story', label: '情节记录' },
] as const;

export const NoteEditor: React.FC<NoteEditorProps> = ({ isOpen, onClose, uiState, setUIState }) => {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [color, setColor] = React.useState('#06b6d4');
  const [category, setCategory] = React.useState<'none' | 'todo' | 'unprocessed' | 'story'>('none');
  const [image, setImage] = React.useState<string>('');
  const [createdAt, setCreatedAt] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState<string | undefined>(undefined);
  const [showScreenshotLib, setShowScreenshotLib] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isLight = uiState.theme === 'light';

  React.useEffect(() => {
    if (isOpen) {
      if (uiState.editingNoteId) {
        const found = uiState.notes.find(n => n.id === uiState.editingNoteId);
        if (found) {
          setTitle(found.title || '');
          setContent(found.content);
          setColor(found.color || '#06b6d4');
          setCategory(found.category || 'none');
          setImage(found.image || '');
          setCreatedAt(found.createdAt || found.timestamp || new Date().toLocaleString());
          setUpdatedAt(found.updatedAt);
        }
      } else {
        setTitle('');
        setContent('');
        setColor('#06b6d4');
        setCategory('none');
        setImage('');
        setCreatedAt(new Date().toLocaleString());
        setUpdatedAt(undefined);
      }
      setShowScreenshotLib(false);
    }
  }, [isOpen, uiState.editingNoteId, uiState.notes]);

  const handleSave = () => {
    if (!title.trim()) return;
    const nowStr = new Date().toLocaleString();
    if (uiState.editingNoteId) {
      // Edit mode
      const updatedNotes = uiState.notes.map(n => 
        n.id === uiState.editingNoteId 
          ? { 
              ...n, 
              title: title.trim(),
              content: content.trim(), 
              color,
              category,
              image,
              timestamp: nowStr,
              updatedAt: nowStr 
            } 
          : n
      );
      setUIState({ notes: updatedNotes, editingNoteId: null });
      saveNotes(updatedNotes); // 持久化到 localStorage
    } else {
      // Create mode
      const newNote: NoteEntry = {
        id: Math.random().toString(36).substr(2, 9),
        gameId: uiState.editingGameId || '1',
        title: title.trim(),
        content: content.trim(),
        color,
        category,
        image,
        timestamp: nowStr,
        createdAt: nowStr,
        updatedAt: undefined,
      };
      const updatedNotes = [newNote, ...uiState.notes];
      setUIState({ notes: updatedNotes });
      saveNotes(updatedNotes); // 持久化到 localStorage
    }
    setTitle('');
    setContent('');
    setImage('');
    onClose();
  };

  const handleCancel = () => {
    setUIState({ editingNoteId: null });
    onClose();
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const captureScreen = () => {
    const gameplayScreens = [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop'
    ];
    const randomScreen = gameplayScreens[Math.floor(Math.random() * gameplayScreens.length)];
    setImage(randomScreen);
  };

  const isEditing = !!uiState.editingNoteId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="note-editor-outer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={handleCancel}
            className="fixed inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
          />
          
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className={`relative w-full max-w-lg ${isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0a0d12] border-white/10 text-white'} border rounded-2xl shadow-2xl overflow-hidden my-8 z-10 flex flex-col`}
          >
            {/* Header */}
            <div className={`p-4 border-b ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/[0.02]'} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <StickyNote size={16} className="text-cyan-500" />
                <h3 className={`text-xs font-black uppercase tracking-widest italic ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {isEditing ? '编辑随手记' : '新增随手记'}
                </h3>
              </div>
              <button 
                onClick={handleCancel} 
                className={`${isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-500 hover:text-white'} transition-colors`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[75vh] custom-scrollbar">
              
              {/* Note Name/Title */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  笔记名称 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="请输入笔记标题..." 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-4 py-2.5 text-xs rounded-xl outline-none border focus:border-cyan-500 transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-800' 
                      : 'bg-black/40 border-white/5 text-white'
                  }`}
                />
              </div>

              {/* Note Category */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  笔记分类
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {NOTE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`py-2 text-[10px] font-black rounded-xl border transition-all ${
                        category === cat.value
                          ? 'bg-cyan-500 border-cyan-500 text-black'
                          : isLight
                            ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Color selection */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  标记颜色
                </label>
                <div className="flex items-center gap-3">
                  {NOTE_COLORS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setColor(col.value)}
                      className="group relative flex items-center justify-center p-1"
                      title={col.name}
                    >
                      <span 
                        className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center shadow-md transition-transform group-hover:scale-110 active:scale-95" 
                        style={{ backgroundColor: col.value }}
                      >
                        {color === col.value && (
                          <Check size={12} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content text */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  记事内容
                </label>
                <textarea 
                  placeholder="在此输入您的心得或关键线索..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`w-full h-28 p-4 text-xs rounded-xl outline-none border focus:border-cyan-500 transition-all resize-none leading-relaxed ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-800' 
                      : 'bg-black/40 border-white/5 text-white'
                  }`}
                />
              </div>

              {/* Note Image attachment */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    插图附件
                  </label>
                  {image && (
                    <button 
                      type="button" 
                      onClick={() => setImage('')} 
                      className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                      清除插图
                    </button>
                  )}
                </div>

                {image ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-slate-950">
                    <img src={image} className="w-full h-full object-cover" alt="Attachment Preview" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setImage('')} 
                        className="p-2 bg-red-650 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                        title="删除插图"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()} 
                        className="p-2 bg-cyan-700 hover:bg-cyan-500 text-black rounded-lg transition-colors cursor-pointer"
                        title="重新上传"
                      >
                        <Upload size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center transition-colors ${
                    isLight ? 'border-slate-300 bg-slate-50/50 hover:bg-slate-50' : 'border-white/10 bg-white/[0.01] hover:bg-white/[0.03]'
                  }`}>
                    <ImageIcon className={isLight ? 'text-slate-300' : 'text-slate-700'} size={28} />
                    <p className={`text-[10px] font-semibold max-w-[240px] leading-relaxed ${isLight ? 'text-slate-550' : 'text-slate-500'}`}>
                      暂无图片附件，您可以上传本地图片、截图库选取或直接抓取画面。
                    </p>
                  </div>
                )}

                {/* Upload Buttons Row */}
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleLocalUpload} 
                    className="hidden" 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${
                      isLight 
                        ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                  >
                    <Upload size={12} /> 本地上传
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScreenshotLib(true)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${
                      isLight 
                        ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                  >
                    <ImageIcon size={12} /> 截图库
                  </button>

                  <button
                    type="button"
                    onClick={captureScreen}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/15 border text-[9px] font-black uppercase tracking-wider transition-all text-cyan-400`}
                  >
                    <Camera size={12} /> 直接截图
                  </button>
                </div>
              </div>

              {/* Timestamp details */}
              <div className={`p-3 rounded-xl border text-[9px] space-y-1 ${
                isLight ? 'bg-slate-100 border-slate-250 text-slate-500' : 'bg-[#0e131d] border-white/5 text-slate-400'
              }`}>
                <div className="flex justify-between">
                  <span className="font-bold uppercase tracking-widest text-[#06b6d4]">创建时间</span>
                  <span className="font-mono">{createdAt}</span>
                </div>
                {updatedAt && (
                  <div className="flex justify-between border-t border-dashed border-white/10 pt-1 mt-1">
                    <span className="font-bold uppercase tracking-widest text-emerald-500">最近修改</span>
                    <span className="font-mono">{updatedAt}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Cancel/Confirm Action buttons */}
            <div className={`p-4 border-t ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/[0.02]'} flex gap-2`}>
              <button 
                type="button"
                onClick={handleCancel}
                className={`flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isLight 
                    ? 'border-slate-250 bg-white hover:bg-slate-100 text-slate-500' 
                    : 'border-white/5 hover:bg-white/5 text-slate-400'
                }`}
              >
                取消
              </button>
              <button 
                type="button"
                disabled={!title.trim()}
                onClick={handleSave}
                className="flex-[2] py-3 bg-cyan-500 disabled:opacity-50 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={14} /> {isEditing ? '确认修改' : '保存笔记'}
              </button>
            </div>
          </motion.div>

          {/* Screenshot Library modal dialog overlay */}
          <AnimatePresence>
            {showScreenshotLib && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              >
                <div className={`relative w-full max-w-md ${isLight ? 'bg-white border-slate-300' : 'bg-[#0d131f] border-white/10'} border rounded-2xl p-6 shadow-2xl`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="text-cyan-500" size={16} />
                      <h4 className={`text-xs font-black uppercase tracking-widest ${isLight ? 'text-slate-800' : 'text-white'}`}>选取现有截图</h4>
                    </div>
                    <button 
                      onClick={() => setShowScreenshotLib(false)} 
                      className={`${isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-500 hover:text-white'}`}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {MOCK_SCREENSHOTS.map(sc => (
                      <button 
                        key={sc.id} 
                        type="button" 
                        onClick={() => {
                          setImage(sc.url);
                          setShowScreenshotLib(false);
                        }}
                        className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-cyan-500 focus:outline-none focus:border-cyan-500 transition-all text-left bg-slate-900"
                      >
                        <img src={sc.url} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" alt="Shot Choice" />
                        <span className="absolute bottom-1 right-2 text-[8px] font-mono text-white/50 bg-black/50 px-1 rounded">{sc.date.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    onClick={() => setShowScreenshotLib(false)} 
                    className={`mt-4 w-full py-2 bg-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all ${
                      isLight ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    返回编辑器
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
};
