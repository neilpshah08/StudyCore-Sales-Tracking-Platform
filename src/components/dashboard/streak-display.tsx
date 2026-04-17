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
      <div className="flex items-center gap-2 text-sm text-white/55 glass-card px-4 py-2">
        <span>No active streak — log today to start one!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 glass-card px-4 py-2.5 border-[#F59E0B]/25 shadow-[0_0_24px_rgba(245,158,11,0.15)]">
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
        <span className="text-sm font-semibold text-white">
          <span className="metric-number">{currentStreak}</span> day streak
        </span>
        <span className="text-xs text-white/55">
          Longest: <span className="metric-number">{longestStreak}</span> days
        </span>
      </div>
    </div>
  )
}
