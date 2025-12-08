import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UploadedDocument, ChatMessage, DEFAULT_CONFIG, DocumentChunk, LearnedCorrection, RagConfig } from './types';
import { chunkText, performHybridSearch } from './services/vectorStore';
import { batchEmbedChunks, generateRAGResponse, generateEmbedding, generateQueryVariations } from './services/geminiService';
import { getDocumentFromDB, saveDocumentToDB, clearDB } from './services/database';
import { supabase, searchSupabase, uploadKnowledgeBaseToSupabase, isSupabaseConfigured, checkGuideExistsInSupabase, submitFeedback, searchSimilarFeedback, recordUserLogin } from './services/supabaseClient';

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

    // --- AUTHENTICATION STATE ---
    const [session, setSession] = useState<any>(null);
    // Initialize verification state from persistent storage
    const [isTokenVerified, setIsTokenVerified] = useState(() => {
        return localStorage.getItem('is_token_verified') === 'true';
    });
    const [tokenInput, setTokenInput] = useState('');
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setAuthLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setAuthLoading(false);

            // Clear verification if user signs out
            if (event === 'SIGNED_OUT') {
                setIsTokenVerified(false);
                localStorage.removeItem('is_token_verified');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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

    const handleTokenVerify = async () => {
        if (tokenInput.trim() === 'SANTOSH') {
            setIsTokenVerified(true);
            localStorage.setItem('is_token_verified', 'true'); // Persist verification
            if (session?.user?.email) {
                await recordUserLogin(session.user.email, session.user.user_metadata?.full_name || 'Unknown');
            }
        } else {
            alert("Invalid Access Token!");
        }
    };

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    };

    // --- SHOW LOGIN SCREEN IF NOT AUTHENTICATED OR TOKEN NOT VERIFIED ---
    if (!session || !isTokenVerified) {
        if (authLoading) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">Loading...</div>;

        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl space-y-6 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">WebReport Assistant</h1>
                    <p className="text-zinc-400 text-sm">Restricted Access. Please sign in.</p>

                    {!session ? (
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full py-3 bg-white text-black font-semibold rounded hover:bg-zinc-200 transition flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign in with Google
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                                    {session.user.email?.[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{session.user.email}</span>
                            </div>

                            <input
                                type="password"
                                placeholder="Enter Access Token"
                                value={tokenInput}
                                onChange={e => setTokenInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-center tracking-widest text-white focus:border-blue-500 outline-none"
                            />
                            <button
                                onClick={handleTokenVerify}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 transition"
                            >
                                Verify Token
                            </button>
                            <button
                                onClick={() => supabase.auth.signOut()}
                                className="text-xs text-zinc-500 hover:text-white underline"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Load documents from local IndexedDB on startup


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