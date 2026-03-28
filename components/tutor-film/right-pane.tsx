"use client"

import { useState } from "react"
import {
  FileText,
  Play,
  Download,
  Eye,
  MessageSquare,
  Volume2,
  Pause,
  Maximize2,
  CheckCircle2,
  Circle,
  Loader2,
  Palette,
  User,
  Zap,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useTutorFilmStore } from "@/lib/store"
import { VOICE_CATALOG } from "@/lib/voice-catalog"

const generationSteps = [
  { id: 1, label: "Script drafted", description: "AI has written the lesson script" },
  { id: 2, label: "Art style locked", description: "Visual direction confirmed" },
  { id: 3, label: "Character designed", description: "Teacher avatar finalized" },
  { id: 4, label: "Scenes composed", description: "Storyboard complete" },
  { id: 5, label: "Voiceover recorded", description: "Audio generation done" },
  { id: 6, label: "Rendering video", description: "Final video being assembled" },
]

function wordCountBadgeClass(wordCount: number) {
  if (wordCount <= 18) {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
  }
  if (wordCount <= 20) {
    return "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300"
  }
  return "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-400"
}

export function RightPane() {
  const [isPlaying, setIsPlaying] = useState(false)
  const project = useTutorFilmStore((s) => s.project)

  const isGenerating = project?.status === "scripting"
  const generationStep = isGenerating ? 0 : project?.scenes?.length ? 1 : 0
  const isComplete = project?.status === "complete"

  const script = project?.script
  const voiceLabel = script?.voiceCharacterId
    ? VOICE_CATALOG[script.voiceCharacterId]?.label ?? script.voiceCharacterId
    : project?.voiceCharacterId
      ? VOICE_CATALOG[project.voiceCharacterId]?.label ?? project.voiceCharacterId
      : "—"

  const artStyleLabel = script?.artStyle
    ? script.artStyle.replace(/_/g, " ")
    : "—"

  const aiDecisions = [
    { label: "Art Style", value: artStyleLabel, icon: Palette },
    { label: "Teacher", value: project?.avatarType?.replace(/_/g, " ") ?? "—", icon: User },
    { label: "Voice", value: voiceLabel, icon: Volume2 },
    { label: "Pacing", value: "Gentle", icon: Zap },
  ]

  const getStepStatus = (stepIndex: number) => {
    if (isComplete) return "complete"
    if (!isGenerating && !project?.scenes?.length) return "pending"
    if (!isGenerating && project?.scenes?.length) {
      if (stepIndex === 0) return "complete"
      return "pending"
    }
    if (stepIndex < generationStep) return "complete"
    if (stepIndex === generationStep) return "active"
    return "pending"
  }

  const getStatusText = () => {
    if (isComplete) return "Ready for Review"
    if (isGenerating) return "Writing script..."
    if (!project?.scenes?.length) return "Awaiting Input"
    return "Script ready"
  }

  const getStatusColor = () => {
    if (isComplete) return "bg-emerald-500"
    if (isGenerating) return "bg-primary"
    if (project?.scenes?.length) return "bg-emerald-500"
    return "bg-muted-foreground/50"
  }

  const scenes = project?.scenes ?? []

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-primary/[0.02]">
      <div className="flex items-center justify-between border-b border-border bg-card/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                getStatusColor()
              )}
            />
            {isGenerating && (
              <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">AI Director</span>
            <span className="text-sm font-semibold text-foreground">{getStatusText()}</span>
          </div>
        </div>
        {isGenerating && (
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Processing</span>
          </Badge>
        )}
        {isComplete && (
          <Badge className="gap-1.5 bg-emerald-500/10 px-2.5 py-1 text-emerald-500 hover:bg-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs">Complete</span>
          </Badge>
        )}
      </div>

      <div className="border-b border-border bg-card/20 px-5 py-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-1 items-center gap-1">
            {generationSteps.map((step, index) => {
              const status = getStepStatus(index)
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="group relative flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                        status === "complete" && "bg-primary text-primary-foreground",
                        status === "active" &&
                          "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
                        status === "pending" && "bg-secondary text-muted-foreground"
                      )}
                    >
                      {status === "complete" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : status === "active" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {step.label}
                    </div>
                  </div>
                  {index < generationSteps.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 transition-colors",
                        getStepStatus(index) === "complete" ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Progress</span>
            <span className="text-lg font-bold text-primary">
              {isComplete
                ? "100"
                : isGenerating
                  ? Math.round(((generationStep + 1) / generationSteps.length) * 100)
                  : project?.scenes?.length
                    ? Math.min(100, Math.round((1 / generationSteps.length) * 100))
                    : 0}
              %
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {aiDecisions.map((decision) => (
            <div
              key={decision.label}
              className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1.5"
            >
              <decision.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">{decision.label}:</span>
              <span className="max-w-[140px] truncate text-xs font-medium capitalize">
                {decision.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="script" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="h-11 w-full justify-start gap-1 bg-transparent p-0">
            <TabsTrigger
              value="script"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              <FileText className="h-4 w-4" />
              Script & Prompts
            </TabsTrigger>
            <TabsTrigger
              value="render"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              <Play className="h-4 w-4" />
              Final Render
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="script" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Scene Breakdown
                </h3>
                <Badge variant="outline" className="text-xs">
                  {scenes.length} scenes
                </Badge>
              </div>

              {scenes.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Generate a lesson to see scenes here.
                </p>
              )}

              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="group rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-primary/30 hover:bg-card"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-stretch">
                    <div className="relative w-full shrink-0 md:w-[min(100%,320px)] md:max-w-[40%]">
                      <div
                        className={cn(
                          "relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-muted/25 shadow-inner",
                          scene.status === "thumbnail_generating" &&
                            "border-primary/25 bg-gradient-to-br from-primary/5 via-muted/40 to-muted/20"
                        )}
                      >
                        {scene.status === "thumbnail_generating" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                            <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
                            <p className="relative text-center text-xs font-medium tracking-wide text-muted-foreground">
                              Generating Pixar asset...
                            </p>
                          </div>
                        ) : scene.thumbnailUrl ? (
                          <img
                            src={scene.thumbnailUrl}
                            alt={`Scene ${scene.order} keyframe`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full min-h-[7.5rem] flex-col items-center justify-center gap-2 p-4 text-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-[11px] text-muted-foreground">
                              Thumbnail will appear here
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-xs font-semibold text-primary">
                            {scene.order}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Scene {scene.order}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs font-normal"
                          >
                            <Eye className="h-3 w-3" />
                            Visual
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "gap-1 border text-xs font-normal",
                              wordCountBadgeClass(scene.wordCount)
                            )}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {scene.wordCount} words
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/10">
                        <p className="text-xs font-medium text-primary">
                          {scene.visualPrompt}
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {scene.dialogue}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="render" className="mt-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
            <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-background to-primary/5 shadow-2xl shadow-primary/10">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/40"
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="ml-1 h-8 w-8" />
                  )}
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>0:00</span>
                  <span>3:24</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-0 rounded-full bg-primary transition-all" />
                </div>
              </div>

              <button
                type="button"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-background/50 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background/80 hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Duration: 3:24</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                <span>1080p HD</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                <span>{scenes.length} Scenes</span>
              </div>

              <Button
                size="lg"
                className="mt-2 gap-2 bg-primary px-8 shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
              >
                <Download className="h-5 w-5" />
                Download MP4
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
