import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Play } from 'lucide-react';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { ttsService } from '../core/audio/audioService';

interface VoiceInteractionPanelProps {
  onTranscript: (text: string) => void;
  onSpeak: (text: string) => void;
}

export default function VoiceInteractionPanel({ onTranscript, onSpeak }: VoiceInteractionPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // 初始化语音识别和合成
  useEffect(() => {
    // 检查浏览器支持
    const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    
    setIsSupported(hasSpeechRecognition && hasSpeechSynthesis);
    
    if (hasSpeechSynthesis) {
      synthRef.current = window.speechSynthesis;
      loadVoices();
    }
    
    if (hasSpeechRecognition) {
      initSpeechRecognition();
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // 加载语音
  const loadVoices = () => {
    if (!synthRef.current) return;
    
    const voices = synthRef.current.getVoices();
    setAvailableVoices(voices);
    
    // 优先选择中文语音
    const chineseVoice = voices.find(v => v.lang.includes('zh'));
    if (chineseVoice) {
      setVoice(chineseVoice);
    } else if (voices.length > 0) {
      setVoice(voices[0]);
    }
  };

  // 初始化语音识别
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'zh-CN';
    
    recognitionRef.current.onstart = () => {
      setTranscript('');
    };
    
    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(finalTranscript);
        onTranscript(finalTranscript);
      }
    };
    
    recognitionRef.current.onerror = (event: any) => {
      setIsRecording(false);
      useDigitalHumanStore.getState().setError(`语音识别错误: ${event.error}`);
    };
    
    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };
  };

  // 开始/停止录音
  const toggleRecording = () => {
    if (!recognitionRef.current || !isSupported) return;
    
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // 语音合成
  const speakText = (text: string) => {
    if (!synthRef.current || !voice || isMuted) return;
    
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.volume = volume;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.lang = 'zh-CN';
    
    utterance.onstart = () => {
      useDigitalHumanStore.getState().setSpeaking(true);
    };
    
    utterance.onend = () => {
      useDigitalHumanStore.getState().setSpeaking(false);
    };
    
    utterance.onerror = () => {
      useDigitalHumanStore.getState().setSpeaking(false);
    };
    
    synthRef.current.speak(utterance);
  };

  // 测试语音
  const testVoice = () => {
    speakText('您好！这是数字人语音交互系统的测试。');
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-yellow-800">
          <VolumeX size={20} />
          <span className="font-medium">浏览器不支持语音功能</span>
        </div>
        <p className="text-sm text-yellow-700 mt-2">
          请使用支持 Web Speech API 的现代浏览器，如 Chrome、Edge 或 Safari。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">语音交互</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className="text-sm text-gray-600">{isRecording ? '录音中' : '待机'}</span>
        </div>
      </div>

      {/* 语音识别控制 */}
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleRecording}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isRecording ? '停止录音' : '开始录音'}</span>
          </button>
          
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isMuted 
                ? 'bg-gray-300 hover:bg-gray-400 text-gray-700' 
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isMuted ? '取消静音' : '静音'}</span>
          </button>
        </div>

        {/* 识别结果 */}
        {transcript && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">识别结果:</div>
            <div className="text-gray-800">{transcript}</div>
          </div>
        )}
      </div>

      {/* 语音合成控制 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium text-gray-700">语音合成设置</h4>
          <button
            onClick={testVoice}
            className="flex items-center space-x-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
          >
            <Play size={14} />
            <span>测试</span>
          </button>
        </div>

        {/* 语音选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">语音选择</label>
          <select
            value={voice?.name || ''}
            onChange={(e) => {
              const selectedVoice = availableVoices.find(v => v.name === e.target.value);
              setVoice(selectedVoice || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableVoices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* 音量控制 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            音量: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 音调控制 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            音调: {pitch.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 语速控制 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            语速: {rate.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* 快速测试文本 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-600">快速测试文本</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            '您好！我是数字人助手。',
            '今天天气真不错！',
            '有什么可以帮助您的吗？',
            '感谢您的使用！'
          ].map((text, index) => (
            <button
              key={index}
              onClick={() => speakText(text)}
              className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-sm transition-colors text-left"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}