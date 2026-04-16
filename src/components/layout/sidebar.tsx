"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Handshake,
  Percent,
  PhoneCall,
  Package,
  RotateCcw,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  TrendingDown,
  GitCompareArrows,
  TrendingUp,
  Sliders,
  FileText,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
}

interface SidebarProps {
  user: {
    id: string;
    full_name: string;
    role: "admin" | "setter" | "closer";
    email: string;
  };
}

const repNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Earnings", href: "/dashboard/earnings", icon: DollarSign },
];

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Reps", href: "/admin/reps", icon: Users },
  { label: "Deals", href: "/admin/deals", icon: Handshake },
  { label: "Commissions", href: "/admin/commissions", icon: Percent },
  { label: "Call QA", href: "/admin/qa", icon: PhoneCall },
  { label: "Fulfillment", href: "/admin/fulfillment", icon: Package },
  { label: "Refunds", href: "/admin/refunds", icon: RotateCcw },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    children: [
      {
        label: "Lost Deals",
        href: "/admin/analytics/lost-deals",
        icon: TrendingDown,
      },
      {
        label: "Compare",
        href: "/admin/analytics/compare",
        icon: GitCompareArrows,
      },
      {
        label: "Forecast",
        href: "/admin/analytics/forecast",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    children: [
      {
        label: "General",
        href: "/admin/settings/general",
        icon: Sliders,
      },
      {
        label: "Audit Log",
        href: "/admin/settings/audit-log",
        icon: FileText,
      },
    ],
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeVariant(
  role: string
): "default" | "secondary" | "success" | "warning" {
  switch (role) {
    case "admin":
      return "default";
    case "closer":
      return "success";
    case "setter":
      return "warning";
    default:
      return "secondary";
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const navItems =
    user.role === "admin" ? adminNavItems : repNavItems;

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#1B2A4A]">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-6">
        <Link
          href={user.role === "admin" ? "/admin" : "/dashboard"}
          className="text-xl font-bold text-white"
        >
          StudyCore
        </Link>
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="text-white/70 hover:text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedSections[item.label];
          const childActive = hasChildren
            ? item.children!.some((child) => isActive(child.href))
            : false;

          return (
            <div key={item.label}>
              {hasChildren ? (
                <button
                  onClick={() => toggleSection(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active || childActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )}

              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const childIsActive = isActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          childIsActive
                            ? "bg-white/15 text-white"
                            : "text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <ChildIcon className="h-4 w-4" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-white/20 text-sm text-white">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-white">
              {user.full_name}
            </p>
            <Badge
              variant={getRoleBadgeVariant(user.role)}
              className="mt-0.5 text-[10px] capitalize"
            >
              {user.role}
            </Badge>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-[#1B2A4A] p-2 text-white shadow-lg lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
