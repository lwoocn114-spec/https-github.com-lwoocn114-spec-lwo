export enum Genre {
  ROMANCE_CEO = '霸总甜宠 (CEO Romance)',
  REVENGE_FEMALE = '大女主复仇 (Revenge)',
  HISTORICAL_POLITICS = '古风权谋 (Historical)',
  FANTASY_XIANXIA = '玄幻修仙 (Fantasy/Xianxia)',
  THRILLER_HORROR = '悬疑惊悚 (Thriller/Horror)',
  CYBERPUNK = '赛博末世 (Cyberpunk/Sci-Fi)',
  SLICE_OF_LIFE = '治愈日常 (Slice of Life)'
}

export enum VisualStyle {
  JAPANESE_MANGA = '日漫风格 (黑白, 细腻墨线)',
  KOREAN_WEBTOON = '韩漫风格 (鲜艳色彩, 纵向条漫)',
  CHINESE_MANHUA = '国漫风格 (厚涂/水墨, 古风/现代)',
  AMERICAN_COMIC = '美漫风格 (粗线条, 动态阴影)',
  CINEMATIC_REALISM = '电影写实 (4K, 胶片颗粒, 照片级)',
  PIXAR_3D = '3D 动画 (柔和光照, 表情生动)'
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  CINEMATIC = '21:9',
  CLASSIC = '4:3'
}

export type QualityMode = 'speed' | 'balanced' | 'quality';

export type AIProvider = 'gemini' | 'openai';

export interface AISettings {
  provider: AIProvider;
  baseUrl: string;
  modelName: string;
}

export interface Character {
  id: string;
  name: string;
  description_zh: string; 
  prompt_en: string;      
  imageUrl?: string;
  isLoading?: boolean;
}

export interface Scene {
  id: string;
  name: string;
  description_zh: string; 
  prompt_en: string;      
  imageUrl?: string;
  isLoading?: boolean;
}

export interface Shot {
  id: string;
  sceneId?: string; 
  originalScriptSegment: string;
  dialogue?: string;
  visualAction: string;
  cameraAngle: string;
  img2vidPrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  isLoading: boolean;
  isError: boolean;
}

export interface ScriptAnalysis {
  shots: Shot[];
}

export type AppStep = 'IDLE' | 'PRE_PRODUCTION' | 'STORYBOARD' | 'VIDEO_PREVIEW';

export interface GenerationConfig {
  style: VisualStyle;
  aspectRatio: AspectRatio;
}