// app/page.tsx
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import CameraPreview from './components/CameraPreview';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// First, make sure Firebase is initialized
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase (do this outside component to avoid re-initialization)
const app = initializeApp(firebaseConfig);

// Helper function to create message components
const HumanMessage = ({ text, date }: { text: string, date: Date }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8">
      <AvatarImage src="/avatars/human.png" alt="Human" />
      <AvatarFallback className="bg-blue-900 text-white">H</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-blue-900">You</p>
        <span className="text-xs text-gray-500">
          {date.toLocaleTimeString()}
        </span>
      </div>
      <div className="rounded-lg bg-blue-100 px-3 py-2 text-sm text-zinc-800">
        {text}
      </div>
    </div>
  </div>
);

const GeminiMessage = ({ text, date }: { text: string, date: Date }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8 bg-blue-600">
      <AvatarImage src="/avatars/marebot.png" alt="Marebot" />
      <AvatarFallback>AI</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">Teacher A</p>
        <span className="text-xs text-gray-500">
          {date ? date.toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800">
        {text}
      </div>
    </div>
  </div>
);

export default function Home() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ type: 'human' | 'gemini', text: string, date: Date }[]>([]);
  const [isCameraStreaming, setIsCameraStreaming] = useState(false);
  const previousStreamingState = useRef(false);
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const db = getFirestore(app);

  useEffect(() => {
    console.log('isCameraStreaming', isCameraStreaming);
    if (!isCameraStreaming && messages.length > 0) {
      console.log('Transcriptions:', messages);
      // save this to firestore
      const transcriptionsCollection = collection(db, 'transcriptions');
      addDoc(transcriptionsCollection, {
        messages,
        createdAt: new Date()
      }).then(() => {
        console.log('Transcriptions saved to Firestore');
        // Optionally clear messages after saving
        setMessages([]);
      }).catch(error => {
        console.error('Error saving transcriptions:', error);
      });
    }
    
    // Update previous state for next comparison
    previousStreamingState.current = isCameraStreaming;
  }, [isCameraStreaming, messages]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleTranscription = useCallback((transcription: string, date: Date, isHuman: boolean) => {
    setMessages(prev => [...prev, { type: isHuman ? 'human' : 'gemini', text: transcription, date }]);
    // sort messages by date
    setMessages(prev => prev.sort((a, b) => a.date.getTime() - b.date.getTime()));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <h1 className="text-4xl font-bold text-zinc-800 p-8 pb-0">
       AI Assessment and Tutor
      </h1>
      
      {/* Main content area with responsive layout */}
      <div className="flex flex-col md:flex-row gap-8 p-8 flex-grow">
        <CameraPreview 
          onTranscription={handleTranscription} 
          onStreamingStateChange={setIsCameraStreaming}
          className="w-full md:w-auto"
        />

        {/* Message container - positioned at bottom on mobile */}
        <div className="w-full md:w-[640px] bg-white mt-auto md:mt-0 flex-shrink-0">
          <ScrollArea ref={scrollAreaRef} className="h-[300px] md:h-[540px] p-6">
            <div className="space-y-6">
              <GeminiMessage 
                text="Hi! I&apos;m Teacher. A. Are you ready to review on freefall and projectile motion? Please click on the green Camera button to begin." 
                date={new Date()} 
              />
              {messages.map((message, index) => (
                message.type === 'human' ? ( 
                  <HumanMessage key={`msg-${index}`} text={message.text} date={message.date} />
                ) : (
                  <GeminiMessage key={`msg-${index}`} text={message.text} date={message.date} />
                )
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
