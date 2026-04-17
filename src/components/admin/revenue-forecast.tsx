"use client"

import { cn, formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Calculator, Target, DollarSign } from "lucide-react"

interface Props {
  pipeline: { demosInPipeline: number; offersInPipeline: number }
  historicalRates: { showRate: number; closeRate: number; avgDealSize: number }
  revenueSoFar: number
  monthlyTarget: number
}

export function RevenueForecast({ pipeline, historicalRates, revenueSoFar, monthlyTarget }: Props) {
  const { demosInPipeline } = pipeline
  const { showRate, closeRate, avgDealSize } = historicalRates

  const projected = demosInPipeline * showRate * closeRate * avgDealSize
  const totalExpected = revenueSoFar + projected
  const progressPercent = monthlyTarget > 0 ? Math.min((totalExpected / monthlyTarget) * 100, 100) : 0

  const lowCloseRate = Math.max(0, closeRate - 0.05)
  const highCloseRate = closeRate + 0.05
  const lowProjected = demosInPipeline * showRate * lowCloseRate * avgDealSize
  const highProjected = demosInPipeline * showRate * highCloseRate * avgDealSize

  return (
    <div className="space-y-6">
      {/* Main Forecast Card */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#60A5FA]" />
            Projected Revenue (Rest of Month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-[#60A5FA] mb-4">{formatCurrency(projected)}</p>

          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Calculation Breakdown
            </p>
            <p className="text-sm text-white/55">
              <strong>{demosInPipeline}</strong> demos in pipeline
              &times; <strong>{formatPercent(showRate)}</strong> expected show rate
              &times; <strong>{formatPercent(closeRate)}</strong> expected close rate
              &times; <strong>{formatCurrency(avgDealSize)}</strong> avg deal
              = <strong>{formatCurrency(projected)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progress Toward Target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Monthly Target Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Total Expected: <strong>{formatCurrency(totalExpected)}</strong></span>
            <span>Target: <strong>{formatCurrency(monthlyTarget)}</strong></span>
          </div>
          <Progress value={progressPercent} className="h-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[#10B981]/8 rounded-lg p-3">
              <p className="text-xs text-white/55">Revenue So Far</p>
              <p className="text-lg font-bold text-[#10B981]">{formatCurrency(revenueSoFar)}</p>
            </div>
            <div className="bg-[#3B82F6]/8 rounded-lg p-3">
              <p className="text-xs text-white/55">Projected Remaining</p>
              <p className="text-lg font-bold text-[#60A5FA]">{formatCurrency(projected)}</p>
            </div>
            <div className={cn("rounded-lg p-3", totalExpected >= monthlyTarget ? "bg-[#10B981]/8" : "bg-[#F59E0B]/8")}>
              <p className="text-xs text-white/55">Total Expected</p>
              <p className={cn("text-lg font-bold", totalExpected >= monthlyTarget ? "text-[#10B981]" : "text-[#F59E0B]")}>
                {formatCurrency(totalExpected)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Range */}
      <Card>
        <CardHeader><CardTitle>Confidence Range</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-[#EF4444]/8 rounded-lg">
              <p className="text-xs text-white/55 mb-1">Low Estimate</p>
              <p className="text-sm text-white/55">Close rate {formatPercent(lowCloseRate)}</p>
              <p className="text-xl font-bold text-[#EF4444] mt-1">{formatCurrency(revenueSoFar + lowProjected)}</p>
            </div>
            <div className="text-center p-4 bg-[#3B82F6]/8 rounded-lg border-2 border-blue-200">
              <p className="text-xs text-white/55 mb-1">Mid Estimate</p>
              <p className="text-sm text-white/55">Close rate {formatPercent(closeRate)}</p>
              <p className="text-xl font-bold text-[#60A5FA] mt-1">{formatCurrency(totalExpected)}</p>
            </div>
            <div className="text-center p-4 bg-[#10B981]/8 rounded-lg">
              <p className="text-xs text-white/55 mb-1">High Estimate</p>
              <p className="text-sm text-white/55">Close rate {formatPercent(highCloseRate)}</p>
              <p className="text-xl font-bold text-[#10B981] mt-1">{formatCurrency(revenueSoFar + highProjected)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Rates Card */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Trailing 30-Day Averages</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-white/55">Show Rate</p>
              <p className="text-2xl font-bold">{formatPercent(showRate)}</p>
            </div>
            <div>
              <p className="text-sm text-white/55">Close Rate</p>
              <p className="text-2xl font-bold">{formatPercent(closeRate)}</p>
            </div>
            <div>
              <p className="text-sm text-white/55">Avg Deal Size</p>
              <p className="text-2xl font-bold">{formatCurrency(avgDealSize)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
