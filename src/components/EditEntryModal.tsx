import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit3, FileCode, Clock, HardDrive, Calendar, Save, Trash2, Upload, Download, CheckCircle, FileText, Globe } from 'lucide-react';
import { GameEntry, UIState } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: GameEntry | null;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({ isOpen, onClose, game, uiState, setUIState }) => {
  if (!game) return null;

  // Active tab inside the settings panel
  const [activeTab, setActiveTab] = React.useState<'info' | 'transfers' | 'diagnostics'>('info');

  // Input state
  const [localTitle, setLocalTitle] = React.useState(game.title);
  const [localSystem, setLocalSystem] = React.useState(game.system || 'rpgmz');
  const [localCoverUrl, setLocalCoverUrl] = React.useState(game.coverUrl);
  const [localLanguage, setLocalLanguage] = React.useState(game.language || 'zh');
  const [localFileName, setLocalFileName] = React.useState(game.fileName || 'index.html');

  // Deletion confirm state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);

  // Sync inputs with the current game
  React.useEffect(() => {
    if (game) {
      setLocalTitle(game.title);
      setLocalSystem(game.system || 'rpgmz');
      setLocalCoverUrl(game.coverUrl);
      setLocalLanguage(game.language || 'zh');
      setLocalFileName(game.fileName || 'index.html');
    }
  }, [game]);

  // Save Files State (Simulating files collection)
  const [saveFiles, setSaveFiles] = React.useState([
    { id: 's1', name: "AutoSave_Session_01.sav", date: "2026-06-14 14:20", size: "1.2 MB" },
    { id: 's2', name: "Manual_Save_FinalBoss.sav", date: "2026-06-12 21:05", size: "1.2 MB" },
  ]);

  const handleAddMockSave = () => {
    const files = ["Save_Core_Quests.sav", "Save_Final_Equipments.sav", "AutoSave_CaveExplore.sav"];
    const randomName = files[Math.floor(Math.random() * files.length)];
    const newSave = {
      id: Math.random().toString(36).substring(2, 9),
      name: randomName,
      date: new Date().toLocaleString(),
      size: `${(Math.random() * 2 + 0.4).toFixed(1)} MB`
    };
    setSaveFiles([newSave, ...saveFiles]);
  };

  const handleDeleteSaveFile = (id: string) => {
    setSaveFiles(prev => prev.filter(s => s.id !== id));
  };

  // Safe delete execution handler
  const handleConfirmDeleteGame = () => {
    const updatedGames = uiState.games.filter(g => g.id !== game.id);
    setUIState({ games: updatedGames, activeModal: 'NONE', editingGameId: null });
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  // Save All Changes
  const handleSaveAll = () => {
    const updatedGames = uiState.games.map(g => {
      if (g.id === game.id) {
        return {
          ...g,
          title: localTitle.trim() || g.title,
          system: localSystem,
          coverUrl: localCoverUrl,
          language: localLanguage,
          fileName: localFileName.trim() || 'index.html',
        };
      }
      return g;
    });
    setUIState({ games: updatedGames, activeModal: 'NONE', editingGameId: null });
    onClose();
  };

  // Trigger random premium stock covers
  const triggerMockCoverUpload = () => {
    const presetCovers = [
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400&h=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=400&h=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=400&h=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560253023-3ec5d502959f?q=80&w=400&h=600&auto=format&fit=crop"
    ];
    const newCover = presetCovers[Math.floor(Math.random() * presetCovers.length)];
    setLocalCoverUrl(newCover);
    alert("本地文件选取已触发。成功加载替换封面。");
  };

  const isLight = uiState.theme === 'light';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="edit-entry-modal-outer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto"
        >
          {/* Overlay backdrop */}
          <div 
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          />
          
          {/* Main Dialog Panel - Simplified single column layout */}
          <motion.div
            initial={{ scale: 0.92, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 15 }}
            className={`relative w-full max-w-lg border rounded-[1.5rem] shadow-2xl p-5 md:p-6 my-8 z-10 flex flex-col min-w-0 transition-all ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50' 
                : 'bg-[#090d14] border-white/10 text-white shadow-cyan-500/5'
            }`}
          >
            {/* Header section - Cover visual display next to title */}
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <img 
                  src={localCoverUrl} 
                  className={`w-11 h-14 object-cover border rounded-lg shrink-0 shadow-lg ${isLight ? 'border-slate-205' : 'border-white/10'}`} 
                  alt="" 
                />
                <div>
                  <h2 className={`text-md md:text-lg font-black italic uppercase tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>条目详情管理</h2>
                  <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Console System Core Emulator Panel</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  isLight 
                    ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-800' 
                    : 'hover:bg-white/5 text-slate-500 hover:text-white'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Three Tab selectors */}
            <div className={`flex border-b mb-4 gap-1 overflow-x-auto shrink-0 scrollbar-none ${isLight ? 'border-slate-150' : 'border-white/5'}`}>
              <button 
                onClick={() => setActiveTab('info')}
                className={`py-2 px-3 text-[10px] font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === 'info' 
                    ? 'border-cyan-500 text-cyan-500 font-extrabold' 
                    : isLight 
                      ? 'border-transparent text-slate-400 hover:text-slate-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                信息修改
              </button>
              <button 
                onClick={() => setActiveTab('transfers')}
                className={`py-2 px-3 text-[10px] font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === 'transfers' 
                    ? 'border-cyan-500 text-cyan-500 font-extrabold' 
                    : isLight 
                      ? 'border-transparent text-slate-400 hover:text-slate-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                上传与下载
              </button>
              <button 
                onClick={() => setActiveTab('diagnostics')}
                className={`py-2 px-3 text-[10px] font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === 'diagnostics' 
                    ? 'border-cyan-500 text-cyan-500 font-extrabold' 
                    : isLight 
                      ? 'border-transparent text-slate-400 hover:text-slate-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                统计与检测
              </button>
            </div>

            {/* Tab Display Panel Area */}
            <div className="flex-1 overflow-y-auto max-h-[320px] pr-1.5 custom-scrollbar mb-4 space-y-4">
              
              {activeTab === 'info' && (
                <div className="space-y-4 py-1">
                  {/* Game Name input */}
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-500' : 'text-slate-405'}`}>条目名称</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                        className={`w-full rounded-xl py-2.5 px-3.5 text-xs font-bold outline-none focus:border-cyan-500/50 transition-all font-sans border ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-800' 
                            : 'bg-white/5 border-white/10 text-white'
                        }`}
                        placeholder="请输入游戏标题"
                      />
                    </div>
                  </div>

                  {/* Choose RPG Platform RPGMZ / RPGMV */}
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-500' : 'text-slate-405'}`}>平台技术类型</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button 
                        type="button"
                        onClick={() => setLocalSystem('rpgmz')}
                        className={`py-2.5 border rounded-xl flex flex-col items-center justify-center transition-all ${
                          localSystem === 'rpgmz' 
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 font-extrabold shadow-md shadow-cyan-500/5' 
                            : isLight 
                              ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800' 
                              : 'bg-white/[0.02] border-white/15 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-black tracking-widest uppercase italic">rpgmz</span>
                        <span className="text-[7.5px] opacity-50 font-mono mt-0.5">RPG Maker MZ</span>
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => setLocalSystem('rpgmv')}
                        className={`py-2.5 border rounded-xl flex flex-col items-center justify-center transition-all ${
                          localSystem === 'rpgmv' 
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 font-extrabold shadow-md shadow-cyan-500/5' 
                            : isLight 
                              ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800' 
                              : 'bg-white/[0.02] border-white/15 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-black tracking-widest uppercase italic">rpgmv</span>
                        <span className="text-[7.5px] opacity-50 font-mono mt-0.5">RPG Maker MV</span>
                      </button>
                    </div>
                  </div>

                  {/* Cover graphic upload & download */}
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-500' : 'text-slate-405'}`}>封面图像配置</label>
                    <div className={`flex gap-3 items-center p-3.5 border rounded-xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.01] border-white/5'}`}>
                      <img 
                        src={localCoverUrl} 
                        className={`w-12 h-16 object-cover rounded-lg border shrink-0 shadow-md ${isLight ? 'border-slate-250 bg-slate-200' : 'bg-slate-900 border-white/10'}`} 
                        alt="封面 preview" 
                      />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={triggerMockCoverUpload}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none ${
                            isLight 
                              ? 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:border-slate-300' 
                              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Upload size={12} /> 上传替换图片
                        </button>
                        <button 
                          type="button"
                          onClick={() => alert(`已启动 "${localTitle}_cover_graphic.png" 图像内容流打包下载进程。`)}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none ${
                            isLight 
                              ? 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:border-slate-300' 
                              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Download size={12} /> 下载当前图片
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Choose Game Language options: Chinese, English, Japanese, Russian */}
                  <div className="space-y-1.5 pt-1">
                    <label className={`text-[9px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-500' : 'text-slate-405'}`}>游戏语言选择 (Language)</label>
                    <select 
                      value={localLanguage}
                      onChange={(e) => setLocalLanguage(e.target.value)}
                      className={`w-full rounded-xl py-2.5 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                        isLight 
                          ? 'bg-slate-50 border-slate-200 text-slate-800 font-bold' 
                          : 'bg-white/5 border-white/10 text-white bg-[#090d14] font-bold'
                      }`}
                    >
                      <option value="zh">中文 (Chinese)</option>
                      <option value="en">English (英语)</option>
                      <option value="ja">日本語 (日语)</option>
                      <option value="ru">Русский (俄语)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'transfers' && (
                <div className="space-y-4 py-1">
                  
                  {/* Header uploads container */}
                  <div className={`p-3 border rounded-xl flex flex-col gap-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-cyan-400'}`}>上传游戏资源 (.zip / .html / .png)</span>
                      <span className="text-[7.5px] font-mono text-slate-500">Max size: 500MB</span>
                    </div>
                    <button 
                      onClick={() => alert("拖入或选择包体文件已触发。正在测试本地虚拟加载流程...")}
                      className={`py-4 border border-dashed rounded-lg text-[9px] font-black transition-all flex flex-col items-center justify-center gap-1 ${
                        isLight 
                          ? 'border-slate-350 bg-white hover:bg-slate-105 text-slate-500 hover:text-slate-800' 
                          : 'border-white/10 hover:border-cyan-500/40 bg-white/[0.01] text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      <Upload size={14} className="text-slate-550 mb-0.5" />
                      <span>拖拽文件到此处或点击上传包体</span>
                    </button>
                  </div>

                  {/* Note Import & Export options */}
                  <div className={`p-3 border rounded-xl flex flex-col gap-2.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-cyan-400'}`}>游戏笔记数据管理 (Notes Backup)</span>
                      <span className="text-[7.5px] font-mono text-slate-500 font-semibold uppercase">Import / Export Sync</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => alert("外部笔记文本（JSON / TXT）映射流汇入已加载。请上传相应备份文件。")}
                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isLight 
                            ? 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-650' 
                            : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Upload size={12} /> 导入笔记文件
                      </button>
                      <button 
                        type="button"
                        onClick={() => alert(`已成功导出《${localTitle}》条目下全部评测及生词笔记至 "${localTitle}_notes.json"。`)}
                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isLight 
                            ? 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-650' 
                            : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Download size={12} /> 导出备份笔记
                      </button>
                    </div>
                  </div>

                  {/* Live active save profiles editor block */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-450'}`}>存档备份与还原管理</label>
                      <button 
                        onClick={handleAddMockSave}
                        className="text-[8.5px] font-black text-cyan-500 hover:text-cyan-600 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        + 添加测试存档
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {saveFiles.map(file => (
                        <div key={file.id} className={`flex items-center justify-between p-2 md:p-2.5 border rounded-lg group transition-all ${
                          isLight 
                            ? 'bg-slate-50 hover:bg-slate-100/75 border-slate-150' 
                            : 'bg-white/[0.02] border border-white/5 hover:border-cyan-500/25'
                        }`}>
                          <div className="min-w-0">
                            <p className={`text-[10px] font-black truncate font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>{file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[7.5px] font-bold font-mono ${isLight ? 'text-slate-400' : 'text-slate-655'}`}>{file.date}</span>
                              <span className={`text-[7.5px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{file.size}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => alert(`已启动 "${file.name}" 备份并打包，文件下载已通过沙箱缓存代理传输。`)}
                              className={`p-1.5 cursor-pointer ${isLight ? 'text-slate-450 hover:text-cyan-600' : 'text-slate-500 hover:text-cyan-400'}`} 
                              title="下载此存档"
                            >
                              <Download size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteSaveFile(file.id)}
                              className={`p-1.5 cursor-pointer ${isLight ? 'text-slate-450 hover:text-red-600' : 'text-slate-500 hover:text-red-400'}`} 
                              title="删除此存档"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'diagnostics' && (
                <div className="space-y-4 py-1">
                  
                  {/* Basic Stat Cards */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <DiagnosticCard icon={<Calendar size={12} className="text-cyan-500" />} label="创建登记" value={game.createdAt || "2026-06-01"} isLight={isLight} />
                    <DiagnosticCard icon={<HardDrive size={12} className="text-purple-500" />} label="当前大小" value={game.fileSize || "14.4 GB"} isLight={isLight} />
                    <DiagnosticCard icon={<Clock size={12} className="text-amber-500" />} label="累计总玩时" value={game.totalPlayTime || "12h 30m"} isLight={isLight} />
                    <DiagnosticCard icon={<CheckCircle size={12} className="text-green-500" />} label="最后挂载" value={game.lastPlayed || "昨天"} isLight={isLight} />
                  </div>

                  {/* Playable main filename configuration */}
                  <div className={`border p-3.5 rounded-xl space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/25 border-white/5'}`}>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block pl-1">上传的源文件压缩包实际名称 (Source Package ZIP)</label>
                    <div className={`border rounded-xl py-3 px-4 flex items-center justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/5'}`}>
                      <span className="text-xs text-cyan-500 font-mono font-bold truncate">
                        {`${game.title.replace(/[\s\W]+/g, '_').toLowerCase()}_release_package.zip`}
                      </span>
                      <span className="text-[8px] font-black bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded font-mono uppercase shrink-0">ZIP ARCHIVE</span>
                    </div>
                    <span className="text-[7px] text-slate-550 font-mono italic block pl-1">
                      * 系统已自动检测此条目绑定的压缩主解压包体。
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Modal footer actions: Cancel, Delete, Save */}
            <div className={`pt-3 border-t mt-auto flex flex-row items-center gap-2 shrink-0 ${isLight ? 'border-slate-150' : 'border-white/5'}`}>
              <button 
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className={`flex-1 py-2.5 px-2 border rounded-xl flex items-center justify-center transition-all text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap ${
                  isLight 
                    ? 'bg-red-50 border-red-200 text-red-500 hover:text-white hover:bg-red-650' 
                    : 'bg-red-500/10 hover:bg-red-600 border-red-500/15 text-red-450 hover:text-white'
                }`} 
                title="彻底删除此游戏条目"
              >
                <Trash2 size={12} className="sm:mr-1" />
                <span className="hidden sm:inline">删除条目</span>
                <span className="sm:hidden">删除</span>
              </button>

              <button 
                type="button"
                onClick={onClose}
                className={`flex-1 py-2.5 px-2 border rounded-xl text-[9.5px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  isLight 
                    ? 'border-slate-250 bg-white hover:bg-slate-50 text-slate-650' 
                    : 'border-white/10 hover:bg-white/5 text-slate-400'
                }`}
              >
                取消
              </button>

              <button 
                type="button"
                onClick={handleSaveAll}
                className="flex-[2] py-2.5 px-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-[9.5px] font-black uppercase tracking-wider shadow-lg shadow-cyan-500/10 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Save size={12} />
                <span>保存修改</span>
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}

      {/* Embedded Deletion confirmation floating layout modal */}
      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        title="彻底删除条目"
        message={`您是否确认要把当前编辑的游戏配置《${localTitle}》以及该模拟核心挂载的所有本地、在线存档备份信息一并抹除？此操作是不可逆的。`}
        onConfirm={handleConfirmDeleteGame}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        theme={uiState.theme}
      />
    </AnimatePresence>
  );
};

interface DiagnosticCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const DiagnosticCard: React.FC<DiagnosticCardProps & { isLight?: boolean }> = ({ icon, label, value, isLight }) => (
  <div className={`border p-3.5 rounded-xl ${isLight ? 'bg-slate-50 border-slate-205' : 'bg-white/[0.02] border-white/5'}`}>
    <div className="flex items-center gap-2 text-slate-500 mb-1.5">
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className={`text-[10.5px] font-mono font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{value}</p>
  </div>
);
