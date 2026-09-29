import { Component, type ErrorInfo, type ReactNode } from "react";

type SplashErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
};

type SplashErrorBoundaryState = {
  failed: boolean;
};

export class SplashErrorBoundary extends Component<SplashErrorBoundaryProps, SplashErrorBoundaryState> {
  state: SplashErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SplashErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
