import React from "react";
import { motion } from "motion/react";
import {
  Play, Settings, Maximize2, Search, Layout, Monitor,
  Edit2, Trash2, ChevronLeft, ChevronRight, BookOpen, Plus, Upload,
} from "lucide-react";
import { GameEntry, UIState } from "../types";
import { ConfirmModal } from "./ConfirmModal";
// IndexedDB 游戏库 + 模拟器桥接
import { libraryAdd, libraryDelete, libraryGetAll, libraryEntryToGameEntry, extractThumbnail, getVfsInstance, initEmulator } from "../services/emulatorBridge";

interface HomeViewProps {
  onGameSelect: (game: GameEntry) => void;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onGameSelect,
  uiState,
  setUIState,
}) => {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const games = uiState.games || [];

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = React.useState(6);
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const updateItemsPerPage = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        setItemsPerPage(12);
      } else if (width >= 1024) {
        setItemsPerPage(9);
      } else if (width >= 768) {
        setItemsPerPage(8);
      } else if (width >= 640) {
        setItemsPerPage(6);
      } else {
        setItemsPerPage(6); 
      }
    };
    updateItemsPerPage();
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  const [searchText, setSearchText] = React.useState("");

  const filteredGames = React.useMemo(() => {
    return games.filter(
      (game) =>
        game.title.toLowerCase().includes(searchText.toLowerCase()) ||
        game.system.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [games, searchText]);

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);

  // Sync if games size changes
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredGames.length, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGames = filteredGames.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Custom Deletion Confirm Modal State
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // Fullscreen support function
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(
          "Fullscreen permission blocked inside iframe container:",
          err,
        );
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ZIP 文件上传引用（用于添加游戏时导入 ROM 文件）
  const zipInputRef = React.useRef<HTMLInputElement>(null);

  // 导入进度状态
  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importMessage, setImportMessage] = React.useState('');

  // 处理 ZIP 游戏文件导入 — 使用真实的 WASM VFS + IndexedDB
  const handleZipFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    setImportMessage('正在初始化...');

    try {
      // 确保 WASM 已初始化
      await initEmulator();
      const vfs = getVfsInstance();
      if (!vfs) {
        alert('WASM 虚拟机未就绪，请确认 pkg/ 目录存在。');
        setImporting(false);
        if (zipInputRef.current) zipInputRef.current.value = '';
        return;
      }

      const newId = 'game_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const nameWithoutExt = file.name.replace(/\.zip$/i, '');
      const zipData = await file.arrayBuffer();
      setImportProgress(5);
      setImportMessage('正在解压并分析游戏...');

      // 加载 ZIP 到 VFS（与旧项目 addGameToLibrary 逻辑一致）
      const meta = await vfs.loadZip(
        new Blob([zipData]),
        (cur: number, total: number, entryName: string) => {
          const pct = 5 + Math.round((cur / total) * 60);
          setImportProgress(pct);
          if (entryName) setImportMessage(entryName);
        }
      );

      // 根据 basePath 判断引擎类型：MV 游戏资源在 www/ 子目录，MZ 在根目录
      const engineType = meta.basePath && meta.basePath.includes('www')
        ? 'RPGMV' : 'RPGMZ';
      console.log('[HomeView] 引擎类型:', engineType, 'basePath:', meta.basePath, 'indexHtml:', meta.indexHtmlPath);

      setImportProgress(80);
      setImportMessage('提取封面图...');

      // 提取标题画面作为封面
      const thumbnail = await extractThumbnail(vfs);

      setImportProgress(95);
      setImportMessage('保存到游戏库...');

      // 存储到 IndexedDB（含原始 ZIP 数据、加密密钥和引擎类型）
      const encKey = vfs.encryptionInfo ? vfs.encryptionInfo.key : '';
      await libraryAdd(newId, {
        name: nameWithoutExt,
        fileCount: meta.fileCount,
        gameId: vfs.gameId,
        zipSize: zipData.byteLength,
        thumbnail,
        hasEncryption: !!vfs.encryptionInfo,
        encryptionKey: encKey,
        engineType,
      }, zipData);

      // 刷新游戏列表
      const allEntries = await libraryGetAll();
      const games = allEntries.map(libraryEntryToGameEntry);
      setUIState({ games });

      // 清理 VFS
      vfs.shutdown();

      setImportProgress(100);
      setImportMessage('✅ 导入完成 — 游戏已添加到游戏库');
      setTimeout(() => setImporting(false), 1500);
    } catch (err: any) {
      console.error('[HomeView] 导入失败:', err);
      alert('导入失败: ' + (err.message || '未知错误'));
      setImporting(false);
    }

    if (zipInputRef.current) zipInputRef.current.value = '';
  };

  // Add Dynamic New Game Entry — 触发 ZIP 文件选择
  const handleAddNewGame = () => {
    if (importing) return;
    zipInputRef.current?.click();
  };

  // 删除游戏确认 — 使用 IndexedDB 删除
  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await libraryDelete(deleteTarget.id);
      // 刷新游戏列表
      const allEntries = await libraryGetAll();
      const games = allEntries.map(libraryEntryToGameEntry);
      setUIState({ games });
      setDeleteTarget(null);
    }
  };


  return (
    <div
      className={`w-full h-screen-safe ${uiState.theme === "light" ? "bg-[#f0f4f8]" : "bg-[#05070a]"} overflow-hidden flex flex-col transition-colors duration-300`}
    >
      {/* Dynamic Header Section */}
      <header
        className={`px-5 md:px-10 lg:px-16 py-5 border-b ${uiState.theme === "light" ? "border-slate-200 bg-white shadow-sm" : "border-white/5 bg-[#06090e]"} flex items-center justify-between shrink-0 transition-colors duration-300 z-40`}
      >
        <div>
          <h1
            className={`text-xl md:text-2xl font-black tracking-tighter italic uppercase ${uiState.theme === "light" ? "text-slate-900" : "text-white"}`}
          >
            Emulator Hub
          </h1>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
            WASM-VFS Runtime 2.1 • Alpha
          </p>
        </div>

        {/* Global Control bar - Fixed setting + fullscreen visible on all viewport widths */}
        <div className="flex items-center gap-2">
          {/* System Settings - Fixed visible on mobile */}
          <HeaderShortcut
            icon={<Settings size={14} />}
            label="系统设置"
            onClick={() =>
              setUIState({ sidePanelOpen: true, currentSideTab: "SETTINGS" })
            }
            isLight={uiState.theme === "light"}
          />

          {/* Vocabulary Shortcut - Fixed visible on mobile */}
          <HeaderShortcut
            icon={<BookOpen size={14} />}
            label="生词本"
            onClick={() => setUIState({ isDictionaryOpen: !uiState.isDictionaryOpen, dictionaryActiveTab: 'vocab' })}
            isLight={uiState.theme === "light"}
          />

          {/* Fullscreen Display toggle - Fixed visible on mobile */}
          <HeaderShortcut
            icon={<Maximize2 size={14} />}
            label="全屏显示"
            onClick={handleFullscreen}
            isLight={uiState.theme === "light"}
          />
        </div>
      </header>

      {/* Main Content Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-10 lg:px-16 pb-28 flex flex-col">
        {/* Controls Row (Search, Add, Display Mode Toggle) */}
        <div className="flex items-center gap-3 mt-5">
          {/* Left: Search input */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={13}
            />
            <input
              type="text"
              placeholder="搜索已上传资源并测试..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={`w-full border rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:border-cyan-500/50 transition-all font-medium ${
                uiState.theme === "light"
                  ? "bg-white border-slate-300 text-slate-800 focus:bg-slate-50"
                  : "bg-white/5 border-white/10 text-white"
              }`}
            />
          </div>

          {/* Right: Add Game + Toggle View controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Primary "+" Add game item */}
            <button
              onClick={handleAddNewGame}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold transition-all shadow-lg hover:scale-102 active:scale-95 cursor-pointer text-xs"
              title="添加游戏"
            >
              <Plus size={20} strokeWidth={3} />
            </button>

            {/* View Mode Grid/List toggle button */}
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow border ${
                uiState.theme === "light"
                  ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              title={viewMode === "grid" ? "切换到列表模式" : "切换到九宫格模式"}
            >
              {viewMode === "grid" ? <Monitor size={15} /> : <Layout size={15} />}
            </button>
          </div>
        </div>

          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-4 md:gap-5 mt-4"
                : "flex flex-col gap-2.5 w-full mt-4"
            }
          >
            {paginatedGames.map((game, index) =>
              viewMode === "grid" ? (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.03, 0.4) }}
                  className={`group relative flex flex-col border rounded-2xl p-2 transition-all cursor-pointer ${
                    uiState.theme === "light"
                      ? "bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md"
                      : "bg-white/[0.01] border-white/5 hover:border-white/10"
                  }`}
                  onClick={() => onGameSelect(game)}
                >
                  {/* Image layout frame - removed the top-right platform badge */}
                  <div
                    className={`aspect-[3/4] rounded-xl overflow-hidden mb-2.5 border bg-slate-900 shadow-xl relative shrink-0 ${uiState.theme === "light" ? "border-slate-200" : "border-white/10"}`}
                  >
                    <img
                      src={game.coverUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23111" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23333" font-size="14">🎮</text></svg>'}
                      alt={game.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      loading="lazy"
                    />

                    {/* Overlay play button triggers directly on tap or hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play
                          size={20}
                          fill="currentColor"
                          className="ml-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Subtitle Information & Controls below image in Grid Model */}
                  <div
                    className="px-1 flex flex-col gap-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3
                      onClick={() => onGameSelect(game)}
                      className={`font-extrabold text-[11px] truncate transition-colors uppercase italic cursor-pointer ${uiState.theme === "light" ? "text-slate-800 hover:text-cyan-600" : "text-white hover:text-cyan-400"}`}
                    >
                      {game.title}
                    </h3>

                    {/* Inline quick settings controllers below cover image: Changed to icons only without text */}
                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <span className="text-[8px] font-mono text-slate-500 font-extrabold uppercase tracking-wider">
                        {game.system}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            setUIState({
                              activeModal: "EDIT_ENTRY",
                              editingGameId: game.id,
                            })
                          }
                          className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${
                            uiState.theme === "light"
                              ? "bg-slate-100 hover:bg-cyan-500 hover:text-black border-slate-200 text-slate-600 hover:border-cyan-500"
                              : "bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 hover:border-cyan-500 text-slate-300"
                          }`}
                          title="编辑详细配置"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({ id: game.id, name: game.title })
                          }
                          className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${
                            uiState.theme === "light"
                              ? "bg-red-50 hover:bg-red-550 border-red-100 text-red-550 hover:text-white hover:border-red-550"
                              : "bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-450 hover:text-white"
                          }`}
                          title="彻底删除"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                // Simplified List Item: ONLY image, title and management buttons as requested
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`border rounded-xl p-3 flex items-center gap-4 transition-all group ${
                    uiState.theme === "light"
                      ? "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                  }`}
                >
                  {/* List thumbnail */}
                  <div
                    className="w-10 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0 cursor-pointer border border-white/10"
                    onClick={() => onGameSelect(game)}
                  >
                    <img
                      src={game.coverUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23111" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23333" font-size="14">🎮</text></svg>'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-550"
                      alt=""
                    />
                  </div>

                  {/* Plain Title: no redundant data clutter on mobile */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onGameSelect(game)}
                  >
                    <h3
                      className={`font-bold text-xs sm:text-sm truncate transition-colors uppercase italic ${
                        uiState.theme === "light"
                          ? "text-slate-800 group-hover:text-cyan-600"
                          : "text-white group-hover:text-cyan-400"
                      }`}
                    >
                      {game.title}
                    </h3>
                    <span
                      className={`inline-block px-1.5 py-0.5 font-mono text-[7px] font-black rounded uppercase mt-0.5 ${
                        uiState.theme === "light"
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {game.system}
                    </span>
                  </div>

                  {/* Management buttons: edit & delete & play (Changed fully to beautiful graphic icons) */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        setUIState({
                          activeModal: "EDIT_ENTRY",
                          editingGameId: game.id,
                        })
                      }
                      className={`w-8 h-8 rounded-full transition-all border flex items-center justify-center ${
                        uiState.theme === "light"
                          ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-cyan-500 hover:text-black hover:border-cyan-500"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                      title="配置"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({ id: game.id, name: game.title })
                      }
                      className={`w-8 h-8 rounded-full transition-all border flex items-center justify-center ${
                        uiState.theme === "light"
                          ? "bg-red-50 hover:bg-red-500 border-red-100 text-red-550 hover:text-white hover:border-red-500"
                          : "bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-white border border-red-500/10"
                      }`}
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      onClick={() => onGameSelect(game)}
                      className="w-8 h-8 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      title="启动"
                    >
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </motion.div>
              ),
            )}

            {/* Upload New Entry Grid Card Option was removed from here to prevent redundancy and scroll clutter */}
          </div>

        {/* Pagination Section controls display */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 py-4 border-t border-white/5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-slate-400 flex items-center justify-center transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    page === currentPage
                      ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/10"
                      : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5"
                  }`}
                >
                  {page}
                </button>
              ),
            )}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-slate-400 flex items-center justify-center transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 隐藏的文件上传输入 — 用于导入 RPG Maker ZIP 游戏文件 */}
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleZipFileImport}
        accept=".zip"
        className="hidden"
      />

      {/* 游戏导入进度覆盖层 */}
      {importing && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className={`w-full max-w-md border rounded-2xl p-8 shadow-2xl ${
            uiState.theme === "light" ? "bg-white border-slate-200" : "bg-[#0d131f] border-white/10"
          }`}>
            <div className="text-center mb-6">
              <div className="text-cyan-400 text-sm font-black uppercase tracking-widest animate-pulse mb-1">
                正在导入游戏
              </div>
              <div className="text-white/50 text-xs font-mono">{importProgress}%</div>
            </div>
            {/* 进度条 */}
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, importProgress)}%` }}
              />
            </div>
            {/* 当前步骤信息 */}
            {importMessage && (
              <div className="text-center">
                <p className={`text-xs font-medium truncate ${
                  uiState.theme === "light" ? "text-slate-600" : "text-white/60"
                }`}>
                  {importMessage}
                </p>
              </div>
            )}
            {importProgress >= 5 && (
              <div className={`mt-4 pt-4 border-t text-[10px] space-y-1 ${
                uiState.theme === "light" ? "border-slate-100 text-slate-400" : "border-white/5 text-white/30"
              }`}>
                <p>• 正在解压游戏资源文件</p>
                <p>• 检测加密密钥</p>
                <p>• 提取封面缩略图</p>
                <p>• 保存至本地游戏库</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating confirmation delete modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="彻底删除条目"
        message={
          deleteTarget
            ? `确认要从您的游戏库中彻底清除《${deleteTarget.name}》吗？此动作无法撤销并且所有的本地存档缓存也将一并被重置。`
            : ""
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={uiState.theme}
      />
    </div>
  );
};

const HeaderShortcut = ({
  icon,
  label,
  onClick,
  isLight,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all shadow-lg cursor-pointer ${
      isLight
        ? "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
        : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
    }`}
    title={label}
  >
    {icon}
  </button>
);
