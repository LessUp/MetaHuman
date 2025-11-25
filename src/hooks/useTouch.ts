import { useState, useCallback, useRef, TouchEvent } from 'react';

interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
}

interface TouchState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface UseTouchOptions {
  threshold?: number; // 最小滑动距离（像素）
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  longPressDelay?: number;
}

export function useTouch(options: UseTouchOptions = {}) {
  const {
    threshold = 50,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    longPressDelay = 500,
    onLongPress,
  } = options;

  const [touchState, setTouchState] = useState<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const lastTapTime = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchState(prev => ({
      ...prev,
      startX: touch.clientX,
      startY: touch.clientY,
    }));
    isLongPress.current = false;

    // 长按检测
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        onLongPress();
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchState(prev => ({
      ...prev,
      endX: touch.clientX,
      endY: touch.clientY,
    }));

    // 如果移动了，取消长按
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();

    // 如果是长按，不处理其他事件
    if (isLongPress.current) {
      return;
    }

    const deltaX = touchState.endX - touchState.startX;
    const deltaY = touchState.endY - touchState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 判断是否是滑动
    if (absX > threshold || absY > threshold) {
      if (absX > absY) {
        // 水平滑动
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // 垂直滑动
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    } else {
      // 点击事件
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;

      if (timeSinceLastTap < 300 && onDoubleTap) {
        onDoubleTap();
        lastTapTime.current = 0;
      } else {
        onTap?.();
        lastTapTime.current = now;
      }
    }
  }, [
    touchState,
    threshold,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    clearLongPressTimer,
  ]);

  const getSwipeDirection = useCallback((): SwipeDirection => {
    const deltaX = touchState.endX - touchState.startX;
    const deltaY = touchState.endY - touchState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < threshold && absY < threshold) {
      return { direction: null, distance: 0 };
    }

    if (absX > absY) {
      return {
        direction: deltaX > 0 ? 'right' : 'left',
        distance: absX,
      };
    }

    return {
      direction: deltaY > 0 ? 'down' : 'up',
      distance: absY,
    };
  }, [touchState, threshold]);

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    touchState,
    getSwipeDirection,
  };
}

// 检测是否是触摸设备
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}
