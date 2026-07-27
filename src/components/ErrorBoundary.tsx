import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 48, gap: 16, color: '#666',
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h3 style={{ margin: 0 }}>组件渲染出错</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#999', textAlign: 'center' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 24px', borderRadius: 6, border: 'none',
              background: '#4f6ef7', color: '#fff', cursor: 'pointer', fontSize: 14,
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
