"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SEED = [
  -0.3, -0.1, 0.2, -0.4, -0.2, 0.1, -0.6, -0.5, -0.2, 0.0,
  0.1, -0.3, -0.4, -0.5, -0.2, -0.3, -0.4, -0.2, -0.1, 0.2,
  0.5, 0.7, 0.4, 0.2, 0.0, -0.1, 0.3, 0.6, 0.4, 0.2,
];
const DAYS = 30;
const W = 600;
const H = 160;

function formatK(n: number) {
  return Math.abs(Math.round(n)).toLocaleString("es-CO");
}

function yFor(cum: number, maxAbs: number) {
  return 85 + (cum * 55) / maxAbs;
}

function getState(day: number) {
  let cum = 0;
  const cums: number[] = [];
  for (let i = 0; i < day; i++) {
    cum += SEED[i];
    cums.push(cum);
  }
  let rolling = 0;
  let maxAbs = 0.5;
  for (let i = 0; i < DAYS; i++) {
    rolling += SEED[i];
    maxAbs = Math.max(maxAbs, Math.abs(rolling));
  }
  return { cums, finalCum: cum, maxAbs };
}

type Mood = {
  text: string;
  color: string;
  glow: string;
  state: "good" | "tight" | "over";
};

function currentMonthLabel() {
  const m = new Date().toLocaleString("es-CO", { month: "long" });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function LandingDemo() {
  const [day, setDay] = useState(17);
  const monthLabel = useMemo(() => currentMonthLabel(), []);

  const { cums, finalCum, maxAbs } = useMemo(() => getState(day), [day]);

  const { pathD, fillD, markerX, markerY } = useMemo(() => {
    const pts = cums.map((c, i) => {
      const x = (i / (DAYS - 1)) * W;
      const y = yFor(c, maxAbs);
      return [x, y] as const;
    });
    if (pts.length === 0) {
      return { pathD: "", fillD: "", markerX: 0, markerY: 0 };
    }
    const d = pts
      .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1))
      .join(" ");
    const first = pts[0];
    const last = pts[pts.length - 1];
    const fd = d + ` L${last[0].toFixed(1)},${H} L${first[0].toFixed(1)},${H} Z`;
    return { pathD: d, fillD: fd, markerX: last[0], markerY: last[1] };
  }, [cums, maxAbs]);

  const mood: Mood = useMemo(() => {
    if (finalCum < -0.2) {
      return { text: "Vas bien.", color: "#5CB88A", glow: "rgba(61,158,110,0.6)", state: "good" };
    }
    if (finalCum < 0.25) {
      return { text: "Vas ajustado.", color: "#D4A843", glow: "rgba(212,168,67,0.6)", state: "tight" };
    }
    return { text: "Pisa el freno.", color: "#E8875A", glow: "rgba(232,135,90,0.6)", state: "over" };
  }, [finalCum]);

  const overK = finalCum * 50;
  const left = DAYS - day;
  const allowanceToday = Math.max(0, 180 - overK * 1.2);

  let metaText: string;
  let note: React.ReactNode;
  if (mood.state === "good") {
    metaText = `+ $ ${formatK(-overK)}k sobre el promedio · quedan ${left} días`;
    note = (
      <>
        <strong>Hoy puedes gastar $ {formatK(allowanceToday)}k</strong> sin salirte del plan.
      </>
    );
  } else if (mood.state === "tight") {
    metaText = `Justo en el promedio · quedan ${left} días`;
    note = (
      <>
        <strong>Hoy puedes gastar $ {formatK(Math.max(40, allowanceToday))}k</strong> — un poco
        menos que ayer.
      </>
    );
  } else {
    metaText = `- $ ${formatK(overK)}k bajo el promedio · quedan ${left} días`;
    note = (
      <>
        <strong>Hoy mejor $ {formatK(Math.max(20, allowanceToday * 0.5))}k</strong> — recupera el
        ritmo.
      </>
    );
  }

  return (
    <div className="demo-card reveal">
      <div className="demo-top">
        <span className="ttl">Este mes · {monthLabel}</span>
        <span className="eyebrow">
          <span className="dot" />
          Día {day} / {DAYS}
        </span>
      </div>

      <div className="demo-verdict">
        <span
          className="emoji-dot"
          style={{ background: mood.color, boxShadow: `0 0 20px ${mood.glow}` }}
        />
        <span>{mood.text}</span>
      </div>
      <div className="demo-meta">{metaText}</div>

      <div className="demo-chart">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="zeta-demo-g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#937844" stopOpacity="0.35" />
              <stop offset="1" stopColor="#937844" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="zeta-demo-band" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#3D9E6E" stopOpacity="0.08" />
              <stop offset="1" stopColor="#3D9E6E" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <rect x="0" y="60" width="600" height="50" fill="url(#zeta-demo-band)" />
          <line x1="0" y1="60" x2="600" y2="60" stroke="#3D9E6E" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.5" />
          <line x1="0" y1="110" x2="600" y2="110" stroke="#3D9E6E" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.5" />
          <path d={pathD} stroke={mood.color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={fillD} fill="url(#zeta-demo-g)" />
          <circle cx={markerX} cy={markerY} r="6" fill={mood.color} stroke="#121412" strokeWidth="2" />
          <line x1={markerX} x2={markerX} y1="0" y2="160" stroke={mood.color} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
        </svg>
      </div>

      <div className="demo-axis">
        <span>Día 1</span>
        <span>Día 15</span>
        <span>Día 30</span>
      </div>

      <div className="demo-slider-wrap">
        <span className="sl-lbl">Día</span>
        <input
          type="range"
          className="demo-slider"
          min={1}
          max={30}
          value={day}
          step={1}
          onChange={(e) => setDay(parseInt(e.currentTarget.value, 10))}
          aria-label="Día del mes"
        />
        <span className="sl-val">{day}</span>
      </div>

      <p className="demo-note">{note}</p>
    </div>
  );
}

export function FooterYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year ?? ""}</>;
}

export function LandingBehaviors() {
  const ticking = useRef(false);
  useEffect(() => {
    const nav = document.getElementById("zeta-landing-nav");
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        if (nav) nav.classList.toggle("scrolled", window.scrollY > 10);
        ticking.current = false;
      });
    };
    if (nav) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    const els = document.querySelectorAll(".zeta-landing .reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);
  return null;
}
