// app/lib/embeddings.ts
import OpenAI from 'openai'; // Or your embedding client
import { FileChunk } from '@/app/types';
import { PineconeRecord } from '@pinecone-database/pinecone';
// Ensure this imports the version with user_id
import { PineconeDocumentMetadata } from './pinecone-client';

// Initialize OpenAI Client (or your chosen provider)
const openai = new OpenAI();

// --- Configuration ---
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EXPECTED_DIMENSION = 768; // *** MATCH YOUR PINECONE INDEX DIMENSION ***
// --- End Configuration ---

export async function generateEmbeddings(
  chunks: FileChunk[] // Expects chunks WITH user_id in metadata
): Promise<PineconeRecord<PineconeDocumentMetadata>[]> {
  if (!chunks || chunks.length === 0) {
    console.log("generateEmbeddings called with empty chunks array.");
    return [];
  }
  console.log(`Generating embeddings for ${chunks.length} chunks using ${OPENAI_EMBEDDING_MODEL}...`);

  // --- Input Validation (Optional but Recommended) ---
  for (const chunk of chunks) {
      if (!chunk.metadata?.user_id) {
          const errorMsg = `Chunk ${chunk.id} is missing required user_id in its metadata. Cannot generate embeddings.`;
          console.error(errorMsg);
          throw new Error(errorMsg); // Fail fast if user_id is missing
      }
  }
  // --- End Input Validation ---


  const textsToEmbed = chunks.map(chunk => chunk.content.replace(/\n/g, " "));
  const batchSize = 100; // Adjust based on API limits
  const allVectors: PineconeRecord<PineconeDocumentMetadata>[] = [];
  let totalTokensUsed = 0;

  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
    const textBatch = textsToEmbed.slice(i, i + batchSize);
    const chunkBatch = chunks.slice(i, i + batchSize); // Corresponding chunk objects
    // console.log(`Processing embedding batch ${...}`);

    try {
      // Call embedding API (e.g., OpenAI)
      const response = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: textBatch,
        dimensions: EXPECTED_DIMENSION,
        // encoding_format: "float", // If supported/needed
      });

      if (response.usage) { /* ... log token usage ... */ totalTokensUsed += response.usage.total_tokens; }
      if (!response?.data || response.data.length !== textBatch.length) { throw new Error(`OpenAI embedding response length mismatch.`); }

      const batchVectors = chunkBatch.map((chunk, indexInBatch) => {
        const embeddingData = response.data[indexInBatch];
        if (!embeddingData?.embedding || embeddingData.embedding.length !== EXPECTED_DIMENSION) {
             console.warn(`Invalid embedding vector for chunk ${chunk.id}. Skipping.`);
             return null; // Filter this out later
        }

        // --- METADATA MAPPING (Verify user_id) ---
        const metadataForPinecone: PineconeDocumentMetadata = {
          fileName: chunk.metadata.fileName,
          chunkIndex: chunk.metadata.chunkIndex.toString(),
          pageNumber: chunk.metadata.pageNumber?.toString(),
          content: chunk.content, // Store original chunk content
          uploadedAt: new Date().toISOString(),
          docTitle: chunk.metadata.docTitle,
          docSource: chunk.metadata.docSource,
          docType: chunk.metadata.docType,

          // --- Ensure user_id is mapped correctly ---
          user_id: chunk.metadata.user_id, // Directly map from validated chunk metadata
          // --- End user_id mapping ---
        };
        // --- END METADATA MAPPING ---

        return {
          id: chunk.id, // Use the pre-generated chunk ID
          values: embeddingData.embedding,
          metadata: metadataForPinecone,
        };
      }); // End map chunkBatch

      const validBatchVectors = batchVectors.filter(v => v !== null) as PineconeRecord<PineconeDocumentMetadata>[];
      allVectors.push(...validBatchVectors);

    } catch (batchError) {
      console.error(`Failed to process embedding batch starting at index ${i}:`, batchError);
      // Re-throw to stop the entire upload process on batch failure
      throw new Error(`Embedding batch failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
    }
  } // End batch loop

  console.log(`Finished generating ${allVectors.length} embedding records. Total tokens: ${totalTokensUsed}`);
  return allVectors;
}