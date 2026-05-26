import React, { useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { X, Building, User, Activity } from 'lucide-react';

export default function AgentNetwork({ messages }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);

  // Resize listener
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const typeColors = {
    'System': '#ff6b6b',
    'Person': '#4facfe',
    'Company': '#38b2ac',
    'GovernmentAgency': '#f6ad55',
    'Asset': '#f6e05e',
    'Entity': '#a0aec0'
  };

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    const agents = ['The Regulator', 'The Whale', 'The Retail Mob', 'The CEO', 'The Crypto Maxi', 'The Doomer'];
    agents.forEach(a => nodes.push({ id: a, name: a, type: 'Person', group: 1, val: 4 }));
    nodes.push({ id: 'God-Mode', name: 'MACRO EVENT', type: 'System', group: 0, val: 6 });

    const companies = ['TechCorp', 'MacroBank', 'CryptoExchange', 'RetailChain', 'HedgeFundX', 'Semiconductor Co', 'AI Startup', 'Real Estate Trust', 'Energy Giant', 'Social Media Inc'];
    companies.forEach(c => nodes.push({ id: c, name: c, type: 'Company', group: 2, val: 2 }));

    const govt = ['SEC', 'Federal Reserve', 'Treasury', 'Congress', 'European Union', 'FCA'];
    govt.forEach(g => nodes.push({ id: g, name: g, type: 'GovernmentAgency', group: 3, val: 2.5 }));

    const assets = ['Bitcoin', 'Ethereum', 'S&P 500', 'Gold', 'Bonds', 'Real Estate'];
    assets.forEach(a => nodes.push({ id: a, name: a, type: 'Asset', group: 4, val: 2 }));

    for(let i = 0; i < 70; i++) {
        nodes.push({ id: `Entity_${i}`, name: `Entity ${i}`, type: 'Entity', group: 5, val: 1 });
    }

    // Connect Agents to God-Mode
    agents.forEach(agent => {
        links.push({ source: 'God-Mode', target: agent });
    });

    nodes.forEach(node => {
        if(node.id === 'God-Mode' || agents.includes(node.id)) return;
        const numLinks = Math.floor(Math.random() * 3) + 1;
        for(let i=0; i<numLinks; i++) {
            const target = nodes[Math.floor(Math.random() * nodes.length)];
            if(target.id !== node.id) {
                links.push({ source: node.id, target: target.id });
            }
        }
    });

    links.push({ source: 'The Regulator', target: 'SEC' });
    links.push({ source: 'The Regulator', target: 'Federal Reserve' });
    links.push({ source: 'The Whale', target: 'MacroBank' });
    links.push({ source: 'The Whale', target: 'HedgeFundX' });
    links.push({ source: 'The Crypto Maxi', target: 'Bitcoin' });
    links.push({ source: 'The Crypto Maxi', target: 'CryptoExchange' });
    links.push({ source: 'The CEO', target: 'TechCorp' });
    links.push({ source: 'The Retail Mob', target: 'RetailChain' });

    return { nodes, links };
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0 || !fgRef.current) return;
    const lastMsg = messages[messages.length - 1];
    
    // When someone speaks, shoot particles along ALL their connections
    if (lastMsg.type === 'world_event') {
      graphData.links.forEach(link => {
        const srcId = link.source.id || link.source;
        if (srcId === 'God-Mode') fgRef.current.emitParticle(link);
      });
    } else if (lastMsg.type === 'agent_speech') {
      graphData.links.forEach(link => {
        const srcId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if (srcId === lastMsg.sender || targetId === lastMsg.sender) {
          fgRef.current.emitParticle(link);
        }
      });
    }
  }, [messages, graphData]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-120);
      fgRef.current.d3Force('link').distance(60);
      // Let it spread out
      setTimeout(() => {
        if(fgRef.current) fgRef.current.zoomToFit(400, 50);
      }, 1000);
    }
  }, []);

  // ... (keeping resize listener and graphData logic the same, they are above handleNodeClick)

  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setNodeDetails(null);
    setLoadingNode(true);
    
    try {
      const res = await fetch(`/api/node_info/${encodeURIComponent(node.id)}`);
      const data = await res.json();
      setNodeDetails(data);
    } catch (err) {
      console.error("Failed to fetch node details", err);
      setNodeDetails({ summary: "Failed to connect to live data feed." });
    } finally {
      setLoadingNode(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex flex-col h-full overflow-visible">
      
      {/* Title */}
      <div className="absolute top-0 left-0 z-10 pointer-events-none">
        <div className="backdrop-blur-md bg-white/5 border border-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
          Knowledge Graph
        </div>
        <h2 className="text-2xl font-bold text-white leading-tight flex items-center drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          <Activity className="w-5 h-5 mr-2 text-[#4facfe]" />
          MACRO-ECONOMIC TOPOLOGY
        </h2>
      </div>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 z-10 backdrop-blur-xl bg-white/5 p-4 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-none">
        <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Entity Types</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/80">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center">
              <span className="w-3 h-3 rounded-full mr-2 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color: color }}></span>
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Node Details Popover */}
      {selectedNode && (
        <div className="absolute top-0 right-0 z-20 w-80 backdrop-blur-2xl bg-white/5 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden animate-in fade-in slide-in-from-right-4">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="text-white font-bold flex items-center drop-shadow-md">
              <Building className="w-4 h-4 mr-2 text-[#4facfe]" />
              Node Details
            </h3>
            <button onClick={() => setSelectedNode(null)} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Name</div>
              <div className="text-white/90 font-medium">{selectedNode.name}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Type</div>
              <div className="inline-block px-2 py-1 rounded-md text-xs font-bold shadow-[0_0_10px_currentColor]" style={{ backgroundColor: typeColors[selectedNode.type] + '33', color: typeColors[selectedNode.type] || '#fff', borderColor: typeColors[selectedNode.type] }}>
                {selectedNode.type}
              </div>
            </div>
            
            {loadingNode ? (
              <div className="py-4 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            ) : nodeDetails ? (
              <>
                {nodeDetails.realTicker && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Live Price</div>
                      <div className="text-[#4facfe] font-mono font-bold">{nodeDetails.price}</div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Market Cap</div>
                      <div className="text-[#f6e05e] font-mono font-bold">{nodeDetails.marketCap}</div>
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t border-white/10">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Live Summary</div>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {nodeDetails.summary}
                  </p>
                </div>
              </>
            ) : null}
            
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="absolute inset-0 -m-20">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeRelSize={4}
          nodeColor={node => typeColors[node.type] || '#ffffff'}
          linkColor={() => 'rgba(255,255,255,0.1)'}
          linkWidth={1}
          linkDirectionalParticles={0} 
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleColor={link => {
            const srcId = link.source.id || link.source;
            const targetId = link.target.id || link.target;
            if (srcId === 'God-Mode') return '#ff6b6b';
            if (typeColors[link.source.type]) return typeColors[link.source.type];
            return '#ffffff';
          }}
          linkDirectionalParticleSpeed={0.015}
          backgroundColor="rgba(255,255,255,0)"
          onNodeClick={handleNodeClick}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      </div>
    </div>
  );
}
