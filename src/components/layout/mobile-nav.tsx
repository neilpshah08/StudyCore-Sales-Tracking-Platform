"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, DollarSign, Users, Handshake, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  role: "admin" | "setter" | "closer";
}

const repItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Earnings", href: "/dashboard/earnings", icon: DollarSign },
];

const adminItems = [
  { label: "Home", href: "/admin", icon: LayoutDashboard },
  { label: "Reps", href: "/admin/reps", icon: Users },
  { label: "Deals", href: "/admin/deals", icon: Handshake },
  { label: "Analytics", href: "/admin/analytics/forecast", icon: BarChart3 },
];

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const items = role === "admin" ? adminItems : repItems;

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl border border-white/10 bg-slate-900/75 px-2 py-2 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {items.map((it) => {
          const Icon = it.icon;
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-all",
                active
                  ? "text-white nav-active"
                  : "text-white/55 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
