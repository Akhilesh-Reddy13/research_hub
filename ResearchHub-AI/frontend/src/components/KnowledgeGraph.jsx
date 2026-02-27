import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Node data representing research papers
const nodes = [
  { id: 1, x: 20, y: 30, size: 60, label: 'AI' },
  { id: 2, x: 70, y: 20, size: 45, label: 'NLP' },
  { id: 3, x: 45, y: 55, size: 55, label: 'ML' },
  { id: 4, x: 80, y: 60, size: 40, label: 'CV' },
  { id: 5, x: 30, y: 70, size: 35, label: 'DL' },
  { id: 6, x: 60, y: 80, size: 50, label: 'LLM' },
  { id: 7, x: 15, y: 50, size: 30, label: 'RL' },
  { id: 8, x: 85, y: 40, size: 38, label: 'GAN' },
];

// Connections between nodes
const connections = [
  [1, 2], [1, 3], [2, 3], [2, 4], [3, 5], [3, 6], [4, 8], [5, 6], [6, 8], [1, 7], [7, 5]
];

export default function KnowledgeGraph({ scrollProgress = 0 }) {
  const containerRef = useRef(null);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] overflow-hidden"
      style={{ perspective: '1000px' }}
    >
      {/* Animated mesh background */}
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Connection lines */}
          {connections.map(([from, to], idx) => {
            const nodeFrom = nodes.find(n => n.id === from);
            const nodeTo = nodes.find(n => n.id === to);
            return (
              <motion.line
                key={idx}
                x1={`${nodeFrom.x}%`}
                y1={`${nodeFrom.y}%`}
                x2={`${nodeTo.x}%`}
                y2={`${nodeTo.y}%`}
                stroke="url(#lineGradient)"
                strokeWidth="0.3"
                initial={{ pathLength: 1, opacity: 0.6 }}
                animate={{ 
                  pathLength: 1, 
                  opacity: 0.6,
                  x1: `${nodeFrom.x + Math.sin(scrollProgress * 2 + idx) * 3}%`,
                  y1: `${nodeFrom.y + Math.cos(scrollProgress * 2 + idx) * 3}%`,
                  x2: `${nodeTo.x + Math.sin(scrollProgress * 2 + idx + 1) * 3}%`,
                  y2: `${nodeTo.y + Math.cos(scrollProgress * 2 + idx + 1) * 3}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            );
          })}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating nodes */}
      {nodes.map((node, idx) => (
        <motion.div
          key={node.id}
          className="absolute rounded-full flex items-center justify-center glass-node cursor-pointer"
          style={{
            width: node.size,
            height: node.size,
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            x: [0, Math.sin(idx) * 15, 0],
            y: [0, Math.cos(idx) * 15, 0],
          }}
          transition={{ 
            x: { duration: 3 + idx * 0.5, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: 4 + idx * 0.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ 
            scale: 1.2, 
            boxShadow: '0 0 30px rgba(96, 165, 250, 0.6)',
          }}
        >
          <span className="text-xs font-semibold text-white/90">{node.label}</span>
          
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-blue-400/30"
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              delay: idx * 0.3,
            }}
          />
        </motion.div>
      ))}

      {/* Central glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
