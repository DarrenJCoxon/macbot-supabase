// app/types/index.ts

// Message Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

// Chat History Type
export interface ChatHistory {
  messages: Message[];
}

// LLM Stream Chunk Type
export interface LLMStreamChunk {
  choices: {
    delta: {
      content?: string;
    };
    index: number;
  }[];
}

// File Handling Types
export interface UploadedFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

// Represents a chunk of text from a file BEFORE embedding
export interface FileChunk {
  id: string;       // Unique ID for the chunk (e.g., fileId-chunk-index)
  fileId: string;   // ID linking back to the original file upload instance
  content: string;  // The actual text content of the chunk
  metadata: {
    // Metadata associated *with the chunk itself*
    fileName: string;      // Original name of the source file
    chunkIndex: number;    // 0-based index of this chunk within the file
    pageNumber?: number;   // Optional page number if applicable

    // Metadata inherited from the document upload
    docTitle?: string;     // Title provided by user during upload
    docSource?: string;    // Source provided by user
    docType?: string;      // Type provided by user

    // --- User association (Added during processing) ---
    user_id: string;       // Supabase Auth User ID (REQUIRED for embedding)
  };
}

// Represents a search result retrieved FROM Pinecone
export interface VectorSearchResult {
  id: string;       // Pinecone vector ID (likely same as FileChunk id)
  score: number;    // Similarity score from Pinecone query
  content: string;  // The text content stored in Pinecone metadata
  metadata: {
    // Metadata retrieved FROM Pinecone (should match PineconeDocumentMetadata structure, potentially parsed)
    fileName: string;
    chunkIndex: number;    // Parsed back to number
    pageNumber?: number;   // Parsed back to number or undefined
    docTitle?: string;
    docSource?: string;
    docType?: string;
    uploadedAt?: string;   // Kept as ISO string

    // --- ADDED: User ID from Pinecone metadata ---
    user_id: string;       // The user ID associated with this vector
    // --- END ADDED ---
  };
}