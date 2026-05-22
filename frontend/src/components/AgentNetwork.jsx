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
    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative flex justify-center items-center h-[350px]">
       <div className="absolute top-3 left-4 z-10 font-mono text-xs font-bold text-gray-400 tracking-widest">
         [NETWORK_TOPOLOGY]
       </div>
       <ForceGraph2D
          ref={fgRef}
          width={350}
          height={350}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={node => node.id === 'God-Mode' ? '#2563eb' : '#000000'}
          linkColor={() => 'rgba(0,0,0,0.1)'}
          linkDirectionalParticles={0} // We only emit particles manually
          linkDirectionalParticleWidth={4}
          linkDirectionalParticleColor={link => {
            const srcId = link.source.id || link.source;
            return srcId === 'God-Mode' ? '#2563eb' : '#dc2626';
          }}
          linkDirectionalParticleSpeed={0.015}
          backgroundColor="rgba(255,255,255,1)"
          enableZoomInteraction={false}
          enablePanInteraction={false}
       />
    </div>
  );
}
