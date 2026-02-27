import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../utils/AuthContext';
import AnimatedSection from '../components/AnimatedSection';
import FeatureCard from '../components/FeatureCard';
import { containerVariants, viewportConfig } from '../utils/motionVariants';
import {
  Search,
  FolderOpen,
  MessageSquare,
  Wand2,
  Upload,
  FileText,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Paper Search',
    desc: 'Search millions of academic papers via OpenAlex.',
  },
  {
    icon: FolderOpen,
    title: 'Workspaces',
    desc: 'Organize papers by project or research topic.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    desc: 'Chat with AI about your research papers.',
  },
  {
    icon: Wand2,
    title: 'AI Tools',
    desc: 'Summarize, compare, and extract key findings.',
  },
  {
    icon: Upload,
    title: 'PDF Upload',
    desc: 'Upload your own PDF papers for analysis.',
  },
  {
    icon: FileText,
    title: 'Doc Space',
    desc: 'Manage all documents in one central place.',
  },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="scroll-container">
      {/* Hero Section */}
      <AnimatedSection 
        id="hero"
        className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center px-4"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            className="flex items-center justify-center gap-3 mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FlaskConical size={48} />
            <h1 className="text-5xl font-extrabold tracking-tight">ResearchHub AI</h1>
          </motion.div>
          <motion.p 
            className="text-xl text-blue-100 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            An intelligent, AI-powered platform for managing and analyzing academic
            research papers. Search, organize, and gain insights with the power of
            Google Gemini.
          </motion.p>
          <motion.div 
            className="flex items-center justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
              >
                Go to Dashboard <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Get Started <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 border-2 border-white text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Login
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Features Section */}
      <AnimatedSection 
        id="features"
        className="bg-gray-50 flex items-center justify-center px-4"
      >
        <div className="max-w-6xl mx-auto w-full">
          <motion.h2 
            className="text-3xl font-bold text-center text-gray-900 mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            transition={{ duration: 0.5 }}
          >
            Everything You Need for Research
          </motion.h2>
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {features.map((feat) => (
              <FeatureCard
                key={feat.title}
                icon={feat.icon}
                title={feat.title}
                desc={feat.desc}
              />
            ))}
          </motion.div>
        </div>
      </AnimatedSection>
    </div>
  );
}
