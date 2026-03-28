"use client"

import { useEffect, useState } from "react"
import {
  User,
  ImageIcon,
  Video,
  Check,
  Volume2,
  Sparkles,
  RefreshCw,
  Film,
  Clapperboard,
  Loader2,
  Music,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTutorFilmStore } from "@/lib/store"
import { VOICE_CATALOG } from "@/lib/voice-catalog"
import { ScriptApprovalSceneList } from "@/components/tutor-film/script-approval-scene-list"

type AvatarChoice = "male" | "female" | "custom"

const voiceEntries = Object.entries(VOICE_CATALOG) as [
  keyof typeof VOICE_CATALOG,
  (typeof VOICE_CATALOG)[string],
][]

export function LeftPane() {
  const lessonData = useTutorFilmStore((s) => s.lessonData)
  const avatarType = useTutorFilmStore((s) => s.avatarType)
  const setAvatarType = useTutorFilmStore((s) => s.setAvatarType)
  const voiceCharacterId = useTutorFilmStore((s) => s.voiceCharacterId)
  const setVoiceCharacterId = useTutorFilmStore((s) => s.setVoiceCharacterId)
  const project = useTutorFilmStore((s) => s.project)
  const generateScript = useTutorFilmStore((s) => s.generateScript)
  const confirmStage = useTutorFilmStore((s) => s.confirmStage)
  const updateScene = useTutorFilmStore((s) => s.updateScene)
  const addScene = useTutorFilmStore((s) => s.addScene)
  const removeScene = useTutorFilmStore((s) => s.removeScene)
  const reorderScenes = useTutorFilmStore((s) => s.reorderScenes)
  const regenerateThumbnailForScene = useTutorFilmStore(
    (s) => s.regenerateThumbnailForScene
  )
  const generateVideoForScene = useTutorFilmStore((s) => s.generateVideoForScene)
  const generateMusicForProject = useTutorFilmStore((s) => s.generateMusicForProject)
  const stitchFinalVideoForProject = useTutorFilmStore((s) => s.stitchFinalVideoForProject)

  const useAnimatedTeacher = avatarType !== "none"

  const selectedAvatar: AvatarChoice =
    avatarType === "custom"
      ? "custom"
      : avatarType === "default_female"
        ? "female"
        : "male"

  const avatarOptions = [
    { id: "male" as const, label: "Default Male", icon: User },
    { id: "female" as const, label: "Default Female", icon: User },
    {
      id: "custom" as const,
      label: "Custom Avatar",
      icon: ImageIcon,
      subtitle: "Upload Selfie",
    },
  ]

  const canGenerate =
    !!lessonData &&
    (lessonData.lessonPrompt.trim().length > 0 || lessonData.uploadedFile)

  const isScripting = project?.status === "scripting"
  const isGeneratingAssets = project?.status === "generating_assets"
  const isGeneratingVideos = project?.status === "generating_videos"
  const isStitching = project?.status === "stitching"
  const isComposingMusic = project?.status === "composing_music"
  const isMuxing = project?.status === "muxing"

  const showCastAndVoice =
    !project || (project.stage === "setup" && project.status !== "scripting")

  const scenesOrdered = project
    ? [...project.scenes].sort((a, b) => a.order - b.order)
    : []

  const busyPipeline =
    isGeneratingAssets ||
    isGeneratingVideos ||
    isStitching ||
    isComposingMusic ||
    isMuxing

  const [thumbnailLightboxUrl, setThumbnailLightboxUrl] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (!thumbnailLightboxUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThumbnailLightboxUrl(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [thumbnailLightboxUrl])

  return (
    <>
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/30">
      <div className="shrink-0 border-b border-border bg-card/50 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          Director&apos;s Desk
        </h2>
        <p className="text-[10px] leading-tight text-muted-foreground">
          Draft → approve → gallery
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="flex flex-col gap-3 p-3 pb-2">
          <AnimatePresence mode="popLayout">
            {showCastAndVoice && (
              <motion.section
                key="cast-setup"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-3"
              >
                <section className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground">
                      <User className="h-3 w-3" />
                    </div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cast
                    </h3>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/50 px-2.5 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {useAnimatedTeacher ? "Animated Teacher" : "Narrated B-Roll"}
                        </span>
                      </div>
                    </div>
                    <Switch
                      className="scale-90"
                      checked={useAnimatedTeacher}
                      onCheckedChange={(checked) => {
                        if (checked) setAvatarType("default_male")
                        else setAvatarType("none")
                      }}
                    />
                  </div>

                  {useAnimatedTeacher && (
                    <div className="grid gap-1.5">
                      {avatarOptions.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => {
                            if (avatar.id === "male") setAvatarType("default_male")
                            else if (avatar.id === "female")
                              setAvatarType("default_female")
                            else setAvatarType("custom")
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-all",
                            selectedAvatar === avatar.id
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/50 bg-background/50 hover:border-muted-foreground/30"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                              selectedAvatar === avatar.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            <avatar.icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{avatar.label}</span>
                            {avatar.subtitle && (
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {avatar.subtitle}
                              </span>
                            )}
                          </div>
                          {selectedAvatar === avatar.id && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <div className="h-px bg-border/50" />

                <section className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground">
                      <Volume2 className="h-3 w-3" />
                    </div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Voice
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    {voiceEntries.map(([id, meta]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setVoiceCharacterId(id)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-left text-[10px] font-medium leading-tight transition-all",
                          voiceCharacterId === id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                        )}
                        title={meta.description}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </section>
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isScripting && project && (
              <motion.div
                key="scripting-wait"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-3 py-6"
              >
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <p className="text-center text-xs font-medium text-foreground">
                  Writing your lesson…
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {project?.stage === "script_approval" && !isScripting && (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Script
                </h3>
              </div>
              <ScriptApprovalSceneList
                scenes={scenesOrdered}
                updateScene={updateScene}
                addScene={addScene}
                removeScene={removeScene}
                reorderScenes={reorderScenes}
              />
            </motion.section>
          )}

          {project?.stage === "thumbnail_approval" && (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Thumbnails
                </h3>
              </div>
              {scenesOrdered.map((scene) => (
                <div
                  key={scene.id}
                  className="flex min-h-0 flex-row overflow-hidden rounded-lg border border-border/60 bg-background/40"
                >
                  <div className="min-w-0 flex-[3]">
                    <div className="relative aspect-video w-full bg-muted/30">
                      {scene.status === "thumbnail_generating" ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                          <span className="text-[10px] text-muted-foreground">
                            Generating…
                          </span>
                        </div>
                      ) : scene.thumbnailUrl ? (
                        <button
                          type="button"
                          className="absolute inset-0 flex cursor-zoom-in items-center justify-center overflow-hidden bg-muted/20 p-0"
                          onClick={() => setThumbnailLightboxUrl(scene.thumbnailUrl)}
                          aria-label="Open thumbnail full size"
                        >
                          <img
                            src={scene.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                          No thumbnail
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex min-w-[5.5rem] flex-[1] flex-col justify-center gap-2 border-l border-border/50 px-2.5 py-2 sm:min-w-[6.5rem] sm:px-3">
                    <p className="text-xs font-semibold leading-tight text-foreground">
                      Scene {scene.order}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full shrink-0 gap-1 px-2 text-[10px] sm:w-auto sm:self-start"
                      disabled={
                        scene.status === "thumbnail_generating" || busyPipeline
                      }
                      onClick={() => void regenerateThumbnailForScene(scene.id)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Redo
                    </Button>
                  </div>
                </div>
              ))}
            </motion.section>
          )}

          {project?.stage === "video_approval" && (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Videos
                </h3>
              </div>
              {scenesOrdered.map((scene) =>
                scene.status === "error" ? (
                  <div
                    key={scene.id}
                    className="overflow-hidden rounded-lg border-2 border-destructive/60 bg-destructive/5"
                  >
                    <div className="flex flex-col gap-2 px-3 py-3 sm:py-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Scene {scene.order}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-destructive">
                        Generation Failed
                      </p>
                      <p className="text-[10px] leading-snug text-muted-foreground">
                        Video generation did not complete. Check your connection and API
                        limits, then retry.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={
                          !scene.thumbnailUrl ||
                          busyPipeline
                        }
                        onClick={() => void generateVideoForScene(scene.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={scene.id}
                    className="overflow-hidden rounded-lg border border-border/60 bg-background/40"
                  >
                    <div className="relative h-28 w-full bg-black/80 sm:h-32">
                      {scene.status === "video_generating" ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                          <span className="text-[10px] text-muted-foreground">
                            Animating…
                          </span>
                        </div>
                      ) : scene.videoUrl ? (
                        <video
                          src={scene.videoUrl}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                          No video
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 py-1">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Scene {scene.order}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[10px]"
                        disabled={
                          !scene.thumbnailUrl ||
                          scene.status === "video_generating" ||
                          busyPipeline
                        }
                        onClick={() => void generateVideoForScene(scene.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Redo
                      </Button>
                    </div>
                  </div>
                )
              )}
            </motion.section>
          )}

          {project?.stage === "final" && project.status === "stitching" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-4 text-center"
            >
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-foreground">
                Assembling lesson video…
              </p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Scene clips are concatenated in order. Background music runs in parallel; then
                the final export is mixed on the server.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-amber-500/20 bg-background/60 px-2 py-1.5 text-[10px] text-muted-foreground">
                <Music className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-left leading-snug">
                  <span className="font-medium text-foreground">Background music</span>
                  {project.musicUrl ? (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="ml-1.5 inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating…
                    </span>
                  )}
                </span>
              </div>
            </motion.div>
          )}

          {project?.stage === "final" &&
            project.status === "composing_music" &&
            project.assembledScenesVideoUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-3"
              >
                <p className="text-center text-xs font-semibold text-foreground">
                  Scene assembly ready — composing music…
                </p>
                <video
                  src={project.assembledScenesVideoUrl}
                  className="aspect-video w-full rounded-md border border-border bg-black/40 object-contain"
                  controls
                  playsInline
                />
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                  Lyria background track
                </div>
              </motion.div>
            )}

          {project?.stage === "final" &&
            project.assembledScenesVideoUrl &&
            project.musicUrl &&
            !project.finalVideoUrl &&
            (project.status === "final_preview" || project.status === "muxing") && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-3"
              >
                <p className="text-center text-xs font-semibold text-foreground">
                  Preview — video &amp; music bed
                </p>
                <p className="text-center text-[10px] leading-snug text-muted-foreground">
                  Watch and listen below. When you are happy with the track, confirm to mix the
                  final export (dialogue + ducked music).
                </p>
                <video
                  src={project.assembledScenesVideoUrl}
                  className="aspect-video w-full rounded-md border border-border bg-black/40 object-contain"
                  controls
                  playsInline
                />
                <div className="rounded-md border border-border/60 bg-card/80 px-2 py-1.5">
                  <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                    Background music
                  </p>
                  <audio
                    src={project.musicUrl}
                    controls
                    className="h-8 w-full"
                  />
                </div>
                {project.status === "muxing" ? (
                  <p className="flex items-center justify-center gap-2 text-center text-[10px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Mixing final export (music ducked under dialogue)…
                  </p>
                ) : null}
                {project.status === "final_preview" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 w-full text-[10px] font-semibold"
                    onClick={() => void stitchFinalVideoForProject()}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Confirm &amp; export final video
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-[10px]"
                  disabled={project.status === "muxing"}
                  onClick={() => void generateMusicForProject()}
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Regenerate music
                </Button>
              </motion.div>
            )}

          {project?.stage === "final" && project.status === "complete" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-4 text-center"
            >
              <Check className="mx-auto mb-1.5 h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-semibold text-foreground">
                Lesson finalized
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Final video with background music is ready.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                See the gallery on the right — Final Render tab to play or download.
              </p>
              {project.finalVideoUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 w-full text-[10px]"
                  onClick={() => void generateMusicForProject()}
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Regenerate music
                </Button>
              ) : null}
            </motion.div>
          )}

          {project?.stage === "final" && project.status === "error" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-center"
            >
              <p className="text-xs font-semibold text-destructive">
                Assembly failed
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Could not combine scene videos. Check the server logs and try again.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/50 p-2.5">
        {isScripting && project ? (
          <Button
            type="button"
            disabled
            className="h-9 w-full gap-1.5 text-xs font-semibold"
          >
            <span className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Writing…
            </span>
          </Button>
        ) : null}

        {!isScripting && !project ? (
          <Button
            type="button"
            onClick={() => void generateScript()}
            disabled={!canGenerate}
            className={cn(
              "h-9 w-full gap-1.5 text-xs font-semibold",
              canGenerate &&
                "bg-primary shadow-md shadow-primary/20 hover:bg-primary/90"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Lesson
          </Button>
        ) : null}

        {!isScripting && project?.stage === "script_approval" ? (
          <Button
            type="button"
            onClick={() => void confirmStage()}
            disabled={busyPipeline || scenesOrdered.length === 0}
            className="h-9 w-full gap-1.5 text-xs font-semibold"
          >
            {isGeneratingAssets ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Images…
              </>
            ) : (
              <>
                <ImageIcon className="h-3.5 w-3.5" />
                Confirm &amp; generate images
              </>
            )}
          </Button>
        ) : null}

        {!isScripting && project?.stage === "thumbnail_approval" ? (
          <Button
            type="button"
            onClick={() => void confirmStage()}
            disabled={
              busyPipeline ||
              scenesOrdered.some(
                (s) => s.status === "thumbnail_generating" || !s.thumbnailUrl
              )
            }
            className="h-9 w-full gap-1.5 text-xs font-semibold"
          >
            <Film className="h-3.5 w-3.5" />
            Confirm &amp; animate videos
          </Button>
        ) : null}

        {!isScripting && project?.stage === "video_approval" ? (
          <Button
            type="button"
            onClick={() => void confirmStage()}
            disabled={
              busyPipeline ||
              isGeneratingVideos ||
              isStitching ||
              isComposingMusic ||
              isMuxing ||
              scenesOrdered.some(
                (s) => s.status === "video_generating" || !s.videoUrl
              )
            }
            className="h-9 w-full gap-1.5 text-xs font-semibold"
          >
            {isGeneratingVideos ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Videos…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Finalize lesson
              </>
            )}
          </Button>
        ) : null}

        {!isScripting &&
        project?.stage === "final" &&
        (project.status === "stitching" ||
          project.status === "composing_music" ||
          project.status === "muxing" ||
          project.status === "final_preview") ? (
          <Button
            type="button"
            disabled={project.status !== "final_preview"}
            className={cn(
              "h-9 w-full gap-1.5 text-xs font-semibold",
              project.status === "final_preview" && "opacity-90"
            )}
            onClick={
              project.status === "final_preview"
                ? () => void stitchFinalVideoForProject()
                : undefined
            }
          >
            {project.status === "muxing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Mixing final video…
              </>
            ) : project.status === "composing_music" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Composing music…
              </>
            ) : project.status === "stitching" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Assembling video…
              </>
            ) : project.status === "final_preview" ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Confirm final export
              </>
            ) : null}
          </Button>
        ) : null}
      </div>
    </div>

    <AnimatePresence>
      {thumbnailLightboxUrl ? (
        <motion.div
          key="thumbnail-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Thumbnail preview"
          onClick={() => setThumbnailLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-[101] rounded-full bg-background/95 p-2 shadow-md ring-1 ring-border hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              setThumbnailLightboxUrl(null)
            }}
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="flex max-h-[90vh] max-w-full items-center justify-center px-10 pt-10"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={thumbnailLightboxUrl}
              alt=""
              className="max-h-[90vh] max-w-full object-contain"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </>
  )
}
