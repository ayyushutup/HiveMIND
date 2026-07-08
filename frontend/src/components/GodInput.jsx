import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Zap, Settings, Play, Pause, Radio } from 'lucide-react';

// ── SVG Countdown Ring ────────────────────────────────────────────────────────
function CountdownRing({ secondsRemaining, interval, isRunning, onFire }) {
  const SIZE = 88;
  const STROKE = 5;
  const R = (SIZE - STROKE * 2) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = isRunning && interval > 0
    ? Math.max(0, secondsRemaining / interval)
    : 0;
  const dashOffset = CIRC * (1 - progress);
  const color = isRunning ? 'var(--color-brand-cyan)' : '#4a5568';

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        {/* Progress arc */}
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          animate={{ strokeDashoffset: dashOffset, stroke: color }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ filter: isRunning ? `drop-shadow(0 0 4px ${color})` : 'none' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isRunning ? (
          <>
            <span className="font-mono font-black text-xl" style={{ color, lineHeight: 1 }}>
              {secondsRemaining}
            </span>
            <span className="text-white/30 text-[9px] uppercase tracking-wider mt-0.5">sec</span>
          </>
        ) : (
          <Radio className="w-5 h-5 text-white/20" />
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GodInput({ onInject, messages }) {
  // Manual injection state
  const [seed, setSeed]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [maxRounds, setMaxRounds] = useState(12);
  const [activeMode, setActiveMode] = useState('macro');

  // Autopilot state
  const [autopilot, setAutopilot]           = useState(false);
  const [interval, setInterval_]            = useState(60);
  const [secondsLeft, setSecondsLeft]       = useState(0);
  const [lastEvent, setLastEvent]           = useState('');
  const [dynamic, setDynamic]               = useState(false);
  const [firePulse, setFirePulse]           = useState(false);
  const countdownRef = useRef(null);
  const nextFireAtRef = useRef(0);

  // ── Sync with server on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/autopilot/status')
      .then(r => r.json())
      .then(data => {
        setAutopilot(data.running);
        setInterval_(data.interval ?? 60);
        setLastEvent(data.last_event ?? '');
        setDynamic(data.dynamic ?? false);
        setActiveMode(data.mode ?? 'macro');
        if (data.running && data.next_fire_at) {
          nextFireAtRef.current = data.next_fire_at * 1000; // convert to ms
          const secs = Math.max(0, Math.round((data.next_fire_at * 1000 - Date.now()) / 1000));
          setSecondsLeft(secs);
        }
      })
      .catch(() => {});
  }, []);

  // ── React to WebSocket messages ───────────────────────────────────────────
  useEffect(() => {
    if (!messages?.length) return;
    const last = messages[messages.length - 1];

    if (last.type === 'autopilot_tick') {
      setAutopilot(last.running);
      if (last.running && last.next_fire_at) {
        nextFireAtRef.current = last.next_fire_at * 1000;
        const secs = Math.max(0, Math.round((last.next_fire_at * 1000 - Date.now()) / 1000));
        setSecondsLeft(secs);
        setInterval_(last.interval ?? 60);
      }
      if (last.last_event) setLastEvent(last.last_event);
    }

    if (last.type === 'autopilot_fired') {
      setLastEvent(last.event ?? '');
      setFirePulse(true);
      setTimeout(() => setFirePulse(false), 800);
    }

    if (last.type === 'system_config') {
      if (last.config?.mode) {
        setActiveMode(last.config.mode);
      }
    }
  }, [messages]);

  // ── Local countdown ticker (runs client-side for smooth updates) ──────────
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!autopilot) { setSecondsLeft(0); return; }

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((nextFireAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 500);

    return () => clearInterval(countdownRef.current);
  }, [autopilot]);

  // ── Autopilot toggle ──────────────────────────────────────────────────────
  const toggleAutopilot = useCallback(async () => {
    if (autopilot) {
      await fetch('/api/autopilot/stop', { method: 'POST' });
      setAutopilot(false);
      setSecondsLeft(0);
    } else {
      await fetch('/api/autopilot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_seconds: interval, dynamic }),
      });
      setAutopilot(true);
    }
  }, [autopilot, interval, dynamic]);

  // Update interval on backend while running
  const handleIntervalChange = useCallback(async (newVal) => {
    setInterval_(newVal);
    if (autopilot) {
      // Restart with new interval
      await fetch('/api/autopilot/stop', { method: 'POST' });
      await fetch('/api/autopilot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_seconds: newVal, dynamic }),
      });
    }
  }, [autopilot, dynamic]);

  const handleDynamicChange = useCallback(async (newVal) => {
    setDynamic(newVal);
    if (autopilot) {
      await fetch('/api/autopilot/stop', { method: 'POST' });
      await fetch('/api/autopilot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_seconds: interval, dynamic: newVal }),
      });
    }
  }, [autopilot, interval]);

  const handleModeChange = async (newMode) => {
    setActiveMode(newMode);
    try {
      await fetch('/api/set_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });
    } catch (err) {
      console.error("Failed to set mode:", err);
    }
  };

  // ── Manual injection ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!seed.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/update_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_rounds: maxRounds })
      });
    } catch {}

    if (activeMode === 'red_team') {
      try {
        await fetch('/api/inject_strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: seed })
        });
      } catch (err) {
        console.error("Strategy injection failed:", err);
      }
    } else {
      await onInject(seed);
    }
    setSeed('');
    setLoading(false);
  };

  return (
    <motion.div
      className="glass-panel rounded-3xl p-6 relative flex flex-col gap-5 overflow-hidden"
      animate={{
        borderColor: autopilot
          ? firePulse ? 'rgba(255,255,255,0.6)' : 'rgba(0,240,255,0.4)'
          : 'rgba(255,255,255,0.05)',
        backgroundColor: autopilot ? 'rgba(0,240,255,0.04)' : 'var(--glass-bg)',
        boxShadow: autopilot
          ? firePulse
            ? '0 0 60px rgba(255,255,255,0.2)'
            : '0 0 40px rgba(0,240,255,0.15)'
          : '0 8px 32px rgba(0,0,0,0.2)',
      }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMode === 'red_team' ? 'redteam' : (autopilot ? 'auto' : 'manual')}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block border"
              style={activeMode === 'red_team'
                ? { backgroundColor: 'rgba(189,0,255,0.1)', color: 'var(--color-brand-purple)', borderColor: 'rgba(189,0,255,0.3)' }
                : autopilot
                  ? { backgroundColor: 'rgba(0,240,255,0.1)', color: 'var(--color-brand-cyan)', borderColor: 'rgba(0,240,255,0.3)' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)' }
              }
            >
              {activeMode === 'red_team' ? '🛡️ Risk Stress-Testing' : (autopilot ? '● Autopilot Active' : 'Control Panel')}
            </motion.div>
          </AnimatePresence>
          <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md">
            {activeMode === 'red_team' ? 'RED TEAMING' : 'SIMULATION'}
          </h2>
        </div>
        <Zap className="w-6 h-6 text-white/30" />
      </div>

      {/* Mode Selector */}
      <div className="flex border border-white/10 rounded-2xl p-1 bg-black/20">
        <button
          type="button"
          onClick={() => handleModeChange("macro")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all ${activeMode === "macro" ? "bg-white/10 text-white shadow-md border border-white/10" : "text-white/40 hover:text-white/70"}`}
        >
          Macro Sandbox
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("red_team")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all ${activeMode === "red_team" ? "bg-[var(--color-brand-purple)]/20 text-white shadow-md border border-[var(--color-brand-purple)]/30" : "text-white/40 hover:text-white/70"}`}
        >
          Corporate Red-Teaming
        </button>
      </div>

      {activeMode === 'macro' ? (
        /* ── AUTOPILOT SECTION ── */
        <div
          className="rounded-2xl border p-4 flex flex-col gap-4"
          style={{
            borderColor: autopilot ? '#38b2ac33' : 'rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          {/* Top row: ring + controls */}
          <div className="flex items-center gap-4">
            <CountdownRing
              secondsRemaining={secondsLeft}
              interval={interval}
              isRunning={autopilot}
            />

            <div className="flex-1 flex flex-col gap-3">
              <motion.button
                type="button"
                onClick={toggleAutopilot}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center gap-2 font-bold py-2.5 px-5 rounded-full border transition-all text-sm"
                style={autopilot
                  ? { backgroundColor: 'transparent', color: '#ff0055', borderColor: '#ff005544' }
                  : { backgroundColor: 'var(--color-brand-cyan)', color: 'black', borderColor: 'transparent' }
                }
              >
                {autopilot ? (
                  <><Pause className="w-4 h-4 fill-current" />Pause Autopilot</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" />Start Autopilot</>
                )}
              </motion.button>

              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-white/40 text-xs whitespace-nowrap">Frequency (seconds)</span>
                <input
                  type="range" min="10" max="300" step="10"
                  value={interval}
                  disabled={autopilot}
                  onChange={e => handleIntervalChange(Number(e.target.value))}
                  className="w-full accent-cyan-400 opacity-80 disabled:opacity-30"
                />
                <span className="font-mono text-xs text-white/60 w-8 text-right">{interval}s</span>
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-white/40 text-xs whitespace-nowrap">Dynamic Events (LLM)</span>
                <button 
                  type="button" 
                  onClick={() => handleDynamicChange(!dynamic)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${dynamic ? 'bg-[var(--color-brand-cyan)] glow-accent' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${dynamic ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {lastEvent ? (
              <motion.div
                key={lastEvent.slice(0, 20)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs rounded-xl px-3 py-2 border leading-relaxed"
                style={{
                  backgroundColor: 'rgba(0,240,255,0.08)',
                  borderColor: 'rgba(0,240,255,0.3)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <span className="font-bold uppercase tracking-wider text-[var(--color-brand-cyan)] mr-2">Last:</span>
                {lastEvent.length > 90 ? lastEvent.slice(0, 87) + '…' : lastEvent}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-white/20 text-center py-1"
              >
                No events fired yet
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ── RED-TEAMING EXPLANATION ── */
        <div className="rounded-2xl border border-[var(--color-brand-purple)]/20 p-4 bg-purple-950/10 flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand-purple)]">🛡️ AI Red-Teaming Mode</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Submit a strategy, product idea, or corporate change. The corporate stakeholders (CFO, Legal Officer, Risk CISO, Competitor, Advocate) will debate to identify risks and potential points of failure.
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs uppercase tracking-widest">
          {activeMode === 'red_team' ? 'submit strategy proposal' : 'or inject manually'}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* ── MANUAL SECTION ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Max rounds slider */}
        <div className="bg-black/20 border border-white/5 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center text-white/70 font-bold text-sm">
            <Settings className="w-3.5 h-3.5 mr-2 text-[#4facfe]" />
            Max Rounds
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range" min="2" max="30"
              value={maxRounds}
              onChange={e => setMaxRounds(e.target.value)}
              className="w-20 accent-[#4facfe]"
            />
            <span className="font-mono font-bold text-[#4facfe] w-6 text-right text-sm">{maxRounds}</span>
          </div>
        </div>

        <textarea
          value={seed}
          onChange={e => setSeed(e.target.value)}
          placeholder={activeMode === 'red_team' 
            ? "e.g. We plan to migrate all corporate codebases to a new hosting provider to cut infrastructure costs by 30%..."
            : "Inject world event (e.g. The Fed hikes rates by 75bps...)"}
          className="w-full bg-black/40 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-[var(--color-brand-purple)]/50 focus:bg-black/60 focus:ring-1 focus:ring-[var(--color-brand-purple)]/30 transition-all resize-none h-24 rounded-2xl p-4 text-sm font-medium shadow-inner"
        />

        <motion.button
          type="submit"
          disabled={loading || !seed.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-[var(--color-brand-cyan)]/20 to-[var(--color-brand-purple)]/20 hover:from-[var(--color-brand-cyan)]/30 hover:to-[var(--color-brand-purple)]/30 border border-white/10 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_var(--color-brand-purple)] disabled:opacity-40 disabled:pointer-events-none backdrop-blur-md text-sm group"
        >
          {loading ? 'Initializing...' : (activeMode === 'red_team' ? 'Execute Red-Teaming' : 'Run Simulation')}
          <Send className="w-4 h-4 ml-2" />
        </motion.button>
      </form>
    </motion.div>
  );
}
