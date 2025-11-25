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

class VisionService {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private status: VisionStatus = 'idle';
  private faceMesh: any = null;
  private pose: any = null;
  private callbacks: VisionServiceCallbacks = {};
  private yawHistory: number[] = [];
  private pitchHistory: number[] = [];
  private leftWristXHistory: number[] = [];
  private rightWristXHistory: number[] = [];
  private lastUpperBodyMotionTime = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 0;

  getStatus(): VisionStatus {
    return this.status;
  }

  getFps(): number {
    return this.fps;
  }

  isRunning(): boolean {
    return this.running;
  }

  private setStatus(status: VisionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private handleError(message: string, error?: any): void {
    console.error(message, error);
    this.setStatus('error');
    this.callbacks.onError?.(message);
    useDigitalHumanStore.getState().setError(message);
  }

  // 检查摄像头权限
  async checkCameraPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted' || result.state === 'prompt';
    } catch {
      // 某些浏览器不支持权限查询
      return true;
    }
  }

  async start(
    videoElement: HTMLVideoElement,
    onEmotion: EmotionCallback,
    onMotion?: MotionCallback,
  ): Promise<boolean> {
    // 如果已经在运行，只更新回调
    if (this.running) {
      this.callbacks.onEmotion = onEmotion;
      if (onMotion) {
        this.callbacks.onMotion = onMotion;
      }
      return true;
    }

    this.video = videoElement;
    this.callbacks.onEmotion = onEmotion;
    this.callbacks.onMotion = onMotion;
    this.setStatus('initializing');

    // 检查浏览器支持
    if (!navigator.mediaDevices?.getUserMedia) {
      this.handleError('浏览器不支持摄像头访问，请使用 Chrome 或 Firefox');
      this.setStatus('no_camera');
      return false;
    }

    // 获取摄像头权限
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false,
      });
      this.stream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (error: any) {
      const errorMessage = this.getCameraErrorMessage(error);
      this.handleError(errorMessage, error);
      this.setStatus('no_camera');
      return false;
    }

    // 初始化人脸检测模型
    try {
      const mod: any = await import('@mediapipe/face_mesh');
      const FaceMesh = mod.FaceMesh;
      this.faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.faceMesh.onResults((results: any) => {
        const emotion = mapFaceToEmotion(results);
        if (this.callbacks.onEmotion) {
          this.callbacks.onEmotion(emotion);
        }
        const landmarks = results?.multiFaceLandmarks?.[0];
        const motion = this.detectHeadMotion(landmarks);
        if (motion && this.callbacks.onMotion) {
          this.callbacks.onMotion(motion);
        }
      });
    } catch (error) {
      console.warn('人脸检测模型加载失败，部分功能可能受限', error);
      // 不阻止继续运行，因为可能只是模型加载问题
    }

    // 初始化姿态检测模型
    try {
      const poseMod: any = await import('@mediapipe/pose');
      const Pose = poseMod.Pose;
      this.pose = new Pose({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      this.pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.pose.onResults((results: any) => {
        const upperMotion = this.detectUpperBodyMotion(results);
        if (upperMotion && this.callbacks.onMotion) {
          this.callbacks.onMotion(upperMotion);
        }
      });
    } catch (error) {
      console.warn('姿态检测模型加载失败，手势识别功能将不可用', error);
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

  // 获取摄像头错误的友好消息
  private getCameraErrorMessage(error: any): string {
    const errorName = error.name || '';
    const errorMessages: Record<string, string> = {
      'NotAllowedError': '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头',
      'NotFoundError': '未检测到摄像头设备，请确保摄像头已连接',
      'NotReadableError': '摄像头被其他应用占用，请关闭其他使用摄像头的程序',
      'OverconstrainedError': '摄像头不支持请求的分辨率',
      'SecurityError': '安全限制：请通过 HTTPS 访问或在本地运行',
      'AbortError': '摄像头访问被中断',
    };
    return errorMessages[errorName] || `摄像头访问失败: ${error.message || errorName}`;
  }

  private async loop(): Promise<void> {
    if (!this.running || !this.video || (!this.faceMesh && !this.pose)) {
      return;
    }
    
    // FPS 计算
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    
    try {
      if (this.faceMesh) {
        await this.faceMesh.send({ image: this.video });
      }
      if (this.pose) {
        await this.pose.send({ image: this.video });
      }
    } catch (error) {
      // 单帧错误不影响继续运行
      console.debug('视觉处理帧错误:', error);
    }
    
    if (this.running) {
      requestAnimationFrame(() => {
        void this.loop();
      });
    }
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
  }

  private computeHeadPose(landmarks: any): { yaw: number; pitch: number } | null {
    if (!landmarks || landmarks.length < 300) {
      return null;
    }
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    if (!leftEye || !rightEye || !nose || !forehead || !chin) {
      return null;
    }
    const centerX = (leftEye.x + rightEye.x) / 2;
    const yaw = nose.x - centerX;
    const midY = (forehead.y + chin.y) / 2;
    const pitch = nose.y - midY;
    return { yaw, pitch };
  }

  private detectHeadMotion(landmarks: any): 'nod' | 'shakeHead' | null {
    const pose = this.computeHeadPose(landmarks);
    if (!pose) {
      return null;
    }
    const { yaw, pitch } = pose;
    this.yawHistory.push(yaw);
    this.pitchHistory.push(pitch);
    if (this.yawHistory.length > 20) {
      this.yawHistory.shift();
    }
    if (this.pitchHistory.length > 20) {
      this.pitchHistory.shift();
    }
    if (this.yawHistory.length < 10 || this.pitchHistory.length < 10) {
      return null;
    }
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

  private detectUpperBodyMotion(results: any): 'raiseHand' | 'waveHand' | null {
    const landmarks = results?.poseLandmarks;
    if (!landmarks || landmarks.length < 17) {
      return null;
    }

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
      return null;
    }

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

    if (!handRaised) {
      return null;
    }

    if (this.leftWristXHistory.length > 20) {
      this.leftWristXHistory.shift();
    }
    if (this.rightWristXHistory.length > 20) {
      this.rightWristXHistory.shift();
    }

    const now = performance.now();
    if (now - this.lastUpperBodyMotionTime < 800) {
      return null;
    }

    const waveThreshold = 0.06;
    const leftRange =
      this.leftWristXHistory.length >= 5
        ? Math.max(...this.leftWristXHistory) - Math.min(...this.leftWristXHistory)
        : 0;
    const rightRange =
      this.rightWristXHistory.length >= 5
        ? Math.max(...this.rightWristXHistory) - Math.min(...this.rightWristXHistory)
        : 0;

    if (leftRange > waveThreshold || rightRange > waveThreshold) {
      this.leftWristXHistory = [];
      this.rightWristXHistory = [];
      this.lastUpperBodyMotionTime = now;
      return 'waveHand';
    }

    const raiseHistoryThreshold = 10;
    if (
      this.leftWristXHistory.length >= raiseHistoryThreshold ||
      this.rightWristXHistory.length >= raiseHistoryThreshold
    ) {
      this.leftWristXHistory = [];
      this.rightWristXHistory = [];
      this.lastUpperBodyMotionTime = now;
      return 'raiseHand';
    }

    return null;
  }
}

export const visionService = new VisionService();
