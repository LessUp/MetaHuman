import { useDigitalHumanStore } from '../../store/digitalHumanStore';
import { sendUserInput } from '../dialogue/dialogueService';
import { handleDialogueResponse } from '../dialogue/dialogueOrchestrator';

// TTS 配置接口
export interface TTSConfig {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

// 语音队列项接口
interface SpeechQueueItem {
  text: string;
  config: TTSConfig;
  resolve: () => void;
  reject: (error: Error) => void;
}

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }>;
type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike>;

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultListLike;
  resultIndex?: number;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

// 语音合成服务 - 支持队列管理
export class TTSService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[];
  private config: TTSConfig;
  private isInitialized: boolean = false;
  private speechQueue: SpeechQueueItem[] = [];
  private isProcessingQueue: boolean = false;

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
    return this.synth.speaking || this.isProcessingQueue;
  }

  // 获取队列长度
  getQueueLength(): number {
    return this.speechQueue.length;
  }

  // 清空队列
  clearQueue(): void {
    // 拒绝所有待处理的语音
    this.speechQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.speechQueue = [];
    this.synth.cancel();
    this.isProcessingQueue = false;
    useDigitalHumanStore.getState().setSpeaking(false);
    useDigitalHumanStore.getState().setBehavior('idle');
  }

  // 语音合成 - 支持队列
  speak(text: string, config?: Partial<TTSConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }

      const mergedConfig = { ...this.config, ...config };

      // 添加到队列
      this.speechQueue.push({
        text,
        config: mergedConfig,
        resolve,
        reject,
      });

      // 如果没有在处理队列，开始处理
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  // 处理语音队列
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift()!;

      try {
        await this.speakImmediate(item.text, item.config);
        item.resolve();
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.isProcessingQueue = false;
  }

  // 立即播放语音（内部方法）
  private speakImmediate(text: string, config: TTSConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.lang!;
      utterance.rate = config.rate!;
      utterance.pitch = config.pitch!;
      utterance.volume = config.volume!;

      // 选择合适的语音
      const preferredVoice = this.voices.find(voice =>
        voice.lang.includes(config.lang!.split('-')[0])
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        useDigitalHumanStore.getState().setSpeaking(true);
        useDigitalHumanStore.getState().setBehavior('speaking');
      };

      utterance.onend = () => {
        // 只有队列为空时才重置状态
        if (this.speechQueue.length === 0) {
          useDigitalHumanStore.getState().setSpeaking(false);
          useDigitalHumanStore.getState().setBehavior('idle');
        }
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('语音合成错误:', event);
        useDigitalHumanStore.getState().setSpeaking(false);
        useDigitalHumanStore.getState().setBehavior('idle');
        useDigitalHumanStore.getState().addError(`语音合成失败: ${event.error}`);
        reject(new Error(event.error));
      };

      this.synth.speak(utterance);
    });
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

    // 使用队列方式
    return this.speak(text, { lang, rate, pitch, volume });
  }

  stop(): void {
    this.clearQueue();
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
  onTimeout?: () => void;
}

// ASR 配置接口
export interface ASRConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  timeout?: number;
}

// ASR 启动选项
export interface ASRStartOptions {
  onResult?: (text: string) => void;
  mode?: 'command' | 'dictation';
  timeout?: number;
}

// 语音识别服务 - 支持权限检查和超时
export class ASRService {
  private recognition: SpeechRecognitionLike | null = null;
  private isSupported: boolean;
  private callbacks: ASRCallbacks = {};
  private config: ASRConfig;
  private sendToBackend: boolean = true;
  private tts: TTSService;
  private onResultCallback: ((text: string) => void) | null = null;
  private mode: 'command' | 'dictation' = 'command';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning: boolean = false;

  constructor(config: ASRConfig = {}) {
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    this.config = {
      lang: config.lang ?? 'zh-CN',
      continuous: config.continuous ?? false,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 1,
      timeout: config.timeout ?? 30000,
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

  // 检查麦克风权限
  async checkPermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state;
    } catch {
      // 某些浏览器不支持权限查询，返回 prompt
      return 'prompt';
    }
  }

  // 请求麦克风权限
  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 立即停止流，只是为了请求权限
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('麦克风权限请求失败:', error);
      const errorMsg = this.getPermissionErrorMessage(error);
      useDigitalHumanStore.getState().addError(errorMsg);
      return false;
    }
  }

  private getPermissionErrorMessage(error: any): string {
    const errorName = error.name || '';
    const messages: Record<string, string> = {
      'NotAllowedError': '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风',
      'NotFoundError': '未检测到麦克风设备，请确保麦克风已连接',
      'NotReadableError': '麦克风被其他应用占用，请关闭其他使用麦克风的程序',
    };
    return messages[errorName] || `麦克风访问失败: ${error.message || errorName}`;
  }

  private initRecognition(): void {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = this.config.continuous!;
    this.recognition.interimResults = this.config.interimResults!;
    this.recognition.lang = this.config.lang!;
    this.recognition.maxAlternatives = this.config.maxAlternatives!;

    this.recognition.onstart = () => {
      this.isRunning = true;
      useDigitalHumanStore.getState().setBehavior('listening');
      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      // 收到结果时重置超时
      this.resetTimeout();

      let finalTranscript = '';
      let interimTranscript = '';

      const startIndex = event.resultIndex ?? 0;
      for (let i = startIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript ?? '';
        if ((event.results[i] as any)?.isFinal) {
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
        this.callbacks.onTranscript?.(finalTranscript, true);
        if (this.onResultCallback) {
          this.onResultCallback(finalTranscript);
        }
        if (this.mode === 'command') {
          this.processVoiceInput(finalTranscript);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.error('语音识别错误:', event.error);
      const errorMsg = this.getErrorMessage(event.error);
      this.cleanup();
      useDigitalHumanStore.getState().addError(errorMsg);
      this.callbacks.onError?.(errorMsg);
    };

    this.recognition.onend = () => {
      this.cleanup();
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

  // 设置超时
  private setupTimeout(timeout: number): void {
    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      console.warn('语音识别超时');
      this.callbacks.onTimeout?.();
      this.stop();
    }, timeout);
  }

  // 重置超时
  private resetTimeout(): void {
    if (this.timeoutId && this.config.timeout) {
      this.clearTimeout();
      this.setupTimeout(this.config.timeout);
    }
  }

  // 清除超时
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // 清理资源
  private cleanup(): void {
    this.clearTimeout();
    this.isRunning = false;
    useDigitalHumanStore.getState().setRecording(false);
    useDigitalHumanStore.getState().setBehavior('idle');
  }

  async start(options?: ASRStartOptions): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('浏览器不支持语音识别');
      useDigitalHumanStore.getState().addError('浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器');
      return false;
    }

    // 处理 double-start
    if (this.isRunning) {
      console.warn('语音识别已在运行，重用现有会话');
      this.onResultCallback = options?.onResult ?? null;
      this.mode = options?.mode ?? 'command';
      return true;
    }

    // 检查权限
    const permission = await this.checkPermission();
    if (permission === 'denied') {
      useDigitalHumanStore.getState().addError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      return false;
    }

    if (permission === 'prompt') {
      const granted = await this.requestPermission();
      if (!granted) {
        return false;
      }
    }

    this.onResultCallback = options?.onResult ?? null;
    this.mode = options?.mode ?? 'command';
    const timeout = options?.timeout ?? this.config.timeout!;

    try {
      this.recognition!.start();
      useDigitalHumanStore.getState().setRecording(true);

      // 设置超时
      this.setupTimeout(timeout);

      return true;
    } catch (error: any) {
      console.error('启动语音识别失败:', error);

      // 处理已经在运行的情况
      if (error.message?.includes('already started')) {
        this.isRunning = true;
        return true;
      }

      useDigitalHumanStore.getState().addError('启动语音识别失败');
      return false;
    }
  }

  stop(): void {
    this.clearTimeout();

    if (this.recognition && this.isSupported) {
      try {
        this.recognition.stop();
      } catch (e) {
        // 忽略停止错误
      }
    }

    this.onResultCallback = null;
    this.mode = 'command';
    this.isRunning = false;
    useDigitalHumanStore.getState().setRecording(false);
    useDigitalHumanStore.getState().setBehavior('idle');
  }

  abort(): void {
    this.clearTimeout();

    if (this.recognition && this.isSupported) {
      try {
        this.recognition.abort();
      } catch (e) {
        // 忽略中断错误
      }
    }

    this.cleanup();
  }

  // 处理语音输入 - 整合本地命令和后端对话
  private async processVoiceInput(text: string): Promise<void> {
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

      await handleDialogueResponse(response, {
        isMuted: store.isMuted,
        speakWith: (textToSpeak) => this.tts.speak(textToSpeak),
      });

    } catch (error: any) {
      console.error('对话服务错误:', error);
      store.addError('对话服务暂时不可用，请稍后重试');
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
