import React, { useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function AgentNetwork({ messages }) {
  const fgRef = useRef();

  const graphData = useMemo(() => {
    const nodes = [
      { id: 'God-Mode', name: 'MACRO EVENT', group: 0, val: 5 },
      { id: 'The Regulator', name: 'Regulator', group: 1, val: 2 },
      { id: 'The Whale', name: 'Whale', group: 2, val: 2 },
      { id: 'The Retail Mob', name: 'Retail', group: 3, val: 2 },
      { id: 'The CEO', name: 'CEO', group: 4, val: 2 }
    ];

    const links = [];
    const agents = ['The Regulator', 'The Whale', 'The Retail Mob', 'The CEO'];
    
    // Connect WORLD to agents
    agents.forEach(agent => {
      links.push({ source: 'God-Mode', target: agent });
    });
    
    // Connect agents to each other directionally
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        links.push({ source: agents[i], target: agents[j] });
        links.push({ source: agents[j], target: agents[i] });
      }
    }

    return { nodes, links };
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0 || !fgRef.current) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.type === 'world_event') {
      graphData.links.forEach(link => {
        const srcId = link.source.id || link.source;
        if (srcId === 'God-Mode') fgRef.current.emitParticle(link);
      });
    } else if (lastMsg.type === 'agent_speech') {
      graphData.links.forEach(link => {
        const srcId = link.source.id || link.source;
        if (srcId === lastMsg.sender) fgRef.current.emitParticle(link);
      });
    }
  }, [messages, graphData]);

  // Adjust nodes physics slightly
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-250);
      fgRef.current.d3Force('link').distance(80);
    }
  }, []);

  return (
    <div className="bg-[#4facfe] rounded-[2rem] shadow-lg relative flex flex-col justify-between h-full min-h-[400px] overflow-hidden">
      
      <div className="absolute top-6 left-6 z-10">
        <div className="bg-black/10 text-black/80 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
          Network
        </div>
        <h2 className="text-2xl font-bold text-[#222] leading-tight">
          TOPOLOGY
        </h2>
      </div>

       <div className="absolute inset-0 flex justify-center items-center mt-8">
         <ForceGraph2D
            ref={fgRef}
            width={400}
            height={400}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={node => node.id === 'God-Mode' ? '#ff6b6b' : '#222222'}
            linkColor={() => 'rgba(255,255,255,0.2)'}
            linkDirectionalParticles={0} 
            linkDirectionalParticleWidth={5}
            linkDirectionalParticleColor={link => {
              const srcId = link.source.id || link.source;
              return srcId === 'God-Mode' ? '#ff6b6b' : '#ffffff';
            }}
            linkDirectionalParticleSpeed={0.015}
            backgroundColor="rgba(255,255,255,0)"
            enableZoomInteraction={false}
            enablePanInteraction={false}
         />
       </div>
    </div>
  );
}
