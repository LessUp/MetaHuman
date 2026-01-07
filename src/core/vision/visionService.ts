import { mapFaceToEmotion, UserEmotion } from './visionMapper';
import { useDigitalHumanStore } from '../../store/digitalHumanStore';

type EmotionCallback = (emotion: UserEmotion) => void;
type MotionCallback = (motion: 'nod' | 'shakeHead' | 'raiseHand' | 'waveHand') => void;
type ErrorCallback = (error: string) => void;
type StatusCallback = (status: VisionStatus) => void;

export type VisionStatus = 'idle' | 'initializing' | 'running' | 'error' | 'no_camera';

export interface VisionServiceCallbacks {
  onEmotion?: EmotionCallback;
  onMotion?: MotionCallback;
  onError?: ErrorCallback;
  onStatusChange?: StatusCallback;
}

// 视觉服务配置
export interface VisionServiceConfig {
  maxRetries: number;
  retryDelay: number;
  emotionDebounceMs: number;
  motionCooldownMs: number;
  targetFps: number;
}

type Landmark = { x: number; y: number; z: number };
type FaceMeshResultsLike = { multiFaceLandmarks?: Landmark[][] };

type PoseLandmark = { x: number; y: number };
type PoseResultsLike = { poseLandmarks?: PoseLandmark[] };

type MediaPipeModelLike = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: unknown) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
};

type FaceMeshModuleLike = {
  FaceMesh: new (options: { locateFile: (file: string) => string }) => MediaPipeModelLike;
};

type PoseModuleLike = {
  Pose: new (options: { locateFile: (file: string) => string }) => MediaPipeModelLike;
};

const DEFAULT_CONFIG: VisionServiceConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  emotionDebounceMs: 500,
  motionCooldownMs: 800,
  targetFps: 30,
};

class VisionService {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private status: VisionStatus = 'idle';
  private faceMesh: MediaPipeModelLike | null = null;
  private pose: MediaPipeModelLike | null = null;
  private callbacks: VisionServiceCallbacks = {};
  private config: VisionServiceConfig = { ...DEFAULT_CONFIG };
  private yawHistory: number[] = [];
  private pitchHistory: number[] = [];
  private leftWristXHistory: number[] = [];
  private rightWristXHistory: number[] = [];
  private lastUpperBodyMotionTime = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 0;
  private lastEmotionTime = 0;
  private lastEmotion: UserEmotion | null = null;
  private emotionStableCount = 0;
  private lastMotionTime = 0;
  private lastMotion: string | null = null;
  private retryCount = 0;

  getStatus(): VisionStatus {
    return this.status;
  }

  getFps(): number {
    return this.fps;
  }

  isRunning(): boolean {
    return this.running;
  }

  updateConfig(config: Partial<VisionServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private setStatus(status: VisionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private handleError(message: string, error?: unknown): void {
    console.error(message, error);
    this.setStatus('error');
    this.callbacks.onError?.(message);
    useDigitalHumanStore.getState().addError(message);
  }

  async checkCameraPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted' || result.state === 'prompt';
    } catch {
      return true;
    }
  }

  private async loadModelsWithRetry(): Promise<{ faceMesh: MediaPipeModelLike | null; pose: MediaPipeModelLike | null }> {
    let faceMesh: MediaPipeModelLike | null = null;
    let pose: MediaPipeModelLike | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const mod = (await import('@mediapipe/face_mesh')) as unknown as FaceMeshModuleLike;
        faceMesh = new mod.FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        break;
      } catch (error) {
        console.warn(`人脸检测模型加载失败 (尝试 ${attempt + 1}/${this.config.maxRetries}):`, error);
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const poseMod = (await import('@mediapipe/pose')) as unknown as PoseModuleLike;
        pose = new poseMod.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        break;
      } catch (error) {
        console.warn(`姿态检测模型加载失败 (尝试 ${attempt + 1}/${this.config.maxRetries}):`, error);
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return { faceMesh, pose };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private debounceEmotion(emotion: UserEmotion): UserEmotion | null {
    const now = performance.now();
    if (this.lastEmotion === emotion) {
      this.emotionStableCount++;
    } else {
      this.emotionStableCount = 1;
      this.lastEmotion = emotion;
    }
    if (now - this.lastEmotionTime < this.config.emotionDebounceMs) {
      return null;
    }
    if (this.emotionStableCount >= 3) {
      this.lastEmotionTime = now;
      return emotion;
    }
    return null;
  }

  private shouldEmitMotion(motion: string): boolean {
    const now = performance.now();
    if (now - this.lastMotionTime < this.config.motionCooldownMs) {
      return false;
    }
    if (motion === this.lastMotion && now - this.lastMotionTime < this.config.motionCooldownMs * 2) {
      return false;
    }
    this.lastMotionTime = now;
    this.lastMotion = motion;
    return true;
  }

  async start(
    videoElement: HTMLVideoElement,
    onEmotion: EmotionCallback,
    onMotion?: MotionCallback,
  ): Promise<boolean> {
    if (this.running) {
      this.callbacks.onEmotion = onEmotion;
      if (onMotion) this.callbacks.onMotion = onMotion;
      return true;
    }

    this.video = videoElement;
    this.callbacks.onEmotion = onEmotion;
    this.callbacks.onMotion = onMotion;
    this.setStatus('initializing');
    this.retryCount = 0;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.handleError('浏览器不支持摄像头访问，请使用 Chrome 或 Firefox');
      this.setStatus('no_camera');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: this.config.targetFps } },
        audio: false,
      });
      this.stream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (error) {
      const errorMessage = this.getCameraErrorMessage(error);
      this.handleError(errorMessage, error);
      this.setStatus('no_camera');
      return false;
    }

    const { faceMesh, pose } = await this.loadModelsWithRetry();
    this.faceMesh = faceMesh;
    this.pose = pose;

    if (this.faceMesh) {
      this.faceMesh.onResults((results: unknown) => {
        const emotion = mapFaceToEmotion(results);
        const debouncedEmotion = this.debounceEmotion(emotion);
        if (debouncedEmotion && this.callbacks.onEmotion) {
          this.callbacks.onEmotion(debouncedEmotion);
        }
        const landmarks = this.getFaceLandmarks(results);
        const motion = this.detectHeadMotion(landmarks);
        if (motion && this.shouldEmitMotion(motion) && this.callbacks.onMotion) {
          this.callbacks.onMotion(motion);
        }
      });
    }

    if (this.pose) {
      this.pose.onResults((results: unknown) => {
        const upperMotion = this.detectUpperBodyMotion(results);
        if (upperMotion && this.shouldEmitMotion(upperMotion) && this.callbacks.onMotion) {
          this.callbacks.onMotion(upperMotion);
        }
      });
    }

    if (this.faceMesh || this.pose) {
      this.running = true;
      this.setStatus('running');
      this.lastFpsTime = performance.now();
      this.loop();
      return true;
    } else {
      this.handleError('视觉模型加载失败，请刷新页面重试');
      return false;
    }
  }

  private getCameraErrorMessage(error: unknown): string {
    const err = error as { name?: string; message?: string };
    const errorName = err.name || '';
    const errorMessages: Record<string, string> = {
      'NotAllowedError': '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头',
      'NotFoundError': '未检测到摄像头设备，请确保摄像头已连接',
      'NotReadableError': '摄像头被其他应用占用，请关闭其他使用摄像头的程序',
      'OverconstrainedError': '摄像头不支持请求的分辨率',
      'SecurityError': '安全限制：请通过 HTTPS 访问或在本地运行',
      'AbortError': '摄像头访问被中断',
    };
    return errorMessages[errorName] || `摄像头访问失败: ${err.message || errorName}`;
  }

  private async loop(): Promise<void> {
    if (!this.running || !this.video || (!this.faceMesh && !this.pose)) return;
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    try {
      if (this.faceMesh) await this.faceMesh.send({ image: this.video });
      if (this.pose) await this.pose.send({ image: this.video });
    } catch { /* ignore single frame errors */ }
    if (this.running) requestAnimationFrame(() => { void this.loop(); });
  }

  stop(): void {
    this.running = false;
    this.setStatus('idle');
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.faceMesh = null;
    this.pose = null;
    this.callbacks = {};
    this.yawHistory = [];
    this.pitchHistory = [];
    this.leftWristXHistory = [];
    this.rightWristXHistory = [];
    this.lastUpperBodyMotionTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.lastEmotionTime = 0;
    this.lastEmotion = null;
    this.emotionStableCount = 0;
    this.lastMotionTime = 0;
    this.lastMotion = null;
    this.retryCount = 0;
  }

  private getFaceLandmarks(results: unknown): Landmark[] | undefined {
    if (!results || typeof results !== 'object') return undefined;
    const typed = results as FaceMeshResultsLike;
    const landmarks = typed.multiFaceLandmarks?.[0];
    return Array.isArray(landmarks) ? landmarks : undefined;
  }

  private getPoseLandmarks(results: unknown): PoseLandmark[] | undefined {
    if (!results || typeof results !== 'object') return undefined;
    const typed = results as PoseResultsLike;
    const landmarks = typed.poseLandmarks;
    return Array.isArray(landmarks) ? landmarks : undefined;
  }

  private computeHeadPose(landmarks: Landmark[] | undefined): { yaw: number; pitch: number } | null {
    if (!landmarks || landmarks.length < 300) return null;
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    if (!leftEye || !rightEye || !nose || !forehead || !chin) return null;
    const centerX = (leftEye.x + rightEye.x) / 2;
    const yaw = nose.x - centerX;
    const midY = (forehead.y + chin.y) / 2;
    const pitch = nose.y - midY;
    return { yaw, pitch };
  }

  private detectHeadMotion(landmarks: Landmark[] | undefined): 'nod' | 'shakeHead' | null {
    const pose = this.computeHeadPose(landmarks);
    if (!pose) return null;
    const { yaw, pitch } = pose;
    this.yawHistory.push(yaw);
    this.pitchHistory.push(pitch);
    if (this.yawHistory.length > 20) this.yawHistory.shift();
    if (this.pitchHistory.length > 20) this.pitchHistory.shift();
    if (this.yawHistory.length < 10 || this.pitchHistory.length < 10) return null;
    const yawMin = Math.min(...this.yawHistory);
    const yawMax = Math.max(...this.yawHistory);
    const pitchMin = Math.min(...this.pitchHistory);
    const pitchMax = Math.max(...this.pitchHistory);
    const yawRange = yawMax - yawMin;
    const pitchRange = pitchMax - pitchMin;
    const nodThreshold = 0.04;
    const shakeThreshold = 0.04;
    const tolerance = 0.02;
    if (pitchRange > nodThreshold && yawRange < tolerance) {
      this.yawHistory = [];
      this.pitchHistory = [];
      return 'nod';
    }
    if (yawRange > shakeThreshold && pitchRange < tolerance) {
      this.yawHistory = [];
      this.pitchHistory = [];
      return 'shakeHead';
    }
    return null;
  }

  private detectUpperBodyMotion(results: unknown): 'raiseHand' | 'waveHand' | null {
    const landmarks = this.getPoseLandmarks(results);
    if (!landmarks || landmarks.length < 17) return null;
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return null;
    const raiseThreshold = 0.05;
    let handRaised = false;
    if (leftWrist.y < leftShoulder.y - raiseThreshold) {
      handRaised = true;
      this.leftWristXHistory.push(leftWrist.x);
    } else {
      this.leftWristXHistory = [];
    }
    if (rightWrist.y < rightShoulder.y - raiseThreshold) {
      handRaised = true;
      this.rightWristXHistory.push(rightWrist.x);
    } else {
      this.rightWristXHistory = [];
    }
    if (!handRaised) return null;
    if (this.leftWristXHistory.length > 20) this.leftWristXHistory.shift();
    if (this.rightWristXHistory.length > 20) this.rightWristXHistory.shift();
    const now = performance.now();
    if (now - this.lastUpperBodyMotionTime < this.config.motionCooldownMs) return null;
    const waveThreshold = 0.06;
    const leftRange = this.leftWristXHistory.length >= 5 ? Math.max(...this.leftWristXHistory) - Math.min(...this.leftWristXHistory) : 0;
    const rightRange = this.rightWristXHistory.length >= 5 ? Math.max(...this.rightWristXHistory) - Math.min(...this.rightWristXHistory) : 0;
    if (leftRange > waveThreshold || rightRange > waveThreshold) {
      this.leftWristXHistory = [];
      this.rightWristXHistory = [];
      this.lastUpperBodyMotionTime = now;
      return 'waveHand';
    }
    const raiseHistoryThreshold = 10;
    if (this.leftWristXHistory.length >= raiseHistoryThreshold || this.rightWristXHistory.length >= raiseHistoryThreshold) {
      this.leftWristXHistory = [];
      this.rightWristXHistory = [];
      this.lastUpperBodyMotionTime = now;
      return 'raiseHand';
    }
    return null;
  }
}

export const visionService = new VisionService();
