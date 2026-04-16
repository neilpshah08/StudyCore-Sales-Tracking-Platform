"use client"

import { getStreakFlame } from "@/lib/utils"

interface StreakDisplayProps {
  currentStreak: number
  longestStreak: number
}

export function StreakDisplay({ currentStreak, longestStreak }: StreakDisplayProps) {
  const flame = getStreakFlame(currentStreak)

  if (currentStreak <= 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>No active streak — log today to start one!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={
          currentStreak >= 30
            ? "text-4xl"
            : currentStreak >= 14
              ? "text-3xl"
              : currentStreak >= 7
                ? "text-2xl"
                : "text-xl"
        }
        role="img"
        aria-label="streak flame"
      >
        {flame}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          {currentStreak} day streak
        </span>
        <span className="text-xs text-muted-foreground">
          Longest: {longestStreak} days
        </span>
      </div>
    </div>
  )
}
