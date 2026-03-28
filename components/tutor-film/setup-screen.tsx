"use client"

import { useState, useCallback } from "react"
import {
  FileText,
  Upload,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LessonData } from "@/lib/types"

interface SetupScreenProps {
  onStart: (data: LessonData) => void
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [lessonPrompt, setLessonPrompt] = useState("")
  const [duration, setDuration] = useState([3])
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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
    onStart({
      lessonPrompt,
      uploadedFile,
      uploadedFileUrl: null,
      duration: duration[0],
    })
  }

  const isValid = lessonPrompt.trim().length > 0 || uploadedFile !== null

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
            {/* Lesson Concept */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Lesson Concept</Label>
              <Textarea
                placeholder="e.g., Explain the Roman Empire to a 7-year-old..."
                value={lessonPrompt}
                onChange={(e) => setLessonPrompt(e.target.value)}
                className="min-h-[80px] resize-none bg-secondary/50 text-sm placeholder:text-muted-foreground/60"
              />
            </div>

            {/* PDF Upload */}
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

            {/* Duration Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Target Duration
                </Label>
                <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                  {duration[0]} min
                </Badge>
              </div>
              <Slider
                value={duration}
                onValueChange={setDuration}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1 min</span>
                <span>5 min</span>
                <span>10 min</span>
              </div>
            </div>
          </div>

          {/* Start Button - Fixed at bottom */}
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
