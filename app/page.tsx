"use client"

import { useCallback, useState } from "react"
import { Navbar } from "@/components/tutor-film/navbar"
import { LeftPane } from "@/components/tutor-film/left-pane"
import { RightPane } from "@/components/tutor-film/right-pane"
import { SetupScreen } from "@/components/tutor-film/setup-screen"
import { useTutorFilmStore } from "@/lib/store"
import type { LessonData } from "@/lib/types"

export default function TutorFilmApp() {
  const hasStarted = useTutorFilmStore((s) => s.hasStarted)
  const setLessonData = useTutorFilmStore((s) => s.setLessonData)
  const setHasStarted = useTutorFilmStore((s) => s.setHasStarted)

  const [projectTitle, setProjectTitle] = useState("The Roman Empire - Ages 5-8")

  const handleStart = useCallback(
    (data: LessonData) => {
      setLessonData(data)
      setHasStarted(true)
    },
    [setLessonData, setHasStarted]
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Navbar
        projectTitle={projectTitle}
        onProjectTitleChange={setProjectTitle}
        hasStarted={hasStarted}
      />

      {!hasStarted ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SetupScreen onStart={handleStart} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 w-[38%] min-w-[280px] max-w-[440px] shrink-0 flex-col border-r border-border/40">
            <LeftPane />
          </div>

          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <RightPane />
          </div>
        </div>
      )}
    </div>
  )
}
