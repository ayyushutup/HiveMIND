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
    <div className="min-h-screen bg-gray-50 p-8 text-gray-900 selection:bg-blue-600/30">
      <header className="mb-8 border-b-2 border-black pb-4">
        <h1 className="text-5xl font-black tracking-tighter text-black uppercase">
          SharkFin<span className="text-blue-600 font-light">_OS</span>
        </h1>
        <p className="text-gray-500 mt-2 text-sm uppercase tracking-widest font-bold">Macro-Economic Policy Sandbox</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: God Input & Agent Status */}
        <div className="lg:col-span-1 space-y-8">
          <GodInput onInject={handleInjectSeed} />
          
          <AgentNetwork messages={messages} />
        </div>

        {/* Right Column: Live Feed */}
        <div className="lg:col-span-2">
          <LiveSimulation messages={messages} />
        </div>
      </div>
    </div>
  );
}

export default App;
