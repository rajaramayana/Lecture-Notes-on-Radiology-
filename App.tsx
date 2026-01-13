
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
  Maximize2,
  Trash2,
  Plus
} from 'lucide-react';
import { TextbookData, Message } from './types';
import { processPdf } from './utils/pdf';
import { askGemini } from './services/gemini';

const App: React.FC = () => {
  const [textbooks, setTextbooks] = useState<TextbookData[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  
  // State for the previewer
  const [selectedBookIdx, setSelectedBookIdx] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'chat' | 'split'>('split');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const newBooks: TextbookData[] = [];
      for (let i = 0; i < files.length; i++) {
        const pages = await processPdf(files[i]);
        newBooks.push({ name: files[i].name, pages });
      }
      
      const updatedTextbooks = [...textbooks, ...newBooks];
      setTextbooks(updatedTextbooks);
      
      // If it's the first book(s), set the first one as active
      if (textbooks.length === 0) {
        setSelectedBookIdx(0);
        setCurrentPage(1);
      }

      setMessages(prev => [...prev, {
        id: `upload-${Date.now()}`,
        role: 'assistant',
        content: `I've added ${newBooks.length} new book(s) to the library. You now have ${updatedTextbooks.length} books indexed for search. I will synthesize answers using all available material.`,
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
      alert("Failed to process one or more PDFs. Ensure they are valid files.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeBook = (idx: number) => {
    const newBooks = textbooks.filter((_, i) => i !== idx);
    setTextbooks(newBooks);
    if (selectedBookIdx >= newBooks.length) {
      setSelectedBookIdx(Math.max(0, newBooks.length - 1));
      setCurrentPage(1);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || textbooks.length === 0 || isAnswering) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAnswering(true);

    const answer = await askGemini(input, textbooks, messages.map(m => ({ role: m.role, content: m.content })));
    
    // Parse references: (Book: [Name], Page: [X]) or (Page [X])
    // VISUAL_REFERENCES: [Book: "Name", Page: X; Book: "Name", Page: Y]
    const references: { bookIndex: number; pageNumber: number }[] = [];
    
    // Extract textual citations
    textbooks.forEach((book, bIdx) => {
      // Look for citations specifically for this book name or just page numbers if we can infer
      const pageMatches = [...answer.matchAll(/Page:?\s*(\d+)/gi)];
      pageMatches.forEach(match => {
        const pNum = parseInt(match[1]);
        if (pNum >= 1 && pNum <= book.pages.length) {
          // If the book name is nearby in the text (simple heuristic)
          if (answer.includes(book.name)) {
             references.push({ bookIndex: bIdx, pageNumber: pNum });
          }
        }
      });
    });

    // Extract VISUAL_REFERENCES explicitly
    const visualBlockMatch = answer.match(/VISUAL_REFERENCES: \[(.*?)\]/i);
    if (visualBlockMatch) {
      const parts = visualBlockMatch[1].split(';');
      parts.forEach(part => {
        textbooks.forEach((book, bIdx) => {
          if (part.toLowerCase().includes(book.name.toLowerCase().substring(0, 10))) {
            const pMatch = part.match(/Page:?\s*(\d+)/i);
            if (pMatch) {
              references.push({ bookIndex: bIdx, pageNumber: parseInt(pMatch[1]) });
            }
          }
        });
      });
    }

    // Clean unique refs
    const uniqueRefs = Array.from(new Set(references.map(r => `${r.bookIndex}-${r.pageNumber}`)))
                            .map(s => {
                              const [b, p] = s.split('-').map(Number);
                              return { bookIndex: b, pageNumber: p };
                            });

    const displayContent = answer.replace(/VISUAL_REFERENCES: \[.*?\]/i, '').trim();

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: displayContent,
      pages: uniqueRefs.length > 0 ? uniqueRefs : undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsAnswering(false);
    
    if (uniqueRefs.length > 0) {
      jumpToRef(uniqueRefs[0].bookIndex, uniqueRefs[0].pageNumber);
    }
  };

  const jumpToRef = (bookIdx: number, pageNum: number) => {
    setSelectedBookIdx(bookIdx);
    setCurrentPage(pageNum);
  };

  const currentBook = textbooks[selectedBookIdx];
  const currentPageData = currentBook?.pages[currentPage - 1];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Verbatim Library Hub</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Multi-Book Global Retrieval</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {textbooks.length > 0 && (
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
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            Add Books
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="application/pdf" 
            multiple
            className="hidden" 
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {textbooks.length === 0 && !isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
              <Upload className="text-indigo-600" size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-slate-800">Your Personal Verbatim Library</h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Upload multiple textbooks to create a searchable library. Our AI synthesizes data across all books, providing verbatim quotes and visual figures.
            </p>
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-100 hover:scale-105 transition-transform"
            >
              Get Started: Upload PDFs
            </button>
          </div>
        ) : isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <Loader2 className="animate-spin text-indigo-600 relative" size={64} />
            </div>
            <p className="mt-6 text-xl font-medium text-slate-700">Indexing Your Library...</p>
            <p className="text-slate-400 text-sm mt-2">Processing multiple chapters and figures</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Split View: Textbook Sidebar */}
            {viewMode === 'split' && (
              <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-200/30">
                {/* Book Selector Header */}
                <div className="bg-white px-4 py-2 border-b border-slate-200 flex flex-wrap gap-2">
                  {textbooks.map((book, idx) => (
                    <div 
                      key={idx}
                      onClick={() => { setSelectedBookIdx(idx); setCurrentPage(1); }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-xs font-semibold ${
                        selectedBookIdx === idx 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <FileText size={12} />
                      <span className="max-w-[120px] truncate">{book.name}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeBook(idx); }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Trash2 size={10} className="text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 truncate">{currentBook?.name}</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-700">
                      PAGE {currentPage} / {currentBook?.pages.length}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(currentBook?.pages.length || 1, prev + 1))}
                      disabled={currentPage >= (currentBook?.pages.length || 0)}
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
                        Select a book to preview
                      </div>
                    )}
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
                          <BookOpen size={12} /> Multi-Book Retrieval
                        </div>
                      )}
                      
                      <div className={message.role === 'assistant' ? 'p-5' : ''}>
                        <div className="whitespace-pre-wrap leading-relaxed text-sm font-medium">
                          {message.content}
                        </div>
                      </div>

                      {/* Visual Reference Gallery */}
                      {message.role === 'assistant' && message.pages && textbooks.length > 0 && (
                        <div className="bg-white p-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <ImageIcon size={14} className="text-indigo-600" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cross-Library Visual References</h4>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {message.pages.map((ref, idx) => {
                              const book = textbooks[ref.bookIndex];
                              const pData = book?.pages[ref.pageNumber - 1];
                              if (!pData) return null;
                              return (
                                <div key={idx} className="flex-shrink-0 group relative w-32">
                                  <div 
                                    className={`h-44 rounded border overflow-hidden cursor-pointer transition-all ${
                                      selectedBookIdx === ref.bookIndex && currentPage === ref.pageNumber 
                                        ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md' 
                                        : 'border-slate-200 grayscale-[0.5] hover:grayscale-0 hover:border-indigo-300'
                                    }`}
                                    onClick={() => jumpToRef(ref.bookIndex, ref.pageNumber)}
                                  >
                                    <img src={pData.dataUrl} className="w-full h-full object-cover" alt="Source Figure" />
                                    <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 size={16} className="text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                  <div className="mt-1 flex flex-col gap-0.5">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase truncate">{book.name}</span>
                                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-sm inline-block text-center">PAGE {ref.pageNumber}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {message.role === 'user' && (
                        <div className="mt-2 opacity-70 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                          <MessageSquare size={10} /> User Query
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
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Scanning Library...</span>
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
                    placeholder={textbooks.length > 0 ? "Query all textbooks verbatim..." : "Upload a book first..."}
                    disabled={textbooks.length === 0}
                    className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isAnswering || textbooks.length === 0}
                    className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-sm"
                  >
                    {isAnswering ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </button>
                </form>
                <div className="mt-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                    <span className="flex items-center gap-1"><BookOpen size={8} /> {textbooks.length} Books Loaded</span>
                    <span className="flex items-center gap-1"><ImageIcon size={8} /> Cross-Book Figures</span>
                  </div>
                  <span className="text-[9px] text-slate-300 italic">Synthesized global search active</span>
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
