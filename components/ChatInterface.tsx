import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Terminal, Copy, Check, ThumbsUp, ThumbsDown, ArrowRight, AlertTriangle, MessageSquare, Trash2, Lock } from 'lucide-react';
import { ChatMessage, DocumentChunk } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  onCitationClick: (chunk: DocumentChunk) => void;
  onFeedback: (messageId: string, rating: 'positive' | 'negative', correction?: string) => void;
  onClearHistory: () => void;
  onAdminAccess: () => void; // Secret trigger callback
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950/80 shadow-lg group">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5 opacity-60">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest ml-3">{language || 'CODE'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto bg-[#0d0d0d]">
        <pre className="text-sm font-mono text-blue-100/90 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const MessageContent: React.FC<{ content: string; role: 'user' | 'model' }> = ({ content, role }) => {
  if (role === 'user') {
    return <div className="whitespace-pre-wrap leading-relaxed font-sans text-zinc-100">{content}</div>;
  }

  // Split by markdown code blocks (```)
  const parts = content.split(/(```(?:[\w-]*)\n[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-zinc-300">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Remove start/end ticks
          const raw = part.slice(3, -3);
          
          // Split first line to check for language
          const firstNewLine = raw.indexOf('\n');
          let language = 'text';
          let code = raw;

          if (firstNewLine !== -1) {
             const possibleLang = raw.substring(0, firstNewLine).trim();
             // Simple check if it looks like a language identifier (no spaces)
             if (possibleLang && !possibleLang.includes(' ')) {
                language = possibleLang;
                code = raw.substring(firstNewLine + 1);
             }
          }
          
          return <CodeBlock key={index} code={code.trim()} language={language} />;
        }
        
        if (!part.trim()) return null;

        // PARSE DOUBT TAGS inside prose
        // Tag format: <<doubt>>content<<doubt>>
        const textParts = part.split(/(<<doubt>>[\s\S]*?<<doubt>>)/g);

        return (
          <div key={index} className="whitespace-pre-wrap leading-relaxed">
            {textParts.map((subPart, subIndex) => {
                if (subPart.startsWith('<<doubt>>') && subPart.endsWith('<<doubt>>')) {
                    const cleanText = subPart.replace(/<<doubt>>/g, '');
                    return (
                        <span 
                            key={subIndex} 
                            className="bg-yellow-500/20 text-yellow-200 px-1.5 py-0.5 rounded border-b border-yellow-500/50 cursor-help inline-flex items-center gap-1 relative group/tooltip"
                        >
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />
                            {cleanText}
                            {/* Tooltip */}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-800 text-zinc-300 text-[10px] rounded shadow-xl border border-zinc-700 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                Confidence Low: Verify this value in your environment.
                            </span>
                        </span>
                    );
                }
                return <span key={subIndex}>{subPart}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
};

// Feedback Component
const FeedbackActions: React.FC<{ 
    message: ChatMessage; 
    onSubmit: (rating: 'positive' | 'negative', correction?: string) => void; 
}> = ({ message, onSubmit }) => {
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [correction, setCorrection] = useState('');

    if (message.isFeedbackSubmitted) {
        return (
            <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                {message.feedback === 'positive' ? (
                    <span className="text-emerald-500 flex items-center gap-1"><ThumbsUp className="w-3 h-3"/> Helpful</span>
                ) : (
                    <span className="text-amber-500 flex items-center gap-1"><ThumbsDown className="w-3 h-3"/> Correction Sent</span>
                )}
            </div>
        );
    }

    if (isCorrecting) {
        return (
            <div className="mt-3 bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 animate-in fade-in slide-in-from-top-1">
                <p className="text-xs text-zinc-400 mb-2 font-medium">Teach the system: What is the correct code?</p>
                <textarea 
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                    rows={4}
                    placeholder="[LL_WEBREPORT_FOR ...] Correct syntax here..."
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-2">
                    <button 
                        onClick={() => setIsCorrecting(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => onSubmit('negative', correction)}
                        disabled={!correction.trim()}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                    >
                        Teach <ArrowRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => onSubmit('positive')}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors"
                title="This response is correct"
            >
                <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button 
                onClick={() => setIsCorrecting(true)}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                title="This response has an error"
            >
                <ThumbsDown className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isGenerating,
  onCitationClick,
  onFeedback,
  onClearHistory,
  onAdminAccess
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Secret Trigger Refs
  const clickCountRef = useRef(0);
  const lastClickRef = useRef(0);
  
  // Custom Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Clear History Modal State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (text: string) => {
      setInput(text);
  };

  const handleClearClick = () => {
    setIsClearModalOpen(true);
  };

  // Secret Click Handler
  const handleTitleClick = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent accidental double-click selection
      
      const now = Date.now();
      // 800ms tolerance between clicks
      if (now - lastClickRef.current > 800) {
          clickCountRef.current = 0;
      }
      
      clickCountRef.current += 1;
      lastClickRef.current = now;

      // Trigger at 5 rapid clicks
      if (clickCountRef.current >= 5) {
          clickCountRef.current = 0; // Reset immediately
          // Use setTimeout to allow the event loop to clear and prevent browser blocking
          setTimeout(() => {
            setIsPasswordModalOpen(true); // Open custom modal instead of prompt
            setPasswordError(false);
            setPasswordInput('');
          }, 50);
      }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === "OPENTEXT") {
          setIsPasswordModalOpen(false);
          setPasswordInput('');
          onAdminAccess();
      } else {
          setPasswordError(true);
      }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 
            onClick={handleTitleClick}
            className="text-lg font-semibold flex items-center gap-2 text-zinc-100 cursor-pointer select-none transition-opacity active:opacity-70 hover:opacity-90"
            title="v1.0"
        >
            <Sparkles className="w-5 h-5 text-blue-500" />
            WebReport Coder (v1)
        </h1>
        <button
          onClick={handleClearClick}
          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
          title="Clear Chat History"
        >
            <span>Clear Chat</span>
            <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-2">
                <MessageSquare className="w-8 h-8 text-zinc-400" />
            </div>
            
            <div className="text-center space-y-1">
                <h2 className="text-2xl font-semibold text-zinc-200">WebReport Code Assistant</h2>
                <p className="text-sm text-yellow-500 font-medium">(only for personal use and fun - code might break 🙃)</p>
                <p className="text-zinc-500 text-lg">It writes WebReport code</p>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap justify-center">
                {['WebReport', 'LiveReport', 'Workflow', 'Forms'].map((label) => (
                    <button 
                        key={label}
                        onClick={() => handleSuggestionClick(`${label} code help`)}
                        className="px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-2xl px-4">
                <span className="text-zinc-600 text-sm">Try an example:</span>
                <button 
                    onClick={() => handleSuggestionClick("Create 100 folders named Folder1 to Folder100 in node 436743. Remove public permission for even-numbered folders and set owner permission to 'See Contents' for odd-numbered folders.")}
                    className="w-full p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 text-left text-zinc-400 text-sm leading-relaxed transition-colors"
                >
                    "Create 100 folders named Folder1 to Folder100 in node 436743. Remove public permission for even-numbered folders and set owner permission to 'See Contents' for odd-numbered folders."
                </button>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto group ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-blue-500/30">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
            )}

            <div
              className={`flex-1 space-y-1 max-w-[90%] ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block text-left rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm shadow-md p-4'
                    : 'bg-transparent text-zinc-200 w-full'
                }`}
              >
                <MessageContent content={msg.content} role={msg.role} />
              </div>
              
              {/* Feedback UI for Model Messages */}
              {msg.role === 'model' && !isGenerating && (
                  <FeedbackActions 
                    message={msg} 
                    onSubmit={(rating, correction) => onFeedback(msg.id, rating, correction)} 
                  />
              )}
            </div>

            {msg.role === 'user' && (
               <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-5 h-5 text-zinc-300" />
              </div>
            )}
          </div>
        ))}
        {isGenerating && (
             <div className="flex gap-4 max-w-4xl mx-auto justify-start">
                 <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-blue-500/30">
                    <Bot className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-sm p-4 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                    Consulting WebReport Guide & Memory...
                </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900 relative">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isGenerating ? "Reasoning..." : "Ask about tags, loops, or complex actions..."}
              disabled={isGenerating}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl pl-4 pr-12 py-4 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm shadow-lg"
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          
          {/* Footer Info */}
          <div className="mt-4 flex items-center justify-center">
             {/* Center Text */}
            <p className="w-full text-center text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
               Strict Mode Active • Grounded in Official Documentation & Feedback Memory
            </p>
          </div>
        </div>

        {/* Made By Santosh T - Absolute Positioned */}
        <div className="absolute bottom-2 right-4 flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
            <p className="text-[10px] font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Made By Santosh T
            </p>
        </div>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl w-80 ring-1 ring-white/10">
               <div className="flex items-center gap-2 mb-4 text-zinc-100 font-semibold">
                   <Lock className="w-5 h-5 text-blue-500" />
                   <span>Admin Access</span>
               </div>
               <form onSubmit={handlePasswordSubmit}>
                   <input 
                       type="password" 
                       autoFocus
                       value={passwordInput}
                       onChange={(e) => {
                           setPasswordInput(e.target.value);
                           setPasswordError(false);
                       }}
                       placeholder="Enter Password" 
                       className={`w-full bg-zinc-950 border ${passwordError ? 'border-red-500 focus:border-red-500' : 'border-zinc-800 focus:border-blue-500'} text-white px-3 py-2 rounded-lg mb-4 outline-none transition-all placeholder:text-zinc-600 text-sm`}
                   />
                   {passwordError && <p className="text-red-500 text-xs mb-3 -mt-2">Incorrect password</p>}
                   <div className="flex justify-end gap-2">
                       <button 
                           type="button" 
                           onClick={() => {
                               setIsPasswordModalOpen(false);
                               setPasswordInput('');
                               setPasswordError(false);
                           }}
                           className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                       >
                           Cancel
                       </button>
                       <button 
                           type="submit"
                           className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors shadow-lg shadow-blue-500/20"
                       >
                           Unlock
                       </button>
                   </div>
               </form>
           </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl w-80 ring-1 ring-white/10">
               <div className="flex items-center gap-2 mb-4 text-zinc-100 font-semibold">
                   <AlertTriangle className="w-5 h-5 text-red-500" />
                   <span>Clear History?</span>
               </div>
               <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                   Are you sure you want to clear all chat history? This action cannot be undone.
               </p>
               <div className="flex justify-end gap-2">
                   <button 
                       onClick={() => setIsClearModalOpen(false)}
                       className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                   >
                       Cancel
                   </button>
                   <button 
                       onClick={() => {
                           onClearHistory();
                           setIsClearModalOpen(false);
                       }}
                       className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors shadow-lg shadow-red-500/20"
                   >
                       Yes, Clear All
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};
