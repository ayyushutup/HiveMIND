import { useState, useEffect, useRef } from 'react';
import GodInput from './components/GodInput';
import LiveSimulation from './components/LiveSimulation';
import AgentNetwork from './components/AgentNetwork';
import SentimentDashboard from './components/SentimentDashboard';
import MarketChart from './components/MarketChart';
import PortfolioTracker from './components/PortfolioTracker';
import FearAndGreedGauge from './components/FearAndGreedGauge';
import TickerTape from './components/TickerTape';
import HistoryPanel from './components/HistoryPanel';
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.1 } }
};

const itemVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

function App() {
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://${window.location.host}/ws_api`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const handleInjectSeed = async (seedText) => {
    try {
      await fetch('/api/inject_seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seedText })
      });
    } catch (err) {
      console.error("Injection failed:", err);
    }
  };

  return (
    <div className="min-h-screen w-full p-4 md:p-6 lg:p-8 flex flex-col font-sans text-white selection:bg-cyan-500/30 overflow-x-hidden relative z-10">
      
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none z-0"></div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-8 flex flex-col md:flex-row items-center justify-between px-6 py-4 glass-panel rounded-2xl md:rounded-3xl gap-4 relative z-10"
      >
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--color-brand-cyan)] to-[var(--color-brand-purple)] p-[2px] glow-accent">
            <div className="w-full h-full bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center">
              <div className="w-5 h-5 bg-white shadow-[0_0_15px_rgba(255,255,255,1)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 drop-shadow-sm">
              SharkFin<span className="font-light text-gradient">_OS</span>
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-mono mt-0.5">Neural Market Engine v2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <FearAndGreedGauge messages={messages} />
          <div className="px-6 py-2.5 rounded-full text-sm font-semibold tracking-wide text-[var(--color-brand-cyan)] flex items-center bg-[var(--color-brand-cyan)]/10 border border-[var(--color-brand-cyan)]/30 shadow-[inset_0_0_12px_rgba(0,240,255,0.15)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand-cyan)] animate-pulse mr-3 shadow-[0_0_10px_rgba(0,240,255,0.8)]"></span>
            Live Simulation Active
          </div>
        </div>
      </motion.header>

      {/* Ticker Tape - Full Width */}
      <div className="-mx-4 md:-mx-6 lg:-mx-8 mb-6">
        <TickerTape messages={messages} />
      </div>

      {/* Tab Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex items-center gap-1 mb-8 p-1 rounded-2xl relative z-10 self-start"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {[
          { id: 'live', label: '⚡ Live', color: '#22d3ee' },
          { id: 'history', label: '📜 History', color: '#a78bfa' },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="relative px-6 py-2 rounded-xl text-sm font-bold tracking-wide transition-all duration-200"
            style={{
              color: activeTab === tab.id ? tab.color : 'rgba(255,255,255,0.35)',
              background: activeTab === tab.id ? `${tab.color}15` : 'transparent',
              border: activeTab === tab.id ? `1px solid ${tab.color}35` : '1px solid transparent',
              boxShadow: activeTab === tab.id ? `0 0 16px ${tab.color}15` : 'none',
            }}
          >
            {tab.label}
            {tab.id === 'live' && (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }}
              />
            )}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'live' ? (
          <motion.div
            key="live"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0 }}
            className="flex flex-col gap-8 flex-1 pb-10"
          >
            {/* Row 1: Force Graph */}
            <motion.div variants={itemVariants} className="h-[50vh] w-full glass-panel rounded-3xl overflow-hidden relative">
              <div className="absolute top-4 left-6 z-10 text-xs font-bold tracking-widest text-white/40 uppercase">Agent Topology</div>
              <AgentNetwork messages={messages} />
            </motion.div>

            {/* Row 2: Market Impact Charts */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <MarketChart asset="TECH" messages={messages} />
              <MarketChart asset="CRYPTO" messages={messages} />
              <MarketChart asset="MACRO" messages={messages} />
            </motion.div>

            {/* Row 3: Sentiment + GodInput | Live Feed */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Left: Sentiment Dashboard + Portfolio + God Input */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="flex-1 glass-panel rounded-3xl p-6 min-h-[400px]">
                  <SentimentDashboard messages={messages} />
                </div>
                <div className="flex-1 glass-panel rounded-3xl p-0 min-h-[300px] overflow-hidden">
                  <PortfolioTracker />
                </div>
                <div className="shrink-0 glass-panel rounded-3xl p-6">
                  <GodInput onInject={handleInjectSeed} messages={messages} />
                </div>
              </div>

              {/* Right: Live Chat Feed */}
              <div className="lg:col-span-8 h-[700px] glass-panel rounded-3xl p-6 flex flex-col">
                <LiveSimulation messages={messages} />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 pb-10"
          >
            <HistoryPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
