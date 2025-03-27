// app/page.tsx
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import CameraPreview from './components/CameraPreview';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { Button } from "@/components/ui/button";
import { GeminiWebSocket } from './services/geminiWebSocket';
import { useRouter, useSearchParams } from 'next/navigation';

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

// Add this constant outside your component
const PHYSICS_TOPICS = [
  {
    title: "Motion and Forces",
    subtopics: [
      "Displacement and Velocity",
      "Soccer",
      "Acceleration",
      "Newton's Laws of Motion",
      "Freefall and Projectile Motion",
      "Circular Motion"
    ]
  },
  {
    title: "Energy",
    subtopics: [
      "Work and Energy",
      "Potential and Kinetic Energy",
      "Conservation of Energy",
      "Power"
    ]
  },
  {
    title: "Waves",
    subtopics: [
      "Wave Properties",
      "Sound Waves",
      "Light Waves",
      "Electromagnetic Spectrum"
    ]
  },
  {
    title: "Heat",
    subtopics: [
      "Temperature and Heat",
      "Heat Transfer",
      "Specific Heat Capacity",
      "Phase Changes"
    ]
  }
];

// Add topic-specific prompts
const TOPIC_PROMPTS = {
  "Displacement and Velocity": "Hi! I'm Teacher A. Let's explore displacement and velocity. Ready to understand how objects move and measure their motion? Click the green Camera button to begin.",
  "Soccer": "Hi! I'm Teacher A. Let's explore the physics of soccer. Ready to understand how forces and motion apply to the beautiful game? Click the green Camera button to begin.",
  "Acceleration": "Hi! I'm Teacher A. Today we'll study acceleration. Ready to learn how velocity changes over time? Click the green Camera button to begin.",
  "Newton's Laws of Motion": "Hi! I'm Teacher A. Let's dive into Newton's Laws of Motion. Ready to understand the fundamental principles of force and motion? Click the green Camera button to begin.",
  "Freefall and Projectile Motion": "Hi! I'm Teacher A. Are you ready to review freefall and projectile motion? Please click on the green Camera button to begin.",
  "Circular Motion": "Hi! I'm Teacher A. Let's explore circular motion. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Work and Energy": "Hi! I'm Teacher A. Let's explore work and energy. Ready to understand how objects move and measure their motion? Click the green Camera button to begin.",
  "Potential and Kinetic Energy": "Hi! I'm Teacher A. Today we'll study potential and kinetic energy. Ready to learn how velocity changes over time? Click the green Camera button to begin.",
  "Conservation of Energy": "Hi! I'm Teacher A. Let's dive into conservation of energy. Ready to understand the fundamental principles of force and motion? Click the green Camera button to begin.",
  "Power": "Hi! I'm Teacher A. Let's explore power. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Wave Properties": "Hi! I'm Teacher A. Let's explore wave properties. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Sound Waves": "Hi! I'm Teacher A. Let's explore sound waves. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Light Waves": "Hi! I'm Teacher A. Let's explore light waves. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Electromagnetic Spectrum": "Hi! I'm Teacher A. Let's explore the electromagnetic spectrum. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Temperature and Heat": "Hi! I'm Teacher A. Let's explore temperature and heat. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Heat Transfer": "Hi! I'm Teacher A. Let's explore heat transfer. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Specific Heat Capacity": "Hi! I'm Teacher A. Let's explore specific heat capacity. Ready to understand how objects move in circles? Click the green Camera button to begin.",
  "Phase Changes": "Hi! I'm Teacher A. Let's explore phase changes. Ready to understand how objects move in circles? Click the green Camera button to begin.",
} as const;

type TopicKey = keyof typeof TOPIC_PROMPTS;

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

const GeminiMessage = ({ text, date, imageUrl }: { text: string, date?: Date, imageUrl?: string }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8 bg-blue-600">
      <AvatarImage src="/avatars/marebot.png" alt="Marebot" />
      <AvatarFallback>AI</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">Teacher A</p>
        <span className="text-xs text-gray-500">
          {date?.toLocaleTimeString()}
        </span>
      </div>
      <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800">
        {text}
        {imageUrl && (
          <div className="mt-4">
            <img src={imageUrl} alt="Soccer scenario" className="rounded-lg max-w-full h-auto" />
          </div>
        )}
      </div>
    </div>
  </div>
);

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get topic from URL or default to "Freefall and Projectile Motion"
  const currentTopic = (searchParams.get('topic') as TopicKey) || "Freefall and Projectile Motion";
  const [activeTopic, setActiveTopic] = useState<TopicKey>(currentTopic);

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

  const [initialMessageDate, setInitialMessageDate] = useState<Date>();
  const webSocketRef = useRef<GeminiWebSocket | null>(null);

  // Reset messages when topic changes
  useEffect(() => {
    setMessages([]);
    setInitialMessageDate(new Date());
  }, [activeTopic]);

  // Update activeTopic when URL changes
  useEffect(() => {
    if (currentTopic in TOPIC_PROMPTS) {
      setActiveTopic(currentTopic as TopicKey);
    }
  }, [currentTopic]);

  // Handle topic selection
  const handleTopicSelect = useCallback((subtopic: string) => {
    if (subtopic in TOPIC_PROMPTS) {
      // Update URL and force reload the page
      window.location.href = `/?topic=${encodeURIComponent(subtopic)}`;
    }
  }, []);

  // Update page title based on active topic
  useEffect(() => {
    const title = document.querySelector('h1');
    if (title) {
      title.textContent = activeTopic;
    }
  }, [activeTopic]);

  // Define all the required handler functions
  const handleMessage = useCallback((text: string) => {
    console.log("Received message:", text);
  }, []);

  const handleSetupComplete = useCallback(() => {
    console.log("WebSocket setup complete");
  }, []);

  const handlePlayingStateChange = useCallback((isPlaying: boolean) => {
    setIsCameraStreaming(isPlaying);
  }, []);

  const handleAudioLevelChange = useCallback((level: number) => {
    // Optional: Handle audio level changes if needed
    console.log("Audio level:", level);
  }, []);

  const handleTranscription = useCallback((transcription: string, date: Date, isHuman: boolean) => {
    setMessages(prev => [...prev, { 
      type: isHuman ? 'human' : 'gemini', 
      text: transcription, 
      date 
    }]);
  }, []);

  // Initialize WebSocket with current topic
  useEffect(() => {
    webSocketRef.current = new GeminiWebSocket(
      handleMessage,
      handleSetupComplete,
      handlePlayingStateChange,
      handleAudioLevelChange,
      handleTranscription,
      activeTopic // Pass the current topic
    );
    webSocketRef.current.connect();

    return () => {
      webSocketRef.current?.disconnect();
    };
  }, [
    handleMessage,
    handleSetupComplete,
    handlePlayingStateChange,
    handleAudioLevelChange,
    handleTranscription,
    activeTopic // Add activeTopic as dependency
  ]);

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
  }, [isCameraStreaming, messages, db]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.log('Gemini API key is loaded', process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    } else {
      console.log('Gemini API key is missing');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <h1 className="text-4xl font-bold text-zinc-800 p-8 pb-0">
        Better Ed : Education Reimagined
      </h1>
      
      <div className="flex flex-row gap-8 p-8 flex-grow">
        {/* Navigation Sidebar */}
        <div className="hidden md:block w-64 bg-white rounded-lg border border-zinc-200 h-[calc(100vh-8rem)] flex-shrink-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <h2 className="font-semibold text-lg mb-4">Grade 10 Physics</h2>
              {PHYSICS_TOPICS.map((topic, topicIndex) => (
                <div key={topicIndex} className="mb-4">
                  <h3 className="font-medium text-sm text-zinc-800 mb-2">{topic.title}</h3>
                  <div className="space-y-1">
                    {topic.subtopics.map((subtopic, subtopicIndex) => (
                      <Button
                        key={subtopicIndex}
                        variant="ghost"
                        className={`w-full justify-start text-sm font-normal h-8 ${
                          activeTopic === subtopic ? "bg-blue-50 text-blue-700" : ""
                        }`}
                        onClick={() => handleTopicSelect(subtopic)}
                      >
                        {subtopic}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex flex-col md:flex-row gap-8 flex-grow">
          <CameraPreview 
            onTranscription={handleTranscription} 
            onStreamingStateChange={setIsCameraStreaming}
            className="w-full md:min-w-[480px] md:w-auto"
            topic={activeTopic}
          />

          <div className="w-full md:w-[480px] bg-white mt-auto md:mt-0 flex-shrink-0">
            <ScrollArea ref={scrollAreaRef} className="h-[240px] md:h-[540px] p-6">
              <div className="space-y-6">
                <GeminiMessage 
                  text={TOPIC_PROMPTS[activeTopic]}
                  date={initialMessageDate}
                  imageUrl={activeTopic === "Soccer" ? "/soccer.png" : undefined}
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
    </div>
  );
}
