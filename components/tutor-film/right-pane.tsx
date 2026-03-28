"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { getLessonProgressFraction, useTutorFilmStore } from "@/lib/store"
import { VOICE_CATALOG } from "@/lib/voice-catalog"
import { maxWordsForScene } from "@/lib/validate-script"

const LESSON_STEPS = [
  "Script",
  "Avatar and Voice",
  "Thumbnails",
  "Animations",
  "Music Score",
  "Final Render",
] as const

function wordCountBadgeClass(wordCount: number, maxWords: number) {
  if (maxWords <= 0) {
    return "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
  }
  if (wordCount > maxWords) {
    return "border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-400"
  }
  if (wordCount <= Math.floor(maxWords * 0.85)) {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
  }
  return "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300"
}

export function RightPane() {
  const [isPlaying, setIsPlaying] = useState(false)
  const project = useTutorFilmStore((s) => s.project)

  const isGenerating =
    project?.status === "scripting" ||
    project?.status === "generating_assets" ||
    project?.status === "generating_videos" ||
    project?.status === "stitching" ||
    project?.status === "composing_music" ||
    project?.status === "muxing"
  const isComplete = project?.status === "complete"

  const masterVideoUrl =
    project?.finalVideoUrl ?? project?.assembledScenesVideoUrl ?? null

  const scenes = project?.scenes ?? []
  const galleryScenes = scenes.filter((s) => s.confirmed)

  /** Thumbnails in Scene Breakdown only after thumbnail stage is approved (left pane). */
  const showApprovedThumbnails =
    project?.stage === "video_approval" || project?.stage === "final"

  const progressFraction = getLessonProgressFraction(project)
  const progressPercent = Math.min(100, Math.round(progressFraction * 100))

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

  const getLessonStepCircleStatus = (index: number) => {
    const n = LESSON_STEPS.length
    const f = progressFraction
    if (f >= 1) return "complete" as const
    if (f >= (index + 1) / n) return "complete" as const
    if (f >= index / n && f < (index + 1) / n) return "active" as const
    return "pending" as const
  }

  const getStatusText = () => {
    if (isComplete) return "Ready for Review"
    if (project?.status === "scripting") return "Writing script..."
    if (project?.status === "generating_assets") return "Generating keyframes..."
    if (project?.status === "generating_videos") return "Animating scenes..."
    if (project?.status === "stitching") return "Assembling lesson video..."
    if (project?.status === "composing_music") return "Composing background music..."
    if (project?.status === "muxing") return "Mixing final export..."
    if (project?.status === "final_preview") return "Preview — confirm on the left"
    if (!galleryScenes.length) return "Awaiting confirmation"
    return "Gallery"
  }

  const getStatusColor = () => {
    if (isComplete) return "bg-emerald-500"
    if (isGenerating) return "bg-primary"
    if (galleryScenes.length) return "bg-emerald-500"
    return "bg-muted-foreground/50"
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-background via-background to-primary/[0.02]">
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {LESSON_STEPS.map((label, index) => {
                const status = getLessonStepCircleStatus(index)
                return (
                  <div key={label} className="flex min-w-0 flex-1 items-center">
                    <div className="group relative flex min-w-0 flex-1 flex-col items-center">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
                          status === "complete" &&
                            "bg-primary text-primary-foreground shadow-sm",
                          status === "active" &&
                            "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse",
                          status === "pending" &&
                            "border border-border/80 bg-muted/40 text-muted-foreground/60"
                        )}
                      >
                        {status === "complete" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : status === "active" ? (
                          <Circle className="h-4 w-4 fill-primary/35 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="mt-1.5 hidden max-w-[4.75rem] truncate text-center text-[8px] font-medium leading-tight text-muted-foreground sm:block">
                        {label}
                      </span>
                      <div className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:hidden">
                        {label}
                      </div>
                    </div>
                    {index < LESSON_STEPS.length - 1 && (
                      <div
                        className={cn(
                          "mx-0.5 h-0.5 min-w-[8px] flex-1 transition-colors",
                          progressFraction >= (index + 1) / LESSON_STEPS.length
                            ? "bg-primary"
                            : "bg-border"
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {progressPercent}%
              </span>
            </div>
          </div>

          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
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
                  {galleryScenes.length} scenes
                </Badge>
              </div>

              {galleryScenes.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Confirm script on the left to add scenes to the gallery.
                </p>
              )}

              <AnimatePresence mode="popLayout">
                {galleryScenes.map((scene) => (
                  <motion.div
                    key={scene.id}
                    layout
                    initial={{ opacity: 0, x: -28, filter: "blur(4px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                      mass: 0.85,
                    }}
                    className="group rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-primary/30 hover:bg-card"
                  >
                  <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-stretch">
                    <div className="relative w-full shrink-0 md:w-[min(100%,320px)] md:max-w-[40%]">
                      <div
                        className={cn(
                          "relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-muted/25 shadow-inner",
                          (scene.status === "thumbnail_generating" ||
                            scene.status === "video_generating") &&
                            "border-primary/25 bg-gradient-to-br from-primary/5 via-muted/40 to-muted/20"
                        )}
                      >
                        {scene.videoUrl ? (
                          <video
                            src={scene.videoUrl}
                            className="h-full w-full object-cover"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : !showApprovedThumbnails ? (
                          <div
                            className="absolute inset-0 rounded-md bg-white/5 animate-pulse"
                            aria-hidden
                          />
                        ) : scene.status === "thumbnail_generating" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                            <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
                            <p className="relative text-center text-xs font-medium tracking-wide text-muted-foreground">
                              Generating Pixar asset...
                            </p>
                          </div>
                        ) : scene.thumbnailUrl ? (
                          <div className="relative h-full w-full">
                            <motion.img
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5 }}
                              src={scene.thumbnailUrl}
                              alt={`Scene ${scene.order} keyframe`}
                              className="relative z-0 h-full w-full object-cover"
                              loading="lazy"
                            />
                            {scene.status === "video_generating" && (
                              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-background/65 p-4 backdrop-blur-[2px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-center text-xs font-medium tracking-wide text-foreground">
                                  Animating with Veo...
                                </p>
                              </div>
                            )}
                          </div>
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
                            className="gap-1 border border-border/60 bg-background/80 text-xs font-normal text-muted-foreground"
                          >
                            <Clock className="h-3 w-3" />
                            {scene.durationSeconds ?? 8}s
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "gap-1 border text-xs font-normal",
                              wordCountBadgeClass(
                                scene.wordCount,
                                maxWordsForScene(scene.durationSeconds ?? 8)
                              )
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
                </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="render" className="mt-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto p-6">
            <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-background to-primary/5 shadow-2xl shadow-primary/10">
              {masterVideoUrl ? (
                <video
                  src={masterVideoUrl}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <>
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
                      <span>—</span>
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
                </>
              )}
            </div>

            <div className="flex max-w-xl flex-col items-center gap-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {project?.finalVideoUrl
                  ? "Final export with music (Lyria) when available."
                  : project?.assembledScenesVideoUrl
                    ? "Scene clips combined — Lyria score and final mux will follow."
                    : "Finalize the lesson to assemble scene clips and unlock the player."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
                <span>{galleryScenes.length} Scenes</span>
              </div>

              {masterVideoUrl ? (
                <Button
                  size="lg"
                  className="mt-0 gap-2 bg-primary px-8 shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
                  asChild
                >
                  <a href={masterVideoUrl} download="tutor-film-lesson.mp4">
                    <Download className="h-5 w-5" />
                    Download MP4
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled
                  className="mt-0 gap-2 px-8 opacity-60"
                >
                  <Download className="h-5 w-5" />
                  Download MP4
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
