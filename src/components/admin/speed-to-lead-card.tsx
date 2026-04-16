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
      iconClass: "text-gray-400",
      textClass: "text-gray-500",
      label: "No data",
    }
  }
  if (avgMinutes < 5) {
    return {
      icon: CheckCircle2,
      iconClass: "text-green-600",
      textClass: "text-green-600",
      label: `${avgMinutes.toFixed(1)} min`,
    }
  }
  if (avgMinutes <= 10) {
    return {
      icon: AlertTriangle,
      iconClass: "text-yellow-500",
      textClass: "text-yellow-600",
      label: `${avgMinutes.toFixed(1)} min`,
    }
  }
  return {
    icon: AlertOctagon,
    iconClass: "text-red-600",
    textClass: "text-red-600",
    label: `${avgMinutes.toFixed(1)} min`,
  }
}

export function SpeedToLeadCard({ setters }: SpeedToLeadCardProps) {
  const hasAlerts = setters.some(
    (s) => s.avgMinutes !== null && s.avgMinutes > 5
  )

  return (
    <Card className={cn(hasAlerts && "border-yellow-300 bg-yellow-50/50")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5" />
          Speed to Lead - Today
          {hasAlerts && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {setters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No setter data for today.</p>
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
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isWarning && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isWarning ? "text-red-600" : "text-foreground"
                      )}
                    >
                      {setter.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", status.textClass)}>
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
