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
    if (['panicked', 'angry', 'aggressive'].includes(e)) return 'text-[#ff6b6b] bg-[#ff6b6b]/10';
    if (['calculating', 'cold', 'analytical'].includes(e)) return 'text-[#4facfe] bg-[#4facfe]/10';
    if (['philosophical', 'peaceful', 'calm'].includes(e)) return 'text-[#38b2ac] bg-[#38b2ac]/10';
    if (['paranoid', 'terrified', 'suspicious'].includes(e)) return 'text-[#f6ad55] bg-[#f6ad55]/10';
    return 'text-gray-300 bg-gray-700/50';
  };

  return (
    <div className="bg-[#2d2d2d] rounded-[2rem] flex flex-col h-[800px] shadow-lg relative overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 flex justify-between items-center bg-[#2d2d2d] z-10 shadow-sm">
        <div>
          <div className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
            Chat Log
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            AI OPERATIONS LEAD
          </h2>
        </div>
        <div className="flex space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#ff6b6b]"></span>
          <span className="w-3 h-3 rounded-full bg-[#f6ad55]"></span>
          <span className="w-3 h-3 rounded-full bg-[#4facfe]"></span>
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
              className={`${msg.type === 'world_event' ? 'bg-[#ff6b6b]/10 rounded-3xl p-6 border border-[#ff6b6b]/30' : msg.type === 'system_command' ? 'bg-[#ff6b6b] rounded-3xl p-6 shadow-lg' : 'bg-[#3b3b3b] rounded-3xl p-6'}`}
            >
              {msg.type === 'world_event' ? (
                // God Mode Event
                <div>
                  <div className="text-[#ff6b6b] font-bold mb-2 flex items-center text-sm tracking-wider uppercase">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Macro-Economic Event
                  </div>
                  <div className="text-xl text-white font-medium">
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
