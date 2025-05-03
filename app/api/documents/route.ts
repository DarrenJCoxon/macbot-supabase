// app/api/documents/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // <--- Added
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // <--- Added
import { getIndex } from '@/app/lib/pinecone-client'; // <--- Kept getIndex, removed others

// --- Supabase Client Helper (Corrected for Unused Vars) ---
const getSupabaseClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
          cookies: {
              get(name: string) {
                  return cookieStore.get(name)?.value;
              },
              // --- FIXED: Prefix unused parameters with '_' ---
              set(_name: string, _value: string, _options: CookieOptions) {
                  void _name;
                  void _value;
                  void _options;
                  // No-op is fine here for API routes usually
              },
              remove(_name: string, _options: CookieOptions) {
                  void _name;
                  void _options;
                  // No-op is fine here
              },
              // --- END FIX ---
          }
      }
  );
};
// --- End Helper ---
// --- End Helper ---

// --- GET Documents for the CURRENT USER (Modified Logic) ---
export async function GET(_req: Request) {
    void _req;
    console.log('--- GET /api/documents (User Specific) ---'); // Updated log
    const supabase = await getSupabaseClient(); // <--- Added

    // --- Authentication (Added) ---
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        console.error('GET /api/documents: Auth Error or No Session', sessionError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    console.log(`GET /api/documents: Getting documents for user ${userId}`);
    // --- End Authentication ---

    try {
        // --- STRATEGY CHANGE: Query Supabase DB table, protected by RLS ---
        console.log(`Querying Supabase 'user_documents' table for user ${userId}...`);
        const { data: userDocsData, error: dbError } = await supabase
            .from('user_documents') // Your Supabase table name
            .select('file_name, document_title, chunk_count, created_at') // Select needed columns
            .eq('user_id', userId); // Filter for the logged-in user

        if (dbError) {
            console.error(`Error fetching documents for user ${userId} from Supabase:`, dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }

        // Format the response based on DB data
        const documents = userDocsData?.map(doc => ({
            fileName: doc.file_name,
            uploadedAt: doc.created_at,
            chunks: doc.chunk_count,
            // title: doc.document_title // Optional: uncomment if needed by frontend
        })) || [];

        console.log(`Found ${documents.length} documents for user ${userId} in Supabase.`);
        return NextResponse.json({ documents: documents });
        // --- END STRATEGY CHANGE ---

    } catch (error) {
        console.error(`Error in GET /api/documents route for user ${userId}:`, error); // Added userId to log
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json( { error: 'Failed to fetch documents', details: message }, { status: 500 } );
    }
}


// --- DELETE Documents for the CURRENT USER (Modified Logic) ---
export async function DELETE(req: Request) {
    console.log('--- DELETE /api/documents (User Specific) ---'); // Updated log
    const supabase = await getSupabaseClient(); // <--- Added

     // --- Authentication (Added) ---
     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     if (sessionError || !session) {
         console.error('DELETE /api/documents: Auth Error or No Session', sessionError);
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     const userId = session.user.id;
     console.log(`DELETE /api/documents: Request from user ${userId}`);
     // --- End Authentication ---

    try {
        const { fileName } = await req.json();
        if (!fileName || typeof fileName !== 'string') {
            console.error("DELETE request missing valid 'fileName'.");
            return NextResponse.json( { error: 'File name is required' }, { status: 400 } );
        }
        console.log(`Attempting to delete file: ${fileName} for user ${userId}`);

        // --- STEP 1: Verify ownership in Supabase DB (Added) ---
        console.log(`Verifying ownership for file: ${fileName}, user: ${userId} in Supabase...`);
        const { data: docData, error: verifyError } = await supabase
            .from('user_documents')
            .select('file_id') // Select only needed field(s)
            .eq('user_id', userId) // Must match logged-in user
            .eq('file_name', fileName) // Must match the specific file
            .single(); // Expect one or zero rows

        if (verifyError) {
             console.error(`Ownership verification failed for file ${fileName}, user ${userId}: ${verifyError.message}`);
             if (verifyError.code === 'PGRST116') { // Not found / not owned
                 return NextResponse.json({ error: `Document not found or not owned by user: ${fileName}` }, { status: 404 });
             }
             return NextResponse.json({ error: `Database error during verification`, details: verifyError.message }, { status: 500 });
        }
        if (!docData) { // Should be caught by verifyError, but good failsafe
             console.error(`Ownership verification null data for file ${fileName}, user ${userId}.`);
             return NextResponse.json({ error: `Document not found or not owned by user: ${fileName}` }, { status: 404 });
        }
        console.log(`Ownership verified.`);
        // Note: We don't strictly *need* the file_id if we delete by metadata filter in Pinecone
        // const fileId = docData.file_id;
        // --- End Verification ---


        // --- STEP 2: Delete vectors from Pinecone using Filter (Modified) ---
        const index = await getIndex(); // Still need index object
        console.log(`Attempting to delete vectors from Pinecone using filter: user_id=${userId}, fileName=${fileName}...`);
        try {
            // Delete based on metadata filter matching BOTH user and filename
            const deleteResponse = await index.deleteMany({
                user_id: userId,
                fileName: fileName
            });
             console.log(`Pinecone delete request successful for filter user_id=${userId}, fileName=${fileName}. Response:`, deleteResponse);
        } catch (pineconeDeleteError) {
             console.error(`Error deleting vectors from Pinecone for user ${userId}, file ${fileName}:`, pineconeDeleteError);
             // Allow Supabase delete attempt? Or fail here? For now, fail here.
             throw new Error(`Failed to delete vectors from Pinecone: ${pineconeDeleteError instanceof Error ? pineconeDeleteError.message : String(pineconeDeleteError)}`);
        }
        // --- End Pinecone Delete ---


        // --- STEP 3: Delete metadata from Supabase DB (Added) ---
        console.log(`Deleting metadata from Supabase DB for file ${fileName}, user ${userId}...`);
        const { error: deleteDbError } = await supabase
            .from('user_documents')
            .delete()
            .eq('user_id', userId) // RLS protects, but filter is explicit
            .eq('file_name', fileName);

        if (deleteDbError) {
            console.error(`CRITICAL: Failed to delete metadata from Supabase DB for file ${fileName} after deleting from Pinecone:`, deleteDbError);
            return NextResponse.json({
                error: 'Failed to delete document metadata from database after removing from vector store. Manual cleanup might be required.',
                details: deleteDbError.message,
             }, { status: 500 });
        }
        console.log(`Successfully deleted metadata from Supabase DB.`);
        // --- End Supabase Delete ---

        return NextResponse.json({
            success: true,
            // Message indicates vectors targeted by filter were removed
            message: `Successfully processed deletion request for ${fileName}. Associated vectors removed.`,
            fileName
        });

    } catch (error) {
        console.error(`Error in DELETE /api/documents route for user ${userId}:`, error); // Added userId to log
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to delete document', details: message }, { status: 500 });
    }
}