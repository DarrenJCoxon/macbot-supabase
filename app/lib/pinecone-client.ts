// app/lib/pinecone-client.ts
import {
  Pinecone,
  PineconeRecord,
  Index
} from '@pinecone-database/pinecone';
import { VectorSearchResult } from '@/app/types';

// --- Environment Variables ---
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX;

if (!pineconeApiKey) { /* ... error handling ... */ }
if (!pineconeIndexName) { /* ... error handling ... */ }

// --- Metadata Type Definition ---
export type PineconeDocumentMetadata = {
  fileName: string;
  chunkIndex: string;
  content: string;
  pageNumber?: string;
  uploadedAt?: string;
  docTitle?: string;
  docSource?: string;
  docType?: string;
  user_id: string; // REQUIRED
};

// --- Initialize Pinecone Client ---
const pinecone = new Pinecone({ apiKey: pineconeApiKey || 'MISSING_API_KEY' });

// --- Get or Create Index Function (with Caching) ---
let pineconeIndex: Index<PineconeDocumentMetadata> | null = null;

export const getIndex = async (): Promise<Index<PineconeDocumentMetadata>> => {
    if (pineconeIndex) return pineconeIndex;
    if (!pineconeIndexName) throw new Error("Pinecone index name is not configured.");
    console.log(`Attempting to get or create Pinecone index: ${pineconeIndexName}`);
    try {
        await pinecone.describeIndex(pineconeIndexName);
        console.log(`Index '${pineconeIndexName}' found.`);
        pineconeIndex = pinecone.index<PineconeDocumentMetadata>(pineconeIndexName);
        return pineconeIndex;
    } catch (error: unknown) {
        // ... (rest of error handling and index creation logic remains the same) ...
        let isNotFoundError = false;
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        const errorStatus = typeof error === 'object' && error !== null && 'status' in error ? (error as { status: number }).status : undefined;
        if (errorStatus === 404 || errorMessage.includes('not found') || errorMessage.includes('could not find index')) {
            isNotFoundError = true;
            console.log(`Index '${pineconeIndexName}' not found via describeIndex. Attempting creation...`);
        }
        if (isNotFoundError) {
            try {
                const EXPECTED_DIMENSION = 768;
                console.log(`Creating index '${pineconeIndexName}' with dimension ${EXPECTED_DIMENSION}...`);
                await pinecone.createIndex({ name: pineconeIndexName, dimension: EXPECTED_DIMENSION, metric: 'cosine', spec: { serverless: { cloud: 'aws', region: 'us-east-1' } } });
                console.log(`Index '${pineconeIndexName}' creation initiated. Waiting ~60s...`);
                await new Promise(resolve => setTimeout(resolve, 60000));
                console.log(`Index '${pineconeIndexName}' assumed ready after wait.`);
                pineconeIndex = pinecone.index<PineconeDocumentMetadata>(pineconeIndexName);
                return pineconeIndex;
            } catch (creationError: unknown) {
                 const creationErrorMessage = creationError instanceof Error ? creationError.message.toLowerCase() : '';
                 const creationErrorStatus = typeof creationError === 'object' && creationError !== null && 'status' in creationError ? (creationError as { status: number }).status : undefined;
                 console.error(`Failed to create index '${pineconeIndexName}':`, creationError);
                 if (creationErrorStatus === 409 || creationErrorMessage.includes('already exists')) {
                     console.warn(`Index creation conflict (409/Already Exists). Assuming index '${pineconeIndexName}' exists now.`);
                     pineconeIndex = pinecone.index<PineconeDocumentMetadata>(pineconeIndexName);
                     return pineconeIndex;
                 }
                 throw creationError;
            }
        } else {
            console.error(`Unexpected error describing index '${pineconeIndexName}':`, error);
            throw error;
        }
    }
};

// --- Insert Vectors Function ---
export const insertVectors = async (
  vectors: PineconeRecord<PineconeDocumentMetadata>[]
): Promise<void> => {
  if (!vectors || vectors.length === 0) { console.warn("insertVectors: No vectors."); return; }
  for (const vec of vectors) {
    if (!vec.metadata?.user_id) {
        const errorMsg = `Vector ${vec.id} is missing required user_id metadata.`;
        console.error(errorMsg); throw new Error(errorMsg);
    }
  }
  try {
    const index = await getIndex();
    // --- FIXED: Use pineconeIndexName for logging ---
    console.log(`Inserting ${vectors.length} vectors into index '${pineconeIndexName}' (User ID hint: ${vectors[0]?.metadata?.user_id})...`);
    // --- END FIXED ---
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }
    console.log(`Successfully inserted ${vectors.length} vectors.`);
  } catch (error) { console.error('Error inserting vectors:', error); throw error; }
};

// --- Query Vectors Function ---
export const querySimilarChunks = async (
  queryEmbedding: number[],
  topK: number = 5,
  userId?: string
): Promise<VectorSearchResult[]> => {
  if (!queryEmbedding?.length) { console.error("querySimilarChunks: Empty embedding."); return []; }
  const EXPECTED_DIMENSION = 768;
  if (queryEmbedding.length !== EXPECTED_DIMENSION) { console.error(`Query dimension mismatch: ${queryEmbedding.length} vs ${EXPECTED_DIMENSION}`); return []; }
  if (!pineconeIndexName) throw new Error("Pinecone index name not configured."); // Added check

  try {
    const index = await getIndex();
    let filter: Record<string, unknown> | undefined = undefined;
    if (userId) {
      filter = { user_id: { $eq: userId } };
      console.log(`Querying index '${pineconeIndexName}' with topK=${topK} AND filter for user_id: ${userId}`);
    } else {
      console.warn(`Querying index '${pineconeIndexName}' with topK=${topK} WITHOUT user_id filter.`);
    }

    const queryOptions: Parameters<typeof index.query>[0] = {
        vector: queryEmbedding, topK, includeMetadata: true, ...(filter && { filter }),
    };

    const queryResponse = await index.query(queryOptions);
    console.log(`Query returned ${queryResponse.matches?.length ?? 0} matches.`);

    const results: VectorSearchResult[] = [];
    if (queryResponse.matches) {
        for (const match of queryResponse.matches) {
            const metadata = match.metadata as PineconeDocumentMetadata | undefined;
            if (!metadata?.content || !metadata.fileName || !metadata.chunkIndex || !metadata.user_id) {
                 console.warn(`Skipping match ${match.id} due to missing essential metadata.`, metadata); continue;
            }
            if (userId && metadata.user_id !== userId) {
                 console.warn(`FILTER MISMATCH? Match ${match.id} user ${metadata.user_id} vs filter ${userId}. Skipping.`); continue;
            }
            const chunkIndex = parseInt(metadata.chunkIndex, 10);
            if (isNaN(chunkIndex)) { console.warn(`Skipping match ${match.id}: invalid chunkIndex '${metadata.chunkIndex}'`); continue; }
            let pageNumber: number | undefined = undefined;
            if (typeof metadata.pageNumber === 'string') {
                 const parsedPage = parseInt(metadata.pageNumber, 10);
                 if (!isNaN(parsedPage)) pageNumber = parsedPage;
            }

            // --- This structure MUST match VectorSearchResult in types/index.ts ---
            results.push({
                id: match.id,
                score: match.score ?? 0,
                content: metadata.content,
                metadata: {
                    fileName: metadata.fileName,
                    chunkIndex: chunkIndex,
                    pageNumber: pageNumber,
                    docTitle: metadata.docTitle,
                    docSource: metadata.docSource,
                    docType: metadata.docType,
                    uploadedAt: metadata.uploadedAt,
                    // --- Ensure user_id is here ---
                    user_id: metadata.user_id,
                },
            });
            // --- End structure ---
        }
    }
    console.log(`Formatted ${results.length} valid search results.`);
    return results;
  } catch (error) { console.error('Error querying vectors:', error); throw error; }
};

// --- Exports ---
const pineconeClient = { insertVectors, querySimilarChunks, getIndex };
export default pineconeClient;