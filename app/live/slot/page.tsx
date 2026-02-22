"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPublicCurrentResult,
  getPublicNextSlot,
  getPublicPastResults,
  getPublicNow,
  type PublicCurrentResult,
  type PublicNowResponse,
} from "@/lib/api";

const IST = "Asia/Kolkata";
const REEL_COPIES = 32; // long strip for 15+ sec spin (0-9 repeated)
const MIDDLE_START = 160; // middle "window" block index
const SPIN_DURATION_MS = 15000; // animation at least 15 sec
const SPIN_FULL_ROTATIONS = 15; // how many full 0-9 cycles before landing
const STAGGER_MS = 400; // delay before second reel starts (slot feel)

/** Responsive reel digit height: scales with viewport width (mobile → desktop) */
function getDigitHeightPx(width: number): number {
  if (width <= 0) return 56;
  if (width < 380) return Math.max(32, Math.min(40, Math.floor(width * 0.11)));
  if (width < 520) return Math.max(40, Math.min(56, Math.floor(width * 0.12)));
  if (width < 768) return Math.max(56, Math.min(64, Math.floor(width * 0.1)));
  return Math.min(72, Math.max(64, Math.floor(width * 0.08)));
}

/** Today's date in IST as YYYY-MM-DD */
function getTodayISTYYYYMMDD(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

function formatDateDDMMYYYY(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : yyyyMmDd;
}

function formatResultDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatISTFromMs(ms: number | null) {
  if (ms == null) return "";
  return new Date(ms).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function useISTClock() {
  const { data } = useQuery<PublicNowResponse | null>({
    queryKey: ["public", "now-time"],
    queryFn: getPublicNow,
    refetchInterval: 1000,
  });
  if (!data) return "";
  return formatISTFromMs(data.timestamp);
}

function useTodayIST() {
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(
      new Date().toLocaleDateString("en-IN", {
        timeZone: IST,
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
  }, []);
  return date;
}

/** Reel size that scales with viewport for responsive slot machine */
function useSlotReelSize(): number {
  const [digitHeightPx, setDigitHeightPx] = useState(56);
  useEffect(() => {
    const update = () => setDigitHeightPx(getDigitHeightPx(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return digitHeightPx;
}

function useCountdown(
  initialSeconds: number | null,
  toleranceSeconds = 30
): { display: string | null; seconds: number | null; parts: { h: string; m: string; s: string } | null } {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);

  useEffect(() => {
    if (initialSeconds == null) {
      setSeconds(null);
      return;
    }
    setSeconds((prev) => {
      if (prev == null) return initialSeconds;
      const diff = Math.abs(initialSeconds - prev);
      return diff > toleranceSeconds ? initialSeconds : prev;
    });
  }, [initialSeconds, toleranceSeconds]);

  useEffect(() => {
    if (seconds == null) return;
    const id = setInterval(() => {
      setSeconds((prev) => (prev != null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds == null]);

  if (seconds == null || seconds < 0) {
    return { display: null, seconds: null, parts: null };
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const display = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const parts = {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
  return { display, seconds, parts };
}

function formatNextSlotTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/** Single vertical reel: 15+ sec spin then lands on target digit. Stagger per reel. Size scales with digitHeightPx. */
function SlotReel({
  targetDigit,
  reelIndex,
  digitHeightPx,
  spinToken,
}: {
  targetDigit: string;
  reelIndex: 0 | 1;
  digitHeightPx: number;
  /** Increments whenever a new result comes, so reel always spins again even if digit repeats */
  spinToken: number;
}) {
  const digitIndex = /^\d$/.test(targetDigit) ? parseInt(targetDigit, 10) : 0;
  const totalDigits = 10 * REEL_COPIES;
  const finalY = -(MIDDLE_START + digitIndex) * digitHeightPx;

  const [displayY, setDisplayY] = useState(finalY);
  const [useTransition, setUseTransition] = useState(false);

  useEffect(() => {
    const finalYNew = -(MIDDLE_START + digitIndex) * digitHeightPx;
    const startYNew = finalYNew - SPIN_FULL_ROTATIONS * 10 * digitHeightPx;

    setUseTransition(false);
    setDisplayY(startYNew);

    const staggerDelay = 50 + reelIndex * STAGGER_MS;
    const t = setTimeout(() => {
      setUseTransition(true);
      setDisplayY(finalYNew);
    }, staggerDelay);
    return () => clearTimeout(t);
  }, [spinToken, digitIndex, reelIndex, digitHeightPx]);

  const reelWidth = digitHeightPx + Math.max(12, Math.floor(digitHeightPx * 0.35));

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg shrink-0"
      style={{
        width: reelWidth,
        height: digitHeightPx,
        border: `${Math.max(2, Math.floor(digitHeightPx / 18))}px solid #d4a574`,
        boxShadow:
          "inset 0 0 0 2px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(180,140,90,0.5)",
        background: "linear-gradient(180deg, #6dd5ed 0%, #2193b0 40%, #11998e 100%)",
      }}
    >
      <div
        className="absolute left-0 right-0 flex flex-col ease-out"
        style={{
          transform: `translateY(${displayY}px)`,
          top: 0,
          transition: useTransition
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
            : "none",
        }}
      >
        {Array.from({ length: totalDigits }, (_, i) => i % 10).map((d, i) => (
          <div
            key={i}
            className="flex flex-shrink-0 items-center justify-center font-mono font-black tabular-nums text-white"
            style={{
              height: digitHeightPx,
              fontSize: `${Math.max(14, Math.min(28, Math.floor(digitHeightPx * 0.45)))}px`,
              background:
                i >= MIDDLE_START && i < MIDDLE_START + 10
                  ? "linear-gradient(180deg, #7edce8 0%, #2db5a0 50%, #1a8f7a 100%)"
                  : "linear-gradient(180deg, #5bc4d4 0%, #1a9b8f 100%)",
              textShadow:
                i >= MIDDLE_START && i < MIDDLE_START + 10
                  ? "0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(255,255,255,0.3)"
                  : "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 16px rgba(0,0,0,0.25)" }}
      />
    </div>
  );
}

/** Slot machine cabinet: two reels + middle panel, lights, frame. Scales with digitHeightPx. */
function SlotMachineSection({
  result,
  countdownDisplay,
  countdownSeconds,
  digitHeightPx,
}: {
  result: PublicCurrentResult | null | undefined;
  countdownDisplay: string | null;
  countdownSeconds: number | null;
  digitHeightPx: number;
}) {
  const resultNumber = result?.resultNumber ?? "";
  const digit1 = resultNumber.length >= 1 ? resultNumber[0] : "0";
  const digit2 = resultNumber.length >= 2 ? resultNumber[1] : "0";
  const gameName =
    typeof result?.gameName === "string"
      ? result.gameName
      : (result?.gameId as { name?: string })?.name ?? "Lucky Draw";

  /** Slot rukne ke baad number + WIN dikhana; pehle dono "—" */
  const [slotHasStopped, setSlotHasStopped] = useState(false);
  const prevResultRef = useRef<string | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  useEffect(() => {
    if (!resultNumber) {
      setSlotHasStopped(false);
      prevResultRef.current = null;
      return;
    }
    if (resultNumber !== prevResultRef.current) {
      prevResultRef.current = resultNumber;
      setSlotHasStopped(false);
      // Naya result aate hi spinToken increment – dono reels dobara spin karein,
      // chahe digit pehle jaisa hi kyu na ho.
      setSpinToken((t) => t + 1);
      const delay = SPIN_DURATION_MS + STAGGER_MS + 300;
      const t = setTimeout(() => setSlotHasStopped(true), delay);
      return () => clearTimeout(t);
    }
  }, [resultNumber]);

  const [showWinPop, setShowWinPop] = useState(false);
  const prevWinPopRef = useRef<string | null>(null);
  useEffect(() => {
    if (resultNumber && slotHasStopped && resultNumber !== prevWinPopRef.current) {
      prevWinPopRef.current = resultNumber;
      setShowWinPop(true);
      const t = setTimeout(() => setShowWinPop(false), 800);
      return () => clearTimeout(t);
    }
    if (!resultNumber) prevWinPopRef.current = null;
  }, [resultNumber, slotHasStopped]);

  const bulbStyle = (i: number) => {
    const isYellow = i % 3 === 0;
    const isRed = i % 3 === 1;
    const color = isYellow ? "#fbbf24" : isRed ? "#ef4444" : "#22c55e";
    const glow = isYellow ? "rgba(251,191,36,0.8)" : isRed ? "rgba(239,68,68,0.8)" : "rgba(34,197,94,0.8)";
    return { background: color, boxShadow: `0 0 8px ${glow}` };
  };

  const insetPx = Math.max(8, Math.min(18, Math.floor(digitHeightPx * 0.25)));
  /* Content padding must be >= lights band so lights don't overlap content on mobile */
  const lightsBandPx = 24;
  const contentInsetMin = insetPx + lightsBandPx;

  return (
    <div
      className="relative mx-auto w-full max-w-[min(32rem,95vw)] rounded-2xl border-2 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:border-4"
      style={{
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.5), 0 20px 50px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Multicolour lights – thinner on mobile so they don't overlap content */}
      <div
        className="pointer-events-none absolute z-20 overflow-hidden rounded-2xl sm:rounded-3xl"
        style={{ top: insetPx, left: insetPx, right: insetPx, bottom: insetPx }}
      >
        {/* Top */}
        <div
          className="absolute left-0 right-0 top-0 flex justify-center"
          style={{
            gap: "8px",
            padding: 4,
            paddingLeft: 16,
            paddingRight: 16,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={`t-${i}`}
              className="slot-light-blink h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
              style={{ ...bulbStyle(i), animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        {/* Bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-center"
          style={{
            gap: "8px",
            padding: 4,
            paddingLeft: 16,
            paddingRight: 16,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={`b-${i}`}
              className="slot-light-blink h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
              style={{ ...bulbStyle(i + 1), animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        {/* Left */}
        <div
          className="absolute left-0 top-0 flex flex-col items-center"
          style={{
            bottom: 0,
            gap: "8px",
            padding: 4,
            paddingTop: 16,
            paddingBottom: 16,
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 20,
          }}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={`l-${i}`}
              className="slot-light-blink h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
              style={{ ...bulbStyle(i + 2), animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        {/* Right */}
        <div
          className="absolute right-0 top-0 flex flex-col items-center"
          style={{
            bottom: 0,
            gap: "8px",
            padding: 4,
            paddingTop: 16,
            paddingBottom: 16,
            borderTopRightRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={`r-${i}`}
              className="slot-light-blink h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
              style={{ ...bulbStyle(i + 3), animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        {/* Corners – 4 bulbs each; smaller on mobile */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => {
          const pos =
            corner === "tl" ? { top: 0, left: 0 } :
            corner === "tr" ? { top: 0, right: 0 } :
            corner === "bl" ? { bottom: 0, left: 0 } : { bottom: 0, right: 0 };
          const align =
            corner === "tl" ? { justifyContent: "flex-start", alignItems: "flex-start" } :
            corner === "tr" ? { justifyContent: "flex-end", alignItems: "flex-start" } :
            corner === "bl" ? { justifyContent: "flex-start", alignItems: "flex-end" } : { justifyContent: "flex-end", alignItems: "flex-end" };
          const base = corner === "tl" ? 0 : corner === "tr" ? 4 : corner === "bl" ? 8 : 12;
          return (
            <div
              key={corner}
              className="absolute flex flex-wrap"
              style={{ ...pos, ...align, width: 28, height: 28, gap: 4, padding: 2 }}
            >
              {[0, 1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="slot-light-blink h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                  style={{ ...bulbStyle(base + j), animationDelay: `${(base + j) * 0.08}s` }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Content – padding >= lights band so content never under lights */}
      <div
        style={{
          paddingTop: `${Math.max(contentInsetMin, Math.round(Math.min(56, Math.max(16, digitHeightPx * 0.75))))}px`,
          paddingBottom: `${Math.max(contentInsetMin, Math.round(Math.min(56, Math.max(16, digitHeightPx * 0.75))))}px`,
          paddingLeft: `${Math.max(contentInsetMin, Math.round(Math.min(56, Math.max(12, digitHeightPx * 0.65))))}px`,
          paddingRight: `${Math.max(contentInsetMin, Math.round(Math.min(56, Math.max(12, digitHeightPx * 0.65))))}px`,
        }}
      >
        {/* Red strip – top */}
        <div
          className="h-3 w-full rounded-t-2xl sm:h-4"
          style={{
            background: "linear-gradient(180deg, #e53935 0%, #c62828 50%, #b71c1c 100%)",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.3)",
          }}
        />

        {/* Spherical lights + Marquee sign */}
        <div className="flex flex-col items-center px-1 pt-4 pb-3 sm:pt-5 sm:pb-4">
          <div className="mb-2 flex justify-center gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="slot-light-blink h-4 w-4 rounded-full sm:h-5 sm:w-5"
                style={{
                  background: "radial-gradient(circle at 30% 30%, #fff, #f0e6d3)",
                  boxShadow: "0 0 12px rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.3)",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div
            className="w-full rounded-lg border-2 px-2 py-1.5 text-center sm:rounded-xl sm:px-4 sm:py-2.5"
            style={{
              borderColor: "#f5e6c8",
              background: "linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%)",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 sm:text-xs" style={{ textShadow: "0 0 4px rgba(255,0,0,0.5), 1px 1px 0 #fff" }}>
              Welcome
            </p>
            <p className="mt-0.5 text-base font-black uppercase tracking-wide sm:text-xl md:text-2xl" style={{ color: "#1e88e5", textShadow: "2px 2px 0 #fff, -1px -1px 0 #fff, 0 0 8px rgba(30,136,229,0.6)" }}>
              Let&apos;s Play
            </p>
            <p className="mt-1 truncate text-[8px] font-medium uppercase tracking-wider text-amber-200/80 sm:text-[10px]">
              {gameName}
            </p>
          </div>
        </div>

        {/* Teal credit / win display */}
        <div
          className="mb-5 rounded-xl border-2 px-3 py-3 sm:mb-6 sm:py-3.5"
          style={{
            borderColor: "#14b8a6",
            background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(20,184,166,0.3)",
          }}
        >
          <div className="flex justify-center gap-3 sm:gap-4">
            <div
              className="flex flex-1 items-center justify-center rounded-lg py-2 sm:py-2.5"
              style={{ background: "linear-gradient(180deg, #0c1222 0%, #050a12 100%)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}
            >
              <span className="font-mono text-xl font-black tabular-nums text-emerald-400 sm:text-2xl" style={{ textShadow: "0 0 10px rgba(52,211,153,0.6)" }}>
                {slotHasStopped && resultNumber ? resultNumber : "—"}
              </span>
            </div>
            <div
              className={`flex flex-1 items-center justify-center rounded-lg py-2 transition-all sm:py-2.5 ${showWinPop ? "slot-result-win-pop" : ""}`}
              style={{ background: "linear-gradient(180deg, #0c1222 0%, #050a12 100%)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}
            >
              <span className="font-mono text-lg font-black tabular-nums text-emerald-400 sm:text-xl" style={{ textShadow: "0 0 10px rgba(52,211,153,0.6)" }}>
                {slotHasStopped && resultNumber ? "WIN" : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Reels row + side lever */}
        <div className="relative mb-5 flex items-center justify-center gap-3 sm:mb-6 sm:gap-4">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0.5 w-[85%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.7) 20%, rgba(251,191,36,1) 50%, rgba(251,191,36,0.7) 80%, transparent 100%)",
              boxShadow: "0 0 10px 2px rgba(251,191,36,0.5)",
            }}
          />
          <SlotReel
            targetDigit={digit1}
            reelIndex={0}
            digitHeightPx={digitHeightPx}
            spinToken={spinToken}
          />
          <SlotReel
            targetDigit={digit2}
            reelIndex={1}
            digitHeightPx={digitHeightPx}
            spinToken={spinToken}
          />
          <div className="flex flex-col items-center">
            <div
              className="h-8 w-3 rounded-full sm:h-10 sm:w-4"
              style={{
                background: "linear-gradient(90deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 2px 2px 6px rgba(0,0,0,0.4)",
              }}
            />
          <div
            className="-mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white sm:h-7 sm:w-7"
            style={{
              background: "radial-gradient(circle at 30% 30%, #374151, #111827)",
              border: "2px solid #1f2937",
              boxShadow: "0 0 0 2px #fff, 0 4px 8px rgba(0,0,0,0.5)",
            }}
          >
            8
          </div>
          <div
            className="-mt-1 h-6 w-4 sm:h-7 sm:w-5"
            style={{
              background: "linear-gradient(180deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)",
              borderRadius: "0 0 50% 50%",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), 0 4px 8px rgba(0,0,0,0.3)",
            }}
          />
          </div>
        </div>

        {/* Dark brown lower panel – countdown */}
        <div
          className="mb-5 rounded-lg px-4 py-3 sm:mb-6 sm:py-3.5"
          style={{
            background: "linear-gradient(180deg, #78350f 0%, #451a03 50%, #292524 100%)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="flex items-center justify-center rounded py-1.5 sm:py-2"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
              border: "1px solid rgba(0,0,0,0.4)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 sm:text-xs">
              Next draw
            </span>
            <span className="ml-2 font-mono text-sm font-bold tabular-nums text-white sm:text-base">
              {countdownDisplay ?? "—"}
            </span>
          </div>
        </div>

        {/* Coin tray – golden spheres centered; height scales */}
        <div
          className="relative flex min-h-[3rem] items-center justify-center overflow-hidden rounded-b-lg sm:min-h-[4rem] sm:rounded-b-xl"
          style={{
            background: "linear-gradient(180deg, #57534e 0%, #44403c 60%, #292524 100%)",
            boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 20 + (i % 3) * 4,
                  height: 20 + (i % 3) * 4,
                  background: "radial-gradient(circle at 35% 35%, #fde047, #eab308 40%, #ca8a04 100%)",
                  boxShadow: "inset 0 2px 4px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.4)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-page party popper – confetti + ribbons + stars for 5s when slot stops */
function FullPagePartyPopper() {
  const pieces = useMemo(() => {
    const colors = ["#fef08a", "#facc15", "#f59e0b", "#f97316", "#ef4444", "#a78bfa", "#34d399", "#38bdf8"];
    const total = 260;
    return Array.from({ length: total }, (_, i) => {
      const r = Math.random();
      const type: "confetti" | "ribbon" | "star" =
        r < 0.15 ? "star" : r < 0.55 ? "ribbon" : "confetti";
      const baseSize = 4 + Math.random() * 6;
      return {
        id: i,
        type,
        color: colors[i % colors.length],
        left: Math.random() * 100,
        top: -8 + Math.random() * 6,
        delay: Math.random() * 0.6,
        size: baseSize,
        endX: (Math.random() - 0.5) * 90,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {pieces.map((p) => {
        let width = p.size;
        let height = p.size;
        let borderRadius = 2;
        if (p.type === "ribbon") {
          width = p.size * 0.4;
          height = p.size * 4.0;
          borderRadius = 9999;
        } else if (p.type === "star") {
          width = p.size * 3;
          height = p.size * 3;
        }
        const isStar = p.type === "star";
        return (
          <div
            key={p.id}
            className="absolute full-page-confetti-drop flex items-center justify-center"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width,
              height,
              color: isStar ? p.color : undefined,
              backgroundColor: isStar ? "transparent" : p.color,
              borderRadius,
              animationDelay: `${p.delay}s`,
              ["--end-x" as string]: `${p.endX}vw`,
              fontSize: isStar ? `${width}px` : undefined,
            }}
          >
            {isStar ? "★" : null}
          </div>
        );
      })}
    </div>
  );
}

function OrangeBarItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-slate-600/50 bg-slate-800/80 px-1.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 live-card-3d min-h-[48px] sm:min-h-[56px] md:min-h-[64px]"
      style={{
        boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px] md:text-xs text-center">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-white sm:text-sm md:text-base text-center">
        {value}
      </p>
    </div>
  );
}

function DigitalBox({
  value,
  label,
  urgent,
}: {
  value: string;
  label: string;
  urgent: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 px-2 py-1.5 text-center font-mono text-lg font-bold tabular-nums live-card-3d sm:px-3 sm:py-2 sm:text-2xl md:px-4 md:text-3xl ${
        urgent
          ? "border-red-500/70 bg-red-950/50 text-red-400"
          : "border-slate-500/50 bg-slate-800/80 text-slate-200"
      }`}
      style={
        urgent
          ? undefined
          : {
              boxShadow:
                "0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px -5px rgba(59,130,246,0.12)",
            }
      }
    >
      <span className="block">{value}</span>
      <span className="mt-0.5 block text-[8px] font-medium uppercase tracking-wider text-slate-500 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

export default function LiveSlotPage() {
  const istClock = useISTClock();
  const todayIST = useTodayIST();
  const queryClient = useQueryClient();

  const { data: currentResult } = useQuery({
    queryKey: ["public", "current-result"],
    queryFn: getPublicCurrentResult,
    refetchInterval: 1000,
  });

  const { data: nextSlot } = useQuery({
    queryKey: ["public", "next-slot"],
    queryFn: getPublicNextSlot,
    refetchInterval: 1000,
  });

  const lastStableResultRef = useRef<PublicCurrentResult | null>(null);
  if (currentResult?.resultNumber != null && currentResult.resultNumber !== "") {
    lastStableResultRef.current = currentResult;
  }
  const displayResult = currentResult ?? lastStableResultRef.current ?? null;

  const [showNextGameMessage, setShowNextGameMessage] = useState(false);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const prevResultKeyRef = useRef<string | null>(null);

  /** Slot stop delay = spin duration + stagger + buffer (same as SlotMachineSection) */
  const slotStopDelayMs = SPIN_DURATION_MS + STAGGER_MS + 300;

  useEffect(() => {
    const key =
      currentResult?.resultNumber != null && currentResult?.fullDateTime != null
        ? `${currentResult.resultNumber}_${currentResult.fullDateTime}`
        : null;
    if (key == null) return;
    if (prevResultKeyRef.current != null && prevResultKeyRef.current !== key) {
      prevResultKeyRef.current = key;
      /* Sab kuch slot ruk jane ke baad: result, previous draws refetch, next game message, party popper */
      const afterSlotStopped = () => {
        setShowNextGameMessage(true);
        queryClient.invalidateQueries({ queryKey: ["public", "past-results"] });
        setShowPartyPopper(true);
        const t = setTimeout(() => setShowNextGameMessage(false), 10000);
        const tPartyOff = setTimeout(() => setShowPartyPopper(false), 5000);
        return () => {
          clearTimeout(t);
          clearTimeout(tPartyOff);
        };
      };
      const tMain = setTimeout(afterSlotStopped, slotStopDelayMs);
      return () => clearTimeout(tMain);
    }
    prevResultKeyRef.current = key;
  }, [currentResult?.resultNumber, currentResult?.fullDateTime, slotStopDelayMs, queryClient]);

  const remainingSeconds = nextSlot != null ? nextSlot.remainingSeconds : null;
  const { display: countdownDisplay, seconds: countdownSeconds, parts: countdownParts } =
    useCountdown(remainingSeconds);
  const isUrgent =
    countdownSeconds != null && countdownSeconds > 0 && countdownSeconds <= 60;

  const digitHeightPx = useSlotReelSize();

  const [singleDate, setSingleDate] = useState<string>(() => getTodayISTYYYYMMDD());
  const fromDate = singleDate || undefined;
  const toDate = singleDate || undefined;

  const { data: pastData } = useQuery({
    queryKey: ["public", "past-results", 1, fromDate, toDate],
    queryFn: () =>
      getPublicPastResults({
        page: 1,
        limit: 50,
        ...(fromDate && toDate ? { fromDate, toDate } : {}),
      }),
    // Poll past results in background so UI shows recent uploads without reloading.
    // Keeps the refresh scoped to this query only for a smooth UX.
    refetchInterval: 30000,
  });

  return (
    <main className="relative min-h-screen min-h-dvh w-full max-w-full overflow-x-hidden bg-slate-900 text-white">
      {showPartyPopper && <FullPagePartyPopper />}
      {/* Top bar */}
      <section
        className="relative z-10 shrink-0 border-b border-slate-600/50 bg-slate-900/95 backdrop-blur-sm live-card-3d"
        style={{
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -5px rgba(59,130,246,0.12)",
        }}
      >
        <div className="w-full">
          {/* Mobile & Tablet: logo row (full width) + 2x2 grid for the four info boxes */}
          <div className="lg:hidden">
            <div className="px-2 sm:px-6 md:px-8">
              <div
                className="mt-[3px] rounded-lg border border-slate-600/50 bg-slate-800/80 p-0 live-card-3d overflow-hidden h-20 sm:h-24 md:h-28"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}
              >
                <div className="relative w-full h-full p-0">
                  <Image src="/pl365-logo.png" alt="Pl365" fill className="object-cover" priority />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 px-2 py-2.5 sm:gap-4 sm:px-6 md:gap-5 md:px-8">
              <OrangeBarItem
                label="Next Draw Time"
                value={nextSlot ? formatNextSlotTime(nextSlot.nextSlotTime) : "—"}
              />
              <OrangeBarItem label="Today Date" value={todayIST} />
              <OrangeBarItem label="Now Time" value={istClock || "—"} />
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-slate-600/50 bg-slate-800/80 px-1.5 py-1.5 sm:px-3 sm:py-2.5 md:px-4 md:py-2.5 live-card-3d"
            style={{
              boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px] md:text-xs text-center">
              Time to Draw
            </p>
            {showNextGameMessage ? (
              <p className="next-game-message mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-400 sm:text-sm md:text-base text-center">
                Next game
              </p>
            ) : (
              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-white sm:text-sm md:text-base text-center">
                {countdownDisplay ?? "—"}
              </p>
            )}
          </div>
            </div>
          </div>

          {/* Desktop/Large: single row with 5 columns (logo + 4 boxes) */}
          <div className="hidden lg:grid w-full grid-cols-5 gap-1.5 px-6 py-4">
            <div
              className="mt-[3px] rounded-lg border border-slate-600/50 bg-gradient-to-b from-slate-900 to-slate-800 p-0 live-card-3d overflow-hidden h-24 xl:h-28"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <div className="relative w-full h-full p-3 flex items-center justify-center">
                <Image src="/pl365-logo.png" alt="Pl365" fill className="object-contain" priority />
              </div>
            </div>
            <OrangeBarItem
              label="Next Draw Time"
              value={nextSlot ? formatNextSlotTime(nextSlot.nextSlotTime) : "—"}
            />
            <OrangeBarItem label="Today Date" value={todayIST} />
            <OrangeBarItem label="Now Time" value={istClock || "—"} />
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-slate-600/50 bg-slate-800/80 px-1.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 live-card-3d min-h-[48px] sm:min-h-[56px] md:min-h-[64px]"
              style={{
                boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px] md:text-xs text-center">
                Time to Draw
              </p>
              {showNextGameMessage ? (
                <p className="next-game-message mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-400 sm:text-sm md:text-base text-center">
                  Next game
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-white sm:text-sm md:text-base text-center">
                  {countdownDisplay ?? "—"}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Slot machine – vertical ticker reels; size scales with viewport */}
      <section className="relative z-10 flex flex-col pt-4 pb-4 sm:pt-6 sm:pb-6 md:pt-8 md:pb-8">
        <div className="flex flex-col items-center gap-3 px-2 sm:gap-5 sm:px-4">
          <SlotMachineSection
            result={displayResult}
            countdownDisplay={countdownDisplay}
            countdownSeconds={countdownSeconds}
            digitHeightPx={digitHeightPx}
          />
          <div className="mt-2 flex justify-center gap-1 sm:gap-2">
            {countdownParts ? (
              <>
                <DigitalBox value={countdownParts.h} label="Hrs" urgent={isUrgent} />
                <span className="flex items-end pb-1 font-mono text-lg font-bold text-slate-500 sm:pb-2 sm:text-2xl">
                  :
                </span>
                <DigitalBox value={countdownParts.m} label="Min" urgent={isUrgent} />
                <span className="flex items-end pb-1 font-mono text-lg font-bold text-slate-500 sm:pb-2 sm:text-2xl">
                  :
                </span>
                <DigitalBox value={countdownParts.s} label="Sec" urgent={isUrgent} />
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Previous draws – centered with space left & right (same as live page) */}
      <section className="relative z-10 w-full bg-slate-900 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-2xl md:max-w-3xl">
          <h2 className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:mb-3 sm:text-xs">
            Previous draws
          </h2>

          <div className="live-date-filters mb-4 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] [color-scheme:dark] sm:px-4 sm:py-4">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
                  See previous result
                </span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="live-date-input w-full min-w-[120px] sm:min-w-[140px] sm:w-auto"
                />
              </label>
            </div>
          </div>

          <p className="mb-3 text-center text-[10px] text-slate-500 sm:mb-4">
            {singleDate
              ? `Showing results for ${formatDateDDMMYYYY(singleDate)} (IST)`
              : "Showing latest results. Select a date above to see past draws."}
          </p>

          {pastData?.items && pastData.items.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              {pastData.items.map((item) => (
                <div
                  key={item._id ?? `${item.fullDateTime}-${item.resultNumber}`}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2.5 backdrop-blur-sm transition live-card-3d live-card-glow hover:border-slate-500 hover:bg-slate-700/50 sm:px-6 sm:py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 sm:text-xs md:text-sm">
                      {formatResultDateTime(item.fullDateTime)}
                    </span>
                    <span className="font-mono text-lg font-bold text-amber-400 sm:text-xl md:text-2xl">
                      {item.resultNumber}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 py-6 text-center text-sm text-slate-500 live-card-3d" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}>
              No past results yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
