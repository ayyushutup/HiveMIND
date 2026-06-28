import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function PortfolioTracker() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolios = () => {
    fetch('/api/sentiment')
      .then(r => r.json())
      .then(data => {
        setAgents(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch portfolios", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPortfolios();
    const interval = setInterval(fetchPortfolios, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sort agents by highest total value
  const sortedAgents = [...agents].sort((a, b) => {
    const valA = a.portfolio?.total_value || 0;
    const valB = b.portfolio?.total_value || 0;
    return valB - valA;
  });

  return (
    <div className="glass-panel p-6 h-full flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          Agent Portfolios
        </h2>
        <div className="text-xs font-mono text-emerald-400/60 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
          LIVE PnL
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {loading && agents.length === 0 ? (
          <div className="text-center text-white/40 mt-10">Loading portfolios...</div>
        ) : (
          <AnimatePresence>
            {sortedAgents.map((agent, i) => {
              const port = agent.portfolio;
              if (!port) return null;

              const isProfit = port.pnl >= 0;
              const pnlColor = isProfit ? 'text-emerald-400' : 'text-rose-400';
              const pnlBg = isProfit ? 'bg-emerald-400/10' : 'bg-rose-400/10';
              const pnlBorder = isProfit ? 'border-emerald-400/20' : 'border-rose-400/20';

              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-slate-900/40 rounded-xl p-4 border border-white/5 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:animate-shimmer" />

                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-white/90">{agent.name}</div>
                    <div className={`flex items-center gap-1 text-sm font-mono px-2 py-0.5 rounded-full border ${pnlBg} ${pnlBorder} ${pnlColor}`}>
                      {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      ${Math.abs(port.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-white/40 text-xs mb-1">Total Value</div>
                      <div className="font-mono flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-white/40" />
                        {port.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs mb-1">Cash Available</div>
                      <div className="font-mono text-white/80">
                        ${port.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Positions summary */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="text-white/40 text-xs mb-2">Positions</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(port.positions).map(([asset, qty]) => {
                        if (qty <= 0) return null;
                        return (
                          <div key={asset} className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/10">
                            <span className="text-white/40 mr-1">{asset}</span>
                            <span className="text-white/80">{qty.toFixed(2)}</span>
                          </div>
                        );
                      })}
                      {Object.values(port.positions).every(qty => qty <= 0) && (
                        <div className="text-[10px] text-white/30 italic">No open positions</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
