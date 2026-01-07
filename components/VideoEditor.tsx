import React, { useState, useEffect, useRef } from 'react';
import { Shot, AspectRatio } from '../types';
import { 
    ArrowLeft, Play, Pause, SkipBack, SkipForward, 
    Volume2, Film, Clapperboard, MonitorPlay, Layers, Download, Loader2
} from 'lucide-react';

interface VideoEditorProps {
    storyboard: Shot[];
    aspectRatio: AspectRatio;
    onBack: () => void;
}

// Helper: Text Wrapping for Canvas
const drawWrappedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const chars = text.split('');
    let line = '';
    const lines = [];

    for (let n = 0; n < chars.length; n++) {
        const testLine = line + chars[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = chars[n];
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    // Draw lines (Stacking upwards from bottom baseline y is tricky, so we draw downwards from y)
    // Note: The caller should pass the Y of the *first* line or handle offsetting.
    // Here we assume Y is the bottom of the last line, so we calculate upwards?
    // Let's assume Y is the starting Y for the first line.
    lines.forEach((l, idx) => {
        ctx.strokeText(l, x, y + (idx * lineHeight));
        ctx.fillText(l, x, y + (idx * lineHeight));
    });
};

export const VideoEditor: React.FC<VideoEditorProps> = ({ storyboard, aspectRatio, onBack }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    
    // Export State
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const DURATION_PER_SHOT = 4000; // 4 seconds per shot
    const intervalRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Mock images if missing
    const getDisplayImage = (shot: Shot) => shot.imageUrl || `https://picsum.photos/seed/${shot.id}/800/1200?blur=2`;

    const currentShot = storyboard[currentIndex];

    // Playback Logic
    useEffect(() => {
        if (isPlaying && !isExporting) {
            startTimeRef.current = Date.now() - (progress / 100) * DURATION_PER_SHOT;
            intervalRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const newProgress = (elapsed / DURATION_PER_SHOT) * 100;

                if (newProgress >= 100) {
                    // Next Slide
                    if (currentIndex < storyboard.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                        setProgress(0);
                        startTimeRef.current = Date.now();
                    } else {
                        // End of Timeline
                        setIsPlaying(false);
                        setProgress(100);
                        if (intervalRef.current) clearInterval(intervalRef.current);
                    }
                } else {
                    setProgress(newProgress);
                }
            }, 50);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, currentIndex, storyboard.length, isExporting]);

    // Reset progress when index changes manually
    const handleJump = (index: number) => {
        if (isExporting) return;
        setCurrentIndex(index);
        setProgress(0);
        startTimeRef.current = Date.now();
    };

    const togglePlay = () => {
        if (isExporting) return;
        if (!isPlaying && progress >= 100 && currentIndex === storyboard.length - 1) {
            // Restart
            setCurrentIndex(0);
            setProgress(0);
            startTimeRef.current = Date.now();
        }
        setIsPlaying(!isPlaying);
    };

    const handleNext = () => {
        if (currentIndex < storyboard.length - 1) handleJump(currentIndex + 1);
    };

    const handlePrev = () => {
        if (currentIndex > 0) handleJump(currentIndex - 1);
    };

    const handleVoicePreview = () => {
        alert("AI 配音生成中... (Feature Placeholder)");
    };

    // --- Core Video Export Logic ---
    const handleExportVideo = async () => {
        if (isExporting) return;
        setIsExporting(true);
        setExportProgress(0);
        setIsPlaying(false); // Pause playback

        try {
            // A. Setup Canvas
            let width = 1920;
            let height = 1080;
            if (aspectRatio === AspectRatio.PORTRAIT) { width = 1080; height = 1920; }
            else if (aspectRatio === AspectRatio.SQUARE) { width = 1080; height = 1080; }
            else if (aspectRatio === AspectRatio.CINEMATIC) { width = 1920; height = 816; } // ~2.35:1
            else if (aspectRatio === AspectRatio.CLASSIC) { width = 1440; height = 1080; }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Failed to create canvas context");

            // B. Setup Recorder
            const stream = canvas.captureStream(30); // 30 FPS
            // Try standard webm/vp9, fallback to default
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
                ? 'video/webm; codecs=vp9' 
                : 'video/webm';
            
            const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 }); // 5Mbps
            const chunks: BlobPart[] = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `manju_storyboard_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setIsExporting(false);
                setExportProgress(0);
            };

            recorder.start();

            // C. Draw & Record Loop
            const RECORD_DURATION = 3000; // 3 seconds per slide for export

            for (let i = 0; i < storyboard.length; i++) {
                const shot = storyboard[i];
                setExportProgress(Math.round(((i) / storyboard.length) * 100));

                // 1. Load Image
                const img = new Image();
                img.crossOrigin = "anonymous"; // CRITICAL for CORS
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn(`Export: Image load failed for shot ${i}`);
                        resolve(null);
                    };
                    img.src = shot.imageUrl || `https://placehold.co/${width}x${height}/222/FFF?text=Image+Load+Error`;
                });

                // 2. Draw Image (Object Cover)
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, width, height);

                if (img.naturalWidth > 0) {
                    const imgRatio = img.width / img.height;
                    const canvasRatio = width / height;
                    let drawW, drawH, offsetX, offsetY;

                    if (imgRatio > canvasRatio) {
                        drawH = height;
                        drawW = height * imgRatio;
                        offsetX = (width - drawW) / 2;
                        offsetY = 0;
                    } else {
                        drawW = width;
                        drawH = width / imgRatio;
                        offsetX = 0;
                        offsetY = (height - drawH) / 2;
                    }
                    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
                } else {
                    ctx.fillStyle = "#333";
                    ctx.fillRect(0,0,width,height);
                    ctx.fillStyle = "white";
                    ctx.font = "bold 60px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("Missing Image", width/2, height/2);
                }

                // 3. Draw Subtitles
                if (shot.dialogue) {
                    // Gradient Strap
                    const strapHeight = height * 0.25;
                    const grad = ctx.createLinearGradient(0, height - strapHeight, 0, height);
                    grad.addColorStop(0, "rgba(0,0,0,0)");
                    grad.addColorStop(0.3, "rgba(0,0,0,0.6)");
                    grad.addColorStop(1, "rgba(0,0,0,0.9)");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, height - strapHeight, width, strapHeight);

                    // Text Config
                    const fontSize = Math.floor(height * 0.04); 
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.fillStyle = "white";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top"; // Draw downwards
                    ctx.strokeStyle = "black";
                    ctx.lineWidth = 3;

                    const textX = width / 2;
                    const maxWidth = width * 0.85;
                    const lineHeight = fontSize * 1.35;
                    
                    // Count lines to determine start Y (so it aligns to bottom area)
                    const tempCtx = canvas.getContext('2d')!; // Clone ctx to measure
                    tempCtx.font = ctx.font;
                    const chars = shot.dialogue.split('');
                    let line = '';
                    let lineCount = 1;
                    for (let n = 0; n < chars.length; n++) {
                         const testLine = line + chars[n];
                         if (tempCtx.measureText(testLine).width > maxWidth && n > 0) {
                             line = chars[n];
                             lineCount++;
                         } else {
                             line = testLine;
                         }
                    }

                    const totalTextH = lineCount * lineHeight;
                    const startY = height - (height * 0.08) - totalTextH; // 8% padding from bottom

                    drawWrappedText(ctx, shot.dialogue, textX, startY, maxWidth, lineHeight);
                }

                // 4. Wait
                await new Promise(r => setTimeout(r, RECORD_DURATION));
            }

            recorder.stop();

        } catch (e) {
            console.error("Export Failed", e);
            setIsExporting(false);
            alert("视频导出失败，请检查浏览器是否支持 WebM 录制，或图片跨域设置。");
        }
    };

    const getAspectRatioClass = (ratio: AspectRatio) => {
        switch (ratio) {
            case AspectRatio.PORTRAIT: return 'aspect-[9/16] w-full max-w-md';
            case AspectRatio.LANDSCAPE: return 'aspect-[16/9] w-full max-w-5xl';
            case AspectRatio.SQUARE: return 'aspect-square w-full max-w-xl';
            case AspectRatio.CINEMATIC: return 'aspect-[21/9] w-full max-w-6xl';
            case AspectRatio.CLASSIC: return 'aspect-[4/3] w-full max-w-3xl';
            default: return 'aspect-video w-full max-w-4xl';
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-black text-neutral-200 font-sans overflow-hidden">
            {/* --- Top Header (Minimal) --- */}
            <div className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/80 backdrop-blur z-50">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        disabled={isExporting}
                        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-xs font-bold group disabled:opacity-50"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        返回分镜板
                    </button>
                    <div className="h-4 w-px bg-neutral-800"></div>
                    <span className="text-xs text-blue-500 font-mono uppercase tracking-wider font-bold flex items-center gap-2">
                        <Film className="w-3 h-3" /> Video Preview Mode
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Export Button */}
                    <button
                        onClick={handleExportVideo}
                        disabled={isExporting}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg
                            ${isExporting 
                                ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700' 
                                : 'bg-green-600 hover:bg-green-500 text-white border border-green-500/50 hover:shadow-green-500/20'}
                        `}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>合成中 {exportProgress}%</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-3 h-3" />
                                导出视频 (Download .webm)
                            </>
                        )}
                    </button>

                    <div className="text-xs font-mono text-neutral-500 border-l border-neutral-800 pl-4">
                        {currentIndex + 1} / {storyboard.length}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                
                {/* --- A. Left: Script Monitor --- */}
                <div className="w-1/4 min-w-[320px] bg-neutral-900/50 border-r border-neutral-800 flex flex-col z-20">
                    <div className="p-4 border-b border-neutral-800 flex items-center gap-2 text-neutral-500 bg-neutral-900">
                        <MonitorPlay className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Script Monitor</span>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        {/* Thumbnail Preview */}
                        <div className="aspect-video w-full bg-black rounded-lg border border-neutral-800 overflow-hidden relative opacity-80">
                            <img src={getDisplayImage(currentShot)} className="w-full h-full object-cover opacity-50" alt="monitor" />
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                                SHOT {currentIndex + 1}
                            </div>
                        </div>

                        {/* Dialogue Block */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                                <Clapperboard className="w-3 h-3" /> 对白 (Dialogue)
                            </label>
                            <div className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-lg text-white font-medium shadow-inner min-h-[80px]">
                                {currentShot.dialogue || <span className="text-neutral-600 italic">(无对白/空镜头)</span>}
                            </div>
                            <button 
                                onClick={handleVoicePreview}
                                disabled={isExporting}
                                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded border border-neutral-700 transition-colors text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Volume2 className="w-3 h-3" />
                                播放配音 (Preview Audio)
                            </button>
                        </div>

                        {/* Visual Description */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                                <Layers className="w-3 h-3" /> 画面描述 (Visual)
                            </label>
                            <p className="text-sm text-neutral-400 leading-relaxed font-light">
                                {currentShot.visualAction}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- B. Center: Main Player (Dynamic Ratio) --- */}
                <div className="flex-1 bg-black relative flex flex-col items-center justify-center p-8">
                    
                    {/* Responsive Container */}
                    <div className={`relative ${getAspectRatioClass(aspectRatio)} bg-neutral-900 rounded-2xl border-[4px] border-neutral-800 shadow-2xl overflow-hidden ring-1 ring-white/10 transition-all duration-500`}>
                        
                        {/* Render Active Image & Animation */}
                        <img 
                            key={currentIndex}
                            src={getDisplayImage(currentShot)}
                            alt="active shot"
                            className={`w-full h-full object-cover absolute inset-0 ${isPlaying && !isExporting ? 'animate-ken-burns' : ''}`}
                        />
                        
                        {/* Export Overlay */}
                        {isExporting && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                                <Loader2 className="w-12 h-12 animate-spin text-green-500 mb-4" />
                                <div className="text-white font-bold text-xl">正在合成视频...</div>
                                <div className="text-neutral-400 text-sm mt-2">处理中: {currentIndex + 1} / {storyboard.length}</div>
                            </div>
                        )}

                        {/* Subtitle Overlay */}
                        <div className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none">
                             <div className="bg-gradient-to-t from-black/90 via-black/40 to-transparent pb-12 px-8 pt-20">
                                {currentShot.dialogue && (
                                    <p className="text-white text-xl font-bold text-center leading-normal drop-shadow-md animate-fade-in-up">
                                        {currentShot.dialogue}
                                    </p>
                                )}
                             </div>
                        </div>

                    </div>

                    {/* Floating Controls */}
                    <div className={`absolute bottom-8 flex items-center gap-6 bg-neutral-900/90 backdrop-blur px-8 py-3 rounded-full border border-neutral-700 shadow-2xl z-30 transition-opacity ${isExporting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <button onClick={handlePrev} className="text-neutral-400 hover:text-white transition-colors"><SkipBack className="w-5 h-5" /></button>
                        <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/20">
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                        </button>
                        <button onClick={handleNext} className="text-neutral-400 hover:text-white transition-colors"><SkipForward className="w-5 h-5" /></button>
                    </div>

                </div>
            </div>

            {/* --- C. Bottom: Timeline Rail --- */}
            <div className="h-32 bg-neutral-900 border-t border-neutral-800 flex flex-col shrink-0 z-50">
                {/* Global Progress Bar */}
                <div className="h-1 bg-neutral-800 w-full relative">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                        style={{ width: `${((currentIndex) / storyboard.length) * 100}%` }}
                    />
                </div>

                {/* Thumbnails Rail */}
                <div className={`flex-1 flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide py-2 ${isExporting ? 'pointer-events-none opacity-50' : ''}`}>
                    {storyboard.map((shot, idx) => (
                        <div 
                            key={shot.id}
                            onClick={() => handleJump(idx)}
                            className={`
                                relative h-20 aspect-video rounded-md overflow-hidden cursor-pointer transition-all shrink-0
                                ${currentIndex === idx ? 'ring-2 ring-blue-500 scale-105 opacity-100' : 'opacity-40 hover:opacity-80 grayscale hover:grayscale-0'}
                            `}
                        >
                            <img src={getDisplayImage(shot)} className="w-full h-full object-cover" alt={`shot-${idx}`} />
                            
                            {/* Inner Progress for active shot */}
                            {currentIndex === idx && !isExporting && (
                                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 z-10" style={{ width: `${progress}%` }}></div>
                            )}

                            <div className="absolute top-1 left-1 px-1 rounded bg-black/60 text-[8px] text-white font-mono">
                                {idx + 1}
                            </div>
                        </div>
                    ))}
                    {/* Spacer */}
                    <div className="w-10 shrink-0"></div> 
                </div>
            </div>

            {/* Styles for animation */}
            <style>{`
                .animate-ken-burns {
                    animation: kenburns 5s ease-out forwards;
                }
                @keyframes kenburns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
            `}</style>
        </div>
    );
};