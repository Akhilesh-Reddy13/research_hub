import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Brain, Zap, Target, Lightbulb } from 'lucide-react';

const insights = [
  { icon: Brain, text: "Analyzing semantic relationships in 1,234 papers..." },
  { icon: TrendingUp, text: "Citation impact increased 47% with AI summaries" },
  { icon: Sparkles, text: "New research gap detected in Attention mechanisms" },
  { icon: Zap, text: "Processing 50+ PDFs in real-time..." },
  { icon: Target, text: "Found 23 related papers for your query" },
  { icon: Lightbulb, text: "Key insight: Transformer efficiency breakthrough" },
  { icon: Brain, text: "Building knowledge graph with 5,678 connections" },
  { icon: TrendingUp, text: "Research velocity: 3x faster than manual review" },
];

// Duplicate for seamless loop
const allInsights = [...insights, ...insights];
const reverseInsights = [...insights].reverse();
const allReverseInsights = [...reverseInsights, ...reverseInsights];

export default function ResearchTicker() {
  return (
    <div className="w-full py-4 space-y-4 relative overflow-hidden">
      {/* Gradient fade edges - must match mesh-gradient-bg */}
      <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 pointer-events-none" />

      {/* Row 1 — left to right */}
      <motion.div
        className="flex gap-6 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ x: { duration: 35, repeat: Infinity, ease: 'linear' } }}
      >
        {allInsights.map((insight, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex-shrink-0"
          >
            <insight.icon className="text-blue-400 flex-shrink-0" size={16} />
            <span className="text-sm font-medium text-gray-300">{insight.text}</span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.2 }}
            />
          </div>
        ))}
      </motion.div>

      {/* Row 2 — right to left */}
      <motion.div
        className="flex gap-6 whitespace-nowrap"
        animate={{ x: ['-50%', '0%'] }}
        transition={{ x: { duration: 40, repeat: Infinity, ease: 'linear' } }}
      >
        {allReverseInsights.map((insight, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex-shrink-0"
          >
            <insight.icon className="text-purple-400 flex-shrink-0" size={16} />
            <span className="text-sm font-medium text-gray-400">{insight.text}</span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: idx * 0.15 }}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
