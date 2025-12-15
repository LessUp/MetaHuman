import { mapFaceToEmotion, UserEmotion } from './visionMapper';

type EmotionCallback = (emotion: UserEmotion) => void;
type MotionCallback = (motion: 'nod' | 'shakeHead' | 'raiseHand' | 'waveHand') => void;

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

class VisionService {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private faceMesh: MediaPipeModelLike | null = null;
  private pose: MediaPipeModelLike | null = null;
  private onEmotion: EmotionCallback | null = null;
  private onMotion: MotionCallback | null = null;
  private yawHistory: number[] = [];
  private pitchHistory: number[] = [];
  private leftWristXHistory: number[] = [];
  private rightWristXHistory: number[] = [];
  private lastUpperBodyMotionTime = 0;

  async start(
    videoElement: HTMLVideoElement,
    onEmotion: EmotionCallback,
    onMotion?: MotionCallback,
  ): Promise<void> {
    if (this.running) {
      this.onEmotion = onEmotion;
      if (onMotion) {
        this.onMotion = onMotion;
      }
      return;
    }
    this.video = videoElement;
    this.onEmotion = onEmotion;
    this.onMotion = onMotion ?? null;
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      this.stream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (error) {
      console.error('无法访问摄像头', error);
      return;
    }

    try {
      const mod = (await import('@mediapipe/face_mesh')) as unknown as FaceMeshModuleLike;
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
      this.faceMesh.onResults((results: unknown) => {
        const emotion = mapFaceToEmotion(results);
        if (this.onEmotion) {
          this.onEmotion(emotion);
        }
        const landmarks = this.getFaceLandmarks(results);
        const motion = this.detectHeadMotion(landmarks);
        if (motion && this.onMotion) {
          this.onMotion(motion);
        }
      });
    } catch (error) {
      console.error('初始化人脸视觉模型失败', error);
    }

    try {
      const poseMod = (await import('@mediapipe/pose')) as unknown as PoseModuleLike;
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
      this.pose.onResults((results: unknown) => {
        const upperMotion = this.detectUpperBodyMotion(results);
        if (upperMotion && this.onMotion) {
          this.onMotion(upperMotion);
        }
      });
    } catch (error) {
      console.error('初始化上半身动作模型失败', error);
    }

    if (this.faceMesh || this.pose) {
      this.running = true;
      this.loop();
    }
  }

  private async loop(): Promise<void> {
    if (!this.running || !this.video || (!this.faceMesh && !this.pose)) {
      return;
    }
    try {
      if (this.faceMesh) {
        await this.faceMesh.send({ image: this.video });
      }
      if (this.pose) {
        await this.pose.send({ image: this.video });
      }
    } catch {
    }
    if (this.running) {
      requestAnimationFrame(() => {
        void this.loop();
      });
    }
  }

  stop(): void {
    this.running = false;
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
    this.onEmotion = null;
    this.onMotion = null;
    this.yawHistory = [];
    this.pitchHistory = [];
    this.leftWristXHistory = [];
    this.rightWristXHistory = [];
    this.lastUpperBodyMotionTime = 0;
  }

  private getFaceLandmarks(results: unknown): Landmark[] | undefined {
    if (!results || typeof results !== 'object') {
      return undefined;
    }
    const typed = results as FaceMeshResultsLike;
    const landmarks = typed.multiFaceLandmarks?.[0];
    if (!Array.isArray(landmarks)) {
      return undefined;
    }
    return landmarks;
  }

  private getPoseLandmarks(results: unknown): PoseLandmark[] | undefined {
    if (!results || typeof results !== 'object') {
      return undefined;
    }
    const typed = results as PoseResultsLike;
    const landmarks = typed.poseLandmarks;
    if (!Array.isArray(landmarks)) {
      return undefined;
    }
    return landmarks;
  }

  private computeHeadPose(landmarks: Landmark[] | undefined): { yaw: number; pitch: number } | null {
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

  private detectHeadMotion(landmarks: Landmark[] | undefined): 'nod' | 'shakeHead' | null {
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

  private detectUpperBodyMotion(results: unknown): 'raiseHand' | 'waveHand' | null {
    const landmarks = this.getPoseLandmarks(results);
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
