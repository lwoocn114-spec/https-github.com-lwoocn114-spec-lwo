
import React, { useState, useRef, useEffect } from 'react';
import { CharacterPhase } from './components/CharacterPhase';
import { StoryboardPhase } from './components/StoryboardPhase';
import { SetupPhase } from './components/SetupPhase';
import { VideoEditor } from './components/VideoEditor';
import SettingsModal from './components/SettingsModal';
import { 
  analyzeScript, 
  generateShotImage, 
  analyzeCharacters, 
  analyzeScenes, 
  expandScript, 
  getPollinationsUrl, 
  QUALITY_CONFIG 
} from './services/geminiService';
import { Shot, VisualStyle, AspectRatio, Character, Scene, AppStep, Genre, QualityMode, AISettings } from './types';
import JSZip from 'jszip';
import { 
  Clapperboard, 
  LayoutTemplate, 
  Palette, 
  FileText, 
  ChevronRight,
  ChevronLeft,
  Sparkles,
  RotateCcw,
  BookOpen,
  Wand2,
  Undo2,
  Loader2,
  ArrowLeft,
  Download,
  X,
  AlertCircle,
  Film,
  Zap,
  Scale,
  Gem,
  Settings
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('IDLE');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [isZipping, setIsZipping] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [script, setScript] = useState('一个赛博朋克侦探走在霓虹闪烁的雨夜小巷里寻找线索。突然，他在水坑里发现了一个发光的微芯片。');
  const [previousScript, setPreviousScript] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [projectSeed, setProjectSeed] = useState<number>(42);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  
  const [currentGenre, setCurrentGenre] = useState<Genre>(Genre.CYBERPUNK);
  const [currentStyle, setCurrentStyle] = useState<VisualStyle>(VisualStyle.CINEMATIC_REALISM);
  const [currentRatio, setCurrentRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);
  const [qualityMode, setQualityMode] = useState<QualityMode>('speed');
  
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    setProjectSeed(Math.floor(Math.random() * 100000));
  }, []);

  const getAISettings = (): AISettings => {
    const saved = localStorage.getItem('manju_ai_settings');
    if (saved) return JSON.parse(saved);
    return {
      provider: 'gemini',
      baseUrl: '',
      modelName: 'gemini-3-flash-preview'
    };
  };

  const showError = (msg: string) => {
      setErrorMsg(msg.replace('Error:', '').trim());
      setTimeout(() => setErrorMsg(null), 5000);
  };

  const handleAIExpand = async () => {
    if (!script.trim() || isExpanding) return;
    setPreviousScript(script);
    setIsExpanding(true);
    try {
        const expansion = await expandScript(script, currentGenre, getAISettings());
        setScript(prev => prev + "\n\n" + expansion);
    } catch (e: any) {
        showError(e.message || "Expansion failed.");
    } finally {
        setIsExpanding(false);
    }
  };

  const handleUndo = () => {
    if (previousScript !== null) {
      setScript(previousScript);
      setPreviousScript(null);
    }
  };

  const handleAnalyze = async () => {
    if (!script.trim() || isLoading) return;
    setIsLoading(true);
    setProjectSeed(Math.floor(Math.random() * 100000));
    try {
      const settings = getAISettings();
      setLoadingStep("正在提取角色设定...");
      const chars = await analyzeCharacters(script, currentGenre, settings);
      setLoadingStep("正在构建场景氛围...");
      const extractedScenes = await analyzeScenes(script, currentGenre, settings);
      setCharacters(chars);
      setScenes(extractedScenes);
      setStep('PRE_PRODUCTION');
    } catch (e: any) {
      showError(e.message || "AI Analysis failed.");
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleConfirmPreProduction = async (confirmedCharacters: Character[], confirmedScenes: Scene[]) => {
    setCharacters(confirmedCharacters);
    setScenes(confirmedScenes);
    setStep('STORYBOARD');
    setIsLoading(true);
    try {
        setLoadingStep("导演正在规划分镜...");
        const analysis = await analyzeScript(script, currentStyle, confirmedCharacters, confirmedScenes, getAISettings());
        const initialShots: Shot[] = analysis.map(s => ({
            ...s,
            imageUrl: undefined,
            videoUrl: undefined,
            isLoading: false,
            isError: false
        }));
        setShots(initialShots);
        setIsLoading(false);
        setLoadingStep("");
        processShotQueue(initialShots, confirmedCharacters, confirmedScenes);
    } catch (e: any) {
        showError(e.message || "Planning failed.");
        setIsLoading(false);
    }
  };

  const processShotQueue = async (initialShots: Shot[], charCtx: Character[], sceneCtx: Scene[]) => {
      isGeneratingRef.current = true;
      for (let i = 0; i < initialShots.length; i++) {
          if (!isGeneratingRef.current) break;
          const shotId = initialShots[i].id;
          setShots(prev => prev.map(s => s.id === shotId ? { ...s, isLoading: true } : s));
          try {
              const imageUrl = await generateShotImage(
                  initialShots[i], 
                  currentStyle, 
                  currentRatio, 
                  sceneCtx, 
                  charCtx, 
                  projectSeed, 
                  qualityMode
              );
              setShots(prev => prev.map(s => s.id === shotId ? { ...s, isLoading: false, imageUrl } : s));
          } catch (e) {
              setShots(prev => prev.map(s => s.id === shotId ? { ...s, isLoading: false, isError: true } : s));
          }
      }
      isGeneratingRef.current = false;
  };

  const handleUpdateShot = (id: string, updates: Partial<Shot>) => {
      setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const handleRegenerateShot = (id: string) => {
      const targetShot = shots.find(s => s.id === id);
      if (!targetShot) return;
      const promptToUse = targetShot.img2vidPrompt || targetShot.visualAction;
      let anchorImage = "";
      const matchedChar = characters.find(c => 
          (targetShot.visualAction.includes(c.name) || (targetShot.dialogue && targetShot.dialogue.includes(c.name))) 
      );
      if (matchedChar && matchedChar.imageUrl && matchedChar.imageUrl.startsWith("http")) {
          anchorImage = matchedChar.imageUrl;
      }
      const newSeed = Math.floor(Math.random() * 1000000000);
      const settings = QUALITY_CONFIG[qualityMode].sizes[currentRatio] || QUALITY_CONFIG[qualityMode].sizes[AspectRatio.SQUARE];
      const model = QUALITY_CONFIG[qualityMode].model;
      const fullPrompt = `((${currentStyle})), ${promptToUse}, cinematic lighting, masterpiece, 8k`;
      const newUrl = getPollinationsUrl(fullPrompt, settings.w, settings.h, newSeed, model, anchorImage || undefined);
      setShots(prev => prev.map(s => s.id === id ? { ...s, isLoading: true, imageUrl: undefined } : s));
      setTimeout(() => {
          setShots(prev => prev.map(s => s.id === id ? { ...s, imageUrl: newUrl, isLoading: false } : s));
      }, 50);
  };

  const handleGlobalReset = () => {
    isGeneratingRef.current = false;
    setStep('IDLE');
    setCharacters([]);
    setScenes([]);
    setShots([]);
    setPreviousScript(null);
  };
  
  const handleBack = () => {
      if (step === 'STORYBOARD') { setStep('PRE_PRODUCTION'); isGeneratingRef.current = false; }
      else if (step === 'PRE_PRODUCTION') { setStep('IDLE'); }
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    try {
        const zip = new JSZip();
        const folder = zip.folder("manju_storyboard");
        const scriptContent = shots.map((s, i) => `[Shot ${i+1}]\n${s.dialogue || ''}\n${s.visualAction}`).join('\n\n');
        folder?.file("script.txt", scriptContent);
        const promises = shots.map(async (shot, i) => {
            if (shot.imageUrl) {
                const response = await fetch(shot.imageUrl);
                const blob = await response.blob();
                folder?.file(`shot_${String(i + 1).padStart(2, '0')}.png`, blob);
            }
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a'); a.href = url; a.download = "storyboard.zip"; a.click();
    } catch (e) { showError("Export failed"); } 
    finally { setIsZipping(false); }
  };

  if (step === 'VIDEO_PREVIEW') {
      return (
          <VideoEditor 
            storyboard={shots} 
            aspectRatio={currentRatio}
            onBack={() => setStep('STORYBOARD')} 
          />
      );
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-200 overflow-hidden font-sans relative">
        {errorMsg && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in-down">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold text-sm">{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="ml-2 hover:bg-white/20 rounded p-1"><X className="w-4 h-4" /></button>
            </div>
        )}

        {previewImage && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out animate-fade-in" onClick={() => setPreviewImage(null)}>
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg border border-neutral-800" onClick={(e) => e.stopPropagation()} />
                <button className="absolute top-6 right-6 p-2 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" onClick={() => setPreviewImage(null)}><X className="w-6 h-6" /></button>
            </div>
        )}

        <div className={`flex flex-row shrink-0 h-full border-r border-neutral-800 bg-neutral-900 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-[45%] min-w-[550px] opacity-100 translate-x-0' : 'w-0 min-w-0 opacity-0 -translate-x-full border-none'}`}>
            <div className="w-[55%] min-w-[300px] flex flex-col border-r border-neutral-800 bg-neutral-900/50">
                <div className="p-4 border-b border-neutral-800 flex items-center gap-2 text-neutral-400 bg-neutral-900/80">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">剧本输入</span>
                </div>
                <div className="flex-1 relative group">
                    <textarea 
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        disabled={isExpanding}
                        className={`w-full h-full bg-transparent p-6 text-sm leading-relaxed resize-none focus:outline-none focus:bg-neutral-900/80 transition-colors text-neutral-300 placeholder-neutral-600 font-mono ${isExpanding ? 'opacity-50 blur-[1px]' : ''}`}
                        placeholder="在此输入您的剧本..."
                    />
                    {isExpanding && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center gap-2 text-purple-400 animate-pulse">
                          <Sparkles className="w-6 h-6" />
                          <span className="text-xs font-bold tracking-widest">AI 扩写中...</span>
                        </div>
                      </div>
                    )}
                </div>
                <div className="p-3 border-t border-neutral-800 bg-neutral-900 flex gap-2">
                    <button onClick={handleAIExpand} disabled={isExpanding || !script.trim()} className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all">
                      {isExpanding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI 扩写
                    </button>
                    <button onClick={handleUndo} disabled={!previousScript || isExpanding} className="px-3 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold flex items-center gap-1 disabled:opacity-30 transition-colors">
                      <Undo2 className="w-3 h-3" /> 撤销
                    </button>
                </div>
            </div>

            <div className="w-[45%] min-w-[250px] flex flex-col bg-neutral-900 z-10">
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between text-neutral-400 bg-neutral-900">
                    <div className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">控制台</span></div>
                    <button onClick={() => setSidebarOpen(false)} className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 p-5 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase"><BookOpen className="w-3 h-3" /> 剧本题材</label>
                        <select value={currentGenre} onChange={(e) => setCurrentGenre(e.target.value as Genre)} className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                            {Object.values(Genre).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase"><Palette className="w-3 h-3" /> 视觉风格</label>
                        <select value={currentStyle} onChange={(e) => setCurrentStyle(e.target.value as VisualStyle)} className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                            {Object.values(VisualStyle).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase"><LayoutTemplate className="w-3 h-3" /> 画面比例</label>
                        <select value={currentRatio} onChange={(e) => setCurrentRatio(e.target.value as AspectRatio)} className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono">
                            {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase">{qualityMode === 'speed' ? <Zap className="w-3 h-3 text-yellow-500" /> : qualityMode === 'balanced' ? <Scale className="w-3 h-3 text-blue-500" /> : <Gem className="w-3 h-3 text-purple-500" />} 画质模式</label>
                        <select value={qualityMode} onChange={(e) => setQualityMode(e.target.value as QualityMode)} className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono">
                            <option value="speed">⚡ 极速预览</option>
                            <option value="balanced">⚖️ 标准均衡</option>
                            <option value="quality">💎 极致细节</option>
                        </select>
                    </div>
                </div>
                <div className="p-5 border-t border-neutral-800 bg-neutral-900 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                    <button onClick={handleAnalyze} disabled={isLoading || step !== 'IDLE'} className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${step !== 'IDLE' ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/50'}`}>
                        {isLoading ? <div className="flex flex-col items-center gap-1"><div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span>分析中...</span></div>{loadingStep && <span className="text-[10px] opacity-75 font-normal">{loadingStep}</span>}</div> : <><Sparkles className="w-4 h-4" />{step === 'IDLE' ? '开始分析剧本' : '分析已完成'}</>}
                    </button>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col bg-neutral-950 relative shadow-[inset_10px_0_20px_rgba(0,0,0,0.2)]">
             {!isSidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-50 p-2 rounded-full bg-black/50 hover:bg-blue-600 text-white backdrop-blur-md shadow-lg transition-colors group" title="展开侧边栏">
                    <ChevronRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
             )}

             <div className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/50 backdrop-blur z-20 pl-16"> 
                <div className="flex items-center gap-4">
                    {step !== 'IDLE' ? (
                        <button onClick={handleBack} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-xs font-bold group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {step === 'STORYBOARD' ? '返回调整' : '返回上一步'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded bg-neutral-800 border border-neutral-700"><Clapperboard className="w-4 h-4 text-blue-500" /></div>
                            <span className="font-bold text-neutral-200 text-sm">工作区 / Workspace</span>
                        </div>
                    )}
                    {step !== 'IDLE' && (
                        <><div className="h-4 w-px bg-neutral-800"></div><span className="text-xs text-neutral-500 font-mono uppercase tracking-wider font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{step === 'PRE_PRODUCTION' ? '角色定妆' : '分镜绘制'}</span></>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors flex items-center justify-center bg-red-900/10 border border-red-500/20"
                        title="设置 API Key"
                    >
                        <Settings size={20} className="text-red-500" />
                    </button>
                    {step === 'STORYBOARD' && (
                         <>
                            <button onClick={() => setStep('VIDEO_PREVIEW')} className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-900/20 border border-blue-900/20 transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                <Film className="w-3 h-3" />🎬 生成样片
                            </button>
                            <button onClick={handleDownloadAll} disabled={isZipping} className="flex items-center gap-2 text-xs font-bold text-green-500 hover:text-green-400 disabled:opacity-50 px-3 py-1.5 rounded hover:bg-green-900/10 transition-colors">
                                {isZipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}导出资产
                            </button>
                        </>
                    )}
                    {step !== 'IDLE' && (
                        <button onClick={handleGlobalReset} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-full bg-red-950/30 border border-red-900/30 transition-all" title="Reset Project">
                            <RotateCcw className="w-3 h-3" />重置
                        </button>
                    )}
                </div>
             </div>

             <div className="flex-1 overflow-hidden relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100">
                {step === 'IDLE' && <SetupPhase onStart={() => {}} isLoading={false} />}
                {step === 'PRE_PRODUCTION' && (
                    <CharacterPhase 
                        characters={characters}
                        scenes={scenes}
                        style={currentStyle}
                        isLoading={isLoading}
                        onConfirm={handleConfirmPreProduction}
                        onPreviewImage={setPreviewImage}
                        projectSeed={projectSeed}
                        aspectRatio={currentRatio}
                        apiKey={process.env.API_KEY || ""}
                        settings={getAISettings()}
                    />
                )}
                {step === 'STORYBOARD' && (
                    <StoryboardPhase 
                        shots={shots}
                        style={currentStyle}
                        aspectRatio={currentRatio}
                        onUpdateShot={handleUpdateShot}
                        onRegenerateShot={handleRegenerateShot}
                        onBack={() => setStep('PRE_PRODUCTION')}
                        onPreviewImage={setPreviewImage}
                        projectSeed={projectSeed}
                        apiKey={process.env.API_KEY || ""}
                        settings={getAISettings()}
                    />
                )}
             </div>
        </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
};

export default App;
