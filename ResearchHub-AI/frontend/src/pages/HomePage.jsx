import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import AnimatedSection from '../components/AnimatedSection';
import TypewriterEffect from '../components/TypewriterEffect';
import KnowledgeGraph from '../components/KnowledgeGraph';
import BentoCard from '../components/BentoCard';
import ResearchTicker from '../components/ResearchTicker';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {
  Search,
  FolderOpen,
  MessageSquare,
  Wand2,
  Upload,
  FileText,
  ArrowRight,
  FlaskConical,
  Sparkles,
} from 'lucide-react';

// Bento grid features with sizes
const bentoFeatures = [
  {
    icon: MessageSquare,
    title: 'AI Chat Assistant',
    desc: 'Have intelligent conversations about your research papers. Ask questions, get summaries, and explore connections.',
    size: 'large',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: Search,
    title: 'Paper Search',
    desc: 'Search millions of academic papers via OpenAlex with semantic understanding.',
    size: 'large',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: Wand2,
    title: 'AI Tools',
    desc: 'Summarize, compare, and extract key findings automatically.',
    size: 'medium',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    icon: FolderOpen,
    title: 'Workspaces',
    desc: 'Organize papers by project or research topic.',
    size: 'medium',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    icon: Upload,
    title: 'PDF Upload',
    desc: 'Upload your own papers for analysis.',
    size: 'small',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
  {
    icon: FileText,
    title: 'Doc Space',
    desc: 'Manage all documents in one place.',
    size: 'small',
    gradient: 'from-indigo-500/20 to-violet-500/20',
  },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  // Initialize Lenis smooth scroll on window
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div>
      {/* ===== HERO SECTION ===== */}
      <AnimatedSection 
        id="hero"
        className="mesh-gradient-bg flex items-center justify-center px-4 relative"
        disableInitialAnimation={true}
      >
        {/* Split Screen Layout */}
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-8 items-center min-h-screen py-20">
          
          {/* Left Side - Typography Command Center */}
          <div className="z-10 text-center lg:text-left">
            <div className="flex items-center gap-3 mb-6 justify-center lg:justify-start">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                <FlaskConical size={36} className="text-blue-400" />
              </div>
              <span className="text-sm font-medium text-blue-400 tracking-wider uppercase">
                AI-Powered Research
              </span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6">
              <span className="text-gradient">ResearchHub</span>
              <br />
              <span className="text-white">AI</span>
            </h1>

            <TypewriterEffect />

            <p className="text-lg text-gray-400 max-w-lg mb-10 mx-auto lg:mx-0">
              An intelligent platform for managing and analyzing academic research. 
              Search, organize, and gain insights with Google Gemini.
            </p>

            <div className="flex items-center gap-4 flex-wrap justify-center lg:justify-start">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="gradient-btn inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl"
                >
                  Go to Dashboard <ArrowRight size={18} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="gradient-btn inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl"
                  >
                    <Sparkles size={18} />
                    Get Started Free
                  </Link>
                  <Link
                    to="/login"
                    className="shimmer-btn inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Side - Knowledge Graph */}
          <div className="relative h-[500px] lg:h-[600px] hidden lg:block">
            <KnowledgeGraph scrollProgress={0} />
            
            {/* Floating stats badges */}
            <div className="absolute bottom-20 left-10 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-sm text-gray-300">
                <span className="text-purple-400 font-bold">AI</span> Powered insights
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <motion.div 
              className="w-1.5 h-3 rounded-full bg-white/50"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </AnimatedSection>

      {/* ===== BENTO FEATURES SECTION ===== */}
      <AnimatedSection 
        id="features"
        className="mesh-gradient-bg flex items-center justify-center px-4 py-20"
      >
        <div className="max-w-6xl mx-auto w-full">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Everything You Need for <span className="text-gradient">Research</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Powerful AI tools designed to accelerate your academic workflow
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[160px]">
            {bentoFeatures.map((feat, idx) => (
              <BentoCard
                key={feat.title}
                icon={feat.icon}
                title={feat.title}
                desc={feat.desc}
                size={feat.size}
                index={idx}
                gradient={feat.gradient}
              />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ===== TICKER SECTION ===== */}
      <AnimatedSection 
        id="insights"
        className="mesh-gradient-bg flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-7xl mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Real-Time <span className="text-gradient">AI Processing</span>
            </h2>
            <p className="text-gray-400">
              Watch your research assistant work in real-time
            </p>
          </motion.div>
        </div>

        {/* Ticker — full viewport width, breaks out of max-w container */}
        <div className="w-screen relative left-1/2 -translate-x-1/2">
          <ResearchTicker />
        </div>

        <div className="w-full max-w-7xl mx-auto px-4">
          {/* CTA */}
          <motion.div 
            className="text-center mt-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            {!isAuthenticated && (
              <Link
                to="/register"
                className="gradient-btn inline-flex items-center gap-3 text-white font-semibold px-10 py-5 rounded-2xl text-lg"
              >
                <Sparkles size={22} />
                Start Your Research Journey
                <ArrowRight size={22} />
              </Link>
            )}
          </motion.div>
        </div>
      </AnimatedSection>
    </div>
  );
}
