// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // Import cookies
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Import Supabase SSR client

import { streamCompletion, modelName } from '@/app/lib/openrouter-client';
import { querySimilarChunks } from '@/app/lib/pinecone-client'; // Ensure this accepts userId filter
import { generateEmbedding } from '@/app/lib/embedding-utils';
import { Message, VectorSearchResult } from '@/app/types';

export async function POST(req: Request) {
  console.log('--- /api/chat endpoint hit ---');
  const cookieStore = await cookies(); // Get cookie store

  // --- Create Supabase Client for API Route ---
  // Use createServerClient from @supabase/ssr
  const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
          cookies: {
              get(name: string) {
                  return cookieStore.get(name)?.value;
              },
              // Set and remove are often no-ops in read-only API routes like chat
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              set(name: string, value: string, options: CookieOptions) { },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              remove(name: string, options: CookieOptions) { },
          },
      }
  );
  console.log("Chat API: Using createServerClient (@supabase/ssr).");
  // --- End Supabase Client Creation ---

  // --- Authentication Check ---
  console.log("Chat API: Attempting to get session...");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
      console.error('Chat API: Supabase session error:', sessionError);
      return NextResponse.json({ error: 'Failed to retrieve user session' }, { status: 500 });
  }
  if (!session) {
      console.log('Chat API: No active session found. Unauthorized.');
      return NextResponse.json({ error: 'Unauthorized: User must be logged in to chat.' }, { status: 401 });
  }
  const userId = session.user.id;
  console.log(`Chat API: Authenticated user ID: ${userId}`);
  // --- End Authentication Check ---

  try {
    // Request body parsing remains the same
    const { messages, useUploadedFiles }: { messages: Message[], useUploadedFiles?: boolean } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid request: 'messages' array not found.");
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }
    console.log(`Chat API (User: ${userId}): Received ${messages.length} messages. useUploadedFiles: ${useUploadedFiles}`);

    let retrievedContextText = '';
    let retrievedChunks: VectorSearchResult[] = [];

    // --- RAG Process (with User ID Filter) ---
    const latestUserMessage = messages.findLast((msg) => msg.role === 'user');

    // Only perform RAG if requested AND there's content
    if (useUploadedFiles && latestUserMessage?.content) {
      console.log(`[RAG - User: ${userId}] Attempting RAG for query:`, latestUserMessage.content.substring(0, 100) + "...");
      try {
        const queryEmbeddingVector = await generateEmbedding(latestUserMessage.content);
        console.log(`[RAG - User: ${userId}] Query embedding generated.`);

        if (queryEmbeddingVector && queryEmbeddingVector.length > 0) {
          console.log(`[RAG - User: ${userId}] Querying Pinecone for similar chunks (top 3)...`);

          // --- PASS USER ID TO QUERY ---
          retrievedChunks = await querySimilarChunks(
            queryEmbeddingVector,
            3, // Retrieve top 3 chunks
            userId // Pass the authenticated user's ID here for filtering
          );
          // --- END PASS USER ID ---

          console.log(`[RAG - User: ${userId}] Retrieved ${retrievedChunks.length} chunks from Pinecone.`);

          if (retrievedChunks.length > 0) {
            // Formatting retrieved context remains the same
            retrievedContextText = `--- START CONTEXT FROM UPLOADED DOCUMENTS (User: ${userId.substring(0, 6)}...) ---\n${
              retrievedChunks.map((chunk, idx) =>
                `[Context Chunk ${idx + 1} | Source: ${chunk.metadata.fileName} | Title: ${chunk.metadata.docTitle || 'N/A'} | Chunk: ${chunk.metadata.chunkIndex}]\n${chunk.content}`
              ).join('\n\n---\n\n')
            }\n--- END CONTEXT FROM UPLOADED DOCUMENTS ---`;
            console.log('[RAG] Formatted Context Text Prepared.');
          } else {
            console.log(`[RAG - User: ${userId}] No relevant chunks found in Pinecone for this user.`);
          }
        } else {
          console.log(`[RAG - User: ${userId}] Skipping Pinecone query due to invalid/empty embedding vector.`);
        }
      } catch (ragError) {
        console.error(`[RAG - User: ${userId}] Error during RAG retrieval/embedding:`, ragError);
        retrievedContextText = ''; // Ensure context is cleared on error
      }
    } else {
        console.log(`[RAG - User: ${userId}] Skipping RAG because useUploadedFiles is ${useUploadedFiles} or no user message content.`);
    }
    // --- End RAG Process ---


    // Prepare Messages Array for LLM (remains the same)
    const messagesForLLM = messages.map(msg => ({ role: msg.role, content: msg.content }));

    // System prompt logic (remains the same)
    const systemPromptIndex = messagesForLLM.findIndex(msg => msg.role === 'system');
    const baseSystemPrompt = "You are Macbot, an AI assistant specialized in helping students understand Shakespeare's Macbeth... Always maintain an educational and supportive tone."; // Keep your original prompt
    const contextInstruction = "\n\nIMPORTANT: If relevant context from the user's uploaded documents is provided in a subsequent system message, prioritize using that information... Base your response primarily on the provided document context if it's relevant."; // Keep your original instruction

    if (systemPromptIndex !== -1) {
      messagesForLLM[systemPromptIndex].content = baseSystemPrompt + contextInstruction;
    } else {
      messagesForLLM.unshift({ role: 'system', content: baseSystemPrompt + contextInstruction });
    }

    // Inject Retrieved Context (remains the same, but context is now user-specific)
    if (retrievedContextText) {
      const lastUserMessageIndex = messagesForLLM.findLastIndex((msg) => msg.role === 'user');
      if (lastUserMessageIndex !== -1) {
        messagesForLLM.splice(lastUserMessageIndex, 0, { role: 'system', content: `Use the following context (from the user's documents) to answer their question:\n${retrievedContextText}` });
        console.log("[Prompt Injection] Injected user-specific retrieved context.");
      } else if (systemPromptIndex !== -1) {
        messagesForLLM[systemPromptIndex].content += `\n\nRetrieved Context:\n${retrievedContextText}`;
        console.log("[Prompt Injection] Appended user-specific context to main system prompt (fallback).");
      }
    }

    console.log(`\n--- Sending ${messagesForLLM.length} Messages to LLM (${modelName}) for User: ${userId} ---`);
    // console.log(JSON.stringify(messagesForLLM, null, 2)); // Optional: Log full payload if needed
    console.log('--- End LLM Payload ---\n');

    // Call LLM (OpenRouter) - remains the same
    const response = await streamCompletion(messagesForLLM);

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter API error:", error);
      throw new Error(`OpenRouter API error: ${error}`);
    }
    console.log("Received stream response from OpenRouter.");

    // Stream handling (remains the same)
    const stream = new ReadableStream({ /* ... stream handling logic ... */
        async start(controller) {
            const encoder = new TextEncoder();
            const reader = response.body?.getReader();
            if (!reader) { controller.error(new Error("Failed to get reader from response")); return; }
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = new TextDecoder().decode(value);
                    const events = chunk.split('\n\n').filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
                    for (const event of events) {
                        const jsonMatch = event.match(/data: (.+)$/m);
                        if (!jsonMatch) continue;
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            const content = jsonData.choices?.[0]?.delta?.content || '';
                            if (content) controller.enqueue(encoder.encode(content));
                        } catch (e) { console.error("Error parsing chunk:", e); }
                    }
                }
            } catch (error) { console.error("Streaming error from OpenRouter:", error); controller.error(error);
            } finally { console.log("LLM response stream finished."); controller.close(); }
        },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });

  } catch (error: unknown) {
    console.error(`--- Error in chat API route (User: ${userId ?? 'Unknown'}) ---:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json( { error: `Failed to generate response: ${errorMessage}` }, { status: 500 });
  }
}