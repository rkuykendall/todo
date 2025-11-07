import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call the optional error handler
    this.props.onError?.(error, errorInfo);

    // In production, you could send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className={styles.errorContainer}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={
              process.env.NODE_ENV === 'development'
                ? this.state.error?.message || 'An unexpected error occurred'
                : 'An unexpected error occurred. Please try refreshing the page.'
            }
            extra={[
              <Button key="retry" type="primary" onClick={this.handleReset}>
                Try Again
              </Button>,
              <Button key="reload" onClick={this.handleReload}>
                Reload Page
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components that need error boundaries
interface ErrorBoundaryHookProps extends Props {
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

export function ErrorBoundaryWrapper({
  children,
  resetKeys = [],
  resetOnPropsChange = true,
  ...props
}: ErrorBoundaryHookProps) {
  const [resetCount, setResetCount] = React.useState(0);

  // Reset error boundary when resetKeys change
  React.useEffect(() => {
    if (resetOnPropsChange) {
      setResetCount((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...resetKeys, resetOnPropsChange]);

  return (
    <ErrorBoundary key={resetCount} {...props}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
