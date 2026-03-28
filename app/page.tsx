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
        <SetupScreen onStart={handleStart} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[40%] min-w-[360px]">
            <LeftPane />
          </div>

          <div className="w-[60%] flex-1">
            <RightPane />
          </div>
        </div>
      )}
    </div>
  )
}
