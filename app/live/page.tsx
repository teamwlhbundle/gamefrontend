"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicCurrentResult,
  getPublicNextSlot,
  getPublicPastResults,
  type PublicCurrentResult,
} from "@/lib/api";

const IST = "Asia/Kolkata";

function useISTClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          timeZone: IST,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
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
  onZero?: () => void
): { display: string | null; seconds: number | null; parts: { h: string; m: string; s: string } | null } {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds == null || seconds <= 0) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s == null || s <= 1) {
          onZero?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, onZero]);

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

  const { data: currentResult, refetch: refetchCurrent } = useQuery({
    queryKey: ["public", "current-result"],
    queryFn: getPublicCurrentResult,
    refetchInterval: 60_000,
  });

  const { data: nextSlot, refetch: refetchNextSlot } = useQuery({
    queryKey: ["public", "next-slot"],
    queryFn: getPublicNextSlot,
    refetchInterval: 60_000,
  });

  const onCountdownZero = useCallback(() => {
    refetchCurrent();
    refetchNextSlot();
  }, [refetchCurrent, refetchNextSlot]);

  const remainingSeconds =
    nextSlot?.remainingSeconds != null ? nextSlot.remainingSeconds : null;
  const { display: countdownDisplay, seconds: countdownSeconds, parts: countdownParts } = useCountdown(
    remainingSeconds,
    onCountdownZero
  );

  /* Spinner: result pe rukna chahiye; sirf next draw se 1 min pehle reset (—). Last result hold karo taaki refetch null aane par reset na ho. */
  const lastStableResultRef = useRef<PublicCurrentResult | null>(null);
  if (currentResult?.resultNumber != null && currentResult.resultNumber !== "") {
    lastStableResultRef.current = currentResult;
  }
  const spinnerDisplayResult: PublicCurrentResult | null | undefined =
    remainingSeconds != null && remainingSeconds <= 60
      ? null
      : (currentResult ?? lastStableResultRef.current ?? null);

  const { data: pastData } = useQuery({
    queryKey: ["public", "past-results", 1],
    queryFn: () => getPublicPastResults({ page: 1, limit: 10 }),
  });

  const isUrgent = countdownSeconds != null && countdownSeconds > 0 && countdownSeconds <= 60;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Full-page subtle glow layer */}
      <div className="pointer-events-none absolute inset-0 z-0 live-page-glow" aria-hidden />
      {/* Dark top bar - full width, 3D + glow */}
      <section
        className="relative z-10 shrink-0 border-b border-slate-600/50 bg-slate-900/95 backdrop-blur-sm live-card-3d"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -5px rgba(59,130,246,0.12)" }}
      >
        <div className="grid w-full grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4 sm:gap-4 sm:px-6 sm:py-4">
          <OrangeBarItem label="Next Draw Time" value={nextSlot ? formatNextSlotTime(nextSlot.nextSlotTime) : "—"} />
          <OrangeBarItem label="Today Date" value={todayIST} />
          <OrangeBarItem label="Now Time" value={istClock || "—"} />
          <OrangeBarItem label="Time to Draw" value={countdownDisplay ?? "—"} />
        </div>
      </section>

      {/* Spinner section – same dark theme */}
      <section className="relative z-10 flex flex-col py-4">
        <div className="flex h-[400px] items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4">
          <LuckyDrawSpinner result={spinnerDisplayResult} countdownDisplay={countdownDisplay} />
        </div>
      </section>

      {/* Rest of content below fold - dark theme */}
      <div className="relative z-10 mx-auto max-w-2xl bg-slate-950 px-4 py-6 sm:py-8">
        {/* Digital countdown */}
        <section>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Next draw in
          </p>
          <div className="mt-2 flex justify-center gap-1 sm:gap-2">
            {countdownParts ? (
              <>
                <DigitalBox value={countdownParts.h} label="Hrs" urgent={isUrgent} />
                <span className="flex items-end pb-2 font-mono text-2xl font-bold text-slate-500">:</span>
                <DigitalBox value={countdownParts.m} label="Min" urgent={isUrgent} />
                <span className="flex items-end pb-2 font-mono text-2xl font-bold text-slate-500">:</span>
                <DigitalBox value={countdownParts.s} label="Sec" urgent={isUrgent} />
              </>
            ) : (
              <div className="rounded-lg border-2 border-slate-600/50 bg-slate-800/60 px-6 py-3 font-mono text-2xl text-slate-400 live-card-3d" style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.35), 0 0 20px -5px rgba(59,130,246,0.1)" }}>
                {countdownDisplay ?? "—"}
              </div>
            )}
          </div>
          {nextSlot && (
            <p className="mt-2 text-center text-sm text-slate-400">
              Draw at <span className="font-semibold text-slate-300">{formatNextSlotTime(nextSlot.nextSlotTime)}</span>
            </p>
          )}
        </section>

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

/** Single digit wheel: colorful segments 0-9, golden rim, red pointer, white center with black digit */
function SingleDigitWheel({
  digit,
  isSpinning,
  justRevealed,
}: {
  digit: string;
  isSpinning: boolean;
  justRevealed: boolean;
  label?: string;
}) {
  const isDigit = digit >= "0" && digit <= "9";
  const digitNum = isDigit ? parseInt(digit, 10) : 0;
  const spinEndDeg = 1800 - (digitNum * 36 + 18);

  const size = "400px";
  const centerSize = "min(24vmin, 62px)";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      {/* Red pointer at top */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <div
          className="h-0 w-0 border-l-[20px] border-r-[20px] border-b-[28px] border-l-transparent border-r-transparent border-b-red-500"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
        />
      </div>
      {/* Wheel: thin bright yellow-orange rim + spinning segments (reference style) */}
      <div className="relative flex flex-1 items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="relative overflow-hidden rounded-full shadow-lg"
          style={{
            width: size,
            height: size,
            border: "3px solid #fbbf24",
            boxShadow: "0 0 0 1px rgba(251,191,36,0.5), 0 8px 24px rgba(0,0,0,0.4), 0 0 40px -5px rgba(251,191,36,0.25), 0 0 60px -10px rgba(59,130,246,0.15)",
          }}
        >
          {/* Spinning part: spin ke baad result pe hi rukna – animation none hone par final rotation fix rakhna */}
          <div
            className="absolute inset-[2px] rounded-full"
            style={{
              ["--spin-end" as string]: `${spinEndDeg}deg`,
              transform: isSpinning && isDigit ? undefined : `rotate(${spinEndDeg}deg)`,
              animation: isSpinning && isDigit
                ? "spinDigitWheel 3.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards"
                : "none",
            }}
          >
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
          {/* White center circle - prominent, black digit */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`flex items-center justify-center rounded-full bg-white ${justRevealed ? "animate-[flipIn_0.5s_ease-out_forwards]" : ""}`}
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

/** Two wheels with middle banner (game name + result) - reference style */
function LuckyDrawSpinner({
  result,
  countdownDisplay,
}: {
  result: PublicCurrentResult | null | undefined;
  countdownDisplay: string | null;
}) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  /* Middle box: spin ke dauran purana/— dikhao, rukne ke baad naya result */
  const [displayResultInMiddle, setDisplayResultInMiddle] = useState<string>("");
  const prevResultRef = useRef<string | null>(null);

  const resultNumber = result?.resultNumber ?? "";
  const digit1 = resultNumber.length >= 1 ? resultNumber[0] : "—";
  const digit2 = resultNumber.length >= 2 ? resultNumber[1] : "—";
  const gameName = typeof result?.gameName === "string"
    ? result.gameName
    : result?.gameId?.name ?? "Lucky Draw";

  /* Middle mein wahi result dikhao jo spinner ke hisaab se: pehle spin ruke, phir result update */
  const middleBoxResult = isSpinning ? displayResultInMiddle : resultNumber;

  useEffect(() => {
    const current = result?.resultNumber ?? null;
    if (current != null && current !== prevResultRef.current) {
      const oldResult = prevResultRef.current;
      prevResultRef.current = current;
      setDisplayResultInMiddle(oldResult ?? "—");
      setIsSpinning(true);
      setShowConfetti(false);
      const t1 = setTimeout(() => setIsSpinning(false), 3200);
      const t2 = setTimeout(() => {
        setJustRevealed(true);
        setShowConfetti(true);
        setTimeout(() => setJustRevealed(false), 1200);
        setTimeout(() => setShowConfetti(false), 2200);
      }, 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (current != null) prevResultRef.current = current;
  }, [result?.resultNumber]);

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-12 sm:gap-20">
      {showConfetti && <ConfettiBurst />}
      {/* Left wheel */}
      <SingleDigitWheel digit={digit1} isSpinning={isSpinning} justRevealed={justRevealed} />
      {/* Middle: 3D + glow */}
      <div className="flex flex-col items-center gap-2 sm:gap-2.5">
        <div
          className="rounded-lg bg-amber-400/95 px-4 py-2 live-card-3d"
          style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.3), 0 0 20px -2px rgba(251,191,36,0.3)" }}
        >
          <span className="text-sm font-semibold text-black sm:text-base">{gameName}</span>
        </div>
        <div
          className="flex items-center justify-center rounded-xl bg-white px-6 py-4 live-card-3d"
          style={{ minWidth: "88px", boxShadow: "0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.2), 0 0 25px -2px rgba(59,130,246,0.2)" }}
        >
          <span className="font-mono text-4xl font-black tabular-nums leading-none text-black sm:text-5xl">
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
      {/* Right wheel */}
      <SingleDigitWheel digit={digit2} isSpinning={isSpinning} justRevealed={justRevealed} />
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#fef08a", "#facc15", "#f59e0b", "#f97316", "#ef4444"];
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: 30 + Math.random() * 40,
    delay: Math.random() * 0.3,
    duration: 2 + Math.random() * 1.5,
    size: 4 + Math.random() * 6,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "45%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confettiDrop ${p.duration}s ease-out ${p.delay}s forwards`,
            transform: `translateY(-100%) rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
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
        className={`mt-4 font-mono text-6xl font-black tabular-nums sm:text-7xl ${
          justDeclared ? "animate-[flipIn_0.5s_ease-out_forwards]" : ""
        }`}
        style={{ color: "#fef08a", textShadow: "0 0 30px rgba(254,240,138,0.6)" }}
      >
        {result.resultNumber}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        {gameName} · {formatResultDateTime(result.fullDateTime)}
      </p>
    </div>
  );
}
