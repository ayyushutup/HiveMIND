import { useState } from 'react';
import { Send, Zap, Settings } from 'lucide-react';

export default function GodInput({ onInject }) {
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxRounds, setMaxRounds] = useState(12);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!seed.trim()) return;
    
    setLoading(true);
    
    // First update the config
    try {
      await fetch('/api/update_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_rounds: maxRounds })
      });
    } catch (err) {
      console.error("Config update failed:", err);
    }

    // Then inject the seed
    await onInject(seed);
    setSeed('');
    setLoading(false);
  };

  return (
    <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative flex flex-col justify-between h-full">
      
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="bg-white/5 border border-white/10 text-white/60 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
            Control Panel
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight flex items-center drop-shadow-md">
            SIMULATION
          </h2>
        </div>
        <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <Zap className="w-6 h-6 text-white" />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-5 flex-1">
        
        {/* Config Area */}
        <div className="bg-black/20 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center text-white/80 font-bold">
                <Settings className="w-4 h-4 mr-2 text-[#4facfe]" />
                Max Debate Rounds
            </div>
            <div className="flex items-center space-x-3">
                <input 
                    type="range" 
                    min="2" max="30" 
                    value={maxRounds} 
                    onChange={e => setMaxRounds(e.target.value)}
                    className="w-24 accent-[#4facfe]"
                />
                <span className="font-mono font-bold text-white w-6 text-right drop-shadow-[0_0_5px_currentColor] text-[#4facfe]">{maxRounds}</span>
            </div>
        </div>

        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Inject world event (e.g. The Federal Reserve hikes rates...)"
          className="w-full flex-1 bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4facfe]/50 focus:bg-black/60 transition-all resize-none min-h-[100px] rounded-2xl p-5 text-lg font-medium shadow-inner"
        />
        
        <button 
          type="submit" 
          disabled={loading || !seed.trim()}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50 disabled:active:scale-100 backdrop-blur-md"
        >
          {loading ? 'Initializing Protocol...' : 'Run Simulation'}
          <Send className="w-5 h-5 ml-3" />
        </button>
      </form>
    </div>
  );
}
