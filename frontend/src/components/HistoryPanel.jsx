import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMOTION_COLOR = {
  panicked: '#ef4444', angry: '#ef4444', aggressive: '#f97316', terrified: '#ef4444',
  paranoid: '#fb923c', suspicious: '#fb923c', cynical: '#a3a3a3', pessimistic: '#a3a3a3',
  skeptical: '#a3a3a3', neutral: '#6b7280', calm: '#60a5fa', philosophical: '#818cf8',
  peaceful: '#34d399', calculating: '#22d3ee', analytical: '#22d3ee', cold: '#38bdf8',
  bullish: '#4ade80', euphoric: '#a3e635', excited: '#facc15',
};

const ASSET_COLOR = { TECH: '#22d3ee', CRYPTO: '#a78bfa', MACRO: '#4ade80' };

function emotionColor(e) {
  return EMOTION_COLOR[e?.toLowerCase()] || '#6b7280';
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ModeTag({ mode }) {
  const isRedTeam = mode === 'red_team';
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{
        background: isRedTeam ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,238,0.12)',
        color: isRedTeam ? '#f87171' : '#22d3ee',
        border: `1px solid ${isRedTeam ? '#f8717140' : '#22d3ee40'}`,
      }}
    >
      {isRedTeam ? 'Red Team' : 'Macro'}
    </span>
  );
}

function StatusBadge({ status }) {
  const complete = status === 'complete';
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{
        background: complete ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
        color: complete ? '#4ade80' : '#fbbf24',
        border: `1px solid ${complete ? '#4ade8040' : '#fbbf2440'}`,
      }}
    >
      {complete ? 'Complete' : 'Incomplete'}
    </span>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session, isSelected, onClick }) {
  const duration = formatDuration(session.started_at, session.ended_at);
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer rounded-2xl p-4 transition-all"
      style={{
        background: isSelected
          ? 'rgba(34,211,238,0.08)'
          : 'rgba(255,255,255,0.03)',
        border: isSelected
          ? '1px solid rgba(34,211,238,0.35)'
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSelected ? '0 0 20px rgba(34,211,238,0.08)' : 'none',
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <ModeTag mode={session.mode} />
        <StatusBadge status={session.status} />
        {session.winner && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(167,139,250,0.12)',
              color: '#a78bfa',
              border: '1px solid #a78bfa40',
            }}
          >
            🏆 {session.winner}
          </span>
        )}
      </div>

      {/* World event snippet */}
      <p className="text-sm text-white/80 leading-snug line-clamp-2 mb-3 font-medium">
        {session.world_event}
      </p>

      {/* Bottom meta */}
      <div className="flex items-center gap-3 text-[11px] text-white/35 font-mono">
        <span>{formatTime(session.started_at)}</span>
        {duration && <><span>·</span><span>{duration}</span></>}
        <span>·</span>
        <span>{session.speech_count} speeches</span>
      </div>
    </motion.div>
  );
}

// ── Market Mini-Bar Chart ─────────────────────────────────────────────────────

function MarketBars({ snapshots }) {
  if (!snapshots || snapshots.length === 0) {
    return <p className="text-white/30 text-xs">No market data</p>;
  }
  const data = snapshots.map(s => ({
    name: s.asset,
    price: parseFloat(s.final_price.toFixed(2)),
    pct: parseFloat(s.pct_change.toFixed(2)),
  }));

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%">
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false} tickLine={false}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: 'rgba(10,10,20,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
            }}
            formatter={(v, name) => [
              name === 'price' ? `$${v}` : `${v > 0 ? '+' : ''}${v}%`,
              name === 'price' ? 'Price' : '% Change',
            ]}
          />
          <Bar dataKey="price" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={ASSET_COLOR[d.name] || '#6b7280'} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Speech Bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ speech, index }) {
  const [expanded, setExpanded] = useState(false);
  const color = emotionColor(speech.emotion);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      className="rounded-xl p-3 mb-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}25`,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
        <span className="text-xs font-bold text-white/80">{speech.agent}</span>
        <span
          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
          style={{ background: `${color}20`, color }}
        >
          {speech.emotion}
        </span>
        <span
          className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono"
          style={{ background: `${ASSET_COLOR[speech.asset_focus] || '#6b7280'}15`, color: ASSET_COLOR[speech.asset_focus] || '#6b7280' }}
        >
          {speech.asset_focus}
        </span>
        <span className="text-[9px] text-white/25 font-mono">
          {speech.spoken_at?.slice(11, 19) || ''}
        </span>
      </div>
      <p
        className="text-xs text-white/70 leading-relaxed cursor-pointer"
        style={{ display: '-webkit-box', WebkitLineClamp: expanded ? 999 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        onClick={() => setExpanded(e => !e)}
      >
        {speech.content}
      </p>
      {speech.content.length > 200 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] mt-1 font-semibold"
          style={{ color: '#22d3ee' }}
        >
          {expanded ? 'Show less ▲' : 'Show more ▼'}
        </button>
      )}
    </motion.div>
  );
}

// ── Session Detail Panel ──────────────────────────────────────────────────────

function SessionDetail({ sessionId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setDetail(null);
    fetch(`/api/history/${sessionId}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Session Replay</h3>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 text-lg leading-none transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {!loading && !detail && (
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          Failed to load session.
        </div>
      )}

      {detail && (
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar">

          {/* World event */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            <p className="text-[10px] text-cyan-400/60 font-bold uppercase tracking-widest mb-1">World Event</p>
            <p className="text-sm text-white/85 leading-relaxed">{detail.session.world_event}</p>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-xs text-white/40 font-mono">
            <span>Started: {formatTime(detail.session.started_at)}</span>
            {detail.session.ended_at && <span>Ended: {formatTime(detail.session.ended_at)}</span>}
            {detail.session.winner && (
              <span className="text-purple-400 font-bold">🏆 Winner: {detail.session.winner}</span>
            )}
            <span>{detail.speeches.length} speeches</span>
          </div>

          {/* Market Final Prices */}
          {detail.market_snapshots.length > 0 && (
            <div>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">Final Market Prices</p>
              <MarketBars snapshots={detail.market_snapshots} />
              <div className="flex gap-4 mt-1">
                {detail.market_snapshots.map(s => (
                  <div key={s.asset} className="text-center">
                    <p className="text-xs font-bold font-mono" style={{ color: ASSET_COLOR[s.asset] }}>
                      {s.asset}
                    </p>
                    <p className="text-sm font-bold text-white/80">${s.final_price.toFixed(2)}</p>
                    <p
                      className="text-[10px] font-mono"
                      style={{ color: s.pct_change >= 0 ? '#4ade80' : '#f87171' }}
                    >
                      {s.pct_change >= 0 ? '+' : ''}{s.pct_change.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Snapshots */}
          {detail.agent_snapshots.length > 0 && (
            <div>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">Agent Final State</p>
              <div className="space-y-1.5">
                {detail.agent_snapshots.map(a => (
                  <div
                    key={a.agent}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: emotionColor(a.final_emotion), boxShadow: `0 0 5px ${emotionColor(a.final_emotion)}` }}
                    />
                    <span className="text-xs font-bold text-white/70 flex-1">{a.agent}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${emotionColor(a.final_emotion)}20`, color: emotionColor(a.final_emotion) }}
                    >
                      {a.final_emotion}
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono">⚡{a.influence_score}</span>
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: a.portfolio_pnl >= 0 ? '#4ade80' : '#f87171' }}
                    >
                      {a.portfolio_pnl >= 0 ? '+' : ''}${a.portfolio_pnl.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">
              Debate Transcript ({detail.speeches.length})
            </p>
            {detail.speeches.length === 0 ? (
              <p className="text-white/25 text-xs">No speeches recorded.</p>
            ) : (
              detail.speeches.map((s, i) => <SpeechBubble key={s.id} speech={s} index={i} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main HistoryPanel ─────────────────────────────────────────────────────────

export default function HistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchSessions = useCallback(() => {
    fetch('/api/history?limit=50')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const filtered = sessions.filter(s =>
    s.world_event?.toLowerCase().includes(search.toLowerCase()) ||
    s.winner?.toLowerCase().includes(search.toLowerCase()) ||
    s.mode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]"
    >
      {/* Left: Session List */}
      <div
        className="lg:w-[380px] flex-shrink-0 rounded-3xl p-5 flex flex-col gap-4"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white/90 tracking-tight">Session Archive</h2>
            <p className="text-[11px] text-white/35 font-mono mt-0.5">{sessions.length} sessions saved</p>
          </div>
          <button
            onClick={fetchSessions}
            className="p-2 rounded-xl text-white/40 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-white/70 placeholder-white/25 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-2xl">📭</span>
              </div>
              <p className="text-white/30 text-sm font-medium">
                {search ? 'No matching sessions' : 'No sessions yet'}
              </p>
              {!search && (
                <p className="text-white/20 text-xs max-w-[200px]">
                  Inject a world event and let the debate run to completion to save a session.
                </p>
              )}
            </div>
          )}
          <AnimatePresence>
            {filtered.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                isSelected={selectedId === s.id}
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Detail / Empty State */}
      <div
        className="flex-1 rounded-3xl p-6 flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          minHeight: 500,
        }}
      >
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col h-full"
            >
              <SessionDetail sessionId={selectedId} onClose={() => setSelectedId(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
                style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)' }}
              >
                <span className="text-3xl">📜</span>
              </div>
              <p className="text-white/40 font-medium text-sm">Select a session to replay</p>
              <p className="text-white/20 text-xs max-w-[260px] leading-relaxed">
                Click any session card on the left to see the full debate transcript, market outcome, and agent final state.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
