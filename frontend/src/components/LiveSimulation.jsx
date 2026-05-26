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
    <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[2rem] flex flex-col h-[800px] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 flex justify-between items-center bg-black/20 border-b border-white/10 z-10 shadow-sm">
        <div>
          <div className="bg-white/5 border border-white/10 text-white/60 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
            Chat Log
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center drop-shadow-md">
            AI OPERATIONS LEAD
          </h2>
        </div>
        <div className="flex space-x-3">
          <span className="w-3 h-3 rounded-full bg-[#ff6b6b] shadow-[0_0_8px_#ff6b6b]"></span>
          <span className="w-3 h-3 rounded-full bg-[#f6ad55] shadow-[0_0_8px_#f6ad55]"></span>
          <span className="w-3 h-3 rounded-full bg-[#4facfe] shadow-[0_0_8px_#4facfe]"></span>
        </div>
      </div>

      {/* Feed Area */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 scroll-smooth">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${msg.type === 'world_event' ? 'backdrop-blur-md bg-[#ff6b6b]/10 rounded-3xl p-6 border border-[#ff6b6b]/50 shadow-[0_0_20px_rgba(255,107,107,0.2)]' : msg.type === 'system_command' ? 'backdrop-blur-md bg-[#ff6b6b]/20 rounded-3xl p-6 border border-[#ff6b6b] shadow-[0_0_30px_rgba(255,107,107,0.3)]' : 'backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-colors'}`}
            >
              {msg.type === 'world_event' ? (
                // God Mode Event
                <div>
                  <div className="text-[#ff6b6b] font-bold mb-2 flex items-center text-sm tracking-widest uppercase drop-shadow-[0_0_5px_#ff6b6b]">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Macro-Economic Event
                  </div>
                  <div className="text-xl text-white font-medium drop-shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : msg.type === 'system_command' ? (
                // System Command (Moderator)
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="text-[#222] font-black mb-1 flex items-center text-lg tracking-widest uppercase">
                    <AlertCircle className="w-6 h-6 mr-2" />
                    System Override
                  </div>
                  <div className="text-2xl text-[#222] font-black text-center mt-1">
                    {msg.content}
                  </div>
                </div>
              ) : (
                // Agent Speech & Thought
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold flex items-center text-lg text-white">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-white/70" />
                      </div>
                      {msg.sender}
                    </div>
                    <div className={`text-xs uppercase tracking-wider px-3 py-1 rounded-full font-bold ${getEmotionColor(msg.emotion)}`}>
                      {msg.emotion}
                    </div>
                  </div>
                  <div className="space-y-4 ml-11">
                    <div className="text-sm italic border-l-2 border-white/10 pl-4 text-gray-400 font-serif">
                      {msg.thought}
                    </div>
                    <div className="text-[1.05rem] text-white/90 leading-relaxed">
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
