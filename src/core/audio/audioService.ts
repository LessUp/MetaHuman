import { useDigitalHumanStore } from '../../store/digitalHumanStore';
import { sendUserInput } from '../dialogue/dialogueService';

// TTS 配置接口
export interface TTSConfig {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

// 语音合成服务
export class TTSService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[];
  private config: TTSConfig;
  private isInitialized: boolean = false;
  
  constructor(config: TTSConfig = {}) {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.config = {
      lang: config.lang ?? 'zh-CN',
      rate: config.rate ?? 1.0,
      pitch: config.pitch ?? 1.0,
      volume: config.volume ?? 0.8,
    };
    this.loadVoices();
  }
  
  private loadVoices(): void {
    const loadVoiceList = () => {
      this.voices = this.synth.getVoices();
      this.isInitialized = this.voices.length > 0;
    };
    
    loadVoiceList();
    if (!this.isInitialized) {
      this.synth.onvoiceschanged = loadVoiceList;
    }
  }
  
  updateConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
  
  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
  
  isSpeaking(): boolean {
    return this.synth.speaking;
  }
  
  speak(text: string, config?: Partial<TTSConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }
      
      if (this.synth.speaking) {
        this.synth.cancel();
      }
      
      const mergedConfig = { ...this.config, ...config };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = mergedConfig.lang!;
      utterance.rate = mergedConfig.rate!;
      utterance.pitch = mergedConfig.pitch!;
      utterance.volume = mergedConfig.volume!;
      
      // 选择合适的语音
      const preferredVoice = this.voices.find(voice => 
        voice.lang.includes(mergedConfig.lang!.split('-')[0])
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.onstart = () => {
        useDigitalHumanStore.getState().setSpeaking(true);
        useDigitalHumanStore.getState().setBehavior('speaking');
      };
      
      utterance.onend = () => {
        useDigitalHumanStore.getState().setSpeaking(false);
        useDigitalHumanStore.getState().setBehavior('idle');
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('语音合成错误:', event);
        useDigitalHumanStore.getState().setSpeaking(false);
        useDigitalHumanStore.getState().setBehavior('idle');
        useDigitalHumanStore.getState().setError(`语音合成失败: ${event.error}`);
        reject(new Error(event.error));
      };
      
      this.synth.speak(utterance);
    });
  }

  getVoices() {
    return this.voices;
  }

  speakWithOptions(
    text: string,
    options: { lang?: string; rate?: number; pitch?: number; volume?: number; voiceName?: string } = {}
  ) {
    const {
      lang = 'zh-CN',
      rate = 1.0,
      pitch = 1.0,
      volume = 0.8,
      voiceName,
    } = options;

    if (this.synth.speaking) {
      this.synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    // 选择中文语音或指定语音
    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (voiceName) {
      selectedVoice = this.voices.find((voice) => voice.name === voiceName);
    }
    if (!selectedVoice) {
      selectedVoice = this.voices.find(voice => voice.lang.includes('zh'));
    }
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => {
      useDigitalHumanStore.getState().setSpeaking(true);
      useDigitalHumanStore.getState().setBehavior('speaking');
    };
    
    utterance.onend = () => {
      useDigitalHumanStore.getState().setSpeaking(false);
      useDigitalHumanStore.getState().setBehavior('idle');
    };
    
    utterance.onerror = (event) => {
      console.error('语音合成错误:', event);
      useDigitalHumanStore.getState().setSpeaking(false);
      useDigitalHumanStore.getState().setBehavior('idle');
      useDigitalHumanStore.getState().setError('语音合成失败');
    };
    
    this.synth.speak(utterance);
  }
  
  stop(): void {
    this.synth.cancel();
    useDigitalHumanStore.getState().setSpeaking(false);
    useDigitalHumanStore.getState().setBehavior('idle');
  }
  
  pause(): void {
    this.synth.pause();
  }
  
  resume(): void {
    this.synth.resume();
  }
}

// ASR 回调接口
export interface ASRCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// ASR 配置接口
export interface ASRConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

// 语音识别服务
export class ASRService {
  private recognition: any;
  private isSupported: boolean;
  private callbacks: ASRCallbacks = {};
  private config: ASRConfig;
  private sendToBackend: boolean = true;
  private tts: TTSService;
  private onResultCallback: ((text: string) => void) | null = null;
  private mode: 'command' | 'dictation' = 'command';
  
  constructor(config: ASRConfig = {}) {
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    this.config = {
      lang: config.lang ?? 'zh-CN',
      continuous: config.continuous ?? false,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 1,
    };
    this.tts = new TTSService();
    
    if (this.isSupported) {
      this.initRecognition();
    }
  }
  
  setCallbacks(callbacks: ASRCallbacks): void {
    this.callbacks = callbacks;
  }
  
  setSendToBackend(send: boolean): void {
    this.sendToBackend = send;
  }
  
  checkSupport(): boolean {
    return this.isSupported;
  }
  
  private initRecognition(): void {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.lang;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
    
    this.recognition.onstart = () => {
      useDigitalHumanStore.getState().setBehavior('listening');
      this.callbacks.onStart?.();
    };
    
    this.recognition.onresult = (event: any) => {
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
      
      // 通知临时结果
      if (interimTranscript) {
        this.callbacks.onTranscript?.(interimTranscript, false);
      }
      
      // 处理最终结果
      if (finalTranscript) {
        console.log('识别结果:', finalTranscript);
        this.callbacks.onTranscript?.(finalTranscript, true);
        if (this.onResultCallback) {
          this.onResultCallback(finalTranscript);
        }
        if (this.mode === 'command') {
          this.processVoiceInput(finalTranscript);
        }
      }
    };
    
    this.recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      const errorMsg = this.getErrorMessage(event.error);
      useDigitalHumanStore.getState().setRecording(false);
      useDigitalHumanStore.getState().setBehavior('idle');
      useDigitalHumanStore.getState().setError(errorMsg);
      this.callbacks.onError?.(errorMsg);
    };
    
    this.recognition.onend = () => {
      useDigitalHumanStore.getState().setRecording(false);
      useDigitalHumanStore.getState().setBehavior('idle');
      this.callbacks.onEnd?.();
    };
  }
  
  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': '未检测到语音，请重试',
      'audio-capture': '无法访问麦克风，请检查权限',
      'not-allowed': '麦克风权限被拒绝',
      'network': '网络错误，请检查连接',
      'aborted': '语音识别被中断',
      'language-not-supported': '不支持当前语言',
    };
    return errorMessages[error] || `语音识别失败: ${error}`;
  }
  
  start(options?: { onResult?: (text: string) => void; mode?: 'command' | 'dictation' }): boolean {
    if (!this.isSupported) {
      console.warn('浏览器不支持语音识别');
      useDigitalHumanStore.getState().setError('浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器');
      return false;
    }

    this.onResultCallback = options?.onResult ?? null;
    this.mode = options?.mode ?? 'command';
    
    try {
      this.recognition.start();
      useDigitalHumanStore.getState().setRecording(true);
      return true;
    } catch (error: any) {
      console.error('启动语音识别失败:', error);
      useDigitalHumanStore.getState().setRecording(false);
      
      // 处理已经在运行的情况
      if (error.message?.includes('already started')) {
        this.recognition.stop();
        setTimeout(() => this.start(), 100);
        return true;
      }
      
      useDigitalHumanStore.getState().setError('启动语音识别失败');
      return false;
    }
  }
  
  stop(): void {
    if (this.recognition && this.isSupported) {
      try {
        this.recognition.stop();
      } catch (e) {
        // 忽略停止错误
      }
    }
    this.onResultCallback = null;
    this.mode = 'command';
  }
  
  abort(): void {
    if (this.recognition && this.isSupported) {
      try {
        this.recognition.abort();
      } catch (e) {
        // 忽略中断错误
      }
    }
    useDigitalHumanStore.getState().setRecording(false);
    useDigitalHumanStore.getState().setBehavior('idle');
  }
  
  // 处理语音输入 - 整合本地命令和后端对话
  private async processVoiceInput(text: string): Promise<void> {
    const store = useDigitalHumanStore.getState();
    
    // 首先检查是否是本地命令
    const isLocalCommand = this.tryLocalCommand(text);
    
    // 如果不是本地命令且启用了后端发送，则发送到对话服务
    if (!isLocalCommand && this.sendToBackend) {
      await this.sendToDialogueService(text);
    }
  }
  
  // 尝试执行本地命令，返回是否匹配到命令
  private tryLocalCommand(command: string): boolean {
    const store = useDigitalHumanStore.getState();
    const lowerCommand = command.toLowerCase();
    
    // 系统控制命令
    if (lowerCommand.includes('播放') || lowerCommand.includes('开始')) {
      store.play();
      return true;
    }
    if (lowerCommand.includes('暂停') || lowerCommand.includes('停止')) {
      store.pause();
      return true;
    }
    if (lowerCommand.includes('重置') || lowerCommand.includes('复位')) {
      store.reset();
      return true;
    }
    if (lowerCommand.includes('静音')) {
      store.setMuted(true);
      return true;
    }
    if (lowerCommand.includes('取消静音')) {
      store.setMuted(false);
      return true;
    }
    
    // 快捷动作命令
    if (lowerCommand.includes('打招呼') || lowerCommand.includes('问好') || lowerCommand.includes('你好')) {
      this.performGreeting();
      return true;
    }
    if (lowerCommand.includes('跳舞')) {
      this.performDance();
      return true;
    }
    if (lowerCommand.includes('点头')) {
      this.performNod();
      return true;
    }
    if (lowerCommand.includes('摇头')) {
      this.performShakeHead();
      return true;
    }
    
    return false;
  }
  
  // 发送到对话服务
  private async sendToDialogueService(text: string): Promise<void> {
    const store = useDigitalHumanStore.getState();
    
    store.setLoading(true);
    store.setBehavior('thinking');
    store.addChatMessage('user', text);
    
    try {
      const response = await sendUserInput({
        userText: text,
        sessionId: store.sessionId,
      });
      
      store.addChatMessage('assistant', response.replyText);
      
      // 应用情感
      if (response.emotion) {
        const emotionMap: Record<string, any> = {
          'happy': { emotion: 'happy', expression: 'smile' },
          'surprised': { emotion: 'surprised', expression: 'surprise' },
          'sad': { emotion: 'sad', expression: 'sad' },
          'angry': { emotion: 'angry', expression: 'angry' },
          'neutral': { emotion: 'neutral', expression: 'neutral' },
        };
        const mapping = emotionMap[response.emotion] || emotionMap['neutral'];
        store.setEmotion(mapping.emotion);
        store.setExpression(mapping.expression);
      }
      
      // 执行动作
      if (response.action && response.action !== 'idle') {
        store.setAnimation(response.action);
        store.setBehavior(response.action as any);
      }
      
      // 语音播放回复
      if (response.replyText && !store.isMuted) {
        await this.tts.speak(response.replyText);
      }
      
      // 恢复状态
      setTimeout(() => {
        store.setBehavior('idle');
        store.setAnimation('idle');
      }, 3000);
      
    } catch (error: any) {
      console.error('对话服务错误:', error);
      store.setError('对话服务暂时不可用，请稍后重试');
      store.setBehavior('idle');
      
      // 本地降级回复
      const fallbackReply = '抱歉，我暂时无法处理您的请求，请稍后再试。';
      store.addChatMessage('assistant', fallbackReply);
      if (!store.isMuted) {
        await this.tts.speak(fallbackReply);
      }
    } finally {
      store.setLoading(false);
    }
  }
  
  // 预设动作：打招呼
  performGreeting(): void {
    const store = useDigitalHumanStore.getState();
    store.setEmotion('happy');
    store.setExpression('smile');
    store.setBehavior('greeting');
    store.setAnimation('wave');
    
    this.tts.speak('您好！很高兴见到您！有什么可以帮助您的吗？');
    
    setTimeout(() => {
      store.setEmotion('neutral');
      store.setExpression('neutral');
      store.setBehavior('idle');
      store.setAnimation('idle');
    }, 4000);
  }
  
  // 预设动作：跳舞
  performDance(): void {
    const store = useDigitalHumanStore.getState();
    store.setAnimation('dance');
    store.setBehavior('excited');
    store.setEmotion('happy');
    
    this.tts.speak('让我为您跳一支舞！');
    
    setTimeout(() => {
      store.setAnimation('idle');
      store.setBehavior('idle');
      store.setEmotion('neutral');
    }, 6000);
  }
  
  // 预设动作：点头
  performNod(): void {
    const store = useDigitalHumanStore.getState();
    store.setAnimation('nod');
    store.setBehavior('listening');
    
    this.tts.speak('好的，我明白了。');
    
    setTimeout(() => {
      store.setAnimation('idle');
      store.setBehavior('idle');
    }, 2000);
  }
  
  // 预设动作：摇头
  performShakeHead(): void {
    const store = useDigitalHumanStore.getState();
    store.setAnimation('shakeHead');
    
    this.tts.speak('不太确定呢。');
    
    setTimeout(() => {
      store.setAnimation('idle');
    }, 2000);
  }
  
  // 预设动作：思考
  performThinking(): void {
    const store = useDigitalHumanStore.getState();
    store.setBehavior('thinking');
    store.setAnimation('think');
    
    this.tts.speak('让我想想...');
    
    setTimeout(() => {
      store.setBehavior('idle');
      store.setAnimation('idle');
    }, 3000);
  }
}

// 初始化服务实例
export const ttsService = new TTSService();
export const asrService = new ASRService();
