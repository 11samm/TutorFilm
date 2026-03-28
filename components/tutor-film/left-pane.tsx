"use client"

import {
  User,
  ImageIcon,
  Video,
  Check,
  Volume2,
  Sparkles,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useTutorFilmStore } from "@/lib/store"
import { VOICE_CATALOG } from "@/lib/voice-catalog"
type AvatarChoice = "male" | "female" | "custom"

const voiceChoices = [
  { id: "woodland_gnome_scholar" as const, label: "Warm & Friendly" },
  { id: "sun_sprite_enthusiast" as const, label: "Energetic & Fun" },
  { id: "ocean_mermaid_sage" as const, label: "Calm & Serious" },
]

export function LeftPane() {
  const lessonData = useTutorFilmStore((s) => s.lessonData)
  const avatarType = useTutorFilmStore((s) => s.avatarType)
  const setAvatarType = useTutorFilmStore((s) => s.setAvatarType)
  const voiceCharacterId = useTutorFilmStore((s) => s.voiceCharacterId)
  const setVoiceCharacterId = useTutorFilmStore((s) => s.setVoiceCharacterId)
  const project = useTutorFilmStore((s) => s.project)
  const startGeneration = useTutorFilmStore((s) => s.startGeneration)

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-card/30">
      <div className="border-b border-border bg-card/50 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
          Director&apos;s Desk
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose your cast & style
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-5">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cast & Crew
              </h3>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
              <div className="flex items-center gap-3">
                <Video className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {useAnimatedTeacher ? "Animated Teacher" : "Narrated B-Roll"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {useAnimatedTeacher
                      ? "3D avatar presents the lesson"
                      : "Voiceover with stock footage"}
                  </span>
                </div>
              </div>
              <Switch
                checked={useAnimatedTeacher}
                onCheckedChange={(checked) => {
                  if (checked) setAvatarType("default_male")
                  else setAvatarType("none")
                }}
              />
            </div>

            {useAnimatedTeacher && (
              <div className="grid gap-2">
                {avatarOptions.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      if (avatar.id === "male") setAvatarType("default_male")
                      else if (avatar.id === "female") setAvatarType("default_female")
                      else setAvatarType("custom")
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                      selectedAvatar === avatar.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 bg-background/50 hover:border-muted-foreground/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        selectedAvatar === avatar.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <avatar.icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{avatar.label}</span>
                      {avatar.subtitle && (
                        <span className="text-[11px] text-muted-foreground">
                          {avatar.subtitle}
                        </span>
                      )}
                    </div>
                    {selectedAvatar === avatar.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-border/50" />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Voice & Tone
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {voiceChoices.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => setVoiceCharacterId(voice.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    voiceCharacterId === voice.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  )}
                  title={VOICE_CATALOG[voice.id]?.description}
                >
                  {voice.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card/50 p-5">
        <Button
          type="button"
          onClick={() => void startGeneration()}
          disabled={isScripting || !canGenerate}
          className={cn(
            "h-14 w-full gap-2 text-base font-semibold transition-all",
            canGenerate &&
              !isScripting &&
              "bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
          )}
        >
          {isScripting ? (
            <span className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Director is writing...
            </span>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Lesson
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
