
export interface DocumentChunk {
  id: string;
  docId: string;
  text: string;
  embedding?: number[];
  startIndex: number;
  endIndex: number;
}

export interface UploadedDocument {
  id: string;
  name: string;
  content: string;
  chunks: DocumentChunk[];
  status: 'pending' | 'chunking' | 'embedding' | 'ready' | 'error';
  progress: number; // 0 to 100
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  // If model, these are the chunks used to generate the answer
  citations?: DocumentChunk[];
  // Feedback State
  feedback?: 'positive' | 'negative';
  correction?: string;
  isFeedbackSubmitted?: boolean;
}

export interface LearnedCorrection {
  id: string;
  query: string;
  correction: string;
  similarity: number;
}

export interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  model: string; // e.g., 'gemini-2.5-flash'
  enableQueryExpansion: boolean; // New: Toggle for Multi-Query Retrieval
}

// Tuned for "In-Context Fine-Tuning" behavior.
// We leverage Gemini's large context window (1M tokens) to pass massive amounts of the manual.
export const DEFAULT_CONFIG: RagConfig = {
  // Massive chunks (8000 chars) to keep large definitions like 'NODEACTION' or 'PERMACTION' intact.
  chunkSize: 8000, 
  // Large overlap to ensure context isn't lost at boundaries.
  chunkOverlap: 1500, 
  // Retrieve 40 chunks. ~320k characters. This is heavy but fits easily in Gemini 1.5/2.5 Flash context.
  topK: 40, 
  model: 'gemini-2.5-flash',
  enableQueryExpansion: true
};
