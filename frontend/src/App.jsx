import { useState, useEffect, useRef } from 'react';
import GodInput from './components/GodInput';
import LiveSimulation from './components/LiveSimulation';
import AgentNetwork from './components/AgentNetwork';

function App() {
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    // Connect to FastAPI WebSocket
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
    // Post to FastAPI backend
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
    <div className="min-h-screen w-full bg-[#222222] p-8 lg:p-12 flex flex-col font-sans text-gray-900 selection:bg-[#ff6b6b]/30">
      
      {/* Soft Header */}
      <header className="mb-10 flex items-center justify-between px-2">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#333333] rounded-full flex items-center justify-center shadow-inner">
              <div className="w-5 h-5 bg-black rounded-full" />
            </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                SharkFin<span className="text-gray-500 font-medium">_OS</span>
              </h1>
            </div>
          </div>
          <div className="bg-[#2d2d2d] px-6 py-3 rounded-full text-sm font-semibold text-gray-300 flex items-center shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-3"></span>
            Macro-Economic Sandbox
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: God Input & Agent Status */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <GodInput onInject={handleInjectSeed} />
            <div className="flex-1 min-h-[400px]">
              <AgentNetwork messages={messages} />
            </div>
          </div>

          {/* Right Column: Live Feed */}
          <div className="lg:col-span-7">
            <LiveSimulation messages={messages} />
          </div>
        </div>
    </div>
  );
}

export default App;
