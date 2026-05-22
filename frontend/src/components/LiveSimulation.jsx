import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Cpu, User, AlertCircle } from 'lucide-react';

export default function LiveSimulation({ messages }) {
  const feedRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const getEmotionColor = (emotion) => {
    const e = emotion?.toLowerCase() || '';
    if (['panicked', 'angry', 'aggressive'].includes(e)) return 'text-red-700 border-red-600 bg-white shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]';
    if (['calculating', 'cold', 'analytical'].includes(e)) return 'text-blue-700 border-blue-600 bg-white shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]';
    if (['philosophical', 'peaceful', 'calm'].includes(e)) return 'text-emerald-700 border-emerald-600 bg-white shadow-[4px_4px_0px_0px_rgba(5,150,105,1)]';
    if (['paranoid', 'terrified', 'suspicious'].includes(e)) return 'text-amber-700 border-amber-600 bg-white shadow-[4px_4px_0px_0px_rgba(217,119,6,1)]';
    return 'text-black border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
  };

  return (
    <div className="bg-white border-2 border-black flex flex-col h-[800px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 border-b-2 border-black flex justify-between items-center">
        <h2 className="text-black font-black flex items-center tracking-tighter text-xl uppercase">
          <Terminal className="w-5 h-5 mr-2 text-blue-600" />
          SYSTEM.LOG :: LIVE FEED
        </h2>
        <div className="flex space-x-2">
          <span className="w-3 h-3 rounded-none bg-red-500 border border-black"></span>
          <span className="w-3 h-3 rounded-none bg-amber-500 border border-black"></span>
          <span className="w-3 h-3 rounded-none bg-emerald-500 border border-black"></span>
        </div>
      </div>

      {/* Feed Area */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 border-2 ${msg.type === 'world_event' ? 'bg-blue-50 border-blue-600 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]' : msg.type === 'system_command' ? 'bg-red-50 border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] text-red-700' : getEmotionColor(msg.emotion)}`}
            >
              {msg.type === 'world_event' ? (
                // God Mode Event
                <div>
                  <div className="text-blue-600 font-black mb-2 flex items-center text-sm tracking-widest uppercase">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    [MACRO-ECONOMIC EVENT]
                  </div>
                  <div className="text-xl text-black font-bold">
                    {msg.content}
                  </div>
                </div>
              ) : msg.type === 'system_command' ? (
                // System Command (Moderator)
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="text-red-600 font-black mb-1 flex items-center text-xl tracking-widest uppercase animate-pulse">
                    <AlertCircle className="w-8 h-8 mr-2" />
                    [SYSTEM OVERRIDE]
                  </div>
                  <div className="text-2xl text-red-700 font-black text-center mt-2">
                    {msg.content}
                  </div>
                </div>
              ) : (
                // Agent Speech & Thought
                <div>
                  <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-inherit">
                    <div className="font-black flex items-center text-lg tracking-tight uppercase text-black">
                      <Cpu className="w-5 h-5 mr-2 opacity-70" />
                      {msg.sender}
                    </div>
                    <div className="text-xs uppercase tracking-widest px-3 py-1 bg-black text-white font-bold">
                      {msg.emotion}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="text-sm italic border-l-4 border-inherit pl-4 text-gray-600 font-mono">
                      <span className="block text-xs uppercase font-bold mb-1 tracking-widest">Internal Monologue</span>
                      {msg.thought}
                    </div>
                    <div className="text-lg text-black font-medium">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Cpu className="w-16 h-16 opacity-30" />
              <p className="font-mono font-bold uppercase tracking-widest">Waiting for policy injection...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
