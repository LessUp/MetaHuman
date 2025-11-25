// 支持的情感类型（与 store 中的 EmotionType 对应）
export type UserEmotion = 'happy' | 'neutral' | 'surprised' | 'sad' | 'angry';

// 面部关键点接口
interface Landmark {
  x: number;
  y: number;
  z: number;
}

// MediaPipe Face Mesh 关键点索引
const FACE_LANDMARKS = {
  // 嘴部
  leftMouth: 61,
  rightMouth: 291,
  upperLip: 13,
  lowerLip: 14,
  upperLipTop: 0,
  lowerLipBottom: 17,
  
  // 眼睛
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  leftEyeInner: 133,
  leftEyeOuter: 33,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  
  // 眉毛
  leftEyebrowInner: 107,
  leftEyebrowOuter: 66,
  rightEyebrowInner: 336,
  rightEyebrowOuter: 296,
  
  // 鼻子
  noseTip: 1,
  noseBottom: 2,
};

// 计算两点距离
function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 计算眼睛开合度
function getEyeOpenness(landmarks: Landmark[], isLeft: boolean): number {
  const upper = isLeft ? landmarks[FACE_LANDMARKS.leftEyeUpper] : landmarks[FACE_LANDMARKS.rightEyeUpper];
  const lower = isLeft ? landmarks[FACE_LANDMARKS.leftEyeLower] : landmarks[FACE_LANDMARKS.rightEyeLower];
  const inner = isLeft ? landmarks[FACE_LANDMARKS.leftEyeInner] : landmarks[FACE_LANDMARKS.rightEyeInner];
  const outer = isLeft ? landmarks[FACE_LANDMARKS.leftEyeOuter] : landmarks[FACE_LANDMARKS.rightEyeOuter];
  
  if (!upper || !lower || !inner || !outer) return 0.5;
  
  const eyeHeight = distance(upper, lower);
  const eyeWidth = distance(inner, outer);
  
  return eyeWidth > 0 ? eyeHeight / eyeWidth : 0.5;
}

// 计算眉毛位置（相对于眼睛）
function getEyebrowPosition(landmarks: Landmark[], isLeft: boolean): number {
  const eyebrowInner = isLeft ? landmarks[FACE_LANDMARKS.leftEyebrowInner] : landmarks[FACE_LANDMARKS.rightEyebrowInner];
  const eyeUpper = isLeft ? landmarks[FACE_LANDMARKS.leftEyeUpper] : landmarks[FACE_LANDMARKS.rightEyeUpper];
  
  if (!eyebrowInner || !eyeUpper) return 0;
  
  // 负值表示眉毛下压，正值表示眉毛抬起
  return eyeUpper.y - eyebrowInner.y;
}

// 计算嘴部特征
interface MouthFeatures {
  openness: number;      // 嘴巴开合度
  width: number;         // 嘴角宽度
  cornerPull: number;    // 嘴角上扬程度
}

function getMouthFeatures(landmarks: Landmark[]): MouthFeatures {
  const leftMouth = landmarks[FACE_LANDMARKS.leftMouth];
  const rightMouth = landmarks[FACE_LANDMARKS.rightMouth];
  const upperLip = landmarks[FACE_LANDMARKS.upperLip];
  const lowerLip = landmarks[FACE_LANDMARKS.lowerLip];
  const upperLipTop = landmarks[FACE_LANDMARKS.upperLipTop];
  const noseTip = landmarks[FACE_LANDMARKS.noseTip];
  
  if (!leftMouth || !rightMouth || !upperLip || !lowerLip) {
    return { openness: 0, width: 0, cornerPull: 0 };
  }
  
  const mouthWidth = distance(leftMouth, rightMouth);
  const mouthHeight = distance(upperLip, lowerLip);
  const openness = mouthWidth > 0 ? mouthHeight / mouthWidth : 0;
  
  // 嘴角上扬程度：比较嘴角和嘴唇中心的高度
  const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
  const cornerY = (leftMouth.y + rightMouth.y) / 2;
  const cornerPull = mouthCenterY - cornerY; // 正值表示嘴角上扬
  
  return { openness, width: mouthWidth, cornerPull };
}

// 情感分析结果
interface EmotionAnalysis {
  emotion: UserEmotion;
  confidence: number;
}

// 主分析函数
export function mapFaceToEmotion(results: unknown): UserEmotion {
  const faceLandmarksResults = results as { multiFaceLandmarks?: Landmark[][] } | null;
  const landmarks: Landmark[] | undefined = faceLandmarksResults?.multiFaceLandmarks?.[0];
  
  if (!landmarks || landmarks.length < 400) {
    return 'neutral';
  }
  
  // 获取面部特征
  const leftEyeOpen = getEyeOpenness(landmarks, true);
  const rightEyeOpen = getEyeOpenness(landmarks, false);
  const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
  
  const leftBrow = getEyebrowPosition(landmarks, true);
  const rightBrow = getEyebrowPosition(landmarks, false);
  const avgBrowPos = (leftBrow + rightBrow) / 2;
  
  const mouth = getMouthFeatures(landmarks);
  
  // 基于特征判断情感
  const analysis = analyzeEmotion(avgEyeOpen, avgBrowPos, mouth);
  
  return analysis.emotion;
}

// 情感分析逻辑
function analyzeEmotion(
  eyeOpenness: number,
  browPosition: number,
  mouth: MouthFeatures
): EmotionAnalysis {
  // 惊讶：眼睛睁大 + 嘴巴张开
  if (eyeOpenness > 0.35 && mouth.openness > 0.06) {
    return { emotion: 'surprised', confidence: 0.8 };
  }
  
  // 愤怒：眉毛下压 + 嘴角下拉
  if (browPosition < -0.02 && mouth.cornerPull < -0.01) {
    return { emotion: 'angry', confidence: 0.7 };
  }
  
  // 悲伤：眉毛内侧上扬 + 嘴角下拉
  if (mouth.cornerPull < -0.015 && browPosition > 0.01) {
    return { emotion: 'sad', confidence: 0.7 };
  }
  
  // 开心：嘴角上扬 + 眼睛微眯
  if (mouth.cornerPull > 0.01 || mouth.openness > 0.03) {
    return { emotion: 'happy', confidence: 0.75 };
  }
  
  // 默认中性
  return { emotion: 'neutral', confidence: 0.9 };
}

// 导出用于调试的函数
export function analyzeFaceFeatures(results: unknown): {
  eyeOpenness: number;
  browPosition: number;
  mouthOpenness: number;
  mouthCornerPull: number;
} | null {
  const faceLandmarksResults = results as { multiFaceLandmarks?: Landmark[][] } | null;
  const landmarks: Landmark[] | undefined = faceLandmarksResults?.multiFaceLandmarks?.[0];
  
  if (!landmarks || landmarks.length < 400) {
    return null;
  }
  
  const leftEyeOpen = getEyeOpenness(landmarks, true);
  const rightEyeOpen = getEyeOpenness(landmarks, false);
  const leftBrow = getEyebrowPosition(landmarks, true);
  const rightBrow = getEyebrowPosition(landmarks, false);
  const mouth = getMouthFeatures(landmarks);
  
  return {
    eyeOpenness: (leftEyeOpen + rightEyeOpen) / 2,
    browPosition: (leftBrow + rightBrow) / 2,
    mouthOpenness: mouth.openness,
    mouthCornerPull: mouth.cornerPull,
  };
}
