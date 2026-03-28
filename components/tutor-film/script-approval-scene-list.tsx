"use client"

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  calculateDurationFromWordCount,
  clampNarrationToWordLimit,
  countWords,
  maxWordsForScene,
  narrationWordBadgeTone,
} from "@/lib/validate-script"
import type { Scene } from "@/lib/types"

function SortableSceneCard({
  scene,
  onUpdateScene,
  onRemoveScene,
}: {
  scene: Scene
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void
  onRemoveScene: (sceneId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const durationSeconds = scene.durationSeconds
  const maxWords = maxWordsForScene(durationSeconds)
  const wc = countWords(scene.scriptHtml)
  const tone = narrationWordBadgeTone(wc, maxWords)

  const handleNarration = (value: string) => {
    const wcNext = countWords(value)
    const newDuration = calculateDurationFromWordCount(wcNext)
    const cap = maxWordsForScene(newDuration)
    const clamped = clampNarrationToWordLimit(value, cap)
    onUpdateScene(scene.id, {
      scriptHtml: clamped,
      dialogue: clamped,
      wordCount: countWords(clamped),
      durationSeconds: newDuration,
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/60 bg-background/40 p-2",
        isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-foreground">Scene {scene.order}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground/80 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete scene"
            onClick={() => onRemoveScene(scene.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        Narration
      </label>
      <Textarea
        value={scene.scriptHtml}
        onChange={(e) => handleNarration(e.target.value)}
        className="mb-1 min-h-[48px] resize-y text-xs leading-snug"
        rows={3}
      />
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums",
            tone === "safe" &&
              "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            tone === "warn" &&
              "bg-amber-500/20 text-amber-800 dark:text-amber-300",
            tone === "max" && "bg-destructive/15 text-destructive"
          )}
        >
          {wc} / {maxWords} words
        </span>
        <span className="text-[9px] tabular-nums text-muted-foreground">
          ⏱️ {scene.durationSeconds}s
        </span>
        <span className="text-[9px] text-muted-foreground">(~2.5 words/sec)</span>
      </div>
      <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        Image prompt
      </label>
      <Textarea
        value={scene.thumbnailPrompt}
        onChange={(e) =>
          onUpdateScene(scene.id, { thumbnailPrompt: e.target.value })
        }
        className="min-h-[40px] resize-y text-xs leading-snug"
        rows={2}
      />
    </div>
  )
}

export function ScriptApprovalSceneList({
  scenes,
  updateScene,
  addScene,
  removeScene,
  reorderScenes,
}: {
  scenes: Scene[]
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  addScene: () => void | Promise<void>
  removeScene: (sceneId: string) => void | Promise<void>
  reorderScenes: (sceneIdsInOrder: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sceneIds = scenes.map((s) => s.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sceneIds.indexOf(active.id as string)
    const newIndex = sceneIds.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    reorderScenes(arrayMove(sceneIds, oldIndex, newIndex))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
          {scenes.map((scene) => (
            <SortableSceneCard
              key={scene.id}
              scene={scene}
              onUpdateScene={updateScene}
              onRemoveScene={removeScene}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full gap-1.5 border-dashed text-[10px] font-semibold"
        onClick={addScene}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Scene
      </Button>
    </div>
  )
}
