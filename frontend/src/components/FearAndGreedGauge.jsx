import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

export default function FearAndGreedGauge({ messages }) {
  const [bull, setBull] = useState(0);
  const [bear, setBear] = useState(0);

  // Initial load
  useEffect(() => {
    fetch('/api/market_state')
      .then(r => r.json())
      .then(states => {
        let b = 0, br = 0;
        Object.values(states).forEach(s => {
          b += s.bull_pressure ?? 0;
          br += s.bear_pressure ?? 0;
        });
        setBull(b);
        setBear(br);
      })
      .catch(() => {});
  }, []);

  // Live updates
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    
    if (last.type === 'market_reset') {
      setBull(0);
      setBear(0);
    }
    
    if (last.type === 'market_tick') {
      const d = last.delta ?? 0;
      if (d > 0) setBull(b => b + d);
      else if (d < 0) setBear(b => b + Math.abs(d));
    }
  }, [messages]);

  const total = bull + bear;
  const greedPct = total > 0 ? (bull / total) * 100 : 50;
  
  // Map 0-100 to an SVG stroke-dashoffset (approx)
  // Let's use a simple semi-circle. SVG viewbox: 0 0 200 100
  // Path for a semicircle: r=80, length is roughly Math.PI * 80 = 251.2
  const r = 80;
  const pathLength = Math.PI * r;
  // Offset mapping: 100% -> 0 offset, 0% -> pathLength offset
  const dashOffset = pathLength - (greedPct / 100) * pathLength;
  
  const getStatusText = (pct) => {
    if (pct >= 80) return { text: "EXTREME GREED", color: "#00f0ff" };
    if (pct >= 60) return { text: "GREED", color: "#00c3ff" };
    if (pct <= 20) return { text: "EXTREME FEAR", color: "#ff0055" };
    if (pct <= 40) return { text: "FEAR", color: "#ff3377" };
    return { text: "NEUTRAL", color: "#a0aec0" };
  };

  const status = getStatusText(greedPct);

  return (
    <div className="flex flex-col items-center justify-center relative min-w-[200px]">
      <div className="absolute top-0 left-0 w-full text-center text-[10px] font-bold tracking-widest text-white/50 uppercase">
        Global Sentiment
      </div>
      
      <div className="relative mt-4 w-[160px] h-[80px]">
        <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="15"
            strokeLinecap="round"
          />
          {/* Foreground Arc */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="15"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            initial={{ strokeDashoffset: pathLength }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0px 0px 8px ${status.color})` }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff0055" />
              <stop offset="50%" stopColor="#a0aec0" />
              <stop offset="100%" stopColor="#00f0ff" />
            </linearGradient>
          </defs>
        </svg>

        {/* Value Text centered in the arc */}
        <div className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-end h-full pointer-events-none">
          <motion.span 
            key={Math.round(greedPct)}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black font-mono drop-shadow-lg"
            style={{ color: status.color }}
          >
            {Math.round(greedPct)}
          </motion.span>
          <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: status.color }}>
            {status.text}
          </span>
        </div>
      </div>
    </div>
  );
}
