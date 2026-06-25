import { useState, useEffect, useRef } from 'react';
import GodInput from './components/GodInput';
import LiveSimulation from './components/LiveSimulation';
import AgentNetwork from './components/AgentNetwork';
import SentimentDashboard from './components/SentimentDashboard';
import MarketChart from './components/MarketChart';
import { motion } from 'framer-motion';

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
    <div className="min-h-screen w-full p-4 md:p-8 lg:p-12 flex flex-col font-sans text-white selection:bg-[#b794f4]/30 overflow-x-hidden">

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-10 flex flex-col md:flex-row items-center justify-between px-4 py-4 md:py-2 glass-panel rounded-2xl md:rounded-full gap-4"
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#38b2ac] to-[#b794f4] p-[1px] shadow-[0_0_20px_rgba(56,178,172,0.3)]">
            <div className="w-full h-full bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 drop-shadow-sm">
            SharkFin<span className="font-light opacity-50">_OS</span>
          </h1>
        </div>
        <div className="px-6 py-2.5 rounded-full text-sm font-medium tracking-wide text-[#38b2ac] flex items-center bg-[#38b2ac]/10 border border-[#38b2ac]/20 shadow-[inset_0_0_12px_rgba(56,178,172,0.1)]">
          <span className="w-2 h-2 rounded-full bg-[#38b2ac] animate-pulse mr-3 shadow-[0_0_8px_rgba(56,178,172,0.8)]"></span>
          Macro-Economic Sandbox
        </div>
      </motion.header>

      <motion.div 
        variants={pageVariants}
        initial="initial"
        animate="animate"
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

          {/* Left: Sentiment Dashboard + God Input */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-1 glass-panel rounded-3xl p-6">
              <SentimentDashboard messages={messages} />
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
    </div>
  );
}

export default App;
