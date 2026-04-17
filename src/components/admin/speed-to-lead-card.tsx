"use client"

import { CheckCircle2, AlertTriangle, AlertOctagon, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SetterSpeedData {
  id: string
  name: string
  avgMinutes: number | null
}

interface SpeedToLeadCardProps {
  setters: SetterSpeedData[]
}

function getStatusInfo(avgMinutes: number | null) {
  if (avgMinutes === null) {
    return {
      icon: Clock,
      iconClass: "text-white/40",
      textClass: "text-white/55",
      label: "No data",
    }
  }
  if (avgMinutes < 5) {
    return {
      icon: CheckCircle2,
      iconClass: "text-[#10B981]",
      textClass: "text-[#6EE7B7]",
      label: `${avgMinutes.toFixed(1)} min`,
    }
  }
  if (avgMinutes <= 10) {
    return {
      icon: AlertTriangle,
      iconClass: "text-[#F59E0B]",
      textClass: "text-[#FCD34D]",
      label: `${avgMinutes.toFixed(1)} min`,
    }
  }
  return {
    icon: AlertOctagon,
    iconClass: "text-[#EF4444]",
    textClass: "text-[#FCA5A5]",
    label: `${avgMinutes.toFixed(1)} min`,
  }
}

export function SpeedToLeadCard({ setters }: SpeedToLeadCardProps) {
  const hasAlerts = setters.some(
    (s) => s.avgMinutes !== null && s.avgMinutes > 5
  )

  return (
    <Card className={cn(hasAlerts && "border-[#F59E0B]/30 shadow-[0_0_24px_rgba(245,158,11,0.12)]")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-[#60A5FA]" />
          Speed to Lead - Today
          {hasAlerts && (
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {setters.length === 0 ? (
          <p className="text-sm text-white/55">No setter data for today.</p>
        ) : (
          <div className="space-y-3">
            {setters.map((setter) => {
              const status = getStatusInfo(setter.avgMinutes)
              const Icon = status.icon
              const isWarning =
                setter.avgMinutes !== null && setter.avgMinutes > 5
              return (
                <div
                  key={setter.id}
                  className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-white/3 transition"
                >
                  <div className="flex items-center gap-2">
                    {isWarning && (
                      <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isWarning ? "text-[#FCA5A5]" : "text-white/85"
                      )}
                    >
                      {setter.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold metric-number", status.textClass)}>
                      {status.label}
                    </span>
                    <Icon className={cn("h-4 w-4", status.iconClass)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
