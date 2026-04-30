import { useEffect, useRef, useState } from "react";

type Props = {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  workSeconds: number;
  onWorkSecondsChange: (val: number) => void;
};

type Phase = "idle" | "work" | "rest" | "done";

const DEFAULT_REST = 30;

export default function WorkoutTimer({
  exerciseName,
  sets,
  workSeconds,
  onWorkSecondsChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentSet, setCurrentSet] = useState(1);
  const [timeLeft, setTimeLeft] = useState(workSeconds);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST);
  const [isRunning, setIsRunning] = useState(false);

  const [soundType, setSoundType] = useState<"beep" | "tone" | "custom">("beep");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ===== SOUND =====
  const playBeep = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.connect(ctx.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  };

  const playSound = () => {
    if (soundType === "beep") playBeep();
    else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  // ===== TIMER LOOP =====
  useEffect(() => {
  if (!isRunning) return;

  const interval = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        playSound();

        // ===== WORK PHASE =====
        if (phase === "work") {
          if (currentSet === sets) {
            // FINAL SET COMPLETED
            setPhase("done");
            setIsRunning(false);
            return 0;
          }

          // go to rest
          setPhase("rest");
          return restSeconds;
        }

        // ===== REST PHASE =====
        if (phase === "rest") {
          // ONLY increment if not exceeding sets
          if (currentSet < sets) {
            setCurrentSet((s) => s + 1);
            setPhase("work");
            return workSeconds;
          } else {
            // safety fallback
            setPhase("done");
            setIsRunning(false);
            return 0;
          }
        }
      }

      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, phase, currentSet, sets, restSeconds, workSeconds, soundType]);
  // Sync when user edits work time
  useEffect(() => {
    if (phase === "idle") setTimeLeft(workSeconds);
  }, [workSeconds, phase]);

  // ===== ACTIONS =====
  const start = () => {
    setPhase("work");
    setTimeLeft(workSeconds);
    setCurrentSet(1);
    setIsRunning(true);
  };

  const stop = () => setIsRunning(false);

  const reset = () => {
    setIsRunning(false);
    setPhase("idle");
    setCurrentSet(1);
    setTimeLeft(workSeconds);
  };

  // ===== PROGRESS RING =====
  const total = phase === "rest" ? restSeconds : workSeconds;
  const progress = total > 0 ? timeLeft / total : 0;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* TOP INFO */}
      <div style={{ fontSize: 12 }}>
        {exerciseName} • Set {Math.min(currentSet, sets)}/{sets}
      </div>

      {/* TIMER + RING */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="50" height="50">
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke="#ddd"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke={phase === "rest" ? "#0b61ff" : "#28a745"}
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 25 25)"
          />
        </svg>

        <div style={{ fontSize: 18, fontWeight: "bold" }}>
          {Math.floor(timeLeft / 60)
            .toString()
            .padStart(2, "0")}
          :
          {(timeLeft % 60).toString().padStart(2, "0")}
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={start}>Start</button>
        <button onClick={stop}>Stop</button>
        <button onClick={reset}>Reset</button>
      </div>

      {/* SETTINGS */}
      <div style={{ fontSize: 12 }}>
        Work:
        <input
          type="number"
          value={workSeconds}
          onChange={(e) => onWorkSecondsChange(Number(e.target.value))}
          style={{ width: 60 }}
        />
        Rest:
        <input
          type="number"
          value={restSeconds}
          onChange={(e) => setRestSeconds(Number(e.target.value))}
          style={{ width: 60 }}
        />
      </div>

      {/* SOUND PICKER */}
      <div style={{ fontSize: 12 }}>
        Sound:
        <select
          value={soundType}
          onChange={(e) => setSoundType(e.target.value as any)}
        >
          <option value="beep">Beep</option>
          <option value="tone">Tone</option>
          <option value="custom">Custom</option>
        </select>

        {soundType !== "beep" && (
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                audioRef.current = new Audio(URL.createObjectURL(file));
              }
            }}
          />
        )}
      </div>

      {phase === "done" && <div style={{ color: "green" }}>✔ Finished</div>}
    </div>
  );
}