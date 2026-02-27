import { useState, useRef, useEffect } from 'react';
import { Send, Bot, UserIcon, Loader2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ChatInterface({ workspaceId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const messagesEndRef = useRef(null);

  // Load conversation history on mount
  useEffect(() => {
    if (!workspaceId) return;
    const loadHistory = async () => {
      try {
        const res = await api.get(`/chat/history/${workspaceId}`);
        const history = res.data.history || [];
        const msgs = [];
        for (const conv of history) {
          msgs.push({ role: 'user', content: conv.user_message });
          msgs.push({ role: 'ai', content: conv.ai_response });
        }
        setMessages(msgs);
      } catch {
        // First time – no history yet
      }
    };
    loadHistory();
  }, [workspaceId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || cooldown) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/chat', {
        message: userMsg,
        workspace_id: workspaceId,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: res.data.response },
      ]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to get AI response');
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      // Cooldown to prevent rapid-fire requests that hit rate limits
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            <Bot size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Ask me anything about your papers!</p>
            <p className="text-sm mt-1">
              I can summarize, compare, and answer questions based on your research.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {msg.role === 'user' ? (
                <UserIcon size={16} />
              ) : (
                <Bot size={16} />
              )}
            </div>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || cooldown || !input.trim()}
            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
