import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UploadedDocument, ChatMessage, DEFAULT_CONFIG, DocumentChunk, LearnedCorrection, RagConfig } from './types';
import { chunkText, performHybridSearch } from './services/vectorStore';
import { batchEmbedChunks, generateRAGResponse, generateEmbedding, generateQueryVariations } from './services/geminiService';
import { getDocumentFromDB, saveDocumentToDB, clearDB } from './services/database';
import { searchSupabase, uploadKnowledgeBaseToSupabase, isSupabaseConfigured, checkGuideExistsInSupabase, submitFeedback, searchSimilarFeedback } from './services/supabaseClient';

// Components
import { ChatInterface } from './components/ChatInterface';
import { SourceViewer } from './components/SourceViewer';
import { AdminPanel } from './components/AdminPanel';
import { Layout, FileText, UploadCloud } from 'lucide-react';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  
  // --- CHAT STATE WITH PERSISTENCE ---
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
        const savedMessages = localStorage.getItem('chat_history');
        return savedMessages ? JSON.parse(savedMessages) : [];
    } catch (e) {
        console.error("Failed to load chat history", e);
        return [];
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingState, setLoadingState] = useState<string>(''); 
  const [viewingChunk, setViewingChunk] = useState<DocumentChunk | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Configuration State
  const [ragConfig, setRagConfig] = useState<RagConfig>(DEFAULT_CONFIG);

  // Load documents from local IndexedDB on startup
  useEffect(() => {
    if (isSupabaseConfigured()) {
        console.log("Supabase configured.");
    }
  }, []);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
      try {
          localStorage.setItem('chat_history', JSON.stringify(messages));
      } catch (e) {
          console.error("Failed to save chat history", e);
      }
  }, [messages]);

  // --- INDEXING PIPELINE (Chunk -> Embed -> Upload) ---
  const processAndUploadDocument = async (
      docId: string, 
      name: string, 
      content: string
  ) => {
      
      setDocuments(prev => {
          if (prev.some(d => d.id === docId)) {
              return prev.map(d => d.id === docId ? { ...d, status: 'chunking', progress: 0 } : d);
          }
          return [{
              id: docId,
              name: name,
              content: content,
              chunks: [], 
              status: 'chunking',
              progress: 0
          }, ...prev];
      });

      try {
          await new Promise(resolve => setTimeout(resolve, 50));

          const chunks = chunkText(content, docId, ragConfig);
          console.log(`Created ${chunks.length} chunks for ${name} using size=${ragConfig.chunkSize}`);

          setDocuments(prev => prev.map(d => 
              d.id === docId ? { ...d, chunks: chunks, status: 'embedding' } : d
          ));

          await batchEmbedChunks(chunks, (completed, total) => {
              setDocuments(prev => prev.map(d => 
                  d.id === docId ? { ...d, progress: (completed / total) * 100 } : d
              ));
          });

          await uploadKnowledgeBaseToSupabase(chunks);

          setDocuments(prev => prev.map(d => 
              d.id === docId ? { ...d, status: 'ready' } : d
          ));

      } catch (error) {
          console.error("Indexing failed:", error);
          setDocuments(prev => prev.map(d => 
              d.id === docId ? { ...d, status: 'error' } : d
          ));
          alert(`Failed to process ${name}. Check console for details.`);
      }
  };

  const handleFileUpload = async (file: File) => {
      console.log(`Starting upload for file: ${file.name} (${file.size} bytes)`);
      if (file.size > 10 * 1024 * 1024) {
          alert("File is too large. Please upload files smaller than 10MB.");
          return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          const content = e.target?.result as string;
          if (!content) {
              console.error("File content is empty or failed to read.");
              alert("Failed to read file content. Please try again.");
              return;
          }

          const docId = uuidv4();
          await processAndUploadDocument(docId, file.name, content);
      };
      reader.onerror = (e) => {
          console.error("Failed to read file:", e);
          alert("Error reading file.");
      };
      reader.readAsText(file);
  };

  // --- CHAT HANDLER ---
  const handleSendMessage = async (text: string) => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsGenerating(true);
    setLoadingState('Thinking...');

    try {
      let relevantChunks: DocumentChunk[] = [];
      let queryEmbedding: number[] = [];

      if (ragConfig.enableQueryExpansion) {
          setLoadingState('Expanding Query...');
          const variations = await generateQueryVariations(text);
          const allQueries = [text, ...variations];
          console.log("Query Expansion:", allQueries);

          setLoadingState('Embedding Queries...');
          const embeddings = await Promise.all(allQueries.map(q => generateEmbedding(q)));
          queryEmbedding = embeddings[0];

          setLoadingState('Searching Knowledge Base...');
          const results = await Promise.all(
              embeddings.map((emb, i) => searchSupabase(allQueries[i], emb, ragConfig.topK))
          );

          const docScores = new Map<string, { chunk: DocumentChunk, score: number }>();
          const k = 60; 

          results.forEach((resultList) => {
             resultList.forEach((chunk, rank) => {
                 const existing = docScores.get(chunk.id);
                 const newScore = 1 / (k + rank + 1);
                 
                 if (existing) {
                     existing.score += newScore;
                 } else {
                     docScores.set(chunk.id, { chunk, score: newScore });
                 }
             });
          });

          relevantChunks = Array.from(docScores.values())
              .sort((a, b) => b.score - a.score)
              .map(item => item.chunk)
              .slice(0, ragConfig.topK);

      } else {
          setLoadingState('Searching Knowledge Base...');
          queryEmbedding = await generateEmbedding(text);
          relevantChunks = await searchSupabase(text, queryEmbedding, ragConfig.topK);
      }
      
      setLoadingState('Checking Memory...');
      const pastCorrections = await searchSimilarFeedback(queryEmbedding);

      setLoadingState('Reasoning...');
      const responseText = await generateRAGResponse(
          text, 
          relevantChunks, 
          pastCorrections,
          ragConfig.model
      );

      const botMessage: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
        citations: relevantChunks 
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error answering:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'model',
          content: 'Sorry, I encountered an error while processing your request.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsGenerating(false);
      setLoadingState('');
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    try {
        localStorage.removeItem('chat_history');
    } catch (e) {
        console.error("Failed to clear chat history", e);
    }
  };

  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative', correction?: string) => {
      setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
              return { ...msg, feedback: rating, correction, isFeedbackSubmitted: true };
          }
          return msg;
      }));

      const targetMsgIndex = messages.findIndex(m => m.id === messageId);
      if (targetMsgIndex === -1) return;

      const targetMsg = messages[targetMsgIndex];
      const userQueryMsg = messages[targetMsgIndex - 1]; 

      if (userQueryMsg && userQueryMsg.role === 'user') {
          const queryEmbedding = await generateEmbedding(userQueryMsg.content);
          
          await submitFeedback(
              userQueryMsg.content,
              targetMsg.content,
              rating,
              queryEmbedding,
              correction
          );
      }
  };

  const handleClearCache = async () => {
      await clearDB();
      setDocuments([]);
      window.location.reload();
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* Main Area - Chat */}
      <div className="flex-1 flex flex-col h-full relative">
        <ChatInterface 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          isGenerating={isGenerating}
          onCitationClick={(chunk) => setViewingChunk(chunk)}
          onFeedback={handleFeedback}
          onClearHistory={handleClearHistory}
          onAdminAccess={() => setShowAdminPanel(true)}
        />
        
        {isGenerating && loadingState && (
            <div className="absolute top-4 right-4 bg-zinc-800/90 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-blue-300 font-mono shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {loadingState}
            </div>
        )}

        {viewingChunk && (
            <SourceViewer chunk={viewingChunk} onClose={() => setViewingChunk(null)} />
        )}

        <AdminPanel 
            isOpen={showAdminPanel}
            onClose={() => setShowAdminPanel(false)}
            ragConfig={ragConfig}
            documents={documents}
            onConfigChange={setRagConfig}
            onFileUpload={handleFileUpload}
            onClearCache={handleClearCache}
        />
      </div>
    </div>
  );
};

export default App;