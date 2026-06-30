import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, Zap } from 'lucide-react';

const BASE_PRICE = 100;

// ── Emotion → color for contribution pills ────────────────────────────────────
const DELTA_COLOR = (delta) => {
  if (delta > 1.5)  return { text: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)', border: 'rgba(0, 240, 255, 0.3)' };
  if (delta > 0)    return { text: '#00c3ff', bg: 'rgba(0, 195, 255, 0.1)', border: 'rgba(0, 195, 255, 0.3)' };
  if (delta < -1.5) return { text: '#ff0055', bg: 'rgba(255, 0, 85, 0.1)', border: 'rgba(255, 0, 85, 0.3)' };
  if (delta < 0)    return { text: '#ff3377', bg: 'rgba(255, 51, 119, 0.1)', border: 'rgba(255, 51, 119, 0.3)' };
  return              { text: '#a0aec0', bg: 'rgba(160, 174, 192, 0.1)', border: 'rgba(160, 174, 192, 0.3)' };
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.price >= BASE_PRICE;
  return (
    <div className="backdrop-blur-xl bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-white/50 mb-1">{d.time}</div>
      <div className="font-mono font-bold text-lg" style={{ color: isUp ? '#00f0ff' : '#ff0055' }}>
        {d.price.toFixed(2)}
      </div>
      {d.agent && d.agent !== 'System' && (
        <div className="text-white/60 mt-1">
          {d.agent} · <span style={{ color: isUp ? '#00f0ff' : '#ff0055' }}>
            {d.delta > 0 ? '+' : ''}{d.delta?.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarketChart({ asset = "MACRO", messages }) {
  const [ticks, setTicks]         = useState([{ price: BASE_PRICE, time: '--:--', agent: 'System', emotion: 'neutral', delta: 0 }]);
  const [currentPrice, setCurrentPrice] = useState(BASE_PRICE);
  const [pctChange, setPctChange] = useState(0);
  const [bull, setBull]           = useState(0);
  const [bear, setBear]           = useState(0);
  const [recentEvents, setRecentEvents] = useState([]);
  const [isFlashing, setIsFlashing]     = useState(false);
  const [newTickFlash, setNewTickFlash] = useState(false);
  const prevPrice = useRef(BASE_PRICE);

  // ── Initial load from REST ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/market_state')
      .then(r => r.json())
      .then(states => {
        const data = states[asset] || {};
        if (data.ticks?.length) setTicks(data.ticks);
        setCurrentPrice(data.current_price ?? BASE_PRICE);
        setPctChange(data.pct_change ?? 0);
        setBull(data.bull_pressure ?? 0);
        setBear(data.bear_pressure ?? 0);
        setRecentEvents(data.recent_events ?? []);
        prevPrice.current = data.current_price ?? BASE_PRICE;
      })
      .catch(() => {});
  }, [asset]);

  // ── React to WebSocket messages ───────────────────────────────────────────
  useEffect(() => {
    if (!messages?.length) return;
    const last = messages[messages.length - 1];

    if (last.type === 'market_reset') {
      // Flash the whole chart white, reset state
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
      setTicks([{ price: BASE_PRICE, time: last.time || '--:--', agent: 'System', emotion: 'neutral', delta: 0 }]);
      setCurrentPrice(BASE_PRICE);
      setPctChange(0);
      setBull(0);
      setBear(0);
      setRecentEvents([]);
      prevPrice.current = BASE_PRICE;
    }

    if (last.type === 'market_tick' && last.asset === asset) {
      const { price, delta, agent, emotion, time } = last;
      const newTick = { price, delta: delta ?? 0, agent, emotion, time };

      prevPrice.current = currentPrice;
      setCurrentPrice(price);
      setPctChange(((price - BASE_PRICE) / BASE_PRICE) * 100);

      setTicks(prev => {
        const updated = [...prev, newTick];
        return updated.slice(-60); // keep last 60 ticks
      });

      setRecentEvents(prev => [newTick, ...prev].slice(0, 5));

      // Brief glow flash on the price number
      setNewTickFlash(true);
      setTimeout(() => setNewTickFlash(false), 400);

      // Update bull/bear
      if (delta > 0) setBull(b => b + delta);
      else if (delta < 0) setBear(b => b + Math.abs(delta));
    }
  }, [messages]);

  // Derived state
  const isUp    = currentPrice >= BASE_PRICE;
  const chartColor = isUp ? '#00f0ff' : '#ff0055';
  const chartGlow = isUp ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 0, 85, 0.15)';
  const totalPressure = bull + bear;
  const bullPct = totalPressure > 0 ? (bull / totalPressure) * 100 : 50;
  const bearPct = 100 - bullPct;

  return (
    <motion.div
      className="relative w-full rounded-3xl overflow-hidden glass-panel"
      animate={{
        backgroundColor: isFlashing ? 'rgba(255,255,255,0.1)' : 'var(--glass-bg)',
        borderColor: isFlashing ? 'rgba(255,255,255,0.3)' : (isUp ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 0, 85, 0.2)'),
        boxShadow: isFlashing ? '0 0 40px rgba(255,255,255,0.2)' : `0 8px 32px ${chartGlow}`
      }}
      transition={{ duration: 0.4 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">

        {/* Left: Label + current price */}
        <div className="flex items-center gap-6">
          <div>
            <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3" />
              {asset} MARKET
            </div>
            <div className="flex items-baseline gap-3">
              <motion.div
                key={Math.round(currentPrice * 100)}
                initial={{ opacity: 0.5, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono font-black text-3xl"
                style={{
                  color: chartColor,
                  textShadow: newTickFlash ? `0 0 20px ${chartColor}` : 'none',
                  transition: 'text-shadow 0.3s, color 0.4s',
                }}
              >
                {currentPrice.toFixed(2)}
              </motion.div>
              <div className="flex items-center gap-1 text-sm font-bold" style={{ color: chartColor }}>
                {isUp ? <TrendingUp className="w-4 h-4" /> : (pctChange === 0 ? <Minus className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-10 bg-white/10" />

          {/* Bull / Bear pressure bar */}
          <div className="min-w-[160px]">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <span style={{ color: '#00f0ff' }}>Bull {bullPct.toFixed(0)}%</span>
              <span style={{ color: '#ff0055' }}>{bearPct.toFixed(0)}% Bear</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <motion.div
                className="h-full rounded-l-full relative overflow-hidden"
                style={{ backgroundColor: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }}
                animate={{ width: `${bullPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.div
                className="h-full rounded-r-full relative overflow-hidden"
                style={{ backgroundColor: '#ff0055', boxShadow: '0 0 10px #ff0055' }}
                animate={{ width: `${bearPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/30 mt-1">
              <span>+{bull.toFixed(1)}</span>
              <span>{bear.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Right: Recent contribution pills */}
        <div className="flex items-center gap-2 flex-wrap justify-end max-w-xs">
          <AnimatePresence mode="popLayout">
            {recentEvents.map((e, i) => {
              const c = DELTA_COLOR(e.delta ?? 0);
              return (
                <motion.div
                  key={`${e.time}-${e.agent}-${i}`}
                  initial={{ opacity: 0, scale: 0.8, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.25 }}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ color: c.text, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {e.agent?.replace('The ', '')} {(e.delta ?? 0) > 0 ? '+' : ''}{(e.delta ?? 0).toFixed(1)}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40 px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ticks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradientUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00f0ff" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="priceGradientDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ff0055" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ff0055" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(0)}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Base price reference line */}
            <ReferenceLine
              y={BASE_PRICE}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              label={{ value: 'BASE', fill: 'rgba(255,255,255,0.2)', fontSize: 9, position: 'insideTopRight' }}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2}
              fill={isUp ? 'url(#priceGradientUp)' : 'url(#priceGradientDown)'}
              dot={false}
              activeDot={{
                r: 5,
                fill: chartColor,
                stroke: 'rgba(0,0,0,0.5)',
                strokeWidth: 2,
                filter: `drop-shadow(0 0 6px ${chartColor})`,
              }}
              animationDuration={300}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
