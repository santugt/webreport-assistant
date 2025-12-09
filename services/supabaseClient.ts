
import { createClient } from '@supabase/supabase-js';
import { DocumentChunk, LearnedCorrection } from '../types';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Verification helper
export const isSupabaseConfigured = () => {
  return !!supabase && SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
};

/**
 * Checks if the system guide is already uploaded to Supabase.
 * We use the 'docId' in metadata to check.
 */
export const checkGuideExistsInSupabase = async (docId: string): Promise<boolean> => {
  if (!supabase) return false;

  try {
    // We check if any chunk exists with this docId in metadata
    // using head: true to just get the count, not data (faster)
    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .contains('metadata', { docId: docId });

    if (error) {
      console.warn("Error checking Supabase (Table might not exist yet?):", error.message);
      return false;
    }

    return (count || 0) > 0;
  } catch (err) {
    console.warn("Connection error checking Supabase:", err);
    return false;
  }
};

/**
 * Uploads processed chunks to Supabase.
 * This is an ADMIN action run once.
 */
export const uploadKnowledgeBaseToSupabase = async (chunks: DocumentChunk[]) => {
  if (!supabase) throw new Error("Supabase not configured");

  console.log(`[Supabase] Starting upload of ${chunks.length} chunks...`);

  // Prepare data for insertion
  const rows = chunks.map(chunk => ({
    content: chunk.text,
    metadata: {
      docId: chunk.docId,
      source_id: chunk.id,
      start_index: chunk.startIndex,
      end_index: chunk.endIndex
    },
    embedding: chunk.embedding
  }));

  // Batch insert to avoid payload limits
  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('document_chunks')
      .insert(batch);

    if (error) {
      console.error("[Supabase] Upload error in batch:", JSON.stringify(error, null, 2));
      throw error;
    }
    successCount += batch.length;
    console.log(`[Supabase] Uploaded ${successCount}/${rows.length}`);
  }

  console.log("[Supabase] Upload complete.");
};

/**
 * Performs Search via Supabase RPC (Postgres Function).
 * Tries Hybrid Search first, falls back to Standard Vector Search.
 */
export const searchSupabase = async (
  query: string,
  queryEmbedding: number[],
  matchCount: number = 40 // Default to 40 to match local accuracy
): Promise<DocumentChunk[]> => {
  if (!supabase) return [];

  // Helper to map Supabase rows to app DocumentChunk format
  const mapRows = (rows: any[]) => {
    if (!rows) return [];
    return rows.map((row: any) => ({
      id: `supabase-${row.id}`,
      docId: row.metadata?.docId || 'remote-db',
      text: row.content,
      startIndex: row.metadata?.start_index || 0,
      endIndex: row.metadata?.end_index || 0,
      embedding: [] // We don't need the vector back on the client
    }));
  };

  try {
    // Attempt 1: Hybrid Search (Custom SQL Function 'hybrid_search')
    // Increased full_text_weight to 1.5 to prioritize exact tag matches like [LL_REPTAG]
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      full_text_weight: 1.5,
      semantic_weight: 1.0,
      rrf_k: 60
    });

    if (error) {
      console.warn("[Supabase] 'hybrid_search' RPC failed. Function might be missing from DB. Error:", error.message);
      throw error; // Throw to trigger fallback
    }

    return mapRows(data);

  } catch (hybridError) {
    // Attempt 2: Standard Vector Search (Fallback 'match_documents')
    console.log("[Supabase] Falling back to standard 'match_documents' vector search...");

    try {
      const { data: vectorData, error: vectorError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Loose threshold to ensure we get results
        match_count: matchCount
      });

      if (vectorError) {
        console.error("[Supabase] Vector fallback failed:", JSON.stringify(vectorError, null, 2));
        return [];
      }

      return mapRows(vectorData);
    } catch (finalError) {
      console.error("[Supabase] Critical Search Failure:", finalError);
      return [];
    }
  }
};

/**
 * Submit Feedback to Supabase
 * Saves the query + embedding + user correction so the AI can learn from it.
 */
export const submitFeedback = async (
  query: string,
  originalResponse: string,
  rating: 'positive' | 'negative',
  queryEmbedding: number[],
  correction?: string
): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('feedback')
    .insert({
      query: query,
      original_response: originalResponse,
      user_correction: correction || null,
      rating: rating === 'positive' ? 1 : -1,
      embedding: queryEmbedding
    });

  if (error) {
    console.error("[Supabase] Failed to submit feedback:", error);
  } else {
    console.log("[Supabase] Feedback saved. System learned.");
  }
}

/**
 * Search for Learned Corrections
 * Checks if a similar query has been corrected in the past.
 */
export const searchSimilarFeedback = async (
  queryEmbedding: number[],
  threshold: number = 0.8 // High threshold: we only want very relevant corrections
): Promise<LearnedCorrection[]> => {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.rpc('match_feedback', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: 3 // Only get top 3 most relevant mistakes
    });

    if (error) {
      // Function might not exist yet if user didn't run SQL or table empty
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      query: row.query,
      correction: row.user_correction,
      similarity: row.similarity
    }));

  } catch (e) {
    return [];
  }
}

/**
 * Record a user login event
 */
export const recordUserLogin = async (email: string, name: string) => {
  if (!supabase) return;
  try {
    await supabase.from('user_logins').insert({ email, name });
  } catch (e) {
    console.error("Error recording login:", e);
  }
};
export const getGlobalSetting = async (key: string): Promise<any> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) throw error;
    return data?.value;
  } catch (e) {
    // console.warn(`Failed to fetch setting ${key}:`, e);
    return null;
  }
};

export const setGlobalSetting = async (key: string, value: any) => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value });

    if (error) throw error;
  } catch (e) {
    console.error(`Failed to update setting ${key}:`, e);
    throw e;
  }
};
/**
 * Fetch all user logs for Admin Panel
 */
export const fetchUserLogs = async (): Promise<any[]> => {
  if (!supabase) return [];
  const { data } = await supabase
    .from('user_logins')
    .select('*')
    .order('login_time', { ascending: false })
    .limit(50);
  return data || [];
};