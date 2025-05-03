// app/components/Chat.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { nanoid } from 'nanoid';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import FileUpload from './FileUpload'; // Use this for user uploads
import {
  ChatContainer,
  MessagesList,
  LoadingIndicator
} from '@/app/styles/ChatStyles'; // Adjust path if needed
import { Message } from '@/app/types'; // Adjust path if needed

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'system-1',
      role: 'system',
      content: "Thou art speaking with the MacBeth Oracle, a learned scholar of the Scottish Play. This Oracle shall illuminate themes, characters, tragic arcs, and the bard's devices within Shakespeare's darkest tragedy. The Oracle draws wisdom from scrolls thou uploadeth using the 'Consult Ancient Texts' button. Responses shall be scholarly yet engaging, with references to acts and scenes when fitting. If no knowledge exists within the Oracle's scrolls, it shall declare such ignorance rather than weave falsehoods."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUploadedFiles, setHasUploadedFiles] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ error: boolean; message: string | null }>({ error: false, message: null });

  useEffect(() => {
    if (uploadStatus.message) {
        const timer = setTimeout(() => {
            setUploadStatus({ error: false, message: null });
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // --- MODIFIED FUNCTION ---
  const handleFileUpload = async (files: File[]) => {
    console.log('[Chat.tsx] handleFileUpload received files:', files);
    setUploadStatus({ error: false, message: 'Uploading...' });

    if (!files || files.length === 0) {
        console.error('[Chat.tsx] handleFileUpload received no files!');
        setUploadStatus({ error: true, message: 'No files were selected.' });
        // Important: Rethrow or return explicitly so FileUpload knows about the error
        throw new Error('No files were selected.');
    }

    // --- Assume only ONE file ---
    // Adapt this if your backend handles multiple files with the key 'file[]' or similar
    if (files.length > 1) {
        console.warn('[Chat.tsx] Multiple files selected, processing only the first one.');
        setUploadStatus({ error: false, message: 'Processing first file...' });
    }
    const fileToUpload = files[0];

    if (!(fileToUpload instanceof File)) {
         console.error('[Chat.tsx] The selected item is not a valid File object:', fileToUpload);
         const errorMsg = 'Invalid item selected.';
         setUploadStatus({ error: true, message: errorMsg });
         throw new Error(errorMsg); // Propagate error
    }
    // --- End File Selection ---

    const formData = new FormData();
    // --- Use 'file' (singular) key to match backend formData.get('file') ---
    const serverExpectedFileKey = 'file';
    formData.append(serverExpectedFileKey, fileToUpload, fileToUpload.name);
    console.log(`[Chat.tsx] Appended file: ${fileToUpload.name} to formData with key '${serverExpectedFileKey}'`);

    // --- Append metadata field - REQUIRED by the current backend route ---
    // Create basic metadata (title from filename)
    const uploadMetadata = {
        title: fileToUpload.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
        source: '', // Optional: Add source if you collect it
        type: 'user_upload', // Set a default type
    };
    // The backend expects the metadata as a JSON string under the key 'metadata'
    formData.append('metadata', JSON.stringify(uploadMetadata));
    console.log('[Chat.tsx] Appended metadata:', uploadMetadata);
    // --- End Append metadata ---

    console.log('[Chat.tsx] Sending fetch request to /api/upload...'); // Ensure this path is correct
    try {
        // Ensure fetch targets the correct API route
        // Use '/api/admin/upload-document' if you didn't rename it, '/api/upload' otherwise
        const uploadRoute = '/api/upload'; // <--- CONFIRM OR CHANGE THIS PATH
        const response = await fetch(uploadRoute, {
            method: 'POST',
            body: formData,
            // No Content-Type header needed for FormData - browser sets it
        });

        console.log(`[Chat.tsx] Received response from ${uploadRoute} with status: ${response.status}`);

        // Always try to read response body, even on error
        const responseData = await response.json().catch(() => ({ // Default empty object on JSON parse error
            error: `Server returned status ${response.status} with non-JSON response.`,
            details: 'Could not parse response body.'
        }));

        if (!response.ok) {
            // Use error details from parsed JSON body if available
            const errorDetails = responseData.error || responseData.details || `Server returned status ${response.status}`;
            console.error(`[Chat.tsx] File upload fetch failed! Status: ${response.status}, Details: ${errorDetails}`);
            setUploadStatus({ error: true, message: `Upload failed: ${errorDetails}` });
            // Re-throw error for FileUpload component
            throw new Error(`File upload failed: ${errorDetails}`);
        }

        // Success Handling
        setHasUploadedFiles(true);
        console.log('[Chat.tsx] File upload successful:', responseData);
        setUploadStatus({ error: false, message: responseData.message || 'Upload successful!' });

        // Add confirmation message to chat
        const confirmationMessage = `Processed: ${responseData.fileName || fileToUpload.name}. Ask questions about its content!`;
        setMessages(prev => [
          ...prev,
          { id: nanoid(), role: 'assistant', content: confirmationMessage }
        ]);

    } catch (error) {
        // Catch network errors or errors explicitly thrown above
        console.error('[Chat.tsx] Error during file upload fetch/processing:', error);
        // Update status only if not already set by !response.ok block
        if (!uploadStatus.error || uploadStatus.message?.includes('Uploading')) {
             setUploadStatus({ error: true, message: error instanceof Error ? error.message : 'Upload network error.' });
        }
        // IMPORTANT: Re-throw the error so FileUpload component's catch block can run
        throw error;
    }
  };
  // --- END MODIFIED FUNCTION ---


  // Handles sending chat messages to the /api/chat route
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: nanoid(), role: 'user', content: trimmedInput, createdAt: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      const requestBody = {
          messages: [...messages, userMessage],
          useUploadedFiles: hasUploadedFiles,
      };
      console.log('[Chat.tsx] Sending chat request with body:', requestBody);

      // --- Ensure this fetch targets your CHAT API route ---
      const chatRoute = '/api/chat'; // <--- CONFIRM OR CHANGE THIS PATH
      const response = await fetch(chatRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetails = `Chat API error! Status: ${response.status}`;
        try { const errorData = await response.json(); errorDetails = errorData.error || errorData.details || JSON.stringify(errorData); }
        catch { try { errorDetails = await response.text() || errorDetails; } catch {} }
        console.error(`[Chat.tsx] Chat API fetch error: ${errorDetails}`);
        throw new Error(errorDetails);
      }

      if (response.body) {
        const responseId = nanoid();
        setMessages(prev => [...prev, { id: responseId, role: 'assistant', content: '' }]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          responseText += chunk;

          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessageIndex = newMessages.findLastIndex(m => m.id === responseId);
            if (lastMessageIndex !== -1) { newMessages[lastMessageIndex] = { ...newMessages[lastMessageIndex], content: responseText }; }
            return newMessages;
          });
        }
      } else {
          console.warn("[Chat.tsx] Chat API response ok but no body.");
          setMessages(prev => [...prev, { id: nanoid(), role: 'assistant', content: "[Received empty response]" }]);
      }
      setIsLoading(false);

    } catch (error) {
      console.error('[Chat.tsx] Error sending chat message:', error);
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        { id: nanoid(), role: 'assistant', content: `Sorry, error processing chat. ${error instanceof Error ? error.message : ''}` }
      ]);
    }
  }; // --- End handleSubmit ---


  // --- Component Render ---
  return (
    <ChatContainer>
      {/* FileUpload triggers handleFileUpload via onFileUpload prop */}
      <FileUpload onFileUpload={handleFileUpload} />

      {/* Display upload status message */}
       {uploadStatus.message && (
         <p style={{ padding: '8px 16px', color: uploadStatus.error ? 'red' : 'green', fontSize: '0.9em', textAlign: 'center' }}>
           {uploadStatus.message}
         </p>
       )}

      {/* Messages list */}
      <MessagesList>
        {messages.map(message =>
          message.role !== 'system' && ( // Don't render system messages
            <ChatMessage key={message.id} message={message} />
          )
        )}
        {isLoading && <LoadingIndicator>Macbot is thinking</LoadingIndicator>}
      </MessagesList>

      {/* Chat input form */}
      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </ChatContainer>
  );
} // --- End Chat Component ---