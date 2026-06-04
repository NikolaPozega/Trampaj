import { useEffect, useRef, useState } from "react";

const CYAN = "#00C8FF";
const YELLOW = "#F5C100";
const NAVY = "#08152E";

export default function PhoneFrame() {
  const [phase, setPhase] = useState<"anim" | "static">("anim");
  const [tick, setTick] = useState(0);

  // Reset animation on click
  const restart = () => {
    setPhase("anim");
    setTick((t) => t + 1);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
        {phase === "anim" ? "Animacija pri prvom otvaranju..." : "Statični rub (nakon animacije)"}
      </p>

      {/* Phone shell */}
      <div
        style={{
          position: "relative",
          width: 320,
          height: 640,
          borderRadius: 40,
          background: "#111",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* Screen content */}
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: 34,
            background: NAVY,
            overflow: "hidden",
          }}
        >
          {/* Fake app UI */}
          <FakeAppUI />

          {/* Neon Frame SVG overlay */}
          <NeonFrameOverlay
            key={tick}
            onDone={() => setPhase("static")}
          />
        </div>

        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 80,
            height: 20,
            background: "#111",
            borderRadius: 12,
            zIndex: 100,
          }}
        />
      </div>

      <button
        onClick={restart}
        style={{
          background: "transparent",
          border: `1px solid ${CYAN}`,
          color: CYAN,
          padding: "8px 20px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ↺ Ponovi animaciju
      </button>
    </div>
  );
}

function FakeAppUI() {
  return (
    <div style={{ padding: "52px 16px 16px", color: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F5C100", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⇄</div>
        <span style={{ fontWeight: 700, fontSize: 18 }}>Trampaj<span style={{ color: "#F5C100" }}>.</span></span>
      </div>

      {/* Search bars */}
      {["Tražim: bicikl, iPhone...", "Nudim: peć, laptop..."].map((ph, i) => (
        <div key={i} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#aaa" }}>
          {i === 0 ? "🔍 " : "📦 "}{ph}
        </div>
      ))}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {[
          { title: "Samsung S23+", sub: "torbicu", price: "400 €", dot: CYAN },
          { title: "Boss parfem", sub: "Masku za mob", price: "20 €", dot: "#4ade80" },
          { title: "Bicikl MTB", sub: "Jaknu XL", price: "150 €", dot: YELLOW },
          { title: "PS5 + igrice", sub: "Laptop", price: "600 €", dot: CYAN },
        ].map((c, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: c.dot, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, marginBottom: 4, color: "#fff" }}>{c.title}</div>
            <div style={{ color: "#aaa", fontSize: 11, marginBottom: 6 }}>⇄ {c.sub}</div>
            <div style={{ color: YELLOW, fontWeight: 700 }}>{c.price}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NeonFrameOverlay({ onDone }: { onDone: () => void }) {
  const W = 308; // inner screen width
  const H = 628; // inner screen height
  const BORDER_W = 3;
  const LIGHT_LEN = 80;
  const perimeter = 2 * (W + H);
  const gap = perimeter - LIGHT_LEN;
  const gapOuter = perimeter - LIGHT_LEN * 2;
  const bx = BORDER_W / 2;
  const rectW = W - BORDER_W;
  const rectH = H - BORDER_W;

  const animRef = useRef<SVGAnimateElement>(null);
  const [done, setDone] = useState(false);
  const DURATION = 5; // seconds for 2 circles

  useEffect(() => {
    const id = setTimeout(() => {
      setDone(true);
      onDone();
    }, DURATION * 1000 + 100);
    return () => clearTimeout(id);
  }, []);

  const twoCircles = perimeter * 2;

  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      width={W}
      height={H}
    >
      <defs>
        <linearGradient id="borderGrad" x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={CYAN} stopOpacity="0.95" />
          <stop offset="38%" stopColor={CYAN} stopOpacity="0.3" />
          <stop offset="62%" stopColor={YELLOW} stopOpacity="0.3" />
          <stop offset="100%" stopColor={YELLOW} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="glowGrad" x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={CYAN} stopOpacity="1" />
          <stop offset="100%" stopColor={YELLOW} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Static border — always visible */}
      <rect x={bx} y={bx} width={rectW} height={rectH} fill="none"
        stroke="url(#borderGrad)" strokeWidth={BORDER_W} />

      {/* Animated wide glow */}
      {!done && (
        <rect x={bx} y={bx} width={rectW} height={rectH} fill="none"
          stroke="url(#borderGrad)" strokeWidth={BORDER_W + 10}
          strokeDasharray={`${LIGHT_LEN * 2} ${gapOuter}`} strokeLinecap="round" strokeOpacity="0.5"
        >
          <animate attributeName="stroke-dashoffset"
            from="0" to={-twoCircles}
            dur={`${DURATION}s`} repeatCount="1" fill="freeze" />
        </rect>
      )}

      {/* Animated sharp core */}
      {!done && (
        <rect x={bx} y={bx} width={rectW} height={rectH} fill="none"
          stroke="url(#glowGrad)" strokeWidth={BORDER_W + 2}
          strokeDasharray={`${LIGHT_LEN} ${gap}`} strokeLinecap="round" strokeOpacity="1"
        >
          <animate attributeName="stroke-dashoffset"
            from="0" to={-twoCircles}
            dur={`${DURATION}s`} repeatCount="1" fill="freeze" />
        </rect>
      )}
    </svg>
  );
}
