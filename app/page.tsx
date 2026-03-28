"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Navbar } from "@/components/tutor-film/navbar"
import { LeftPane } from "@/components/tutor-film/left-pane"
import { RightPane } from "@/components/tutor-film/right-pane"
import { SetupScreen } from "@/components/tutor-film/setup-screen"
import { Button } from "@/components/ui/button"
import { useTutorFilmStore } from "@/lib/store"
import type { LessonData } from "@/lib/types"

export default function TutorFilmApp() {
  const hasStarted = useTutorFilmStore((s) => s.hasStarted)
  const lessonData = useTutorFilmStore((s) => s.lessonData)
  const setLessonData = useTutorFilmStore((s) => s.setLessonData)
  const setHasStarted = useTutorFilmStore((s) => s.setHasStarted)
  const project = useTutorFilmStore((s) => s.project)
  const setProject = useTutorFilmStore((s) => s.setProject)
  const generateScript = useTutorFilmStore((s) => s.generateScript)
  const injectMockProject = useTutorFilmStore((s) => s.injectMockProject)

  const scriptGenerationKickoff = useRef(false)

  const titleFromStore =
    project?.script?.title?.trim() ||
    project?.lessonPrompt?.trim() ||
    "Untitled Project"

  const [projectTitle, setProjectTitle] = useState(titleFromStore)

  useEffect(() => {
    setProjectTitle(titleFromStore)
  }, [titleFromStore])

  useEffect(() => {
    if (!hasStarted || !lessonData || project || scriptGenerationKickoff.current) return
    const hasSource =
      lessonData.lessonPrompt.trim().length > 0 || lessonData.uploadedFile !== null
    if (!hasSource) return
    scriptGenerationKickoff.current = true
    void generateScript()
  }, [hasStarted, lessonData, project, generateScript])

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
          {process.env.NODE_ENV === "development" ? (
            <div className="shrink-0 border-t border-dashed border-amber-500/40 bg-amber-500/[0.06] px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                Dev tools
              </p>
              <p className="mb-2 text-[9px] leading-snug text-muted-foreground">
                Inserts mock project + scenes in Supabase (no /api/generate-* calls). Use to
                preview UI stages without spending credits.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-amber-500/30 bg-background/80 text-[10px]"
                  onClick={() => void injectMockProject("script_approval")}
                >
                  Jump to Script (Mock)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-amber-500/30 bg-background/80 text-[10px]"
                  onClick={() => void injectMockProject("thumbnail_approval")}
                >
                  Jump to Thumbnails (Mock)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-amber-500/30 bg-background/80 text-[10px]"
                  onClick={() => void injectMockProject("video_approval")}
                >
                  Jump to Videos (Mock)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-amber-500/30 bg-background/80 text-[10px]"
                  onClick={() => void injectMockProject("final")}
                >
                  Jump to Final Render (Mock)
                </Button>
              </div>
            </div>
          ) : null}
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
