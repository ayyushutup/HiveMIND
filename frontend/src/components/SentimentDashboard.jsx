import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Link, Clock, BrainCircuit } from 'lucide-react';

// ── Emotion → visual style mapping ────────────────────────────────────────────
const EMOTION_STYLES = {
  panicked:    { color: '#ff0055', label: 'Panicked',       glow: 'rgba(255,0,85,0.8)', intensity: 0.95 },
  angry:       { color: '#ff0055', label: 'Angry',          glow: 'rgba(255,0,85,0.7)', intensity: 0.88 },
  aggressive:  { color: '#ff3377', label: 'Aggressive',     glow: 'rgba(255,51,119,0.7)', intensity: 0.90 },
  terrified:   { color: '#ff8800', label: 'Terrified',      glow: 'rgba(255,136,0,0.7)',  intensity: 0.85 },
  paranoid:    { color: '#ff8800', label: 'Paranoid',       glow: 'rgba(255,136,0,0.6)',  intensity: 0.82 },
  suspicious:  { color: '#ffaa00', label: 'Suspicious',     glow: 'rgba(255,170,0,0.6)',  intensity: 0.75 },
  calculating: { color: '#00c3ff', label: 'Calculating',    glow: 'rgba(0,195,255,0.6)',  intensity: 0.70 },
  cold:        { color: '#00c3ff', label: 'Cold',           glow: 'rgba(0,195,255,0.6)',  intensity: 0.65 },
  analytical:  { color: '#00f0ff', label: 'Analytical',     glow: 'rgba(0,240,255,0.6)',  intensity: 0.60 },
  calm:        { color: '#00f0ff', label: 'Calm',           glow: 'rgba(0,240,255,0.5)',  intensity: 0.35 },
  philosophical:{ color: '#bd00ff', label: 'Philosophical', glow: 'rgba(189,0,255,0.5)',  intensity: 0.30 },
  peaceful:    { color: '#bd00ff', label: 'Peaceful',       glow: 'rgba(189,0,255,0.4)',  intensity: 0.25 },
  cynical:     { color: '#8892b0', label: 'Cynical',        glow: 'rgba(136,146,176,0.5)', intensity: 0.55 },
  pessimistic: { color: '#8892b0', label: 'Pessimistic',    glow: 'rgba(136,146,176,0.4)', intensity: 0.50 },
  skeptical:   { color: '#a8b2d1', label: 'Skeptical',      glow: 'rgba(168,178,209,0.4)', intensity: 0.45 },
  euphoric:    { color: '#bd00ff', label: 'Euphoric',       glow: 'rgba(189,0,255,0.8)', intensity: 0.95 },
  excited:     { color: '#00f0ff', label: 'Excited',        glow: 'rgba(0,240,255,0.7)', intensity: 0.88 },
  bullish:     { color: '#00f0ff', label: 'Bullish',        glow: 'rgba(0,240,255,0.8)', intensity: 0.80 },
  neutral:     { color: '#ccd6f6', label: 'Neutral',        glow: 'rgba(204,214,246,0.2)', intensity: 0.20 },
  idle:        { color: '#495670', label: 'Idle',           glow: 'rgba(73,86,112,0.1)',   intensity: 0.00 },
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
  'The CFO':        'native',
  'The Legal Officer': 'langchain',
  'The Risk & Security Officer': 'native',
  'The Competitor': 'langchain',
  'The Customer Advocate': 'native',
};

// Agent → short label for avatar
const AGENT_INITIALS = {
  'The Regulator':  'REG',
  'The Whale':      'WHL',
  'The Retail Mob': 'MOB',
  'The CEO':        'CEO',
  'The Crypto Maxi':'MAX',
  'The Doomer':     'DMR',
  'The CFO':        'CFO',
  'The Legal Officer': 'LGL',
  'The Risk & Security Officer': 'RSK',
  'The Competitor': 'CMP',
  'The Customer Advocate': 'ADV',
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
  portfolio: { cash: 100000, positions: { TECH: 0, CRYPTO: 0, MACRO: 0 }, total_value: 100000, pnl: 0 },
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
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl border p-4 overflow-hidden glass-panel group"
      style={{
        borderColor: isActive ? style.color + '55' : 'rgba(255,255,255,0.05)',
        boxShadow: isActive ? `0 8px 32px ${style.glow}` : '0 4px 20px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.5s, border-color 0.5s',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      {/* Top row: Avatar + Name + Framework badge */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-lg relative overflow-hidden"
          style={{
            backgroundColor: style.color + '22',
            border: `1px solid ${style.color}66`,
            color: style.color,
            boxShadow: isActive ? `0 0 15px ${style.glow}, inset 0 0 10px ${style.color}22` : 'none',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
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
            className="text-lg font-black font-mono drop-shadow-md"
            style={{ color: agent.influence_score > 0 ? 'var(--color-brand-cyan)' : '#4a5568' }}
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
        <div className="flex gap-2">
          <div className="flex flex-col mr-2">
            <span className="text-white/30 text-[9px] uppercase tracking-widest font-bold">Cash</span>
            <span className="text-white/80 text-xs font-mono">${(agent.portfolio?.cash ?? 100000).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
          </div>
          {['TECH', 'CRYPTO', 'MACRO'].map(asset => (
            <div key={asset} className="flex flex-col">
              <span className="text-white/30 text-[9px] uppercase tracking-widest font-bold">{asset.slice(0, 3)}</span>
              <span className="text-white/80 text-xs font-mono">{(agent.portfolio?.positions?.[asset] ?? 0).toFixed(1)}</span>
            </div>
          ))}
        </div>
        <div className="text-right flex flex-col">
          <span className="text-white font-bold text-sm leading-none mb-0.5 tracking-tight font-mono">
            ${(agent.portfolio?.total_value ?? 100000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
          <span className={`text-[10px] font-bold tracking-wider font-mono ${(agent.portfolio?.pnl ?? 0) >= 0 ? 'text-[#00f0ff]' : 'text-[#ff0055]'}`}>
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

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];

    if (last.type === 'system_config') {
      fetch('/api/sentiment')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAgents(data); })
        .catch(() => {});
    }

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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white/90">
          <BrainCircuit className="w-5 h-5 text-[var(--color-brand-cyan)]" />
          Agent Collective
        </h2>
        <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-brand-purple)] flex items-center gap-1.5 glow-accent px-3 py-1 rounded-full bg-[var(--color-brand-purple)]/10 border border-[var(--color-brand-purple)]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-purple)] animate-pulse shadow-[0_0_8px_var(--color-brand-purple)]" />
          Live Telemetry
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
