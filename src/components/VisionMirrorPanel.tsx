import React, { useEffect, useRef, useState } from 'react';
import { visionService } from '../core/vision/visionService';
import type { UserEmotion } from '../core/vision/visionMapper';

interface VisionMirrorPanelProps {
  onEmotionChange: (emotion: UserEmotion) => void;
  onHeadMotion?: (motion: 'nod' | 'shakeHead') => void;
}

export default function VisionMirrorPanel({ onEmotionChange, onHeadMotion }: VisionMirrorPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<UserEmotion>('neutral');

  useEffect(() => {
    return () => {
      visionService.stop();
    };
  }, []);

  const handleToggleCamera = async () => {
    if (isCameraOn) {
      visionService.stop();
      setIsCameraOn(false);
      setCurrentEmotion('neutral');
      onEmotionChange('neutral');
    } else {
      if (videoRef.current) {
        await visionService.start(
          videoRef.current,
          (emotion) => {
            setCurrentEmotion(emotion);
            onEmotionChange(emotion);
          },
          (motion) => {
            if (onHeadMotion) {
              onHeadMotion(motion);
            }
          },
        );
        setIsCameraOn(true);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">视觉镜像</h3>
        <button
          onClick={handleToggleCamera}
          className={`px-3 py-1 rounded-lg text-sm ${
            isCameraOn ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
          }`}
        >
          {isCameraOn ? '关闭摄像头' : '开启摄像头'}
        </button>
      </div>
      <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
      </div>
      <div className="text-sm text-gray-700">
        当前检测到的表情:
        <span className="ml-2 font-semibold text-blue-600">
          {currentEmotion === 'happy'
            ? '高兴'
            : currentEmotion === 'surprised'
            ? '惊讶'
            : '中性'}
        </span>
      </div>
    </div>
  );
}
