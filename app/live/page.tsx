"use client";

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

/** Result number colour cycle – JS-driven so it’s never overridden by Tailwind */
const RESULT_COLORS = [
  { color: "#fbbf24", shadow: "0 0 20px rgba(251,191,36,0.7), 0 0 40px rgba(251,191,36,0.4)" },
  { color: "#38bdf8", shadow: "0 0 20px rgba(56,189,248,0.7), 0 0 40px rgba(56,189,248,0.4)" },
  { color: "#a78bfa", shadow: "0 0 20px rgba(167,139,250,0.7), 0 0 40px rgba(167,139,250,0.4)" },
  { color: "#34d399", shadow: "0 0 20px rgba(52,211,153,0.7), 0 0 40px rgba(52,211,153,0.4)" },
  { color: "#f472b6", shadow: "0 0 20px rgba(244,114,182,0.7), 0 0 40px rgba(244,114,182,0.4)" },
];

function useResultNumberColor() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % RESULT_COLORS.length);
    }, 500);
    return () => clearInterval(id);
  }, []);
  return RESULT_COLORS[index];
}

type NextSlot = Awaited<ReturnType<typeof getPublicNextSlot>>;

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
    // Abhi ke liye 1 second pe server time poll kar rahe hain.
    // Agar interval change karna ho to yahi value adjust kar sakte hain.
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

function useCountdown(
  initialSeconds: number | null,
  toleranceSeconds = 30
): {
  display: string | null;
  seconds: number | null;
  parts: { h: string; m: string; s: string } | null;
} {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);

  // Jab server se naya remainingSeconds aaye, tab sirf tabhi hard reset karo
  // jab difference ±toleranceSeconds se zyada ho.
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

  // Local per‑second countdown – sirf jab seconds null na ho.
  useEffect(() => {
    if (seconds == null) return;

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev == null) return null;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [seconds == null]);

  if (seconds == null || seconds < 0) {
    return { display: null, seconds: null, parts: null };
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const display = `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(s).padStart(2, "0")}`;

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

export default function LivePage() {
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
  const spinnerDisplayResult: PublicCurrentResult | null | undefined =
    currentResult ?? lastStableResultRef.current ?? null;

  const [showNextGameMessage, setShowNextGameMessage] = useState(false);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const prevResultKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key =
      currentResult?.resultNumber != null && currentResult?.fullDateTime != null
        ? `${currentResult.resultNumber}_${currentResult.fullDateTime}`
        : null;
    if (key == null) return;
    if (prevResultKeyRef.current != null && prevResultKeyRef.current !== key) {
      setShowNextGameMessage(true);
      setShowPartyPopper(true);
      queryClient.invalidateQueries({ queryKey: ["public", "past-results", 1] });
      const t = setTimeout(() => setShowNextGameMessage(false), 10000);
      const t2 = setTimeout(() => setShowPartyPopper(false), 5000);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
    prevResultKeyRef.current = key;
  }, [currentResult?.resultNumber, currentResult?.fullDateTime, queryClient]);

  const { data: pastData } = useQuery({
    queryKey: ["public", "past-results", 1],
    queryFn: () => getPublicPastResults({ page: 1, limit: 10 }),
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 live-page-glow" aria-hidden />
      {showPartyPopper && <FullPagePartyPopper />}

      <TopSection
        istClock={istClock}
        todayIST={todayIST}
        nextSlot={nextSlot}
        spinnerDisplayResult={spinnerDisplayResult}
        showNextGameMessage={showNextGameMessage}
      />

      {/* Rest of content below fold - dark theme (does not re-render every second) */}
      <div className="relative z-10 mx-auto max-w-2xl bg-slate-950 px-4 py-6 sm:py-8">
        {/* Winning number / Latest result */}
        <section className="mt-6">
          <WinningNumberCard result={currentResult} />
        </section>

        {/* Previous draws */}
        <section className="mt-8">
          <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Previous draws
          </h2>
          {pastData?.items && pastData.items.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {pastData.items.map((item) => (
                <div
                  key={item._id ?? `${item.fullDateTime}-${item.resultNumber}`}
                  className="rounded-lg border border-slate-600/50 bg-slate-800/60 px-4 py-2.5 backdrop-blur-sm transition live-card-3d live-card-glow hover:border-slate-500 hover:bg-slate-700/50"
                >
                  <span className="font-mono text-xl font-bold text-amber-400">
                    {item.resultNumber}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {formatResultDateTime(item.fullDateTime)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-700/50 bg-slate-800/40 py-6 text-center text-sm text-slate-500 live-card-3d" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}>
              No past results yet.
            </p>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          All times in IST
        </footer>
      </div>
    </main>
  );
}

function TopSection({
  istClock,
  todayIST,
  nextSlot,
  spinnerDisplayResult,
  showNextGameMessage,
}: {
  istClock: string;
  todayIST: string;
  nextSlot: NextSlot | undefined;
  spinnerDisplayResult: PublicCurrentResult | null | undefined;
  showNextGameMessage: boolean;
}) {
  const remainingSeconds: number | null =
    nextSlot != null ? nextSlot.remainingSeconds : null;

  const {
    display: countdownDisplay,
    seconds: countdownSeconds,
    parts: countdownParts,
  } = useCountdown(remainingSeconds);

  const isUrgent =
    countdownSeconds != null &&
    countdownSeconds > 0 &&
    countdownSeconds <= 60;

  return (
    <>
      {/* Dark top bar - full width, 3D + glow */}
      <section
        className="relative z-10 shrink-0 border-b border-slate-600/50 bg-slate-900/95 backdrop-blur-sm live-card-3d"
        style={{
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -5px rgba(59,130,246,0.12)",
        }}
      >
        <div className="grid w-full grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4 sm:gap-4 sm:px-6 sm:py-4">
          <OrangeBarItem
            label="Next Draw Time"
            value={nextSlot ? formatNextSlotTime(nextSlot.nextSlotTime) : "—"}
          />
          <OrangeBarItem label="Today Date" value={todayIST} />
          <OrangeBarItem label="Now Time" value={istClock || "—"} />
          <TimeToDrawCell
            showNextGameMessage={showNextGameMessage}
            countdownDisplay={countdownDisplay}
          />
        </div>
      </section>

      {/* Spinner section – same dark theme */}
      <section className="relative z-10 flex flex-col py-4">
        <div className="flex h-[400px] items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4">
          <LuckyDrawSpinner
            result={spinnerDisplayResult}
            countdownDisplay={showNextGameMessage ? null : countdownDisplay}
          />
        </div>
      </section>

      {/* Digital countdown OR "Next game" message for 10s after draw */}
      <section className="relative z-10 mx-auto max-w-2xl px-4">
        {showNextGameMessage ? (
          <NextGameMessage />
        ) : (
          <>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Next draw in
            </p>
            <div className="mt-2 flex justify-center gap-1 sm:gap-2">
              {countdownParts ? (
                <>
                  <DigitalBox value={countdownParts.h} label="Hrs" urgent={isUrgent} />
                  <span className="flex items-end pb-2 font-mono text-2xl font-bold text-slate-500">
                    :
                  </span>
                  <DigitalBox value={countdownParts.m} label="Min" urgent={isUrgent} />
                  <span className="flex items-end pb-2 font-mono text-2xl font-bold text-slate-500">
                    :
                  </span>
                  <DigitalBox value={countdownParts.s} label="Sec" urgent={isUrgent} />
                </>
              ) : (
                <div
                  className="rounded-lg border-2 border-slate-600/50 bg-slate-800/60 px-6 py-3 font-mono text-2xl text-slate-400 live-card-3d"
                  style={{
                    boxShadow:
                      "0 4px 14px rgba(0,0,0,0.35), 0 0 20px -5px rgba(59,130,246,0.1)",
                  }}
                >
                  {countdownDisplay ?? "—"}
                </div>
              )}
            </div>
            {nextSlot && (
              <p className="mt-2 text-center text-sm text-slate-400">
                Draw at{" "}
                <span className="font-semibold text-slate-300">
                  {formatNextSlotTime(nextSlot.nextSlotTime)}
                </span>
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** "Next game" message with cycling color animation – shown for 10s after a draw ends */
function NextGameMessage() {
  return (
    <div className="next-game-message-wrap">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Next draw starting soon
      </p>
      <div className="next-game-message mt-3 rounded-xl border-2 border-amber-400/70 bg-slate-900/80 px-8 py-5 text-center font-bold uppercase tracking-wider sm:px-10 sm:py-6 sm:text-xl">
        Next game
      </div>
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
      className={`rounded-lg border-2 px-3 py-2 text-center font-mono text-2xl font-bold tabular-nums sm:px-4 sm:text-3xl live-card-3d live-card-glow transition-shadow ${
        urgent
          ? "border-red-500/70 bg-red-950/50 text-red-400 animate-[screenFlicker_3s_ease-in-out_infinite]"
          : "border-slate-500/50 bg-slate-800/80 text-slate-200"
      }`}
      style={urgent ? undefined : { boxShadow: "0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px -5px rgba(59,130,246,0.12)" }}
    >
      <span className="block">{value}</span>
      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  );
}

/** Time to Draw box: countdown normally, or "Next game" with color animation when showNextGameMessage */
function TimeToDrawCell({
  showNextGameMessage,
  countdownDisplay,
}: {
  showNextGameMessage: boolean;
  countdownDisplay: string | null;
}) {
  return (
    <div
      className="rounded-lg border border-slate-600/50 bg-slate-800/80 px-2 py-2 text-center sm:px-3 sm:py-2.5 live-card-3d"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
        Time to Draw
      </p>
      {showNextGameMessage ? (
        <p className="next-game-message mt-0.5 text-sm font-bold uppercase tracking-wider text-amber-400 sm:text-base">
          Next game
        </p>
      ) : (
        <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white sm:text-base">
          {countdownDisplay ?? "—"}
        </p>
      )}
    </div>
  );
}

function OrangeBarItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-600/50 bg-slate-800/80 px-2 py-2 text-center sm:px-3 sm:py-2.5 live-card-3d" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white sm:text-base">
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-center ${
        accent
          ? "border-amber-500/30 bg-amber-950/20"
          : "border-slate-600/40 bg-black/30"
      } backdrop-blur-sm`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

/* Har colour = usi number. Bright colours taaki clearly dikhen. */
const WHEEL_SEGMENTS: { color: string; number: number }[] = [
  { color: "#16a34a", number: 0 },  /* 1 – green */
  { color: "#0ea5e9", number: 1 },  /* 2 – blue */
  { color: "#9333ea", number: 2 },  /* 3 – purple */
  { color: "#2563eb", number: 3 },  /* 4 – dark blue */
  { color: "#dc2626", number: 4 },  /* 5 – red */
  { color: "#ea580c", number: 5 },  /* 6 – orange */
  { color: "#ca8a04", number: 6 },  /* 7 – yellow */
  { color: "#db2777", number: 7 },  /* 8 – pink */
  { color: "#0d9488", number: 8 },  /* 9 – teal */
  { color: "#d97706", number: 9 },  /* 10 – amber */
];

/** Single digit wheel: static segments 0-9, golden rim, red pointer, center digit (no spin logic) */
type SingleDigitWheelProps = {
  digit: string;
};

function SingleDigitWheel({ digit }: SingleDigitWheelProps) {
  const size = "400px";
  const centerSize = "min(24vmin, 62px)";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <div
          className="h-0 w-0 border-l-[20px] border-r-[20px] border-b-[28px] border-l-transparent border-r-transparent border-b-red-500"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
        />
      </div>
      <div className="relative flex flex-1 items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="relative overflow-hidden rounded-full shadow-lg"
          style={{
            width: size,
            height: size,
            border: "3px solid #fbbf24",
            boxShadow:
              "0 0 0 1px rgba(251,191,36,0.5), 0 8px 24px rgba(0,0,0,0.4), 0 0 40px -5px rgba(251,191,36,0.25), 0 0 60px -10px rgba(59,130,246,0.15)",
          }}
        >
          <div className="absolute inset-[2px] rounded-full">
            {/* Segment colours – bright, clearly visible */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${WHEEL_SEGMENTS.map((seg, i) => `${seg.color} ${i * 36}deg ${(i + 1) * 36}deg`).join(", ")})`,
              }}
            />
            {/* Har segment pe number – chhota circle usi colour ka, andar number */}
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angleDeg = i * 36 + 18;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 flex h-full w-full items-center justify-center"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-41%)`,
                  }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full font-mono font-black tabular-nums sm:h-10 sm:w-10"
                    style={{
                      transform: `rotate(${-angleDeg}deg)`,
                      backgroundColor: seg.color,
                      color: "#ffffff",
                      fontSize: "22px",
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      boxShadow: "inset 0 2px 6px rgba(255,255,255,0.35), inset 0 -2px 6px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {seg.number}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center justify-center rounded-full bg-white"
              style={{
                width: centerSize,
                height: centerSize,
                boxShadow: "0 2px 6px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.9)",
              }}
            >
              <span className="font-mono text-3xl font-black tabular-nums text-black sm:text-4xl">
                {digit}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two wheels with middle banner (game name + result) – static (no spin logic) */
type LuckyDrawSpinnerProps = {
  result: PublicCurrentResult | null | undefined;
  countdownDisplay: string | null;
};

function LuckyDrawSpinner({
  result,
  countdownDisplay,
}: LuckyDrawSpinnerProps) {
  const resultStyle = useResultNumberColor();

  const resultNumber = result?.resultNumber ?? "";
  const digit1 = resultNumber.length >= 1 ? resultNumber[0] : "—";
  const digit2 = resultNumber.length >= 2 ? resultNumber[1] : "—";
  const gameName =
    typeof result?.gameName === "string"
      ? result.gameName
      : result?.gameId?.name ?? "Lucky Draw";

  const middleBoxResult = resultNumber || "—";

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-12 sm:gap-20">
      <SingleDigitWheel digit={digit1} />
      {/* Middle: 3D + glow */}
      <div className="flex flex-col items-center gap-2 sm:gap-2.5">
        <div
          className="rounded-lg bg-amber-400/95 px-4 py-2 live-card-3d"
          style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.3), 0 0 20px -2px rgba(251,191,36,0.3)" }}
        >
          <span className="text-sm font-semibold text-black sm:text-base">{gameName}</span>
        </div>
        <div
          className="flex items-center justify-center rounded-xl bg-slate-900/95 px-6 py-4 live-card-3d"
          style={{ minWidth: "88px", boxShadow: "0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1), 0 0 25px -2px rgba(59,130,246,0.2)" }}
        >
          <span
            className="font-mono text-4xl font-black tabular-nums leading-none transition-colors duration-300 sm:text-5xl"
            style={{ color: resultStyle.color, textShadow: resultStyle.shadow }}
          >
            {middleBoxResult || "—"}
          </span>
        </div>
        <div
          className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-orange-500 px-2 py-1.5 live-card-3d"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3), 0 0 15px -2px rgba(249,115,22,0.4)" }}
        >
          <span className="font-mono text-xs font-bold tabular-nums text-white sm:text-sm">
            {countdownDisplay ?? "—"}
          </span>
        </div>
      </div>
      <SingleDigitWheel digit={digit2} />
    </div>
  );
}

/** Full-page party popper – heavy confetti + ribbons + stars for 5s when result changes */
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

function WinningNumberCard({
  result,
}: {
  result: PublicCurrentResult | null | undefined;
}) {
  const [justDeclared, setJustDeclared] = useState(false);
  const prevResultRef = useRef<string | null>(null);
  const resultStyle = useResultNumberColor();

  useEffect(() => {
    const current = result?.resultNumber ?? null;
    if (current != null && current !== prevResultRef.current) {
      prevResultRef.current = current;
      setJustDeclared(true);
      const t = setTimeout(() => setJustDeclared(false), 2200);
      return () => clearTimeout(t);
    }
    if (current != null) prevResultRef.current = current;
  }, [result?.resultNumber]);

  if (result == null) {
    return (
      <div className="rounded-2xl border-2 border-slate-600/50 bg-slate-800/60 py-10 text-center backdrop-blur-sm live-card-3d live-card-glow transition-shadow" style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 25px -5px rgba(59,130,246,0.1)" }}>
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          No result yet
        </p>
        <p className="mt-1 text-xs text-slate-500">Winning number will appear here after draw</p>
      </div>
    );
  }

  const gameName =
    typeof result.gameName === "string"
      ? result.gameName
      : result.gameId?.name ?? "—";

  return (
    <div
      className={`rounded-2xl border-2 py-8 text-center backdrop-blur-sm live-card-3d live-card-glow transition-shadow ${
        justDeclared
          ? "border-amber-400/60 bg-amber-950/30 animate-[justDeclared_2s_ease-out_forwards]"
          : "border-slate-600/50 bg-slate-800/60"
      }`}
      style={justDeclared ? undefined : { boxShadow: "0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 25px -5px rgba(59,130,246,0.12)" }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400/90">
        {justDeclared ? "🎉 Winning number 🎉" : "Latest result"}
      </p>
      <p
        className={`mt-4 font-mono text-6xl font-black tabular-nums sm:text-7xl transition-colors duration-300 ${
          justDeclared ? "animate-[flipIn_0.5s_ease-out_forwards]" : ""
        }`}
        style={{ color: resultStyle.color, textShadow: resultStyle.shadow }}
      >
        {result.resultNumber}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        {gameName} · {formatResultDateTime(result.fullDateTime)}
      </p>
    </div>
  );
}
