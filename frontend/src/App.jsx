import { useState, useEffect, useRef } from 'react';
import GodInput from './components/GodInput';
import LiveSimulation from './components/LiveSimulation';
import AgentNetwork from './components/AgentNetwork';
import SentimentDashboard from './components/SentimentDashboard';
import MarketChart from './components/MarketChart';

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
    <div className="min-h-screen w-full p-8 lg:p-12 flex flex-col font-sans text-white selection:bg-[#ff6b6b]/30">

      {/* Header */}
      <header className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <div className="w-4 h-4 bg-white/80 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
            SharkFin<span className="text-white/40 font-light">_OS</span>
          </h1>
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 px-6 py-3 rounded-full text-sm font-semibold text-white/70 flex items-center shadow-[0_0_20px_rgba(255,255,255,0.05)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-3 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          Macro-Economic Sandbox
        </div>
      </header>

      <div className="flex flex-col gap-6 flex-1 pb-10">

        {/* Row 1: Force Graph */}
        <div className="h-[50vh] w-full">
          <AgentNetwork messages={messages} />
        </div>

        {/* Row 2: Market Impact Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <MarketChart asset="TECH" messages={messages} />
          <MarketChart asset="CRYPTO" messages={messages} />
          <MarketChart asset="MACRO" messages={messages} />
        </div>

        {/* Row 3: Sentiment + GodInput | Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

          {/* Left: Sentiment Dashboard + God Input */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-1">
              <SentimentDashboard messages={messages} />
            </div>
            <div className="shrink-0">
              <GodInput onInject={handleInjectSeed} messages={messages} />
            </div>
          </div>

          {/* Right: Live Chat Feed */}
          <div className="lg:col-span-8 h-[700px]">
            <LiveSimulation messages={messages} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
