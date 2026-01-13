
import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Upload, 
  Loader2, 
  Send, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Search,
  AlertCircle,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';
import { TextbookData, Message } from './types';
import { processPdf } from './utils/pdf';
import { askGemini } from './services/gemini';

const App: React.FC = () => {
  const [textbook, setTextbook] = useState<TextbookData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'chat' | 'split'>('split');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const pages = await processPdf(file);
      setTextbook({ name: file.name, pages });
      setCurrentPage(1); 
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `I've successfully loaded "${file.name}". I am now configured for "Global Deep Search" across all provided chapters. I will synthesize information from both introductory and advanced sections, including relevant figures.`,
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
      alert("Failed to process PDF. Ensure it's a valid file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !textbook || isAnswering) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAnswering(true);

    const answer = await askGemini(input, textbook.pages, messages.map(m => ({ role: m.role, content: m.content })));
    
    // Extract ALL page numbers mentioned in text
    const pageMatches = [...answer.matchAll(/Page (\d+)/gi)];
    // Extract VISUAL_REFERENCES
    const visualMatches = answer.match(/VISUAL_REFERENCES: \[(.*?)\]/i);
    const visualPages = visualMatches 
      ? visualMatches[1].split(',').map(s => parseInt(s.replace(/\D/g, ''))) 
      : [];

    const allMentionedPages = [...pageMatches.map(m => parseInt(m[1])), ...visualPages];
    const uniquePages = Array.from(new Set(allMentionedPages))
                             .filter(p => p >= 1 && p <= textbook.pages.length)
                             .sort((a, b) => a - b);

    // Clean the answer from internal tagging strings if any
    const displayContent = answer.replace(/VISUAL_REFERENCES: \[.*?\]/i, '').trim();

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: displayContent,
      pages: uniquePages.length > 0 ? uniquePages : undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsAnswering(false);
    
    if (uniquePages.length > 0) {
      jumpToPage(uniquePages[0]);
    }
  };

  const jumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= (textbook?.pages.length || 0)) {
      setCurrentPage(pageNum);
    }
  };

  const currentPageData = textbook?.pages[currentPage - 1];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Verbatim Study Hub</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Multimodal Global Retrieval</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {textbook && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('chat')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Focus Chat
              </button>
              <button 
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Split View
              </button>
            </div>
          )}
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-indigo-200"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            {textbook ? 'Change Book' : 'Upload Textbook'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="application/pdf" 
            className="hidden" 
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {!textbook && !isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
              <Upload className="text-indigo-600" size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-slate-800">Global Multimodal Search Assistant</h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Upload your textbook for exhaustive retrieval. We analyze every page across all chapters, extracting exact textual quotes and relevant medical illustrations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-indigo-600 mb-3"><ImageIcon size={24} /></div>
                <h3 className="font-bold mb-1">Visual Retrieval</h3>
                <p className="text-sm text-slate-500">Automatically identifies and displays relevant figures from any chapter.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-indigo-600 mb-3"><BookOpen size={24} /></div>
                <h3 className="font-bold mb-1">Chapter Linking</h3>
                <p className="text-sm text-slate-500">Connects basic definitions from intro chapters to advanced details later.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-indigo-600 mb-3"><AlertCircle size={24} /></div>
                <h3 className="font-bold mb-1">Verbatim</h3>
                <p className="text-sm text-slate-500">Pure extraction with zero paraphrasing for academic integrity.</p>
              </div>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <Loader2 className="animate-spin text-indigo-600 relative" size={64} />
            </div>
            <p className="mt-6 text-xl font-medium text-slate-700">Analyzing Chapters & Figures...</p>
            <p className="text-slate-400 text-sm mt-2">Indexing document for global cross-referencing</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Split View: Textbook Sidebar */}
            {viewMode === 'split' && textbook && (
              <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-200/30">
                <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 truncate max-w-[200px]">{textbook.name}</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => jumpToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-700">
                      PAGE {currentPage} / {textbook.pages.length}
                    </span>
                    <button 
                      onClick={() => jumpToPage(currentPage + 1)}
                      disabled={currentPage >= textbook.pages.length}
                      className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-6 custom-scrollbar flex items-center justify-center">
                  <div className="bg-white shadow-2xl border border-slate-300 relative group max-w-full">
                    {currentPageData ? (
                      <img 
                        src={currentPageData.dataUrl} 
                        alt={`Page ${currentPage}`} 
                        className="max-w-full h-auto select-none"
                      />
                    ) : (
                      <div className="w-full h-96 flex items-center justify-center bg-slate-50 text-slate-400 italic">
                        Page content unavailable
                      </div>
                    )}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="bg-slate-800/80 text-white text-[10px] px-2 py-1 rounded backdrop-blur uppercase tracking-tighter">Reference Viewer</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Window */}
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} flex flex-col bg-white relative`}>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[90%] rounded-2xl shadow-sm overflow-hidden ${
                      message.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none p-4' 
                        : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}>
                      {message.role === 'assistant' && (
                        <div className="px-4 py-2 bg-slate-200/50 border-b border-slate-200 flex items-center gap-2 opacity-70 text-[10px] font-bold uppercase tracking-widest">
                          <BookOpen size={12} /> Global Retrieval
                        </div>
                      )}
                      
                      <div className={message.role === 'assistant' ? 'p-5' : ''}>
                        <div className="whitespace-pre-wrap leading-relaxed text-sm font-medium">
                          {message.content}
                        </div>
                      </div>

                      {/* Visual Reference Gallery */}
                      {message.role === 'assistant' && message.pages && textbook && (
                        <div className="bg-white p-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <ImageIcon size={14} className="text-indigo-600" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visual References from Textbook</h4>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {message.pages.map(p => {
                              const pData = textbook.pages[p - 1];
                              if (!pData) return null;
                              return (
                                <div key={p} className="flex-shrink-0 group relative">
                                  <div 
                                    className={`w-32 h-44 rounded border overflow-hidden cursor-pointer transition-all ${
                                      currentPage === p ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md' : 'border-slate-200 grayscale-[0.5] hover:grayscale-0 hover:border-indigo-300'
                                    }`}
                                    onClick={() => jumpToPage(p)}
                                  >
                                    <img src={pData.dataUrl} className="w-full h-full object-cover" alt={`Page ${p}`} />
                                    <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 size={16} className="text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                  <div className="mt-1 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">PAGE {p}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {message.role === 'user' && (
                        <div className="mt-2 opacity-70 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                          <MessageSquare size={10} /> User Inquiry
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isAnswering && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-tl-none p-5 shadow-sm max-w-[85%]">
                      <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-indigo-600" size={18} />
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Aggregating Global Chapters...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a specific question (text & figures)..."
                    className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isAnswering}
                    className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-sm"
                  >
                    {isAnswering ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </button>
                </form>
                <div className="mt-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                    <span className="flex items-center gap-1"><AlertCircle size={8} /> Global Multimodal Mode</span>
                    <span className="flex items-center gap-1"><ImageIcon size={8} /> Visual Figures Included</span>
                  </div>
                  <span className="text-[9px] text-slate-300 italic">Extracted content is 100% verbatim</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
