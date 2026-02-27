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

export default function ResearchTicker() {
  return (
    <div className="w-full overflow-hidden py-6 relative">
      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
      
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          x: {
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      >
        {allInsights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <insight.icon className="text-blue-400 flex-shrink-0" size={18} />
            <span className="text-sm text-gray-300">{insight.text}</span>
            <motion.div
              className="w-2 h-2 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
