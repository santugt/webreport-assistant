
import { DocumentChunk, RagConfig } from '../types';

// Fix for missing Intl.Segmenter type definition in some environments
declare global {
  namespace Intl {
    class Segmenter {
      constructor(locale: string | string[], options?: { granularity: 'grapheme' | 'word' | 'sentence'; localeMatcher?: 'lookup' | 'best fit' });
      segment(input: string): IterableIterator<{ segment: string; index: number; input: string }>;
    }
  }
}

/**
 * Splits text into chunks using a hierarchical strategy optimized for technical docs.
 * 
 * Hierarchy:
 * 1. Paragraphs (\n\n) - Preserves logical sections and large code blocks.
 * 2. Lines (\n) - Preserves individual code lines if a block is too large.
 * 3. Sentences (Intl.Segmenter or Regex Fallback) - Splits long prose lines.
 * 4. Characters - Final fallback for massive tokens.
 */
export const chunkText = (
  text: string,
  docId: string,
  config: RagConfig
): DocumentChunk[] => {
  const chunks: DocumentChunk[] = [];
  
  // Safe Segmenter initialization with fallback check
  let segmenter: Intl.Segmenter | null = null;
  try {
    // Check if Intl and Intl.Segmenter exist in the global scope
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    }
  } catch (e) {
    console.warn("Intl.Segmenter not supported in this environment. Using regex fallback.");
  }

  let chunkIndex = 0;
  // We'll track approximate indices for metadata
  let currentDocIndex = 0;

  // Helper to safely add a chunk
  const addChunk = (chunkText: string) => {
    if (!chunkText.trim()) return;
    chunks.push({
      id: `${docId}-chunk-${chunkIndex++}`,
      docId,
      text: chunkText,
      startIndex: currentDocIndex,
      endIndex: currentDocIndex + chunkText.length
    });
    currentDocIndex += chunkText.length;
  };

  // Normalize line endings to ensure consistent paragraph splitting
  // Replace Windows \r\n with Unix \n
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Initial split by double newlines (Paragraphs)
  const paragraphs = normalizedText.split(/\n\n+/);
  
  let currentChunkBuffer = "";

  for (const paragraph of paragraphs) {
    // Determine separator based on whether buffer is empty
    const separator = currentChunkBuffer ? "\n\n" : "";
    const potentialSize = currentChunkBuffer.length + separator.length + paragraph.length;

    if (potentialSize <= config.chunkSize) {
      currentChunkBuffer += separator + paragraph;
    } else {
      // Buffer + New Paragraph exceeds limit.
      
      // A. Commit existing buffer if present
      if (currentChunkBuffer) {
        addChunk(currentChunkBuffer);
        currentChunkBuffer = "";
      }

      // B. Handle the oversized paragraph
      if (paragraph.length > config.chunkSize) {
        // Level 2: Split by Lines (Preserves Code Structure)
        // Code blocks are usually separated by newlines, not periods.
        const lines = paragraph.split('\n');
        let currentLineBuffer = "";

        for (const line of lines) {
           const lineSep = currentLineBuffer ? "\n" : "";
           if (currentLineBuffer.length + lineSep.length + line.length <= config.chunkSize) {
             currentLineBuffer += lineSep + line;
           } else {
             // Commit current line buffer
             if (currentLineBuffer) {
               addChunk(currentLineBuffer);
               currentLineBuffer = "";
             }

             // Level 3: Handle oversized line (Long Prose or Minified Code)
             if (line.length > config.chunkSize) {
               
               // PREPARE SEGMENTS (Sentence level)
               let segments: string[] = [];
               if (segmenter) {
                   // Use browser Native Segmenter if available
                   for (const item of segmenter.segment(line)) {
                       segments.push(item.segment);
                   }
               } else {
                   // Fallback: Split by punctuation followed by space or end of string
                   const matches = line.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
                   if (matches) {
                       segments = matches;
                   } else {
                       segments = [line];
                   }
               }

               let currentSentBuffer = "";
               
               for (const segment of segments) {
                  if (currentSentBuffer.length + segment.length <= config.chunkSize) {
                     currentSentBuffer += segment;
                  } else {
                     if (currentSentBuffer) {
                        addChunk(currentSentBuffer);
                        currentSentBuffer = "";
                     }
                     
                     // Level 4: Force split if a single sentence/segment is still too big
                     if (segment.length > config.chunkSize) {
                        let remaining = segment;
                        while (remaining.length > 0) {
                            const part = remaining.slice(0, config.chunkSize);
                            addChunk(part);
                            remaining = remaining.slice(config.chunkSize);
                        }
                     } else {
                        currentSentBuffer = segment;
                     }
                  }
               }
               if (currentSentBuffer) addChunk(currentSentBuffer);

             } else {
               // Line fits in a new chunk
               currentLineBuffer = line;
             }
           }
        }
        // Flush remaining lines
        if (currentLineBuffer) addChunk(currentLineBuffer);

      } else {
        // Paragraph fits in a fresh chunk (it was just too big for the *previous* buffer)
        currentChunkBuffer = paragraph;
      }
    }
  }

  // Final flush of any remaining text
  if (currentChunkBuffer) {
    addChunk(currentChunkBuffer);
  }

  return chunks;
};

/**
 * Calculates Cosine Similarity between two vectors.
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
};

// --- Hybrid Search Utilities (BM25 + RRF) ---

// Simple tokenizer for client-side usage
const tokenize = (text: string): string[] => {
  return text.toLowerCase().match(/\w+/g) || [];
};

/**
 * Client-side BM25 implementation.
 * Scores chunks based on exact keyword matching, length normalization, and term frequency.
 */
const calculateBM25Scores = (
  query: string,
  chunks: DocumentChunk[]
): Map<string, number> => {
  const k1 = 1.2;
  const b = 0.75;
  
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return new Map();

  // 1. Pre-process chunks for stats
  const chunkStats = chunks.map(chunk => {
    const tokens = tokenize(chunk.text);
    return {
      id: chunk.id,
      tokens,
      length: tokens.length
    };
  });

  const N = chunks.length;
  if (N === 0) return new Map();
  
  const totalLength = chunkStats.reduce((acc, c) => acc + c.length, 0);
  const avgdl = totalLength / N;

  const scores = new Map<string, number>();

  // 2. Score each query token
  queryTokens.forEach(token => {
    // Calculate Document Frequency (n)
    let n = 0;
    chunkStats.forEach(stat => {
      if (stat.tokens.includes(token)) n++;
    });
    
    // If term not found in corpus, skip
    if (n === 0) return;

    // Inverse Document Frequency (IDF)
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));

    // Calculate score contribution for each chunk
    chunkStats.forEach(stat => {
      const tf = stat.tokens.filter(t => t === token).length;
      if (tf > 0) {
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (stat.length / avgdl));
        const score = idf * (numerator / denominator);
        
        const currentScore = scores.get(stat.id) || 0;
        scores.set(stat.id, currentScore + score);
      }
    });
  });

  return scores;
};

/**
 * Performs Hybrid Search using Reciprocal Rank Fusion (RRF).
 * Combines Vector Search (Semantic) and BM25 (Keyword).
 */
export const performHybridSearch = (
  query: string,
  queryEmbedding: number[],
  allChunks: DocumentChunk[],
  topK: number
): DocumentChunk[] => {
  // Filter for valid chunks
  const validChunks = allChunks.filter(c => c.embedding && c.embedding.length > 0);
  if (validChunks.length === 0) return [];

  // 1. Vector Search (Cosine Similarity)
  const vectorScores = new Map<string, number>();
  validChunks.forEach(chunk => {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding!);
    vectorScores.set(chunk.id, score);
  });

  // 2. Keyword Search (BM25)
  const bm25Scores = calculateBM25Scores(query, validChunks);

  // 3. Reciprocal Rank Fusion (RRF)
  // score = 1 / (k + rank_vector) + 1 / (k + rank_bm25)
  const k = 60; // Standard constant for RRF
  const combinedScores = new Map<string, number>();
  
  // Sort ID lists to determine ranks
  const sortedByVector = [...vectorScores.entries()]
    .sort((a, b) => b[1] - a[1]) // Descending score
    .map(entry => entry[0]);

  const sortedByBM25 = [...bm25Scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Compute RRF for every chunk
  validChunks.forEach(chunk => {
    const id = chunk.id;
    let rrfScore = 0;

    const rankVector = sortedByVector.indexOf(id);
    if (rankVector !== -1) {
      rrfScore += 1 / (k + rankVector + 1);
    }

    const rankBM25 = sortedByBM25.indexOf(id);
    if (rankBM25 !== -1) {
      rrfScore += 1 / (k + rankBM25 + 1);
    }

    combinedScores.set(id, rrfScore);
  });

  // 4. Return top K chunks sorted by RRF score
  return [...combinedScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => validChunks.find(c => c.id === id)!);
};

// Kept for backward compatibility if needed, but App.tsx uses hybrid now.
export const retrieveRelevantChunks = (
  queryEmbedding: number[],
  allChunks: DocumentChunk[],
  topK: number
): DocumentChunk[] => {
  const validChunks = allChunks.filter(c => c.embedding && c.embedding.length > 0);
  const scoredChunks = validChunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding!)
  }));
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK).map(item => item.chunk);
};
