
import React, { useState, useEffect, useRef } from 'react';
import { Character, Scene, VisualStyle, AspectRatio, AISettings } from '../types';
import { Users, User, Check, RotateCcw, Loader2, Map as MapIcon, Maximize2, AlertTriangle, ArrowDown } from 'lucide-react';
import { generateCharacterImage, generateSceneImage, optimizePrompt } from '../services/geminiService';

interface PreProductionPhaseProps {
  characters: Character[];
  scenes: Scene[];
  style: VisualStyle;
  onConfirm: (updatedCharacters: Character[], updatedScenes: Scene[]) => void;
  isLoading: boolean;
  onPreviewImage: (url: string) => void;
  projectSeed: number; 
  apiKey: string;
  baseUrl?: string;
  aspectRatio: AspectRatio;
  settings: AISettings;
}

const ImageWithLoader: React.FC<{ src: string; alt: string; isLoading?: boolean }> = ({ src, alt, isLoading }) => {
    const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

    useEffect(() => {
        setImageState('loading');
    }, [src]);

    const handleLoad = () => setImageState('loaded');
    const handleError = () => setImageState('error');

    const displaySrc = imageState === 'error' 
        ? 'https://placehold.co/600x600/1a1a1a/666666?text=Generation+Failed' 
        : src;

    const showLoader = (imageState === 'loading' || isLoading) && imageState !== 'error';

    return (
        <div className="relative w-full h-full bg-neutral-900">
            {showLoader && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10 transition-all duration-300">
                    <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-600 relative z-20" />
                </div>
            )}
            
            {imageState === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                     <AlertTriangle className="w-8 h-8 text-neutral-600 opacity-50" />
                </div>
            )}

            <img 
                src={displaySrc} 
                alt={alt} 
                className={`w-full h-full object-cover transition-opacity duration-500 ${showLoader ? 'opacity-0' : 'opacity-100'}`}
                onLoad={handleLoad}
                onError={handleError}
            />
        </div>
    );
};

export const CharacterPhase: React.FC<PreProductionPhaseProps> = ({ 
  characters: initialCharacters, 
  scenes: initialScenes,
  style,
  onConfirm, 
  isLoading,
  onPreviewImage,
  projectSeed,
  apiKey,
  baseUrl,
  aspectRatio,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'CHARACTERS' | 'SCENES'>('CHARACTERS');
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const mountedRef = useRef(false);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);

  const getMockImage = (id: string, type: 'char' | 'scene') => {
      const seed = id; 
      const width = type === 'char' ? 400 : 800;
      const height = type === 'char' ? 400 : 450;
      return `https://picsum.photos/seed/${seed}/${width}/${height}?grayscale&blur=2`;
  };

  useEffect(() => {
    if (!mountedRef.current) {
        mountedRef.current = true;
        characters.forEach(char => {
            if (!char.imageUrl) handleGenerateCharImage(char.id, char.description_zh, projectSeed); 
        });
        scenes.forEach(scene => {
            if (!scene.imageUrl) handleGenerateSceneImage(scene.id, scene.description_zh, projectSeed);
        });
    }
  }, []);

  const handleGenerateCharImage = async (id: string, desc: string, seed: number, refImage?: string) => {
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, isLoading: true, imageUrl: undefined } : c));
      try {
          const char = characters.find(c => c.id === id);
          if (char) {
            const imageUrl = await generateCharacterImage(char, style, seed, refImage);
            setCharacters(prev => prev.map(c => c.id === id ? { ...c, isLoading: false, imageUrl } : c));
          }
      } catch (e) {
          setCharacters(prev => prev.map(c => c.id === id ? { ...c, isLoading: false } : c));
      }
  };

  const handleGenerateSceneImage = async (id: string, desc: string, seed: number, refImage?: string) => {
      setScenes(prev => prev.map(s => s.id === id ? { ...s, isLoading: true, imageUrl: undefined } : s));
      try {
          const scene = scenes.find(s => s.id === id);
          if (scene) {
            const imageUrl = await generateSceneImage(scene, style, seed, refImage);
            setScenes(prev => prev.map(s => s.id === id ? { ...s, isLoading: false, imageUrl } : s));
          }
      } catch (e) {
          setScenes(prev => prev.map(s => s.id === id ? { ...s, isLoading: false } : s));
      }
  };

  const handleOptimizeChar = async (id: string, text: string) => {
      if (!apiKey) return; 
      setOptimizingId(id);
      try {
          // Fixed: optimizePrompt expects settings as the second argument
          const optimized = await optimizePrompt(text, settings);
          setCharacters(prev => prev.map(c => c.id === id ? { ...c, prompt_en: optimized } : c));
      } catch (e) {
          console.error(e);
      } finally {
          setOptimizingId(null);
      }
  };

  const handleOptimizeScene = async (id: string, text: string) => {
      if (!apiKey) return; 
      setOptimizingId(id);
      try {
          // Fixed: optimizePrompt expects settings as the second argument
          const optimized = await optimizePrompt(text, settings);
          setScenes(prev => prev.map(s => s.id === id ? { ...s, prompt_en: optimized } : s));
      } catch (e) {
          console.error(e);
      } finally {
          setOptimizingId(null);
      }
  };

  const handleManualRegenerateChar = (id: string, desc: string) => {
      const char = characters.find(c => c.id === id);
      let refImage = char?.imageUrl;
      if (refImage && refImage.includes("placehold")) refImage = undefined;
      const newSeed = Math.floor(Math.random() * 1000000000);
      handleGenerateCharImage(id, desc, newSeed, refImage);
  };

  const handleManualRegenerateScene = (id: string, desc: string) => {
      const scene = scenes.find(s => s.id === id);
      let refImage = scene?.imageUrl;
      if (refImage && refImage.includes("placehold")) refImage = undefined;
      const newSeed = Math.floor(Math.random() * 1000000000);
      handleGenerateSceneImage(id, desc, newSeed, refImage);
  };

  const getAspectRatioClass = () => {
    return aspectRatio === AspectRatio.PORTRAIT ? 'aspect-[9/16]' : 'aspect-video';
  };

  return (
    <div className="flex flex-col h-full w-full p-8 animate-fade-in bg-neutral-950">
      
      {/* Tabs */}
      <div className="flex justify-center mb-8">
          <div className="bg-neutral-900 p-1 rounded-lg flex gap-1 border border-neutral-800">
              <button 
                onClick={() => setActiveTab('CHARACTERS')}
                className={`px-6 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'CHARACTERS' ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700' : 'text-neutral-500 hover:text-white'
                }`}
              >
                  <Users className="w-4 h-4" /> 角色定妆 ({characters.length})
              </button>
              <button 
                onClick={() => setActiveTab('SCENES')}
                className={`px-6 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'SCENES' ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700' : 'text-neutral-500 hover:text-white'
                }`}
              >
                  <MapIcon className="w-4 h-4" /> 场景设计 ({scenes.length})
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-2">
        {activeTab === 'CHARACTERS' && (
            <div className="flex flex-col gap-4">
            {characters.map((char) => {
                const displayImage = char.imageUrl || getMockImage(char.id, 'char');
                return (
                <div key={char.id} className="flex flex-row gap-4 bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 mb-6 shadow-lg items-start">
                    
                    {/* 左侧图片区 */}
                    <div className="w-1/3 flex-shrink-0 flex flex-col gap-2">
                         <div className={`w-full relative rounded-lg overflow-hidden border border-gray-700 shadow-md ${getAspectRatioClass()}`}>
                            <ImageWithLoader src={displayImage} alt={char.name} isLoading={char.isLoading} />
                             <div className="absolute top-2 right-2 p-1.5 rounded bg-black/60 text-white hover:bg-black/80 backdrop-blur cursor-pointer" onClick={() => onPreviewImage(displayImage)}>
                                <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleManualRegenerateChar(char.id, char.description_zh); }}
                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded border border-gray-700 flex items-center justify-center gap-2 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> 刷新图片
                        </button>
                    </div>

                    {/* 右侧输入区 */}
                    <div className="flex-1 flex-col gap-3">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                {char.name}
                            </h3>
                             <span className="text-[10px] text-gray-500 font-mono border border-gray-700 px-2 py-0.5 rounded bg-black/20">
                                Visual Anchor
                            </span>
                        </div>

                        {/* 中文描述 */}
                        <div>
                             <div className="flex justify-between mb-1">
                                <label className="text-xs text-gray-400">中文描述</label>
                                <button
                                    onClick={() => handleOptimizeChar(char.id, char.description_zh)}
                                    disabled={optimizingId === char.id}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    {optimizingId === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDown className="w-3 h-3" />}
                                    翻译并同步
                                </button>
                            </div>
                            <textarea 
                                value={char.description_zh} 
                                onChange={(e) => setCharacters(prev => prev.map(c => c.id === char.id ? {...c, description_zh: e.target.value} : c))} 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm h-24 resize-none focus:outline-none focus:border-blue-500 text-gray-300"
                                placeholder="角色中文描述..."
                            />
                        </div>

                        {/* 英文提示词 */}
                        <div>
                             <label className="text-xs text-gray-400 mb-1 block">英文提示词 (AI Prompt)</label>
                             <textarea 
                                value={char.prompt_en}
                                onChange={(e) => setCharacters(prev => prev.map(c => c.id === char.id ? {...c, prompt_en: e.target.value} : c))}
                                className="w-full bg-black/40 border border-gray-800 rounded p-2 text-xs text-gray-400 font-mono h-32 resize-none focus:border-blue-500/50 outline-none"
                                placeholder="Flux Prompt..."
                             />
                        </div>
                    </div>
                </div>
            )})}
            </div>
        )}

        {activeTab === 'SCENES' && (
            <div className="flex flex-col gap-4">
            {scenes.map((scene) => {
                const displayImage = scene.imageUrl || getMockImage(scene.id, 'scene');
                return (
                <div key={scene.id} className="flex flex-row gap-4 bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 mb-6 shadow-lg items-start">
                     
                     {/* 左侧图片区 */}
                     <div className="w-1/3 flex-shrink-0 flex flex-col gap-2">
                        <div className={`w-full relative rounded-lg overflow-hidden border border-gray-700 shadow-md ${getAspectRatioClass()}`}>
                             <ImageWithLoader src={displayImage} alt={scene.name} isLoading={scene.isLoading} />
                             <div className="absolute top-2 right-2 p-1.5 rounded bg-black/60 text-white hover:bg-black/80 backdrop-blur cursor-pointer" onClick={() => onPreviewImage(displayImage)}>
                                <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleManualRegenerateScene(scene.id, scene.description_zh); }}
                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded border border-gray-700 flex items-center justify-center gap-2 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> 刷新图片
                        </button>
                    </div>

                    {/* 右侧输入区 */}
                    <div className="flex-1 flex flex-col gap-3">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                 <MapIcon className="w-4 h-4 text-green-500" />
                                {scene.name}
                            </h3>
                             <span className="text-[10px] text-gray-500 font-mono border border-gray-700 px-2 py-0.5 rounded bg-black/20">
                                Environment
                            </span>
                        </div>
                        
                        {/* 中文描述 */}
                        <div>
                             <div className="flex justify-between mb-1">
                                <label className="text-xs text-gray-400">中文描述</label>
                                <button
                                    onClick={() => handleOptimizeScene(scene.id, scene.description_zh)}
                                    disabled={optimizingId === scene.id}
                                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                                >
                                    {optimizingId === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDown className="w-3 h-3" />}
                                    翻译并同步
                                </button>
                            </div>
                            <textarea 
                                value={scene.description_zh} 
                                onChange={(e) => setScenes(prev => prev.map(s => s.id === scene.id ? {...s, description_zh: e.target.value} : s))} 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm h-24 resize-none focus:outline-none focus:border-green-500 text-gray-300"
                                placeholder="场景中文描述..."
                            />
                        </div>

                        {/* 英文提示词 */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">英文提示词 (AI Prompt)</label>
                            <textarea 
                                value={scene.prompt_en}
                                onChange={(e) => setScenes(prev => prev.map(s => s.id === scene.id ? {...s, prompt_en: e.target.value} : s))}
                                className="w-full bg-black/40 border border-gray-800 rounded p-2 text-xs text-gray-400 font-mono h-32 resize-none focus:border-green-500/50 outline-none"
                                placeholder="Edit Scene Prompt..."
                            />
                        </div>
                    </div>
                </div>
            )})}
            </div>
        )}
      </div>

      <div className="pt-4 border-t border-neutral-800">
        <button
          onClick={() => onConfirm(characters, scenes)}
          disabled={isLoading}
          className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-3 transition-all ${
            isLoading
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
          }`}
        >
           {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
           确认设定并生成分镜
        </button>
      </div>
    </div>
  );
};
