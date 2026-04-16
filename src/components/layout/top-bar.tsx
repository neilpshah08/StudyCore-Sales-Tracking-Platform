"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Menu, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database";

interface TopBarProps {
  title: string;
  user: {
    id: string;
    full_name: string;
    role: string;
  };
}

export function TopBar({ title, user }: TopBarProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [user.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      {/* Mobile: hamburger placeholder + centered brand */}
      <div className="flex items-center gap-3 lg:hidden">
        {/* Spacer for the fixed hamburger button in the sidebar */}
        <div className="h-9 w-9" />
        <span className="text-lg font-bold text-[#1B2A4A]">StudyCore</span>
      </div>

      {/* Desktop: page title */}
      <div className="hidden lg:block">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right side: notification bell */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "border-b px-4 py-3 last:border-b-0",
                      !notification.read && "bg-blue-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 overflow-hidden">
                        <p
                          className={cn(
                            "truncate text-sm",
                            !notification.read
                              ? "font-medium text-gray-900"
                              : "text-gray-700"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                          {notification.message}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    {!notification.read && (
                      <div className="mt-1 flex justify-end">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
