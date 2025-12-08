
import { GoogleGenAI } from "@google/genai";
import { DocumentChunk, LearnedCorrection } from '../types';
import { supabase } from './supabaseClient';

let ai: GoogleGenAI | null = null;

// Helper to get or init the AI client
const getAIClient = async (): Promise<GoogleGenAI> => {
  if (ai) return ai;

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'GEMINI_API_KEY')
      .single();

    if (error || !data) {
      console.error("Failed to fetch GEMINI_API_KEY from Supabase", error);
      throw new Error("Missing GEMINI_API_KEY configuration");
    }

    ai = new GoogleGenAI({ apiKey: data.value });
    return ai;
  } catch (err) {
    console.error("Error initializing AI client:", err);
    throw err;
  }
};



/**
 * Generates an embedding for a single string.
 * Uses text-embedding-004.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const client = await getAIClient();
    const response = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    // The new SDK returns embeddings directly in the response object
    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values;
    }
    return [];
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
};

/**
 * Batch processes embeddings to avoid rate limits.
 * Simple serial queue for this demo.
 */
export const batchEmbedChunks = async (
  chunks: DocumentChunk[],
  onProgress: (completed: number, total: number) => void
): Promise<DocumentChunk[]> => {
  const embeddedChunks = [...chunks];
  let completed = 0;

  for (let i = 0; i < embeddedChunks.length; i++) {
    // Add a small delay to prevent rapid-fire rate limiting on free tier
    await new Promise(r => setTimeout(r, 100));

    try {
      const vector = await generateEmbedding(embeddedChunks[i].text);
      embeddedChunks[i].embedding = vector;
    } catch (e) {
      console.warn(`Failed to embed chunk ${i}`, e);
    }

    completed++;
    onProgress(completed, embeddedChunks.length);
  }

  return embeddedChunks;
};

/**
 * NEW: Generates variations of the user query to improve retrieval recall.
 * Technique: Multi-Query Retrieval / Query Expansion.
 */
export const generateQueryVariations = async (query: string): Promise<string[]> => {
  const prompt = `
    You are an AI assistant helping to retrieve technical documentation for "OpenText WebReports".
    The user's query might use general terms, but the documentation uses specific proprietary tag names (e.g., "[LL_WEBREPORT_FOR]", "NODEACTION").
    
    TASK:
    Generate 3 alternative search queries based on the User Question below.
    1. One variation should use specific WebReport tag syntax if inferred (e.g., "loop" -> "LL_WEBREPORT_FOR").
    2. One variation should focus on the underlying concept/intent.
    3. One variation should be a hypothetical title of a documentation section that answers the question.

    User Question: "${query}"
    
    Output format: Just the 3 queries, separated by newlines. No numbering or prefixes.
  `;

  try {
    const client = await getAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.7 } // Higher temp for creative synonym generation
    });

    const text = response.text || "";
    return text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  } catch (e) {
    console.error("Query expansion failed:", e);
    return [query]; // Fallback to original
  }
};

/**
 * Generates a RAG response with Memory/Self-Correction
 */
export const generateRAGResponse = async (
  query: string,
  contextChunks: DocumentChunk[],
  learnedCorrections: LearnedCorrection[] = [], // NEW: Memory input
  modelName: string = 'gemini-2.5-flash'
): Promise<string> => {

  // Format context for the prompt
  // We include Source IDs to allow the model to cite correctly
  const contextText = contextChunks
    .map((c, index) => `[Source ID: ${c.id}]\n${c.text}`)
    .join("\n\n----------------\n\n");

  // Format past mistakes for the prompt
  let memoryContext = "";
  if (learnedCorrections.length > 0) {
    memoryContext = `
!!! CRITICAL - PAST MISTAKES DETECTED !!!
You have previously made errors on similar queries. 
Review these USER CORRECTIONS and ensure you apply the correct logic this time:

${learnedCorrections.map((c, i) => `
--- MISTAKE CASE ${i + 1} ---
SIMILAR USER QUERY: "${c.query}"
USER CORRECTION: 
"${c.correction}"
---------------------------
`).join('\n')}

DO NOT REPEAT THE ERRORS ABOVE.
!!! END CRITICAL !!!
      `;
  }

  const prompt = `
You are an **OpenText Content Server WebReport Expert**. 
You have been provided with technical documentation (the "Context") below.

${memoryContext}

YOUR GOAL:
Generate **ACCURATE, FUNCTIONAL WebReport code** that solves the user's problem. 
You must strictly follow the syntax rules found in the provided Context.

---
### CRITICAL SYNTAX RULES (Override standard HTML/JS):

1.  **PROPRIETARY TAGS ONLY**: 
    - You must use WebReport tags (e.g., \`[LL_WEBREPORT_IF ... /]\`) for logic. 
    - **DO NOT** use standard JavaScript \`if (...)\`, \`for (...)\`, or \`var x =\`.
    - ALL tags must be enclosed in square brackets: \`[TAG ... /]\`.

2.  **VARIABLE DEREFERENCING**:
    - When checking the value of a variable inside an IF statement or parameter, you must strictly dereference it.
    - **WRONG**: \`[LL_WEBREPORT_IF "myVar" == "Val" /]\`
    - **CORRECT**: \`[LL_WEBREPORT_IF "[LL_REPTAG_!myVar /]" == "Val" /]\`

3.  **STRICT CONTEXT ADHERENCE**:
    - Only use tags that are defined or implied by the provided "REFERENCE CONTEXT".
    - If the user asks for a feature (e.g. "Create Folder") and you see \`NODEACTION:CREATE\` in the context, use it exactly as documented.
    - If the provided context DOES NOT contain the necessary tags to solve the problem, explicitly state: "I cannot find the specific documentation for [Feature] in the loaded context." DO NOT HALLUCINATE SYNTAX.

4.  **Formatting**:
    - Provide the code in a clean code block.
    - Add comments \`// ...\` explaining complex steps.

---
### REFERENCE CONTEXT (The Manual):
${contextText}
---

**User Question:** ${query}

**Expert Solution:**
`;

  try {
    const client = await getAIClient();
    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        // Temperature 0.1 for high determinism in coding tasks.
        temperature: 0.1,
        // Allow high output for long code blocks
        maxOutputTokens: 8192,
        // Enable Thinking to allow the model to plan the syntax structure before writing code.
        // This drastically improves accuracy for proprietary languages.
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Generation error:", error);
    return "Error generating response. Please check your API limits.";
  }
};
