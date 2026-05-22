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
    <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
      
      <h2 className="text-2xl font-black text-black mb-2 flex items-center uppercase tracking-tighter">
        <Zap className="w-6 h-6 text-blue-600 mr-2" />
        Policy Injector
      </h2>
      <p className="text-gray-500 text-sm mb-4 font-bold uppercase tracking-wider">Inject a macro-economic event into the simulation.</p>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="e.g. The Federal Reserve just announced a surprise 0.75% rate hike..."
          className="w-full bg-gray-50 border-2 border-gray-300 p-4 text-black font-mono placeholder-gray-400 focus:outline-none focus:border-black focus:ring-0 transition-all resize-none h-28"
        />
        <button 
          type="submit" 
          disabled={loading || !seed.trim()}
          className="bg-black hover:bg-blue-600 text-white font-black py-3 px-4 flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-black uppercase tracking-widest border-2 border-transparent hover:border-black"
        >
          {loading ? 'Injecting...' : 'Inject Event'}
          <Send className="w-4 h-4 ml-2" />
        </button>
      </form>
    </div>
  );
}
