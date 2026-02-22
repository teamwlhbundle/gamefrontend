"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { hardReset } from "@/lib/api";
import { useAdminAuth } from "@/lib/admin-auth-context";

function CreateGameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function GameManagerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function ResultManagerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function HardResetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function generateSixDigit(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generateEightAlphanumeric(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  return s;
}

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const [showHardResetModal, setShowHardResetModal] = useState(false);
  const [hardResetStep, setHardResetStep] = useState<1 | 2>(1);
  const [sixDigit, setSixDigit] = useState("");
  const [eightChar, setEightChar] = useState("");
  const [confirmInput1, setConfirmInput1] = useState("");
  const [confirmInput2, setConfirmInput2] = useState("");
  const [hardResetError, setHardResetError] = useState("");
  const [hardResetLoading, setHardResetLoading] = useState(false);

  const openHardResetModal = useCallback(() => {
    setSixDigit(generateSixDigit());
    setEightChar(generateEightAlphanumeric());
    setHardResetStep(1);
    setConfirmInput1("");
    setConfirmInput2("");
    setHardResetError("");
    setShowHardResetModal(true);
  }, []);

  const closeHardResetModal = useCallback(() => {
    if (hardResetLoading) return;
    setShowHardResetModal(false);
    setHardResetError("");
  }, [hardResetLoading]);

  const onHardResetStep1Continue = useCallback(() => {
    const trimmed = confirmInput1.replace(/\s/g, "");
    if (trimmed !== sixDigit) {
      setHardResetError("Galat number. Neeche diya 6-digit number exactly daalein.");
      return;
    }
    setHardResetError("");
    setConfirmInput2("");
    setHardResetStep(2);
  }, [confirmInput1, sixDigit]);

  const onHardResetConfirm = useCallback(async () => {
    const trimmed = confirmInput2.replace(/\s/g, "");
    if (trimmed !== eightChar) {
      setHardResetError("Galat code. Neeche diya 8-character code exactly daalein.");
      return;
    }
    setHardResetError("");
    setHardResetLoading(true);
    try {
      await hardReset();
      closeHardResetModal();
      setShowHardResetModal(false);
      alert("Hard reset ho gaya. Saari game data delete ho chuki hai.");
      if (typeof window !== "undefined") window.location.href = "/admin/dashboard";
    } catch (e) {
      setHardResetError(e instanceof Error ? e.message : "Hard reset failed");
    } finally {
      setHardResetLoading(false);
    }
  }, [confirmInput2, eightChar, closeHardResetModal]);

  const navItems = [
    { href: "/admin/games/create", label: "Create Game", icon: CreateGameIcon },
    { href: "/admin/game-manager", label: "Game Manager", icon: GameManagerIcon },
  { href: "/admin/results", label: "Result Manager", icon: ResultManagerIcon },
  { href: "/admin/upload-old-results", label: "Upload Old Results", icon: ResultManagerIcon },
  ];

  return (
    <aside
      className={`flex flex-col shrink-0 h-screen bg-slate-800 border-r border-slate-700/80 transition-[width] duration-200 ease-out ${
        collapsed ? "w-[72px]" : "w-56"
      }`}
    >
      <div
        className={`flex items-center h-14 border-b border-slate-700/80 shrink-0 ${
          collapsed ? "justify-center px-0" : "justify-between px-3"
        }`}
      >
        {!collapsed && (
          <span className="text-sm font-semibold text-white truncate">Admin</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronIcon collapsed={collapsed} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-600/80 text-white"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={openHardResetModal}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-900/30 hover:text-red-200 transition-colors w-full"
        >
          <HardResetIcon className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Hard Reset</span>}
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors w-full mt-2"
        >
          <LogoutIcon className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Logout</span>}
        </button>
      </nav>

      {showHardResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={closeHardResetModal}>
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-1">Hard Reset</h3>
            <p className="text-slate-400 text-sm mb-4">
              Saari game data (past + future) permanent delete ho jayegi. Dobar confirmation deni hogi.
            </p>
            {hardResetStep === 1 ? (
              <>
                <p className="text-slate-300 text-sm mb-2">Step 1: Neeche diya 6-digit number type karein:</p>
                <p className="text-2xl font-mono font-bold text-amber-400 mb-3 tracking-widest">{sixDigit}</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmInput1}
                  onChange={(e) => setConfirmInput1(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit number"
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={onHardResetStep1Continue}
                    className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={closeHardResetModal}
                    className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-sm mb-2">Step 2: Neeche diya 8-character code exactly type karein:</p>
                <p className="text-xl font-mono font-bold text-amber-400 mb-3 tracking-wider break-all">{eightChar}</p>
                <input
                  type="text"
                  maxLength={8}
                  value={confirmInput2}
                  onChange={(e) => setConfirmInput2(e.target.value.slice(0, 8))}
                  placeholder="8-character code"
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={onHardResetConfirm}
                    disabled={hardResetLoading}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium"
                  >
                    {hardResetLoading ? "Resetting…" : "Confirm Hard Reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHardResetStep(1); setConfirmInput2(""); setHardResetError(""); }}
                    disabled={hardResetLoading}
                    className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
            {hardResetError && (
              <p className="mt-3 text-sm text-red-400">{hardResetError}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
