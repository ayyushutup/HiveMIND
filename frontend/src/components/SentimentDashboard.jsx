import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Link, Clock, BrainCircuit } from 'lucide-react';

// ── Emotion → visual style mapping ────────────────────────────────────────────
const EMOTION_STYLES = {
  panicked:    { color: '#ff6b6b', label: 'Panicked',       glow: 'rgba(255,107,107,0.6)', intensity: 0.95 },
  angry:       { color: '#ff6b6b', label: 'Angry',          glow: 'rgba(255,107,107,0.6)', intensity: 0.88 },
  aggressive:  { color: '#ff6b6b', label: 'Aggressive',     glow: 'rgba(255,107,107,0.6)', intensity: 0.90 },
  terrified:   { color: '#f6ad55', label: 'Terrified',      glow: 'rgba(246,173,85,0.6)',  intensity: 0.85 },
  paranoid:    { color: '#f6ad55', label: 'Paranoid',       glow: 'rgba(246,173,85,0.6)',  intensity: 0.82 },
  suspicious:  { color: '#f6ad55', label: 'Suspicious',     glow: 'rgba(246,173,85,0.6)',  intensity: 0.75 },
  calculating: { color: '#4facfe', label: 'Calculating',    glow: 'rgba(79,172,254,0.6)',  intensity: 0.70 },
  cold:        { color: '#4facfe', label: 'Cold',           glow: 'rgba(79,172,254,0.6)',  intensity: 0.65 },
  analytical:  { color: '#4facfe', label: 'Analytical',     glow: 'rgba(79,172,254,0.6)',  intensity: 0.60 },
  calm:        { color: '#38b2ac', label: 'Calm',           glow: 'rgba(56,178,172,0.6)',  intensity: 0.35 },
  philosophical:{ color: '#38b2ac', label: 'Philosophical', glow: 'rgba(56,178,172,0.6)',  intensity: 0.30 },
  peaceful:    { color: '#38b2ac', label: 'Peaceful',       glow: 'rgba(56,178,172,0.6)',  intensity: 0.25 },
  cynical:     { color: '#718096', label: 'Cynical',        glow: 'rgba(113,128,150,0.6)', intensity: 0.55 },
  pessimistic: { color: '#718096', label: 'Pessimistic',    glow: 'rgba(113,128,150,0.6)', intensity: 0.50 },
  skeptical:   { color: '#718096', label: 'Skeptical',      glow: 'rgba(113,128,150,0.6)', intensity: 0.45 },
  euphoric:    { color: '#b794f4', label: 'Euphoric',       glow: 'rgba(183,148,244,0.6)', intensity: 0.95 },
  excited:     { color: '#b794f4', label: 'Excited',        glow: 'rgba(183,148,244,0.6)', intensity: 0.88 },
  bullish:     { color: '#b794f4', label: 'Bullish',        glow: 'rgba(183,148,244,0.6)', intensity: 0.80 },
  neutral:     { color: '#ffffff', label: 'Neutral',        glow: 'rgba(255,255,255,0.2)', intensity: 0.20 },
  idle:        { color: '#4a5568', label: 'Idle',           glow: 'rgba(74,85,104,0.2)',   intensity: 0.00 },
};

const getStyle = (emotion) =>
  EMOTION_STYLES[emotion?.toLowerCase()] ?? EMOTION_STYLES.idle;

// Agent → framework badge
const AGENT_FRAMEWORKS = {
  'The Regulator':  'native',
  'The Whale':      'langchain',
  'The Retail Mob': 'native',
  'The CEO':        'langchain',
  'The Crypto Maxi':'native',
  'The Doomer':     'langchain',
};

// Agent → short label for avatar
const AGENT_INITIALS = {
  'The Regulator':  'REG',
  'The Whale':      'WHL',
  'The Retail Mob': 'MOB',
  'The CEO':        'CEO',
  'The Crypto Maxi':'MAX',
  'The Doomer':     'DMR',
};

// ── Default state before any debate happens ───────────────────────────────────
const DEFAULT_STATE = [
  'The Regulator', 'The Whale', 'The Retail Mob',
  'The CEO', 'The Crypto Maxi', 'The Doomer',
].map(name => ({
  name,
  current_emotion: 'idle',
  intensity: 0,
  influence_score: 0,
  last_updated: '--:--:--',
  timeline: [],
  portfolio: { cash: 100000, position: 0, total_value: 100000, pnl: 0 },
}));

// ── Sparkline: mini row of emotion dots ───────────────────────────────────────
function EmotionSparkline({ timeline }) {
  // timeline is newest-first, display left=oldest, right=newest
  const display = [...timeline].reverse().slice(-8);

  return (
    <div className="flex items-center gap-1 mt-2">
      {display.length === 0
        ? <span className="text-white/20 text-xs">No history yet</span>
        : display.map((t, i) => {
            const style = getStyle(t.emotion);
            return (
              <div
                key={i}
                title={t.emotion}
                className="rounded-full transition-all duration-300"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: style.color,
                  opacity: 0.4 + t.intensity * 0.6,
                  boxShadow: `0 0 ${Math.round(t.intensity * 6)}px ${style.color}`,
                }}
              />
            );
          })}
    </div>
  );
}

// ── Intensity bar ─────────────────────────────────────────────────────────────
function IntensityBar({ intensity, color }) {
  return (
    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-1">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(intensity * 100)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Individual Agent Card ─────────────────────────────────────────────────────
function AgentCard({ agent, flashKey }) {
  const style = getStyle(agent.current_emotion);
  const framework = AGENT_FRAMEWORKS[agent.name];
  const initials = AGENT_INITIALS[agent.name] ?? '???';
  const isActive = agent.current_emotion !== 'idle';

  return (
    <motion.div
      key={flashKey}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl border p-4 overflow-hidden"
      style={{
        borderColor: isActive ? style.color + '55' : 'rgba(255,255,255,0.08)',
        background: isActive
          ? `linear-gradient(135deg, ${style.color}0d 0%, rgba(0,0,0,0.3) 100%)`
          : 'rgba(255,255,255,0.03)',
        boxShadow: isActive ? `0 0 20px ${style.glow}` : 'none',
        transition: 'box-shadow 0.5s, border-color 0.5s, background 0.5s',
      }}
    >
      {/* Top row: Avatar + Name + Framework badge */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0"
          style={{
            backgroundColor: style.color + '22',
            border: `2px solid ${style.color}88`,
            color: style.color,
            boxShadow: isActive ? `0 0 10px ${style.glow}` : 'none',
          }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{agent.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Framework badge */}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={
                framework === 'langchain'
                  ? { backgroundColor: '#4facfe22', color: '#4facfe', border: '1px solid #4facfe44' }
                  : { backgroundColor: '#b794f422', color: '#b794f4', border: '1px solid #b794f444' }
              }
            >
              {framework === 'langchain' ? (
                <><Link className="inline w-2.5 h-2.5 mr-1" />LangChain</>
              ) : (
                <><Zap className="inline w-2.5 h-2.5 mr-1" />Native</>
              )}
            </span>

            {/* Last updated */}
            <span className="text-white/30 text-[10px] flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{agent.last_updated}
            </span>
          </div>
        </div>

        {/* Influence score badge */}
        <div className="text-center shrink-0">
          <div
            className="text-lg font-black"
            style={{ color: agent.influence_score > 0 ? '#f6e05e' : '#4a5568' }}
          >
            {agent.influence_score}
          </div>
          <div className="text-white/30 text-[9px] uppercase tracking-wider leading-tight">
            Influence
          </div>
        </div>
      </div>

      {/* Emotion pill + Intensity bar */}
      <div className="flex items-center justify-between mb-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={agent.current_emotion}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest"
            style={{
              color: style.color,
              backgroundColor: style.color + '22',
              border: `1px solid ${style.color}55`,
            }}
          >
            {style.label}
          </motion.span>
        </AnimatePresence>
        <span className="text-white/30 text-[10px]">{Math.round(agent.intensity * 100)}%</span>
      </div>
      <IntensityBar intensity={agent.intensity} color={style.color} />

      {/* Emotion Sparkline */}
      <EmotionSparkline timeline={agent.timeline} />

      {/* Portfolio Info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="flex gap-3">
          <div className="flex flex-col">
            <span className="text-white/30 text-[9px] uppercase tracking-widest font-bold">Cash</span>
            <span className="text-white/80 text-xs font-mono">${(agent.portfolio?.cash ?? 100000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white/30 text-[9px] uppercase tracking-widest font-bold">Pos</span>
            <span className="text-white/80 text-xs font-mono">{(agent.portfolio?.position ?? 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-white font-bold text-sm leading-none mb-0.5 tracking-tight font-mono">
            ${(agent.portfolio?.total_value ?? 100000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
          <span className={`text-[10px] font-bold tracking-wider font-mono ${(agent.portfolio?.pnl ?? 0) >= 0 ? 'text-[#38b2ac]' : 'text-[#ff6b6b]'}`}>
            {(agent.portfolio?.pnl ?? 0) >= 0 ? '+' : ''}{(agent.portfolio?.pnl ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SentimentDashboard({ messages }) {
  const [agents, setAgents] = useState(DEFAULT_STATE);
  const [flashKeys, setFlashKeys] = useState({});

  // Initial fetch from REST endpoint
  useEffect(() => {
    fetch('/api/sentiment')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAgents(data); })
      .catch(() => {});
  }, []);

  // Real-time updates from WebSocket messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];

    if (last.type === 'sentiment_update') {
      const { agent: agentName, emotion, influence_score } = last;

      setAgents(prev =>
        prev.map(a => {
          if (a.name !== agentName) return a;
          const now = new Date().toLocaleTimeString('en-US', { hour12: false });
          const emotionStyle = EMOTION_STYLES[emotion?.toLowerCase()];
          const intensity = emotionStyle?.intensity ?? 0.5;
          const newEntry = { emotion, intensity, time: now };
          return {
            ...a,
            current_emotion: emotion,
            intensity,
            influence_score: influence_score ?? a.influence_score,
            last_updated: now,
            timeline: [newEntry, ...a.timeline].slice(0, 10),
            // portfolio stays same until next REST poll updates it
          };
        })
      );

      // Trigger flash animation key change
      setFlashKeys(prev => ({ ...prev, [agentName]: (prev[agentName] ?? 0) + 1 }));
    }
  }, [messages]);

  // Periodically re-sync intensity/influence from REST (every 5s)
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/sentiment')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAgents(data); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Sort by influence score descending (guard against non-array state)
  const sorted = Array.isArray(agents)
    ? [...agents].sort((a, b) => b.influence_score - a.influence_score)
    : DEFAULT_STATE;

  return (
    <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[2rem] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex justify-between items-center bg-black/20 border-b border-white/10">
        <div>
          <div className="bg-white/5 border border-white/10 text-white/60 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
            Live Tracking
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-md">
            <BrainCircuit className="w-5 h-5 text-[#b794f4]" />
            Agent Sentiment
          </h2>
        </div>
        <div className="text-right">
          <div className="text-white/40 text-xs uppercase tracking-wider">Sorted by</div>
          <div className="text-[#f6e05e] text-sm font-bold">Influence ↓</div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {sorted.map(agent => (
            <AgentCard
              key={agent.name}
              agent={agent}
              flashKey={flashKeys[agent.name] ?? 0}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
