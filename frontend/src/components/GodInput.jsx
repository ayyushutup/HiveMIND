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
  const color = isRunning ? '#38b2ac' : '#4a5568';

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
    await onInject(seed);
    setSeed('');
    setLoading(false);
  };

  return (
    <motion.div
      className="glass-panel rounded-3xl p-6 relative flex flex-col gap-5 overflow-hidden"
      animate={{
        borderColor: autopilot
          ? firePulse ? 'rgba(255,255,255,0.6)' : 'rgba(56,178,172,0.4)'
          : 'rgba(255,255,255,0.05)',
        backgroundColor: autopilot ? 'rgba(56,178,172,0.04)' : 'rgba(255,255,255,0.02)',
        boxShadow: autopilot
          ? firePulse
            ? '0 0 60px rgba(255,255,255,0.2)'
            : '0 0 40px rgba(56,178,172,0.15)'
          : '0 8px 32px rgba(0,0,0,0.2)',
      }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={autopilot ? 'auto' : 'manual'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block border"
              style={autopilot
                ? { backgroundColor: '#38b2ac18', color: '#38b2ac', borderColor: '#38b2ac44' }
                : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)' }
              }
            >
              {autopilot ? '● Autopilot Active' : 'Control Panel'}
            </motion.div>
          </AnimatePresence>
          <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md">SIMULATION</h2>
        </div>
        <Zap className="w-6 h-6 text-white/30" />
      </div>

      {/* ── AUTOPILOT SECTION ── */}
      <div
        className="rounded-2xl border p-4 flex flex-col gap-4"
        style={{
          borderColor: autopilot ? '#38b2ac33' : 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(0,0,0,0.2)',
        }}
      >
        {/* Top row: ring + controls */}
        <div className="flex items-center gap-4">
          {/* Countdown ring */}
          <CountdownRing
            secondsRemaining={secondsLeft}
            interval={interval}
            isRunning={autopilot}
          />

          {/* Right side: play/pause + interval */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Play/Pause button */}
            <motion.button
              type="button"
              onClick={toggleAutopilot}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 font-bold py-2.5 px-5 rounded-full border transition-all text-sm"
              style={autopilot
                ? { backgroundColor: '#38b2ac22', borderColor: '#38b2ac66', color: '#38b2ac', boxShadow: '0 0 16px rgba(56,178,172,0.3)' }
                : { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }
              }
            >
              {autopilot
                ? <><Pause className="w-4 h-4" /> Pause Autopilot</>
                : <><Play className="w-4 h-4" /> Start Autopilot</>
              }
            </motion.button>

            {/* Interval slider */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-xs whitespace-nowrap">Every</span>
                <input
                  type="range"
                  min={10} max={180} step={5}
                  value={interval}
                  onChange={e => setInterval_(Number(e.target.value))}
                  onPointerUp={e => handleIntervalChange(Number(e.target.value))}
                  className="flex-1 accent-[#38b2ac]"
                />
                <span className="font-mono font-bold text-sm w-10 text-right" style={{ color: '#38b2ac' }}>
                  {interval}s
                </span>
              </div>
              
              {/* Dynamic mode toggle */}
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-white/40 text-xs whitespace-nowrap">Dynamic Events (LLM)</span>
                <button 
                  type="button" 
                  onClick={() => handleDynamicChange(!dynamic)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${dynamic ? 'bg-[#38b2ac]' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${dynamic ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Last event pill */}
        <AnimatePresence mode="wait">
          {lastEvent ? (
            <motion.div
              key={lastEvent.slice(0, 20)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs rounded-xl px-3 py-2 border leading-relaxed"
              style={{
                backgroundColor: 'rgba(56,178,172,0.08)',
                borderColor: '#38b2ac33',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span className="font-bold uppercase tracking-wider text-[#38b2ac] mr-2">Last:</span>
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

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs uppercase tracking-widest">or inject manually</span>
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
          placeholder="Inject world event (e.g. The Fed hikes rates by 75bps...)"
          className="w-full bg-black/40 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-[#b794f4]/50 focus:bg-black/60 focus:ring-1 focus:ring-[#b794f4]/30 transition-all resize-none h-24 rounded-2xl p-4 text-sm font-medium shadow-inner"
        />

        <motion.button
          type="submit"
          disabled={loading || !seed.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-[#38b2ac]/20 to-[#b794f4]/20 hover:from-[#38b2ac]/30 hover:to-[#b794f4]/30 border border-white/10 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(183,148,244,0.3)] disabled:opacity-40 disabled:pointer-events-none backdrop-blur-md text-sm"
        >
          {loading ? 'Initializing...' : 'Run Simulation'}
          <Send className="w-4 h-4 ml-2" />
        </motion.button>
      </form>
    </motion.div>
  );
}
