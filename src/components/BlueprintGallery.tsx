import { useReactFlow } from '@xyflow/react'
import { LayoutTemplate, X } from 'lucide-react'
import { BLUEPRINTS } from '../blueprints'
import { useBlueprintStore } from '../store/blueprintStore'
import type { Blueprint } from '../types'

export function BlueprintGallery() {
  const galleryOpen = useBlueprintStore((s) => s.galleryOpen)
  const setGalleryOpen = useBlueprintStore((s) => s.setGalleryOpen)
  const loadBlueprint = useBlueprintStore((s) => s.loadBlueprint)
  const { fitView } = useReactFlow()

  if (!galleryOpen) return null

  const handleLoad = (blueprint: Blueprint) => {
    loadBlueprint(blueprint)
    // Let React Flow render the new nodes before fitting the viewport.
    window.setTimeout(() => {
      void fitView({ padding: 0.15, duration: 400 })
    }, 50)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={() => setGalleryOpen(false)}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-100">
            <LayoutTemplate size={16} className="text-accent" />
            Blueprint Gallery
          </h2>
          <button
            onClick={() => setGalleryOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-surface-2 hover:text-white"
            aria-label="Close gallery"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BLUEPRINTS.map((bp) => (
            <button
              key={bp.id}
              onClick={() => handleLoad(bp)}
              className="rounded-lg border border-white/10 bg-surface-2 p-4 text-left transition-colors hover:border-accent/60"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-100">{bp.name}</span>
                {bp.category && (
                  <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent">
                    {bp.category}
                  </span>
                )}
              </div>
              <div className="text-[11px] leading-relaxed text-gray-500">
                {bp.description}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-gray-600">
          Loading a blueprint replaces the current canvas.
        </p>
      </div>
    </div>
  )
}
