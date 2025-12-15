import React, { useState, useEffect, useRef } from 'react';
import DigitalHumanViewer from '../components/DigitalHumanViewer';
import ControlPanel from '../components/ControlPanel';
import VoiceInteractionPanel from '../components/VoiceInteractionPanel';
import VisionMirrorPanel from '../components/VisionMirrorPanel';
import ExpressionControlPanel from '../components/ExpressionControlPanel';
import BehaviorControlPanel from '../components/BehaviorControlPanel';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { ttsService, asrService } from '../core/audio/audioService';
import { digitalHumanEngine } from '../core/avatar/DigitalHumanEngine';
import { sendUserInput } from '../core/dialogue/dialogueService';
import { Toaster, toast } from 'sonner';
import { Mic, MessageSquare, Settings, Activity, X, Radio } from 'lucide-react';

export default function AdvancedDigitalHumanPage() {
  const {
    isPlaying,
    isRecording,
    isMuted,
    autoRotate,
    currentExpression,
    currentBehavior,
    isSpeaking,
    setRecording,
    toggleMute,
    toggleAutoRotate
  } = useDigitalHumanStore();

  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: number; role: 'user' | 'assistant'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // --- Event Handlers (Preserved from original) ---
  const handleModelLoad = (_model: unknown) => {
    toast.success('Digital Interface Online');
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      digitalHumanEngine.pause();
      toast.info('Paused');
    } else {
      digitalHumanEngine.play();
      toast.success('Resumed');
    }
  };

  const handleReset = () => {
    digitalHumanEngine.reset();
    toast.info('System Reset');
  };

  const handleChatSend = async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;

    const userMessage = { id: Date.now(), role: 'user' as const, text: content };
    setChatMessages((prev) => [...prev, userMessage]);
    if (!text) setChatInput('');

    setIsChatLoading(true);
    try {
      const res = await sendUserInput({ userText: content, sessionId: 'demo-session' });
      console.debug('LLM response', { emotion: res.emotion, action: res.action });
      const assistantMessage = { id: Date.now() + 1, role: 'assistant' as const, text: res.replyText };
      setChatMessages((prev) => [...prev, assistantMessage]);

      if (res.emotion) {
        digitalHumanEngine.setEmotion(res.emotion);
        if (res.emotion === 'happy') digitalHumanEngine.setExpression('smile');
        else if (res.emotion === 'surprised') digitalHumanEngine.setExpression('surprise');
        else digitalHumanEngine.setExpression('neutral');
      }

      if (res.action && res.action !== 'idle') digitalHumanEngine.playAnimation(res.action);
      if (res.replyText) ttsService.speak(res.replyText);

    } catch (error) {
      console.error(error);
      toast.error('Connection Error');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleToggleRecording = () => {
    console.debug('Toggle recording', { from: isRecording });
    if (isRecording) {
      asrService.stop();
      setRecording(false);
      toast.info('Recording Stopped');
    } else {
      asrService.start();
      toast.success('Listening...');
    }
  };

  const handleExpressionChange = (expression: string, intensity: number) => {
    digitalHumanEngine.setExpression(expression);
    digitalHumanEngine.setExpressionIntensity(intensity);
  };

  const handleBehaviorChange = (behavior: string, params: Record<string, unknown>) => {
    digitalHumanEngine.setBehavior(behavior, params);
  };

  // --- UI Components ---

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white selection:bg-blue-500/30">
      <Toaster position="top-center" theme="dark" />

      {/* Background 3D Viewer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black/0 to-black/0 z-0 pointer-events-none" />
        <DigitalHumanViewer 
          autoRotate={autoRotate} 
          showControls={false} 
          onModelLoad={handleModelLoad}
        />
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-2xl font-light tracking-widest uppercase text-blue-100/80 flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            MetaHuman <span className="text-xs bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 border border-blue-500/30">CORE 1.0</span>
          </h1>
          <div className="mt-2 flex space-x-4 text-xs text-gray-400 font-mono">
            <span>SYS: <span className="text-green-400">ONLINE</span></span>
            <span>CPU: <span className="text-blue-400">34%</span></span>
            <span>MEM: <span className="text-purple-400">1.2GB</span></span>
          </div>
        </div>

        <div className="pointer-events-auto flex space-x-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all active:scale-95"
          >
            <Settings className="w-5 h-5 text-white/80" />
          </button>
        </div>
      </div>

      {/* Right Settings Drawer */}
      <div 
        className={`absolute top-0 right-0 h-full w-80 sm:w-96 bg-black/80 backdrop-blur-xl border-l border-white/10 z-30 transform transition-transform duration-500 ease-out ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-medium text-white/90 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Control Systems
            </h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-white/5 p-1 rounded-lg mb-6 overflow-x-auto">
            {['basic', 'expression', 'behavior', 'vision', 'voice'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all capitalize ${
                  activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                   <ControlPanel
                    isPlaying={isPlaying}
                    isRecording={isRecording}
                    isMuted={isMuted}
                    autoRotate={autoRotate}
                    onPlayPause={handlePlayPause}
                    onReset={handleReset}
                    onToggleRecording={handleToggleRecording}
                    onToggleMute={toggleMute}
                    onToggleAutoRotate={toggleAutoRotate}
                    onVoiceCommand={(cmd) => console.log(cmd)}
                  />
                </div>
              </div>
            )}
            {activeTab === 'expression' && (
              <ExpressionControlPanel
                currentExpression={currentExpression}
                onExpressionChange={handleExpressionChange}
              />
            )}
            {activeTab === 'behavior' && (
              <BehaviorControlPanel
                currentBehavior={currentBehavior}
                onBehaviorChange={handleBehaviorChange}
              />
            )}
            {activeTab === 'vision' && (
               <div className="text-sm text-gray-400 p-4 border border-white/10 rounded-xl bg-white/5">
                  Vision Mirror Module requires camera access.
                  <VisionMirrorPanel 
                    onEmotionChange={(emotion) => {
                      if (emotion === 'happy') {
                        digitalHumanEngine.setExpression('smile');
                      } else if (emotion === 'surprised') {
                        digitalHumanEngine.setExpression('surprise');
                      } else {
                        digitalHumanEngine.setExpression('neutral');
                      }
                      digitalHumanEngine.setEmotion(emotion);
                    }} 
                    onHeadMotion={(motion) => {
                      digitalHumanEngine.playAnimation(motion);
                      toast(`Motion Detected: ${motion}`, { icon: '📸' });
                    }} 
                  />
               </div>
            )}
            {activeTab === 'voice' && (
              <div className="space-y-4">
                <VoiceInteractionPanel
                  onTranscript={(text) => handleChatSend(text)}
                  onSpeak={(text) => {
                    console.log('VoiceInteractionPanel TTS test:', text);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Floating Chat Dock */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
        {/* Chat Bubbles Overlay (Above Dock) */}
        <div className="mb-6 w-full max-h-[40vh] overflow-y-auto space-y-3 pr-4 mask-gradient-bottom custom-scrollbar">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
            >
              <div
                className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm backdrop-blur-md border shadow-xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600/80 border-blue-500/50 text-white rounded-br-none'
                    : 'bg-white/10 border-white/10 text-gray-100 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 pl-4 flex items-center gap-3 shadow-2xl shadow-blue-900/20 ring-1 ring-white/5">
          <div className="p-2 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg">
            <Radio className={`w-5 h-5 text-white ${isSpeaking ? 'animate-pulse' : ''}`} />
          </div>
          
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && !isRecording && handleChatSend()}
            placeholder={
              isRecording
                ? 'Listening... press mic again to stop'
                : isChatLoading
                  ? 'Thinking...'
                  : 'Type a message to interact...'
            }
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 text-sm h-10"
          />

          <div className="flex items-center gap-2 pr-1">
            <button
              onClick={handleToggleRecording}
              disabled={isChatLoading}
              className={`p-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                  : 'hover:bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => handleChatSend()}
              disabled={isChatLoading || !chatInput.trim()}
              className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
            >
              {isChatLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .mask-gradient-bottom { -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%); }
      `}</style>
    </div>
  );
}
