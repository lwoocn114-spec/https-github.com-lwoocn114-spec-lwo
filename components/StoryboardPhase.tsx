
import React, { useEffect, useRef, useState } from 'react';
import { Shot, VisualStyle, AspectRatio, AISettings } from '../types';
// Fixed: Changed 'regenerateShotImage' to 'generateShotImage'
import { generateShotImage, generateSpeech, translateToEnglish } from '../services/geminiService';
import { 
    RotateCcw, Loader2, Video as VideoIcon, 
    MapPin, Copy, Mic, MessageCircle, Volume2, Maximize2, AlertTriangle, CheckCircle2, Clipboard, ArrowDown, Languages
} from 'lucide-react';

interface StoryboardPhaseProps {
  shots: Shot[];
  style: VisualStyle;
  aspectRatio: AspectRatio;
  onUpdateShot: (id: string, updates: Partial<Shot>) => void;
  onRegenerateShot: (id: string) => void;
  onBack: () => void;
  onPreviewImage: (url: string) => void;
  apiKey: string;
  projectSeed: number; 
  baseUrl?: string; 
  settings: AISettings;
}

// Internal Component to handle image loading state
const ImageWithLoader: React.FC<{ src: string; alt: string; isLoading?: boolean }> = ({ src, alt, isLoading }) => {
    const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
    
    // Reset loaded state when src changes
    useEffect(() => {
        setImageState('loading');
    }, [src]);

    const handleLoad = () => setImageState('loaded');
    const handleError = () => setImageState('error');

    // Use a placeholder if error
    const displaySrc = imageState === 'error' 
        ? 'https://placehold.co/800x450/1a1a1a/666666?text=Generation+Failed' 
        : src;

    const showLoader = (imageState === 'loading' || isLoading) && imageState !== 'error';

    return (
        <div className="relative w-full h-full bg-neutral-900">
            {showLoader && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
                    <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
                    <div className="flex flex-col items-center gap-2 relative z-20">
                        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
                        <span className="text-[10px] uppercase tracking-widest font-mono text-neutral-600">
                            {isLoading ? 'GENERATING' : 'LOADING'}
                        </span>
                    </div>
                </div>
            )}
            
            {imageState === 'error' && (
                 <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                     <AlertTriangle className="w-10 h-10 text-neutral-600 opacity-50" />
                </div>
            )}

            <img 
                src={displaySrc} 
                alt={alt} 
                className={`w-full h-full object-cover transition-opacity duration-700 ${showLoader ? 'opacity-0' : 'opacity-100'}`}
                onLoad={handleLoad}
                onError={handleError}
            />
        </div>
    );
};

export const StoryboardPhase: React.FC<StoryboardPhaseProps> = ({
  shots,
  style,
  aspectRatio,
  onUpdateShot,
  onRegenerateShot,
  onPreviewImage,
  apiKey,
  projectSeed,
  baseUrl,
  settings
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  // New State for Success Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [shots.length, shots.filter(s => s.imageUrl).length]);

  // --- Mock Data Logic ---
  const getMockShotImage = (shot: Shot) => {
      const seed = shot.sceneId || shot.id;
      return `https://picsum.photos/seed/${seed}/800/450?blur=1`; 
  };

  const copyPrompt = (text: string) => {
      navigator.clipboard.writeText(text);
      setToastMsg("提示词已复制");
      setTimeout(() => setToastMsg(null), 2000);
  };

  // Sync translation from Chinese Visual Action to English Prompt
  const handleTranslate = async (shot: Shot) => {
      if (!apiKey || translatingId) return;
      setTranslatingId(shot.id);
      try {
          // Fixed: translateToEnglish expects settings as the second argument
          const translated = await translateToEnglish(shot.visualAction, settings);
          onUpdateShot(shot.id, { img2vidPrompt: translated });
          setToastMsg("翻译成功！");
      } catch (e) {
          console.error("Translation failed, falling back to copy", e);
          onUpdateShot(shot.id, { img2vidPrompt: shot.visualAction }); // Fallback
          setToastMsg("翻译服务繁忙，已复制原文");
      } finally {
          setTranslatingId(null);
          setTimeout(() => setToastMsg(null), 2000);
      }
  };

  const handleCopyVideoPrompt = async (shot: Shot) => {
    if (!shot.img2vidPrompt) return;
    
    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(shot.img2vidPrompt);
        setToastMsg("已复制！请前往 Runway/Luma/可灵 粘贴生成视频。");
        setTimeout(() => setToastMsg(null), 5000);
    } catch (err) {
        console.error("Copy failed", err);
    }
  };

  const playAudio = async (text: string) => {
      try {
          // Fixed: generateSpeech only expects 1 argument
          const audioBuffer = await generateSpeech(text);
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const buffer = await ctx.decodeAudioData(audioBuffer);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
      } catch (e) { console.error(e); }
  }

  // --- Voice Tag Helper ---
  const getAudioTag = (text?: string) => {
      if (!text) return { label: '环境音', icon: <Volume2 className="w-3 h-3" />, color: 'text-neutral-500', bg: 'bg-neutral-800' };
      
      if (text.startsWith('(') || text.startsWith('（')) {
          return { label: '环境/动作音', icon: <Volume2 className="w-3 h-3" />, color: 'text-green-400', bg: 'bg-green-900/20' };
      }
      if (text.includes('旁白') || text.includes('OS')) {
          return { label: '旁白', icon: <Mic className="w-3 h-3" />, color: 'text-purple-400', bg: 'bg-purple-900/20' };
      }
      return { label: '对白', icon: <MessageCircle className="w-3 h-3" />, color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200 relative">
      
      {/* Success Toast */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce-in">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Stats Bar (Sub-header) */}
      <div className="px-6 py-2 bg-neutral-900/30 border-b border-neutral-800 flex items-center justify-between text-[10px] text-neutral-500 font-mono uppercase tracking-wider sticky top-0 z-10">
           <span>分镜列表 / SHOT LIST</span>
           <span>共 {shots.length} 镜</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-12">
        {shots.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-600">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>导演正在思考分镜...</p>
            </div>
        )}

        {shots.map((shot, index) => {
            const tag = getAudioTag(shot.dialogue);
            const displayImage = shot.imageUrl || getMockShotImage(shot);
            return (
                <div key={shot.id} className="group relative flex gap-6 pb-12 border-b border-neutral-800/50 last:border-0 animate-fade-in-up">
                    {/* Timeline Line */}
                    <div className="absolute left-[16px] top-10 bottom-0 w-px bg-neutral-800 group-last:hidden"></div>

                    {/* Index Column */}
                    <div className="flex flex-col items-center gap-2 pt-2 z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${shot.isLoading ? 'border-blue-500 text-blue-500 animate-pulse bg-blue-900/10' : 'border-neutral-700 bg-neutral-900 text-neutral-400'}`}>
                            {index + 1}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Visual Preview (5 cols) */}
                        <div className="lg:col-span-5">
                            <div 
                                className={`relative rounded-lg overflow-hidden bg-black border border-neutral-800 shadow-xl cursor-pointer ${aspectRatio === AspectRatio.PORTRAIT ? 'aspect-[9/16] max-w-[200px]' : 'aspect-video w-full'}`}
                                onClick={() => onPreviewImage(displayImage)}
                            >
                                {/* Image with Loader */}
                                <ImageWithLoader src={displayImage} alt="shot" isLoading={shot.isLoading} />
                                
                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20">
                                    {/* Targeted Regenerate Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRegenerateShot(shot.id); }} 
                                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white backdrop-blur transition-all font-bold shadow-lg text-xs" 
                                        title="使用当前提示词重新生成"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        重新生成 (Regenerate)
                                    </button>
                                    
                                    {/* Copy Video Prompt Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleCopyVideoPrompt(shot); }} 
                                        className="p-2.5 rounded-full bg-purple-600/50 hover:bg-purple-600 text-white backdrop-blur transition-all" 
                                        title="复制视频提示词"
                                    >
                                        <Clipboard className="w-4 h-4" />
                                    </button>

                                    <div className="p-2.5 rounded-full bg-white/10 text-white backdrop-blur pointer-events-none"><Maximize2 className="w-4 h-4" /></div>
                                </div>
                            </div>
                            
                            {/* Disclaimer / Tags under image */}
                            <div className="mt-3 flex flex-col gap-2">
                                <p className="text-[10px] text-neutral-500 text-center leading-relaxed bg-neutral-900/50 p-2 rounded border border-neutral-800/50">
                                    * 注：Gemini 暂未开放视频生成 API，请点击复制提示词，配合图片使用第三方工具 (Runway/Luma) 生成。
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {shot.sceneId && (
                                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                                            <MapPin className="w-3 h-3" />
                                            {shot.sceneId}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Details (7 cols) */}
                        <div className="lg:col-span-7 flex flex-col gap-5 pt-1">
                            
                            {/* Dialogue Section */}
                            <div className="space-y-2">
                                <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-transparent ${tag.color} ${tag.bg}`}>
                                    {tag.icon} {tag.label}
                                </div>
                                {shot.dialogue ? (
                                    <blockquote 
                                        onClick={() => playAudio(shot.dialogue!)}
                                        className="relative p-4 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 text-neutral-200 text-lg font-medium leading-relaxed shadow-sm cursor-pointer hover:border-neutral-600 transition-colors group/quote"
                                    >
                                        "{shot.dialogue}"
                                        <div className="absolute bottom-2 right-2 opacity-50 group-hover/quote:opacity-100 transition-opacity">
                                            <Volume2 className="w-4 h-4 text-neutral-400" />
                                        </div>
                                    </blockquote>
                                ) : (
                                    <div className="text-neutral-600 text-sm italic p-2">
                                        (无对白)
                                    </div>
                                )}
                            </div>

                            <hr className="border-neutral-800" />

                            {/* Visual Action (Chinese) - Editable */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        中文画面描述
                                    </h4>
                                    <div className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 font-mono">{shot.cameraAngle}</div>
                                </div>
                                <textarea
                                    className="w-full bg-transparent border border-transparent hover:border-neutral-800 rounded p-1 text-sm text-neutral-300 leading-relaxed font-light resize-none focus:outline-none focus:border-blue-900/50 transition-colors"
                                    rows={2}
                                    value={shot.visualAction}
                                    onChange={(e) => onUpdateShot(shot.id, { visualAction: e.target.value })}
                                />
                            </div>

                            {/* Middle Action Bar: Translate / Sync */}
                            <div className="flex justify-center">
                                <button 
                                    onClick={() => handleTranslate(shot)}
                                    disabled={translatingId === shot.id}
                                    className="group flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-800 transition-all text-[10px] text-neutral-500 hover:text-blue-400"
                                    title="翻译中文描述并覆盖下方英文 Prompt"
                                >
                                    {translatingId === shot.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                                    )}
                                    <Languages className="w-3 h-3" />
                                    <span>翻译并覆盖 (Translate & Overwrite)</span>
                                </button>
                            </div>

                             {/* Generated Prompt (English) - Fully Editable */}
                             <div className="group/prompt relative space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-neutral-600 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                        英文提示词 (AI Prompt)
                                    </h4>
                                    <button 
                                        onClick={() => copyPrompt(shot.img2vidPrompt)} 
                                        className="text-[10px] flex items-center gap-1 text-neutral-500 hover:text-white transition-colors"
                                    >
                                        <Copy className="w-3 h-3" /> 复制
                                    </button>
                                </div>
                                <textarea
                                    className="w-full h-32 bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 text-neutral-400 focus:text-neutral-200 text-xs font-mono leading-relaxed p-3 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                    value={shot.img2vidPrompt}
                                    onChange={(e) => onUpdateShot(shot.id, { img2vidPrompt: e.target.value })}
                                    placeholder="在此编辑英文提示词..."
                                />
                             </div>
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={bottomRef} className="h-20" />
      </div>
    </div>
  );
};
