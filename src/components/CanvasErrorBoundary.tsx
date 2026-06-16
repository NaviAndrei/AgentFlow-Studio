import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

interface CanvasErrorBoundaryProps {
  children: ReactNode
}

interface CanvasErrorBoundaryState {
  hasError: boolean
}

export class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Canvas error boundary caught an error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas text-gray-200">
          <p className="text-sm">
            Canvas error — your work is not lost. Reload to recover.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            <RotateCcw size={13} />
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
