"use client"

import { useState, useCallback } from "react"
import {
  FileText,
  Upload,
  Clock,
  Sparkles,
  ArrowRight,
  Baby,
  School,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LessonData, TargetAgeBand } from "@/lib/types"

interface SetupScreenProps {
  onStart: (data: LessonData) => void
}

const targetAgeOptions: {
  value: TargetAgeBand
  label: string
  icon: typeof Baby
}[] = [
  {
    value: "preschool",
    label: "Preschool (Ages 3–5)",
    icon: Baby,
  },
  {
    value: "kindergarten",
    label: "Kindergarten (Ages 5–6)",
    icon: School,
  },
  {
    value: "primary",
    label: "Primary (Ages 7–10)",
    icon: BookOpen,
  },
]

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [lessonPrompt, setLessonPrompt] = useState("")
  const [duration, setDuration] = useState([30])
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [targetAge, setTargetAge] = useState<TargetAgeBand | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === "application/pdf") {
      setUploadedFile(files[0].name)
    }
  }, [])

  const handleStart = () => {
    if (!targetAge) return
    onStart({
      lessonPrompt,
      uploadedFile,
      uploadedFileUrl: null,
      duration: duration[0],
      targetAge,
    })
  }

  const hasSource = lessonPrompt.trim().length > 0 || uploadedFile !== null
  const isValid = hasSource && targetAge !== null

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-xl border-border bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Create Your Lesson
            </h1>
            <p className="text-xs text-muted-foreground">
              Describe your concept and let AI do the rest
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">Target Age</Label>
              <p className="text-[11px] text-muted-foreground">
                Who is this lesson for? (Required — we tailor vocabulary automatically.)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {targetAgeOptions.map((opt) => {
                  const Icon = opt.icon
                  const selected = targetAge === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTargetAge(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-all",
                        selected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-background/50 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-semibold leading-snug">
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Lesson Concept</Label>
              <Textarea
                placeholder="e.g., Explain how the Roman Empire rose and fell"
                value={lessonPrompt}
                onChange={(e) => setLessonPrompt(e.target.value)}
                className="min-h-[80px] resize-none bg-secondary/50 text-sm placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Or Upload Source Material</Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-5 transition-all",
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary/30",
                  uploadedFile && "border-primary/50 bg-primary/5"
                )}
              >
                {uploadedFile ? (
                  <>
                    <FileText className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium">{uploadedFile}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setUploadedFile(null)
                      }}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Drag & drop your PDF here
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Target Duration
                </Label>
                <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                  {duration[0]} sec
                </Badge>
              </div>
              <Slider
                value={duration}
                onValueChange={setDuration}
                min={15}
                max={60}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>15 sec</span>
                <span>45 sec</span>
                <span>60 sec</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={!isValid}
            className={cn(
              "mt-6 h-12 w-full text-sm font-semibold transition-all",
              isValid &&
                "bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            )}
          >
            <span>Start Creating</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
