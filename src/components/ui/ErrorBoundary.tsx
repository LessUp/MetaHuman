import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // 调用外部错误处理函数
    this.props.onError?.(error, errorInfo);
    
    // 记录错误到控制台（生产环境可发送到监控服务）
    console.error('ErrorBoundary 捕获错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-red-900/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            出现了一些问题
          </h2>
          <p className="text-sm text-white/60 text-center mb-4 max-w-md">
            {this.state.error?.message || '应用程序遇到了意外错误'}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} />
              重试
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors"
            >
              刷新页面
            </button>
          </div>

          {/* 开发环境显示详细错误信息 */}
          {import.meta.env.DEV && this.state.errorInfo && (
            <details className="mt-4 w-full max-w-2xl">
              <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                查看详细错误信息
              </summary>
              <pre className="mt-2 p-3 bg-black/40 rounded text-xs text-red-300 overflow-auto max-h-48">
                {this.state.error?.stack}
                {'\n\nComponent Stack:\n'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
