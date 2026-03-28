"use client"

import { useCallback, useEffect, useState } from "react"
import { Navbar } from "@/components/tutor-film/navbar"
import { LeftPane } from "@/components/tutor-film/left-pane"
import { RightPane } from "@/components/tutor-film/right-pane"
import { SetupScreen } from "@/components/tutor-film/setup-screen"
import { useTutorFilmStore } from "@/lib/store"
import type { LessonData } from "@/lib/types"

export default function TutorFilmApp() {
  const hasStarted = useTutorFilmStore((s) => s.hasStarted)
  const lessonData = useTutorFilmStore((s) => s.lessonData)
  const setLessonData = useTutorFilmStore((s) => s.setLessonData)
  const setHasStarted = useTutorFilmStore((s) => s.setHasStarted)
  const project = useTutorFilmStore((s) => s.project)
  const setProject = useTutorFilmStore((s) => s.setProject)

  const titleFromStore =
    project?.script?.title?.trim() ||
    project?.lessonPrompt?.trim() ||
    lessonData?.lessonPrompt?.trim() ||
    "Untitled Project"

  const [projectTitle, setProjectTitle] = useState(titleFromStore)

  useEffect(() => {
    setProjectTitle(titleFromStore)
  }, [titleFromStore])

  const handleProjectTitleChange = useCallback(
    (title: string) => {
      setProjectTitle(title)
      if (!project?.script) return
      setProject({
        ...project,
        script: { ...project.script, title },
      })
    },
    [project, setProject]
  )

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
        onProjectTitleChange={handleProjectTitleChange}
        hasStarted={hasStarted}
      />

      {!hasStarted ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <SetupScreen onStart={handleStart} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 w-[40%] min-w-[280px] shrink-0 flex-col border-r border-border/40">
            <LeftPane />
          </div>

          <div className="flex h-full min-h-0 min-w-0 w-[60%] flex-col">
            <RightPane />
          </div>
        </div>
      )}
    </div>
  )
}
