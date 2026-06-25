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
    if (['panicked', 'angry', 'aggressive'].includes(e)) return 'text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 shadow-[0_0_10px_rgba(255,107,107,0.2)]';
    if (['calculating', 'cold', 'analytical'].includes(e)) return 'text-[#4facfe] bg-[#4facfe]/10 border border-[#4facfe]/30 shadow-[0_0_10px_rgba(79,172,254,0.2)]';
    if (['philosophical', 'peaceful', 'calm'].includes(e)) return 'text-[#38b2ac] bg-[#38b2ac]/10 border border-[#38b2ac]/30 shadow-[0_0_10px_rgba(56,178,172,0.2)]';
    if (['paranoid', 'terrified', 'suspicious'].includes(e)) return 'text-[#f6ad55] bg-[#f6ad55]/10 border border-[#f6ad55]/30 shadow-[0_0_10px_rgba(246,173,85,0.2)]';
    return 'text-white/60 bg-white/5 border border-white/10';
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center z-10 border-b border-white/5 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#4facfe] flex items-center gap-1.5 mb-1 bg-[#4facfe]/10 px-2 py-0.5 rounded-full inline-flex border border-[#4facfe]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4facfe] animate-pulse" />
            Live Feed
          </div>
          <h2 className="text-xl font-bold text-white flex items-center drop-shadow-md gap-2">
            <Terminal className="w-5 h-5 text-white/50" />
            Agent Comm Link
          </h2>
        </div>
        <div className="flex space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20"></span>
        </div>
      </div>

      {/* Feed Area */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pb-8 space-y-6 scroll-smooth pr-2 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`${msg.type === 'world_event' ? 'backdrop-blur-xl bg-gradient-to-r from-[#ff6b6b]/20 to-transparent rounded-3xl p-6 border-l-4 border-[#ff6b6b] shadow-lg' : msg.type === 'system_command' ? 'backdrop-blur-xl bg-gradient-to-r from-[#f6e05e]/20 to-transparent rounded-3xl p-6 border-l-4 border-[#f6e05e] shadow-lg' : 'glass-panel rounded-3xl p-5 hover:bg-white-[0.04] transition-all group'}`}
            >
              {msg.type === 'world_event' ? (
                // God Mode Event
                <div>
                  <div className="text-[#ff6b6b] font-bold mb-2 flex items-center text-xs tracking-widest uppercase">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Macro-Economic Event
                  </div>
                  <div className="text-lg text-white font-medium drop-shadow-sm leading-snug">
                    {msg.content}
                  </div>
                </div>
              ) : msg.type === 'system_command' ? (
                // System Command (Moderator)
                <div className="flex flex-col py-1">
                  <div className="text-[#f6e05e] font-black mb-2 flex items-center text-xs tracking-widest uppercase">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    System Override
                  </div>
                  <div className="text-xl text-white font-black">
                    {msg.content}
                  </div>
                </div>
              ) : (
                // Agent Speech & Thought
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold flex items-center text-[15px] text-white/90">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center mr-3 shadow-inner">
                        <User className="w-3.5 h-3.5 text-white/70" />
                      </div>
                      {msg.sender}
                    </div>
                    <div className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-bold ${getEmotionColor(msg.emotion)}`}>
                      {msg.emotion}
                    </div>
                  </div>
                  <div className="space-y-3 ml-10">
                    <div className="text-[13px] italic border-l border-white/10 pl-3 text-white/40 font-serif leading-relaxed">
                      {msg.thought}
                    </div>
                    <div className="text-[15px] text-white/80 leading-relaxed font-medium">
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
