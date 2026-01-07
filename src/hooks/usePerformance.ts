/**
 * Performance Monitoring Hooks
 * 
 * 提供 React 组件中使用的性能监控 hooks
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import {
    fpsMonitor,
    stateDebouncer,
    visibilityOptimizer,
    FPSMonitor,
    StateDebouncer,
    VisibilityOptimizer,
    type FPSMonitorConfig,
    type DebounceConfig,
    type VisibilityConfig,
} from '../core/performance/performanceMonitor';

/**
 * FPS 监控 Hook
 */
export function useFPSMonitor(config?: Partial<FPSMonitorConfig>) {
    const [fps, setFps] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const monitorRef = useRef<FPSMonitor | null>(null);

    useEffect(() => {
        // 使用全局单例或创建新实例
        const monitor = config ? new FPSMonitor(config) : fpsMonitor;
        monitorRef.current = monitor;

        if (config) {
            monitor.updateConfig(config);
        }

        monitor.start((currentFps) => {
            setFps(currentFps);
        });
        setIsRunning(true);

        return () => {
            monitor.stop();
            setIsRunning(false);
        };
    }, []);

    // 更新配置
    useEffect(() => {
        if (config && monitorRef.current) {
            monitorRef.current.updateConfig(config);
        }
    }, [config]);

    const start = useCallback(() => {
        monitorRef.current?.start((currentFps) => setFps(currentFps));
        setIsRunning(true);
    }, []);

    const stop = useCallback(() => {
        monitorRef.current?.stop();
        setIsRunning(false);
    }, []);

    return {
        fps,
        isRunning,
        start,
        stop,
        isBelowThreshold: fps < (config?.warningThreshold ?? 30),
    };
}

/**
 * 状态防抖 Hook
 */
export function useStateDebouncer(config?: Partial<DebounceConfig>) {
    const debouncerRef = useRef<StateDebouncer | null>(null);

    useEffect(() => {
        const debouncer = config ? new StateDebouncer(config) : stateDebouncer;
        debouncerRef.current = debouncer;

        if (config) {
            debouncer.updateConfig(config);
        }

        return () => {
            debouncer.clear();
        };
    }, []);

    // 更新配置
    useEffect(() => {
        if (config && debouncerRef.current) {
            debouncerRef.current.updateConfig(config);
        }
    }, [config]);

    const debounce = useCallback((fn: () => void) => {
        debouncerRef.current?.debounce(fn);
    }, []);

    const clear = useCallback(() => {
        debouncerRef.current?.clear();
    }, []);

    return { debounce, clear };
}

/**
 * 页面可见性 Hook
 */
export function usePageVisibility(config?: Partial<VisibilityConfig>) {
    const [isVisible, setIsVisible] = useState(true);
    const optimizerRef = useRef<VisibilityOptimizer | null>(null);

    useEffect(() => {
        const optimizer = config ? new VisibilityOptimizer(config) : visibilityOptimizer;
        optimizerRef.current = optimizer;

        if (config) {
            optimizer.updateConfig(config);
        }

        // 设置初始状态
        setIsVisible(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);

        const unsubscribePause = optimizer.onPause(() => {
            setIsVisible(false);
        });

        const unsubscribeResume = optimizer.onResume(() => {
            setIsVisible(true);
        });

        optimizer.start();

        return () => {
            optimizer.stop();
            unsubscribePause();
            unsubscribeResume();
        };
    }, []);

    // 更新配置
    useEffect(() => {
        if (config && optimizerRef.current) {
            optimizerRef.current.updateConfig(config);
        }
    }, [config]);

    const onPause = useCallback((callback: () => void) => {
        return optimizerRef.current?.onPause(callback) ?? (() => { });
    }, []);

    const onResume = useCallback((callback: () => void) => {
        return optimizerRef.current?.onResume(callback) ?? (() => { });
    }, []);

    return { isVisible, onPause, onResume };
}

/**
 * 综合性能监控 Hook
 * 
 * 整合 FPS 监控、状态防抖和页面可见性优化
 */
export function usePerformanceMonitor(options?: {
    fpsConfig?: Partial<FPSMonitorConfig>;
    debounceConfig?: Partial<DebounceConfig>;
    visibilityConfig?: Partial<VisibilityConfig>;
    autoStart?: boolean;
}) {
    const { fpsConfig, debounceConfig, visibilityConfig, autoStart = true } = options ?? {};

    const { fps, isRunning, start: startFPS, stop: stopFPS, isBelowThreshold } = useFPSMonitor(
        autoStart ? fpsConfig : undefined
    );
    const { debounce, clear: clearDebounce } = useStateDebouncer(debounceConfig);
    const { isVisible, onPause, onResume } = usePageVisibility(visibilityConfig);

    // 从 store 获取性能指标
    const performanceMetrics = useDigitalHumanStore((state) => state.performanceMetrics);

    // 页面隐藏时暂停 FPS 监控
    useEffect(() => {
        if (!autoStart) return;

        const unsubscribePause = onPause(() => {
            stopFPS();
        });

        const unsubscribeResume = onResume(() => {
            startFPS();
        });

        return () => {
            unsubscribePause();
            unsubscribeResume();
        };
    }, [autoStart, onPause, onResume, startFPS, stopFPS]);

    return {
        // FPS 相关
        fps,
        isMonitoring: isRunning,
        isBelowThreshold,
        startFPSMonitor: startFPS,
        stopFPSMonitor: stopFPS,

        // 防抖相关
        debounce,
        clearDebounce,

        // 可见性相关
        isPageVisible: isVisible,
        onPagePause: onPause,
        onPageResume: onResume,

        // Store 中的指标
        performanceMetrics,
    };
}

/**
 * 防抖状态更新 Hook
 * 
 * 用于创建防抖的状态更新函数
 */
export function useDebouncedState<T>(
    initialValue: T,
    config?: Partial<DebounceConfig>
): [T, (value: T) => void, T] {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    const { debounce } = useStateDebouncer(config);

    const setDebouncedValueFn = useCallback((newValue: T) => {
        setValue(newValue);
        debounce(() => {
            setDebouncedValue(newValue);
        });
    }, [debounce]);

    return [debouncedValue, setDebouncedValueFn, value];
}
