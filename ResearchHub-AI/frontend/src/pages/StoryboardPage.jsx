import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Loader2, Download, BookOpen, Layers,
  GitBranch, CheckCircle2, FlaskConical, BarChart3,
  ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Global render counter to guarantee unique IDs across the entire session
let mermaidCounter = 0;

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
  themeVariables: {
    primaryColor: '#4F46E5',
    primaryTextColor: '#fff',
    primaryBorderColor: '#4338CA',
    lineColor: '#6366F1',
    secondaryColor: '#E0E7FF',
    tertiaryColor: '#F5F3FF',
  },
});

/**
 * Sanitize common LLM Mermaid syntax mistakes on the client side.
 */
function sanitizeMermaid(raw) {
  let s = raw.trim();

  // 1. Fix "|>" after edge labels:  -->|label|> B  →  -->|label| B
  s = s.replace(/\|(\s*)>/g, '|$1');

  // 2. Fix "-->|label|-->" double arrow
  s = s.replace(/\|\s*-->/g, '| -->');

  // 3. Remove HTML <br> tags
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // 4. Join orphaned arrows back to previous line
  //    e.g. "input[Data Input]\n    --> processing1[...]"  →  single line
  s = s.replace(/\n\s*(--|==|-\.|\.-)(-?)>(?=\s*\S)/g, ' $1$2>');

  // 5. Fix node IDs that start with reserved keywords (subgraph, end, graph)
  //    e.g. subgraph1 → sg_1,  subgraph2 → sg_2
  s = s.replace(/\bsubgraph(\d+)/g, 'sg_$1');
  s = s.replace(/\bend(\d+)/g, 'nd_$1');

  // 6. Fix subgraph names with spaces: subgraph Agent Reports → subgraph AgentReports["Agent Reports"]
  s = s.replace(/^(\s*subgraph\s+)([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)+)\s*$/gm,
    (match, prefix, name) => {
      // Don't touch if it already has brackets
      if (/\[/.test(name)) return match;
      const id = name.replace(/\s+/g, '_');
      return `${prefix}${id}["${name}"]`;
    }
  );

  // 7. Collapse excessive blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  return s;
}

/* ── Mermaid renderer component ── */
function MermaidDiagram({ code, onRegenerate }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !code) return;
    setError(null);

    let cancelled = false;

    const renderDiagram = async () => {
      const uniqueId = `mmd-${++mermaidCounter}`;

      // Clean up any leftover Mermaid render artifacts in the document
      document.querySelectorAll('[id^="dmmd-"]').forEach(el => el.remove());

      const sanitized = sanitizeMermaid(code);

      try {
        if (containerRef.current) containerRef.current.innerHTML = '';
        const { svg } = await mermaid.render(uniqueId, sanitized);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
      } catch (err) {
        console.warn('Mermaid render error:', err);
        // Clean up failed render container
        const failedEl = document.getElementById('d' + uniqueId);
        if (failedEl) failedEl.remove();

        if (!cancelled) {
          setError(err.message || 'Failed to render diagram');
          if (containerRef.current) containerRef.current.innerHTML = '';
        }
      }
    };

    // Small delay to let React finish DOM updates
    const timer = setTimeout(renderDiagram, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Clean up on unmount
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [code, retryCount]);

  const handleRegenerate = async () => {
    if (!onRegenerate || regenerating) return;
    setRegenerating(true);
    try {
      await onRegenerate();
      // After new code arrives via props, the useEffect will re-render
    } catch {
      toast.error('Failed to regenerate diagram');
    } finally {
      setRegenerating(false);
    }
  };

  if (error) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-red-400">Diagram rendering issue — showing raw code:</p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {regenerating ? (
              <><Loader2 size={12} className="animate-spin" /> Regenerating...</>
            ) : (
              <>↻ Regenerate diagram</>
            )}
          </button>
        </div>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border">
          {sanitizeMermaid(code)}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-center bg-white rounded-lg p-4 min-h-[150px] overflow-x-auto"
    />
  );
}

/* ── Copy button component ── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copy Mermaid code">
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

/* ── Main Page ── */
export default function StoryboardPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeDiagram, setActiveDiagram] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    summary: true, contributions: true, methodology: false, results: false,
  });

  useEffect(() => {
    api.get('/workspaces')
      .then(res => setWorkspaces(res.data.workspaces || []))
      .catch(() => toast.error('Failed to load workspaces'));
  }, []);

  const toggleSection = (key) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async () => {
    if (!selectedWs) return toast.error('Please select a workspace');
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/storyboard/generate',
        { workspace_id: parseInt(selectedWs) }, { timeout: 300000 });
      setResult(res.data);
      setActiveDiagram(0);
      toast.success('Visual summary generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.session_id) return;
    try {
      const res = await api.get(`/storyboard/download/${result.session_id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_visual_summary_${result.session_id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const diagramIcon = (type) => {
    switch (type) {
      case 'architecture': return <GitBranch size={16} />;
      case 'flowchart': return <FlaskConical size={16} />;
      case 'pipeline': return <BarChart3 size={16} />;
      default: return <Layers size={16} />;
    }
  };

  const handleRegenerateDiagram = async (diagramIndex) => {
    if (!result?.summary) return;
    const res = await api.post('/storyboard/regenerate-diagram', {
      summary: result.summary.structured_summary || '',
      methodology: result.summary.methodology || '',
      paper_type: result.summary.paper_type || 'Applied Research',
      diagram_index: diagramIndex,
    }, { timeout: 120000 });
    // Update the diagram in result
    setResult(prev => {
      const updated = { ...prev, diagrams: [...prev.diagrams] };
      updated.diagrams[diagramIndex] = res.data;
      return updated;
    });
    toast.success('Diagram regenerated!');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research Visual Summary</h1>
          <p className="text-sm text-gray-500">Academic analysis with architecture diagrams & flowcharts</p>
        </div>
      </div>

      {/* Workspace Selection */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={18} className="text-indigo-600" />
          <label className="text-sm font-medium text-gray-700">
            Select a workspace to generate an academic visual summary
          </label>
        </div>
        <select
          value={selectedWs}
          onChange={(e) => { setSelectedWs(e.target.value); setResult(null); }}
          className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Choose a workspace...</option>
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name} ({ws.paper_count || 0} papers)</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-2">
          The AI will analyze all papers, generate a structured summary with key contributions,
          methodology breakdown, and technical diagrams (architecture, flowchart, pipeline, data flow).
        </p>
        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading || !selectedWs}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Analyzing papers...</>
            ) : (
              <><FileText size={16} /> Generate Visual Summary</>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
          <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Analyzing your research...</h3>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <span>1. Structured Summary</span>
            <span>→</span>
            <span>2. Diagram Generation</span>
            <span>→</span>
            <span>3. PDF Export</span>
          </div>
        </div>
      )}

      {/* ═══════ Results ═══════ */}
      {result && (
        <>
          {/* Paper Type Badge + Download */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                {result.summary?.paper_type || 'Research Paper'}
              </span>
              <span className="text-sm text-gray-500">
                {result.diagrams?.length || 0} diagrams generated
              </span>
            </div>
            {result.pdf_ready && (
              <button onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors">
                <Download size={16} /> Download PDF
              </button>
            )}
          </div>

          {/* ── Structured Summary ── */}
          <SectionCard
            title="Structured Summary"
            icon={<BookOpen size={18} className="text-indigo-600" />}
            expanded={expandedSections.summary}
            onToggle={() => toggleSection('summary')}
          >
            <ProseBlock text={result.summary?.structured_summary} />
          </SectionCard>

          {/* ── Key Contributions ── */}
          <SectionCard
            title="Key Contributions"
            icon={<CheckCircle2 size={18} className="text-emerald-600" />}
            expanded={expandedSections.contributions}
            onToggle={() => toggleSection('contributions')}
          >
            <ul className="space-y-2">
              {result.summary?.key_contributions?.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* ── Methodology ── */}
          <SectionCard
            title="Methodology"
            icon={<FlaskConical size={18} className="text-purple-600" />}
            expanded={expandedSections.methodology}
            onToggle={() => toggleSection('methodology')}
          >
            <ProseBlock text={result.summary?.methodology} />
          </SectionCard>

          {/* ── Results ── */}
          <SectionCard
            title="Results & Findings"
            icon={<BarChart3 size={18} className="text-amber-600" />}
            expanded={expandedSections.results}
            onToggle={() => toggleSection('results')}
          >
            <ProseBlock text={result.summary?.results} />
          </SectionCard>

          {/* ═══════ Diagrams ═══════ */}
          {result.diagrams?.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-8 mb-4">
                <GitBranch size={20} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Technical Diagrams</h2>
              </div>

              {/* Diagram Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {result.diagrams.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDiagram(i)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeDiagram === i
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {diagramIcon(d.diagram_type)}
                    {d.title}
                  </button>
                ))}
              </div>

              {/* Active Diagram */}
              {result.diagrams[activeDiagram] && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {diagramIcon(result.diagrams[activeDiagram].diagram_type)}
                      <h3 className="font-semibold text-gray-900">
                        {result.diagrams[activeDiagram].title}
                      </h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        {result.diagrams[activeDiagram].diagram_type}
                      </span>
                    </div>
                    <CopyButton text={result.diagrams[activeDiagram].mermaid_code} />
                  </div>

                  {/* Rendered diagram — key forces full remount on tab switch */}
                  <div className="p-6 bg-gray-50">
                    <MermaidDiagram
                      key={`diagram-${activeDiagram}-${result.session_id}-${result.diagrams[activeDiagram].mermaid_code.length}`}
                      code={result.diagrams[activeDiagram].mermaid_code}
                      onRegenerate={() => handleRegenerateDiagram(activeDiagram)}
                    />
                  </div>

                  {/* Mermaid source (collapsible) */}
                  <details className="border-t border-gray-100">
                    <summary className="px-4 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 hover:bg-gray-50">
                      View Mermaid source code
                    </summary>
                    <pre className="px-4 py-3 text-xs text-gray-500 font-mono bg-gray-50 whitespace-pre-wrap border-t border-gray-100">
                      {result.diagrams[activeDiagram].mermaid_code}
                    </pre>
                  </details>

                  {/* Navigation */}
                  <div className="flex justify-between px-6 py-4 border-t border-gray-100">
                    <button
                      onClick={() => setActiveDiagram(Math.max(0, activeDiagram - 1))}
                      disabled={activeDiagram === 0}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => setActiveDiagram(Math.min(result.diagrams.length - 1, activeDiagram + 1))}
                      disabled={activeDiagram === result.diagrams.length - 1}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Collapsible section card ── */
function SectionCard({ title, icon, expanded, onToggle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          {icon}
          {title}
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Styled markdown prose block ── */
function ProseBlock({ text }) {
  if (!text) return null;

  // Clean any residual JSON artifacts the LLM might leave
  let cleaned = text;
  // Strip leading/trailing quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  // Unescape escaped newlines and quotes
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  // Remove any stray markdown code fences wrapping the whole thing
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?\s*```\s*$/m, '');
  // If the text looks like raw JSON, try to extract just the value
  if (cleaned.trim().startsWith('{') && cleaned.trim().endsWith('}')) {
    try {
      const obj = JSON.parse(cleaned);
      // If it parsed, grab the first string value
      const firstVal = Object.values(obj).find(v => typeof v === 'string');
      if (firstVal) cleaned = firstVal;
    } catch { /* not JSON, use as-is */ }
  }

  return (
    <div className="prose-custom">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-600">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 mb-3">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-gray-700 leading-relaxed">{children}</li>
          ),
          h1: ({ children }) => (
            <h3 className="text-base font-bold text-gray-900 mb-2 mt-3">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-sm font-bold text-gray-800 mb-1.5 mt-2">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-sm font-semibold text-gray-800 mb-1 mt-2">{children}</h5>
          ),
          code: ({ children }) => (
            <code className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-indigo-300 pl-3 italic text-gray-500 text-sm mb-3">{children}</blockquote>
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
