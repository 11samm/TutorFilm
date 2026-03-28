"use client"

import { Film, Save, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NavbarProps {
  projectTitle: string
  onProjectTitleChange: (title: string) => void
  hasStarted: boolean
}

export function Navbar({ projectTitle, onProjectTitleChange, hasStarted }: NavbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Film className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Tutor Film</span>
        </div>
        {hasStarted && (
          <>
            <div className="mx-4 h-6 w-px bg-border" />
            <Input
              value={projectTitle}
              onChange={(e) => onProjectTitleChange(e.target.value)}
              className="h-8 w-64 border-none bg-secondary/50 text-sm focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Untitled Project"
            />
          </>
        )}
      </div>
      {hasStarted && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      )}
    </header>
  )
}
