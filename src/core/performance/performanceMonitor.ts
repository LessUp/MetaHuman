/**
 * Performance Monitor
 * 
 * 提供帧率监控、状态更新防抖和页面可见性优化功能
 */

import { useDigitalHumanStore } from '../../store/digitalHumanStore';

// 帧率监控配置
export interface FPSMonitorConfig {
    sampleSize: number;      // 采样数量
    targetFPS: number;       // 目标帧率
    warningThreshold: number; // 警告阈值
}

// 状态防抖配置
export interface DebounceConfig {
    maxUpdatesPerSecond: number; // 每秒最大更新次数
    debounceInterval: number;    // 防抖间隔（毫秒）
}

// 页面可见性配置
export interface VisibilityConfig {
    pauseDelay: number;      // 暂停延迟（毫秒）
    resumeDelay: number;     // 恢复延迟（毫秒）
}

// 默认配置
const DEFAULT_FPS_CONFIG: FPSMonitorConfig = {
    sampleSize: 60,
    targetFPS: 60,
    warningThreshold: 30,
};

const DEFAULT_DEBOUNCE_CONFIG: DebounceConfig = {
    maxUpdatesPerSecond: 10,
    debounceInterval: 100,
};

const DEFAULT_VISIBILITY_CONFIG: VisibilityConfig = {
    pauseDelay: 100,
    resumeDelay: 100,
};

/**
 * FPS 监控器类
 */
export class FPSMonitor {
    private frameTimes: number[] = [];
    private lastFrameTime: number = 0;
    private animationFrameId: number | null = null;
    private isRunning: boolean = false;
    private config: FPSMonitorConfig;
    private onFPSUpdate?: (fps: number) => void;

    constructor(config: Partial<FPSMonitorConfig> = {}) {
        this.config = { ...DEFAULT_FPS_CONFIG, ...config };
    }

    /**
     * 开始监控帧率
     */
    start(onFPSUpdate?: (fps: number) => void): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.onFPSUpdate = onFPSUpdate;
        this.lastFrameTime = performance.now();
        this.frameTimes = [];
        this.tick();
    }

    /**
     * 停止监控
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * 获取当前帧率
     */
    getCurrentFPS(): number {
        if (this.frameTimes.length < 2) return 0;

        const totalTime = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
        if (totalTime === 0) return 0;

        return Math.round((this.frameTimes.length - 1) / (totalTime / 1000));
    }

    /**
     * 获取平均帧率
     */
    getAverageFPS(): number {
        return this.getCurrentFPS();
    }

    /**
     * 检查帧率是否低于警告阈值
     */
    isBelowThreshold(): boolean {
        return this.getCurrentFPS() < this.config.warningThreshold;
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<FPSMonitorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private tick = (): void => {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        this.frameTimes.push(currentTime);

        // 保持采样窗口大小
        while (this.frameTimes.length > this.config.sampleSize) {
            this.frameTimes.shift();
        }

        // 计算并更新 FPS
        const fps = this.getCurrentFPS();

        // 更新 store 中的性能指标
        const store = useDigitalHumanStore.getState();
        store.updatePerformanceMetrics({
            fps,
            lastFrameTime: currentTime,
        });

        // 调用回调
        this.onFPSUpdate?.(fps);

        this.lastFrameTime = currentTime;
        this.animationFrameId = requestAnimationFrame(this.tick);
    };
}

/**
 * 状态更新防抖器
 */
export class StateDebouncer {
    private lastUpdateTime: number = 0;
    private pendingUpdate: (() => void) | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private updateCount: number = 0;
    private windowStart: number = 0;
    private config: DebounceConfig;

    constructor(config: Partial<DebounceConfig> = {}) {
        this.config = { ...DEFAULT_DEBOUNCE_CONFIG, ...config };
    }

    /**
     * 防抖执行更新
     */
    debounce(updateFn: () => void): void {
        const now = Date.now();

        // 重置计数窗口
        if (now - this.windowStart >= 1000) {
            this.updateCount = 0;
            this.windowStart = now;
        }

        // 检查是否超过每秒最大更新次数
        if (this.updateCount >= this.config.maxUpdatesPerSecond) {
            // 存储待处理的更新
            this.pendingUpdate = updateFn;

            // 设置延迟执行
            if (!this.timeoutId) {
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    if (this.pendingUpdate) {
                        this.pendingUpdate();
                        this.pendingUpdate = null;
                        this.updateCount++;
                    }
                }, this.config.debounceInterval);
            }
            return;
        }

        // 检查防抖间隔
        if (now - this.lastUpdateTime < this.config.debounceInterval) {
            this.pendingUpdate = updateFn;

            if (!this.timeoutId) {
                const delay = this.config.debounceInterval - (now - this.lastUpdateTime);
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    if (this.pendingUpdate) {
                        this.pendingUpdate();
                        this.pendingUpdate = null;
                        this.lastUpdateTime = Date.now();
                        this.updateCount++;
                    }
                }, delay);
            }
            return;
        }

        // 立即执行
        updateFn();
        this.lastUpdateTime = now;
        this.updateCount++;
    }

    /**
     * 获取当前秒内的更新次数
     */
    getUpdateCount(): number {
        return this.updateCount;
    }

    /**
     * 清除待处理的更新
     */
    clear(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.pendingUpdate = null;
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<DebounceConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * 页面可见性优化器
 */
export class VisibilityOptimizer {
    private isPageVisible: boolean = true;
    private pauseCallbacks: (() => void)[] = [];
    private resumeCallbacks: (() => void)[] = [];
    private pauseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private config: VisibilityConfig;
    private boundHandleVisibilityChange: () => void;

    constructor(config: Partial<VisibilityConfig> = {}) {
        this.config = { ...DEFAULT_VISIBILITY_CONFIG, ...config };
        this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * 开始监听页面可见性变化
     */
    start(): void {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
            this.isPageVisible = document.visibilityState === 'visible';
        }
    }

    /**
     * 停止监听
     */
    stop(): void {
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
        }
        this.clearTimeouts();
    }

    /**
     * 注册暂停回调
     */
    onPause(callback: () => void): () => void {
        this.pauseCallbacks.push(callback);
        return () => {
            this.pauseCallbacks = this.pauseCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * 注册恢复回调
     */
    onResume(callback: () => void): () => void {
        this.resumeCallbacks.push(callback);
        return () => {
            this.resumeCallbacks = this.resumeCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * 获取页面是否可见
     */
    isVisible(): boolean {
        return this.isPageVisible;
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<VisibilityConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private handleVisibilityChange(): void {
        const isVisible = document.visibilityState === 'visible';

        if (isVisible === this.isPageVisible) return;

        this.isPageVisible = isVisible;
        this.clearTimeouts();

        if (!isVisible) {
            // 页面隐藏，延迟暂停
            this.pauseTimeoutId = setTimeout(() => {
                this.pauseCallbacks.forEach(cb => cb());
            }, this.config.pauseDelay);
        } else {
            // 页面显示，延迟恢复
            this.resumeTimeoutId = setTimeout(() => {
                this.resumeCallbacks.forEach(cb => cb());
            }, this.config.resumeDelay);
        }
    }

    private clearTimeouts(): void {
        if (this.pauseTimeoutId) {
            clearTimeout(this.pauseTimeoutId);
            this.pauseTimeoutId = null;
        }
        if (this.resumeTimeoutId) {
            clearTimeout(this.resumeTimeoutId);
            this.resumeTimeoutId = null;
        }
    }
}

// 创建单例实例
export const fpsMonitor = new FPSMonitor();
export const stateDebouncer = new StateDebouncer();
export const visibilityOptimizer = new VisibilityOptimizer();

/**
 * 创建防抖状态更新函数
 */
export function createDebouncedUpdater<T>(
    updateFn: (value: T) => void,
    debouncer: StateDebouncer = stateDebouncer
): (value: T) => void {
    return (value: T) => {
        debouncer.debounce(() => updateFn(value));
    };
}

/**
 * 性能监控 Hook 辅助函数
 */
export function initPerformanceMonitoring(): () => void {
    // 启动 FPS 监控
    fpsMonitor.start();

    // 启动页面可见性优化
    visibilityOptimizer.start();

    // 注册暂停回调
    const unsubscribePause = visibilityOptimizer.onPause(() => {
        fpsMonitor.stop();
        // 可以在这里暂停其他非必要处理
    });

    // 注册恢复回调
    const unsubscribeResume = visibilityOptimizer.onResume(() => {
        fpsMonitor.start();
        // 可以在这里恢复其他处理
    });

    // 返回清理函数
    return () => {
        fpsMonitor.stop();
        visibilityOptimizer.stop();
        unsubscribePause();
        unsubscribeResume();
    };
}
