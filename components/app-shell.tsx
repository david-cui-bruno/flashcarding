"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library,
  Plus,
  Inbox,
  BarChart3,
  Settings,
  LogOut,
  MoreVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(auth)/actions";

// Study (incl. the per-deck gate) and Review are distraction-free "focus" tasks:
// minimal rail + close, no sidebar/tab bar.
function isFocusRoute(pathname: string): boolean {
  return pathname.startsWith("/study") || pathname.startsWith("/review");
}

export function AppShell({
  children,
  username,
  triageCount,
}: {
  children: ReactNode;
  username: string;
  triageCount: number;
}) {
  const pathname = usePathname();
  if (isFocusRoute(pathname)) {
    return <FocusChrome>{children}</FocusChrome>;
  }
  return (
    <HubChrome username={username} triageCount={triageCount}>
      {children}
    </HubChrome>
  );
}

/* ------------------------------- Hub chrome ------------------------------- */

function HubChrome({
  children,
  username,
  triageCount,
}: {
  children: ReactNode;
  username: string;
  triageCount: number;
}) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <Sidebar username={username} triageCount={triageCount} />
      <main className="flex-1 pb-24 md:h-screen md:overflow-y-auto md:pb-0">
        {children}
      </main>
      <MobileTabBar username={username} />
    </div>
  );
}

function Sidebar({ username, triageCount }: { username: string; triageCount: number }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-62 flex-none flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
      <Link href="/library" className="flex items-center gap-2 px-2 pb-5 pt-2">
        <Logo />
        <span className="text-lg font-medium tracking-tight">Dory</span>
      </Link>

      <nav className="flex flex-col gap-1">
        <NavRow href="/library" icon={<Library className="size-[18px]" />} matchPrefixes={["/library", "/collections"]}>
          Decks
        </NavRow>
      </nav>

      <Button asChild className="mt-4 w-full">
        <Link href="/new">
          <Plus className="size-[17px]" />
          New deck
        </Link>
      </Button>

      {triageCount > 0 && (
        <div className="mt-6 px-1">
          <div className="px-1 pb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            To triage
          </div>
          <Link
            href="/review"
            className="flex items-center gap-2.5 rounded-md bg-accent px-2.5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/70"
          >
            <Inbox className="size-[18px]" />
            <span className="flex-1">Review</span>
            <Badge variant="secondary" className="tabular-nums">
              {triageCount}
            </Badge>
          </Link>
        </div>
      )}

      <div className="flex-1" />

      <ProfileMenu username={username} side="right" align="end">
        <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
          <Avatar username={username} />
          <span className="flex-1 leading-tight">
            <span className="block text-sm font-medium text-foreground">{username}</span>
            <span className="block text-[0.72rem] text-muted-foreground">Metrics &amp; Settings</span>
          </span>
          <MoreVertical className="size-4 text-muted-foreground" />
        </button>
      </ProfileMenu>
    </aside>
  );
}

function NavRow({
  href,
  icon,
  children,
  matchPrefixes,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  matchPrefixes?: string[];
}) {
  const pathname = usePathname();
  const prefixes = matchPrefixes ?? [href];
  const active = prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-semibold text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function MobileTabBar({ username }: { username: string }) {
  const pathname = usePathname();
  const decksActive = pathname === "/library" || pathname.startsWith("/collections");
  const newActive = pathname.startsWith("/new");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/90 px-2 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md md:hidden">
      <Link href="/library" className={cn("flex flex-1 flex-col items-center gap-1 py-0.5 text-[0.66rem] font-medium", decksActive ? "text-primary" : "text-muted-foreground")}>
        <Library className="size-[22px]" />
        Decks
      </Link>
      <Link href="/new" className={cn("flex flex-1 flex-col items-center gap-1 py-0.5 text-[0.66rem] font-medium", newActive ? "text-primary" : "text-muted-foreground")}>
        <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
          <Plus className="size-[18px]" strokeWidth={2.2} />
        </span>
        New
      </Link>
      <ProfileMenu username={username} side="top" align="end">
        <button className="flex flex-1 flex-col items-center gap-1 py-0.5 text-[0.66rem] font-medium text-muted-foreground">
          <Avatar username={username} className="size-[26px] text-[0.74rem]" />
          Profile
        </button>
      </ProfileMenu>
    </nav>
  );
}

function ProfileMenu({
  username,
  children,
  side,
  align,
}: {
  username: string;
  children: ReactNode;
  side: "top" | "right";
  align: "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-52">
        <div className="px-2 py-1.5 text-sm font-medium">{username}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/metrics">
            <BarChart3 className="size-4" />
            Metrics
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ username, className }: { username: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-accent text-[0.8rem] font-semibold text-accent-foreground",
        className,
      )}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

/* ------------------------------ Focus chrome ------------------------------ */

function FocusChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-[60px] flex-none flex-col items-center border-r border-border bg-card py-5 md:flex">
        <Logo size={24} className="mb-auto" />
        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Close">
          <Link href="/library">
            <X className="size-5" />
          </Link>
        </Button>
      </aside>
      <main className="relative flex flex-1 flex-col overflow-y-auto">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10 rounded-full md:hidden"
          aria-label="Close"
        >
          <Link href="/library">
            <X className="size-5" />
          </Link>
        </Button>
        {children}
      </main>
    </div>
  );
}
