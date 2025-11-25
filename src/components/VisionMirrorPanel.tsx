import React, { useEffect, useRef, useState, useCallback } from 'react';
import { visionService, type VisionStatus } from '../core/vision/visionService';
import type { UserEmotion } from '../core/vision/visionMapper';
import { Camera, CameraOff, ScanFace, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VisionMirrorPanelProps {
  onEmotionChange: (emotion: UserEmotion) => void;
  onHeadMotion?: (motion: 'nod' | 'shakeHead' | 'raiseHand' | 'waveHand') => void;
}

// 情感颜色映射
const EMOTION_COLORS: Record<UserEmotion, string> = {
  neutral: 'text-blue-400',
  happy: 'text-green-400',
  surprised: 'text-yellow-400',
  sad: 'text-indigo-400',
  angry: 'text-red-400',
};

// 情感图标/标签
const EMOTION_LABELS: Record<UserEmotion, string> = {
  neutral: '😐 中性',
  happy: '😊 开心',
  surprised: '😮 惊讶',
  sad: '😢 悲伤',
  angry: '😠 愤怒',
};

export default function VisionMirrorPanel({ onEmotionChange, onHeadMotion }: VisionMirrorPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<UserEmotion>('neutral');
  const [lastMotion, setLastMotion] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  // 清理函数
  useEffect(() => {
    return () => {
      visionService.stop();
    };
  }, []);

  // 动作检测提示自动消失
  useEffect(() => {
    if (lastMotion) {
      const timer = setTimeout(() => setLastMotion(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastMotion]);

  // FPS 更新
  useEffect(() => {
    if (!isCameraOn) return;
    const interval = setInterval(() => {
      setFps(visionService.getFps());
    }, 1000);
    return () => clearInterval(interval);
  }, [isCameraOn]);

  // 处理摄像头开关
  const handleToggleCamera = useCallback(async () => {
    if (isCameraOn) {
      visionService.stop();
      setIsCameraOn(false);
      setCurrentEmotion('neutral');
      onEmotionChange('neutral');
      setLastMotion(null);
      setFps(0);
      setError(null);
    } else {
      if (videoRef.current) {
        setIsLoading(true);
        setError(null);
        
        const success = await visionService.start(
          videoRef.current,
          (emotion) => {
            setCurrentEmotion(emotion);
            onEmotionChange(emotion);
          },
          (motion) => {
            setLastMotion(motion);
            toast.info(`检测到动作: ${motion}`);
            onHeadMotion?.(motion);
          },
        );
        
        setIsLoading(false);
        
        if (success) {
          setIsCameraOn(true);
          toast.success('摄像头已启动');
        } else {
          setError('摄像头启动失败，请检查权限设置');
          toast.error('摄像头启动失败');
        }
      }
    }
  }, [isCameraOn, onEmotionChange, onHeadMotion]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">视觉镜像</h3>
        <div className="flex items-center space-x-3">
          {isCameraOn && fps > 0 && (
            <span className="text-[10px] text-white/40 font-mono">{fps} FPS</span>
          )}
          <div className="flex items-center space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              isLoading ? 'bg-yellow-500 animate-pulse' :
              isCameraOn ? 'bg-red-500 animate-pulse' : 'bg-white/20'
            }`} />
            <span className="text-xs text-white/60">
              {isLoading ? '启动中' : isCameraOn ? 'LIVE' : '离线'}
            </span>
          </div>
        </div>
      </div>

      <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden border border-white/10 shadow-inner">
        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <Loader2 size={32} className="text-blue-400 animate-spin mb-2" />
            <span className="text-xs text-white/60">正在启动摄像头...</span>
          </div>
        )}
        
        {/* 错误状态 */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/20 z-10">
            <AlertCircle size={32} className="text-red-400 mb-2" />
            <span className="text-xs text-red-300 text-center px-4">{error}</span>
          </div>
        )}
        
        {/* 离线状态 */}
        {!isCameraOn && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
            <ScanFace size={48} className="mb-2" />
            <span className="text-xs uppercase tracking-widest">摄像头未开启</span>
          </div>
        )}
        
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity ${isCameraOn ? 'opacity-100' : 'opacity-0'} transform scale-x-[-1]`}
          autoPlay
          playsInline
          muted
        />
        
        {isCameraOn && (
          <>
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] text-white/80 border border-white/10">
              AI 追踪中
            </div>
            {lastMotion && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-xs text-white font-medium animate-fade-in-up">
                检测到: {lastMotion.toUpperCase()}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-white/60">
          检测情感:
          <span className={`ml-2 font-medium ${EMOTION_COLORS[currentEmotion]}`}>
            {EMOTION_LABELS[currentEmotion]}
          </span>
        </div>
        
        <button
          onClick={handleToggleCamera}
          disabled={isLoading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
            isCameraOn 
              ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30' 
              : 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30'
          }`}
          aria-label={isCameraOn ? '关闭摄像头' : '开启摄像头'}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isCameraOn ? (
            <CameraOff size={14} />
          ) : (
            <Camera size={14} />
          )}
          <span>{isLoading ? '启动中...' : isCameraOn ? '关闭摄像头' : '开启摄像头'}</span>
        </button>
      </div>
    </div>
  );
}
