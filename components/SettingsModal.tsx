
import React, { useEffect, useState } from 'react';
import { X, Settings, Key, Info, ExternalLink, ShieldCheck, Zap, Globe, Cpu, Eye, EyeOff } from 'lucide-react';
import { AISettings, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('manju_api_key') || '');
  const [settings, setSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('manju_ai_settings');
    if (saved) return JSON.parse(saved);
    return {
      provider: 'gemini',
      baseUrl: '',
      modelName: 'gemini-3-flash-preview'
    };
  });

  const saveSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('manju_ai_settings', JSON.stringify(newSettings));
  };

  const handleSaveAll = () => {
    localStorage.setItem('manju_api_key', apiKey);
    // Ensure the process.env syncs if needed, though the app reads from localStorage or state usually
    onClose();
    // Refresh page to ensure all services pick up the new key if they don't use reactive state
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-white tracking-tight">系统设置 / Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* API Key Section */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Key size={14} /> API 密钥 (API Key)
            </label>
            <div className="relative">
              <input 
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 pr-12 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                placeholder="在此输入您的 API Key..."
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              密钥将安全地保存在您的浏览器本地。
            </p>
          </div>

          <div className="h-px bg-neutral-800 w-full" />

          {/* AI Provider Section */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={14} /> 模型服务商 (AI Provider)
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => saveSettings({ ...settings, provider: 'gemini', modelName: 'gemini-3-flash-preview' })}
                className={`p-3 rounded-xl border text-sm font-bold transition-all ${settings.provider === 'gemini' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-neutral-800/50 border-neutral-700 text-neutral-500 hover:border-neutral-600'}`}
              >
                Google Gemini
              </button>
              <button
                onClick={() => saveSettings({ ...settings, provider: 'openai', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o' })}
                className={`p-3 rounded-xl border text-sm font-bold transition-all ${settings.provider === 'openai' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-neutral-800/50 border-neutral-700 text-neutral-500 hover:border-neutral-600'}`}
              >
                OpenAI (Compatible)
              </button>
            </div>
          </div>

          {/* Model Configuration */}
          <div className="space-y-4">
             {settings.provider === 'openai' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                    <Globe size={12} /> 接口地址 (Base URL)
                  </label>
                  <input 
                    type="text"
                    value={settings.baseUrl}
                    onChange={(e) => saveSettings({ ...settings, baseUrl: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
             )}

             <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                  <Cpu size={12} /> 模型名称 (Model Name)
                </label>
                <input 
                  type="text"
                  value={settings.modelName}
                  onChange={(e) => saveSettings({ ...settings, modelName: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={settings.provider === 'gemini' ? 'gemini-3-flash-preview' : 'gpt-4o'}
                />
             </div>
          </div>

          <div className="p-4 bg-blue-900/10 rounded-xl border border-blue-500/20 space-y-2">
             <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Info size={14} /> 提示
             </div>
             <p className="text-[11px] text-neutral-400 leading-relaxed">
               如果使用 Google Gemini，请确保您的 API Key 具有访问选定模型的权限。
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950/50 border-t border-neutral-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-neutral-500 hover:text-white text-sm font-bold transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSaveAll}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            保存并刷新
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
