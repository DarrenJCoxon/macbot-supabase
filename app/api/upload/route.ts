// app/api/admin/upload-document/route.ts
// (Or your chosen upload route name, e.g., app/api/upload/route.ts)

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { Buffer } from 'node:buffer'; // Explicit Buffer import

// --- Use the SSR client creator ---
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// --- Your Types & Libs ---
import { FileChunk } from '@/app/types'; // Adjust path if needed
import { generateEmbeddings } from '@/app/lib/embeddings'; // Adjust path if needed
import { insertVectors } from '@/app/lib/pinecone-client'; // Adjust path if needed
import { PdfReader } from 'pdfreader';
// Removed static mammoth import, using dynamic below

// --- PDF Helper Function using pdfreader (Keep exactly as before) ---
async function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        let pdfText = '';
        let currentPage: number | null = null;
        const reader = new PdfReader();

        reader.parseBuffer(buffer, (err, item) => {
            if (err) {
                console.error("pdfreader parsing error:", err);
                const errorMessage = String(err); // Safe string conversion
                reject(new Error(`Failed to parse PDF with pdfreader: ${errorMessage}`));
                return; // Stop processing on error
            }
            if (!item) { // End of buffer/PDF
                console.log("pdfreader finished parsing.");
                const cleanedText = pdfText.replace(/ +/g, ' ').replace(/(\r\n|\n|\r){2,}/g, '\n').trim();
                resolve(cleanedText);
            } else if (item.page) {
                if (currentPage !== null) pdfText += '\n\n--- Page Change ---\n\n';
                currentPage = item.page;
            } else if (item.text) {
                if (pdfText.length > 0 && pdfText[pdfText.length - 1] !== ' ') pdfText += ' ';
                pdfText += item.text;
            }
        });
    });
}
// --- End PDF Helper ---

export async function POST(req: Request) {
  console.log('--- API Upload Route Hit ---');
  // No 'await' here, assuming synchronous based on docs for this context
  const cookieStore = await cookies();

  // --- Use createServerClient from @supabase/ssr ---
  const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
          cookies: {
              get(name: string) {
                  return cookieStore.get(name)?.value;
              },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              set(name: string, value: string, options: CookieOptions) {
                  // No-op in this context
              },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              remove(name: string, options: CookieOptions) {
                   // No-op in this context
              },
          },
      }
  );
  console.log("Using createServerClient (@supabase/ssr) in API Route.");


  // --- 1. Authentication Check ---
  console.log("Attempting to get session in API route...");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
      console.error('Supabase session error:', sessionError);
      return NextResponse.json({ error: 'Failed to retrieve user session' }, { status: 500 });
  }
  if (!session) {
      console.log('No active session found. Unauthorized.');
      // console.log('API Route (Unauthorized): Received cookies:', JSON.stringify(cookieStore.getAll(), null, 2));
      return NextResponse.json({ error: 'Unauthorized: User must be logged in to upload.' }, { status: 401 });
  }
  const userId = session.user.id;
  console.log(`API Route: Authenticated user ID: ${userId}`);
  // --- End Authentication Check ---


  // --- Main Try Block ---
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const metadataString = formData.get('metadata') as string | null;

    // --- Validation ---
    if (!file || !(file instanceof File)) return NextResponse.json( { error: 'File is required' }, { status: 400 } );
    if (!metadataString) return NextResponse.json( { error: 'Metadata JSON string is required' }, { status: 400 });
    let parsedMetadata: { title: string; source?: string; type?: string; };
    try {
        parsedMetadata = JSON.parse(metadataString);
        if (!parsedMetadata.title?.trim()) return NextResponse.json({ error: 'Metadata requires a non-empty "title" field' }, { status: 400 });
        parsedMetadata.source = parsedMetadata.source || '';
        parsedMetadata.type = parsedMetadata.type || 'unknown';
    } catch (parseError) {
        console.error("Validation failed: Invalid metadata JSON.", parseError);
        return NextResponse.json({ error: 'Invalid metadata format.' }, { status: 400 });
    }
    // --- End Validation ---

    const fileId = nanoid(10);
    const originalFileName = file.name;
    console.log(`User ${userId} processing file: ${originalFileName} (Upload ID: ${fileId})`);
    console.log("User provided metadata:", parsedMetadata);

    // --- File Content Extraction ---
    let fileContent = '';
    const fileExt = originalFileName.toLowerCase().split('.').pop() || '';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`File buffer read (${buffer.length} bytes). Ext: .${fileExt}`);

    try {
        if (fileExt === 'txt' || fileExt === 'md') {
            console.log(`Parsing as text/markdown file.`);
            fileContent = buffer.toString('utf-8');
        } else if (fileExt === 'pdf') {
            console.log(`Attempting to parse PDF using pdfreader...`);
            fileContent = await parsePdfBuffer(buffer);
        } else if (fileExt === 'docx' || fileExt === 'doc') {
            console.log(`Attempting to parse as Word (DOCX/DOC) file...`);
            // Use dynamic import for mammoth
            const mammothModule = await import('mammoth');
            const result = await mammothModule.extractRawText({ buffer });
            fileContent = result.value;
        } else {
            console.warn(`Unsupported file type: .${fileExt}`);
            return NextResponse.json({ error: `Unsupported file type: .${fileExt}` }, { status: 415 });
        }
        console.log(`Content extracted (${fileContent?.length ?? 0} chars)`);
    } catch (parsingError) {
        console.error(`Error during file content extraction for ${originalFileName}:`, parsingError);
        const details = parsingError instanceof Error ? parsingError.message : 'Unknown parsing error';
        return NextResponse.json({ error: `Failed to parse file content`, details: details }, { status: 500 });
    }
    // --- End File Content Extraction ---

    if (!fileContent || fileContent.trim().length === 0) {
        console.warn(`File content is empty after parsing for ${originalFileName}.`);
        return NextResponse.json({ error: 'Extracted file content is empty. Cannot process.' }, { status: 400 });
    }

    // --- Chunking (Injecting user_id) ---
    const chunkSize = 1000; const overlap = 200; const fileChunks: FileChunk[] = [];
    console.log(`Splitting content into chunks...`);
    for (let i = 0; i < fileContent.length; i += (chunkSize - overlap)) {
        const chunkEnd = Math.min(i + chunkSize, fileContent.length);
        const chunkContent = fileContent.slice(i, chunkEnd).trim();
        if (chunkContent) {
            const chunkId = `${fileId}-chunk-${fileChunks.length}`;
            fileChunks.push({
                id: chunkId,
                fileId: fileId,
                content: chunkContent,
                metadata: {
                    fileName: originalFileName,
                    chunkIndex: fileChunks.length,
                    pageNumber: undefined,
                    docTitle: parsedMetadata.title,
                    docSource: parsedMetadata.source,
                    docType: parsedMetadata.type,
                    user_id: userId, // Add the authenticated user's ID
                },
            });
        }
        if (i + (chunkSize - overlap) <= i && fileContent.length > 0) { break; } // Safety break
    }
    if (fileChunks.length === 0) {
        console.error(`No chunks could be generated from the content of ${originalFileName}.`);
        return NextResponse.json({ error: 'No text chunks could be generated from the file content.' }, { status: 400 });
    }
    console.log(`Generated ${fileChunks.length} chunks for user ${userId}.`);
    // --- End Chunking ---

    // --- 2. Store Metadata in Supabase DB ---
    console.log(`Inserting metadata into Supabase user_documents table for file ID ${fileId}...`);
    const { error: insertError } = await supabase
        .from('user_documents') // Your table name
        .insert({
            user_id: userId,
            file_id: fileId,
            file_name: originalFileName,
            document_title: parsedMetadata.title,
            chunk_count: fileChunks.length,
        });

    if (insertError) {
        console.error('Supabase DB insert error:', insertError);
        return NextResponse.json({ error: 'Failed to store document metadata in database.', details: insertError.message }, { status: 500 });
    }
    console.log(`Metadata inserted successfully into Supabase for file ID ${fileId}.`);
    // --- End Store Metadata ---

    // --- 3. Generate Embeddings & Store in Pinecone ---
    try {
        console.log(`Generating embeddings for ${fileChunks.length} chunks (user: ${userId})...`);
        const vectors = await generateEmbeddings(fileChunks);
        if (!vectors || vectors.length === 0) { throw new Error('Embedding generation returned no vectors.'); }
        console.log(`Generated ${vectors.length} embedding vectors.`);
        console.log(`Inserting ${vectors.length} vectors into Pinecone...`);
        await insertVectors(vectors);
        console.log(`Successfully inserted vectors into Pinecone for user ${userId}.`);
    } catch (embeddingOrDbError) {
        console.error(`Error during embedding or Pinecone insertion:`, embeddingOrDbError);
        const details = embeddingOrDbError instanceof Error ? embeddingOrDbError.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to process embeddings or store in vector database.', details: details }, { status: 500 });
    }
    // --- End Generate Embeddings & Store ---

    // --- Success Response ---
    console.log(`Successfully processed file ${originalFileName} for user ${userId}`);
    return NextResponse.json({
      success: true,
      message: `Document "${parsedMetadata.title}" processed and indexed successfully.`,
      fileName: originalFileName,
      title: parsedMetadata.title,
      chunks: fileChunks.length,
      fileId: fileId,
    });
    // --- End Success Response ---

  } catch (error) { // Catch unexpected errors
    console.error('--- UNEXPECTED Upload API Error ---:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json( { error: 'An unexpected server error occurred during upload.', details: details }, { status: 500 } );
  }
}