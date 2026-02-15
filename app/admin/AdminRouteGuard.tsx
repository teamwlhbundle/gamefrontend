"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { AdminSidebar } from "./AdminSidebar";

const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_DASHBOARD_PATH = "/admin/dashboard";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAdminAuth();

  const isLoginPage = pathname === ADMIN_LOGIN_PATH;

  useEffect(() => {
    if (isLoading) return;

    if (isLoginPage) {
      if (isAuthenticated) {
        router.replace(ADMIN_DASHBOARD_PATH);
      }
      return;
    }

    if (!isAuthenticated) {
      router.replace(ADMIN_LOGIN_PATH);
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
            aria-hidden
          />
          <p className="text-sm text-neutral-600">Checking access…</p>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    if (isAuthenticated) return null;
    return <>{children}</>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100">
      <AdminSidebar />
      <main className="flex-1 min-h-0 overflow-auto flex flex-col">{children}</main>
    </div>
  );
}
