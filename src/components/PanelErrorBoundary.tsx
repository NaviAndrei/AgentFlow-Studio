import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

interface PanelErrorBoundaryProps {
  name: string
  children: ReactNode
}

interface PanelErrorBoundaryState {
  hasError: boolean
  resetKey: number
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { hasError: false, resetKey: 0 }

  static getDerivedStateFromError(): Partial<PanelErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.name} panel error boundary caught an error:`, error, info)
  }

  reset = () => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-4 text-gray-200">
          <p className="text-center text-[11px] text-gray-400">
            {this.props.name} panel encountered an error.
          </p>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            <RotateCcw size={13} />
            Reload panel
          </button>
        </div>
      )
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>
  }
}
