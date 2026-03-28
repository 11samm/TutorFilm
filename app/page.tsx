"use client"

import { useState, useEffect, useCallback } from "react"
import { Navbar } from "@/components/tutor-film/navbar"
import { LeftPane, type LessonData } from "@/components/tutor-film/left-pane"
import { RightPane } from "@/components/tutor-film/right-pane"
import { SetupScreen } from "@/components/tutor-film/setup-screen"

const TOTAL_GENERATION_STEPS = 6

export default function TutorFilmApp() {
  const [hasStarted, setHasStarted] = useState(false)
  const [projectTitle, setProjectTitle] = useState("The Roman Empire - Ages 5-8")
  const [lessonData, setLessonData] = useState<LessonData>({
    lessonPrompt: "",
    uploadedFile: null,
    duration: 3,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const handleStart = useCallback((data: LessonData) => {
    setLessonData(data)
    setHasStarted(true)
  }, [])

  const handleGenerate = useCallback(() => {
    setIsGenerating(true)
    setIsComplete(false)
    setGenerationStep(0)
  }, [])

  useEffect(() => {
    if (!isGenerating) return

    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        const next = prev + 1
        if (next >= TOTAL_GENERATION_STEPS) {
          setIsGenerating(false)
          setIsComplete(true)
          return prev
        }
        return next
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isGenerating])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Navbar
        projectTitle={projectTitle}
        onProjectTitleChange={setProjectTitle}
        hasStarted={hasStarted}
      />

      {!hasStarted ? (
        <SetupScreen onStart={handleStart} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Pane - User's Desk (40% width) */}
          <div className="w-[40%] min-w-[360px]">
            <LeftPane
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              lessonData={lessonData}
            />
          </div>

          {/* Right Pane - AI's Canvas (60% width) */}
          <div className="w-[60%] flex-1">
            <RightPane
              isGenerating={isGenerating}
              generationStep={generationStep}
              isComplete={isComplete}
            />
          </div>
        </div>
      )}
    </div>
  )
}
