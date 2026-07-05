import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

/**
 * Catches render-time errors anywhere below it and shows a readable message
 * instead of leaving the screen blank. Also logs to the console so the
 * browser dev tools show the real stack trace.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Vestoro crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <div className="card p-6 max-w-lg">
            <h2 className="font-semibold mb-2" style={{ color: 'var(--expense)' }}>
              Etwas ist schiefgelaufen
            </h2>
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
              {this.state.error.message}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
              Details stehen in der Browser-Konsole (Rechtsklick → Untersuchen → Console).
            </p>
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
