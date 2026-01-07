import React from 'react';
import { Clapperboard, ArrowLeft } from 'lucide-react';

interface SetupPhaseProps {
  onStart: (script: string, any: any, any2: any) => void;
  isLoading: boolean;
}

// Acting as the "Idle State" Welcome View
export const SetupPhase: React.FC<SetupPhaseProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-neutral-600 space-y-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <Clapperboard className="w-8 h-8 opacity-50" />
        </div>
        <div className="text-center">
            <h2 className="text-lg font-bold text-neutral-400">AI 导演已就绪</h2>
            <p className="text-sm max-w-xs mx-auto mt-2 opacity-70">
                <ArrowLeft className="inline w-4 h-4 mr-1" />
                请在左侧输入您的剧本或灵感，然后点击“开始分析剧本”以启动。
            </p>
        </div>
    </div>
  );
};