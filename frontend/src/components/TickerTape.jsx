import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TickerTape({ messages }) {
  // Extract the latest 30 relevant messages for the ticker
  const tickerItems = useMemo(() => {
    if (!messages) return [];
    
    // Filter down to market ticks and world events
    const items = messages
      .filter(m => m.type === 'market_tick' || m.type === 'world_event')
      .slice(-30);
      
    // Reverse so newest is right? Actually for a marquee it doesn't matter as much, 
    // but usually newest is at the front (left) or appended to the end.
    // Let's just keep them in chronological order.
    return items;
  }, [messages]);

  if (tickerItems.length === 0) return null;

  return (
    <div className="w-full bg-black/40 border-y border-white/10 overflow-hidden relative h-10 flex items-center backdrop-blur-md z-20">
      
      {/* Label / Overlay on left */}
      <div className="absolute left-0 top-0 h-full px-4 flex items-center bg-gradient-to-r from-black via-black to-transparent z-10 font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-brand-cyan)] animate-pulse"></span>
          LIVE FEED
        </span>
      </div>

      {/* Marquee Container */}
      <div className="flex whitespace-nowrap animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] ml-[150px]">
        {tickerItems.map((item, idx) => {
          if (item.type === 'world_event') {
            return (
              <span key={`ticker-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm text-[var(--color-brand-purple)] font-semibold drop-shadow-[0_0_8px_rgba(189,0,255,0.5)]">
                <Zap className="w-4 h-4" />
                WORLD EVENT: {item.content || item.event}
              </span>
            );
          }

          if (item.type === 'market_tick') {
            const isUp = item.delta >= 0;
            const color = isUp ? '#00f0ff' : '#ff0055';
            return (
              <span key={`ticker-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm font-mono" style={{ color }}>
                <span className="font-bold text-white/80">{item.asset}</span>
                <span>{item.price.toFixed(2)}</span>
                <span className="text-xs flex items-center">
                  {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {isUp ? '+' : ''}{item.delta.toFixed(2)}
                </span>
                <span className="text-xs text-white/40 ml-2 font-sans tracking-wide">
                  by {item.agent} ({item.emotion})
                </span>
              </span>
            );
          }
          return null;
        })}
        
        {/* Duplicate the list to create a seamless loop effect if list is short, though raw CSS marquee on a long list is usually fine.
            For safety, we append it once more. */}
        {tickerItems.map((item, idx) => {
          if (item.type === 'world_event') {
            return (
              <span key={`ticker-dup-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm text-[var(--color-brand-purple)] font-semibold drop-shadow-[0_0_8px_rgba(189,0,255,0.5)]">
                <Zap className="w-4 h-4" />
                WORLD EVENT: {item.content || item.event}
              </span>
            );
          }

          if (item.type === 'market_tick') {
            const isUp = item.delta >= 0;
            const color = isUp ? '#00f0ff' : '#ff0055';
            return (
              <span key={`ticker-dup-${idx}`} className="mx-8 inline-flex items-center gap-2 text-sm font-mono" style={{ color }}>
                <span className="font-bold text-white/80">{item.asset}</span>
                <span>{item.price.toFixed(2)}</span>
                <span className="text-xs flex items-center">
                  {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {isUp ? '+' : ''}{item.delta.toFixed(2)}
                </span>
                <span className="text-xs text-white/40 ml-2 font-sans tracking-wide">
                  by {item.agent} ({item.emotion})
                </span>
              </span>
            );
          }
          return null;
        })}
      </div>
      
      {/* Fade on right edge */}
      <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
    </div>
  );
}
