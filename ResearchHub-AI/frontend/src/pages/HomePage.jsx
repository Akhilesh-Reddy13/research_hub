import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
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
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <FlaskConical size={48} />
            <h1 className="text-5xl font-extrabold tracking-tight">ResearchHub AI</h1>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            An intelligent, AI-powered platform for managing and analyzing academic
            research papers. Search, organize, and gain insights with the power of
            Google Gemini.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
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
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything You Need for Research
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <feat.icon className="text-blue-600 mb-3" size={28} />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {feat.title}
                </h3>
                <p className="text-sm text-gray-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
