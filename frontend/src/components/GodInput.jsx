import { useState } from 'react';
import { Send, Zap } from 'lucide-react';

export default function GodInput({ onInject }) {
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!seed.trim()) return;
    
    setLoading(true);
    await onInject(seed);
    setSeed('');
    setLoading(false);
  };

  return (
    <div className="bg-[#ff6b6b] rounded-[2rem] p-8 shadow-lg relative flex flex-col justify-between">
      
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="bg-black/10 text-black/80 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
            God-Mode
          </div>
          <h2 className="text-3xl font-bold text-[#222] leading-tight">
            INJECT POLICY
          </h2>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <Zap className="w-6 h-6 text-[#222]" />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="e.g. The Federal Reserve hikes rates by 1.5%..."
          className="w-full bg-[#ff7f7f] text-[#222] placeholder-[#222]/50 focus:outline-none focus:bg-white/40 transition-all resize-none h-28 rounded-2xl p-5 text-lg font-medium shadow-inner"
        />
        <button 
          type="submit" 
          disabled={loading || !seed.trim()}
          className="bg-[#222] hover:bg-black text-white font-bold py-4 px-6 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-xl"
        >
          {loading ? 'Initializing Protocol...' : 'Run Simulation'}
          <Send className="w-5 h-5 ml-3" />
        </button>
      </form>
    </div>
  );
}
