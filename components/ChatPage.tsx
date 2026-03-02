import React, { useState, useEffect, useCallback, useRef } from 'react';
import { connectLiveSession, disconnectLiveSession } from '../services/geminiService';
import { LiveServerMessage, FunctionCall, ToolResponsePart } from '@google/genai'; // Import FunctionCall, ToolResponsePart
import { ChatMessage, LocationData } from '../types';
import AtaVisualizer from './AtaVisualizer';
import ChatWindow from './ChatWindow';
import Button from './Button';
import { WAKE_WORD } from '../constants'; // Import WAKE_WORD
import { v4 as uuidv4 } from 'uuid'; // For unique message IDs
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme hook

interface ChatPageProps {
  userName: string | null;
}

const ChatPage: React.FC<ChatPageProps> = ({ userName }) => {
  const { themeColor, setThemeColor, isRgbCycling, toggleRgbCycling, toggleFullscreen, isFullscreen } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConversationStarted, setIsConversationStarted] = useState(false); // Controls if LiveSession is connected
  const [isWaitingForWakeWord, setIsWaitingForWakeWord] = useState(false); // New: True when session is connected but waiting for "Ata"
  const [isAtaListening, setIsAtaListening] = useState(false); // True when mic is on and Ata is waiting for input (after wake word)
  const [isAtaSpeaking, setIsAtaSpeaking] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false); // New: Separate state for location loading
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false); // Controls chat window visibility
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'not_supported'>('idle'); // Changed initial state
  const [showSettings, setShowSettings] = useState(false); // State for settings dropdown

  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  const goodbyeDetectedInThisTurnRef = useRef<boolean>(false);

  const settingsRef = useRef<HTMLDivElement>(null); // Ref for settings dropdown

  const GOODBYE_PHRASES = ['konuşmam bitti', 'teşekkürler ata', 'hoşça kal ata', 'görüşürüz ata'];

  // Refs for state values, to be used inside stable callbacks
  const isWaitingForWakeWordRef = useRef(isWaitingForWakeWord);
  const isAtaListeningRef = useRef(isAtaListening);
  const locationPermissionStatusRef = useRef(locationPermissionStatus);
  const locationRef = useRef(location); 
  const isAtaSpeakingRef = useRef(isAtaSpeaking);
  const isConversationStartedRef = useRef(isConversationStarted);

  // Effect to keep state refs updated
  useEffect(() => { isWaitingForWakeWordRef.current = isWaitingForWakeWord; }, [isWaitingForWakeWord]);
  useEffect(() => { isAtaListeningRef.current = isAtaListening; }, [isAtaListening]);
  useEffect(() => { locationPermissionStatusRef.current = locationPermissionStatus; }, [locationPermissionStatus]);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { isAtaSpeakingRef.current = isAtaSpeaking; }, [isAtaSpeaking]);
  useEffect(() => { isConversationStartedRef.current = isConversationStarted; }, [isConversationStarted]);

  // Click outside to close settings dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsRef]);


  // Refs for functions to break circular dependencies
  const handleLiveMessageRef = useRef<((message: LiveServerMessage) => void) | null>(null);
  const requestLocationPermissionAndReconnectRef = useRef<(() => Promise<LocationData | null>) | null>(null);

  const resetTurnState = useCallback(() => {
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    goodbyeDetectedInThisTurnRef.current = false;
  }, []);

  // Stable callbacks with minimal dependencies
  const handleLiveError = useCallback((err: Error) => {
    console.error("Live session error:", err);
    setError(`Bir hata oluştu: ${err.message}`);
    setIsLoadingSession(false);
    setIsConversationStarted(false);
    setIsWaitingForWakeWord(false);
    setIsAtaListening(false);
    setIsAtaSpeaking(false);
    setShowChatHistory(false);
    resetTurnState();
  }, [resetTurnState]);

  const handleLiveClose = useCallback(() => {
    console.log("Live session closed.");
    setIsLoadingSession(false);
    setIsConversationStarted(false);
    setIsWaitingForWakeWord(false);
    setIsAtaListening(false);
    setIsAtaSpeaking(false);
    setShowChatHistory(false);
    resetTurnState();
  }, [resetTurnState]);

  const handleLiveOpen = useCallback(() => {
    console.log("Live session opened.");
    setIsLoadingSession(false);
    setIsConversationStarted(true);
    setIsWaitingForWakeWord(true);
    setIsAtaListening(false);
    setIsAtaSpeaking(false);
    setShowChatHistory(false);
    setError(null);
  }, []);

  // Define handleToolCall to execute functions based on model's instruction
  const handleToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<ToolResponsePart[]> => {
    const responses: ToolResponsePart[] = [];
    for (const fc of functionCalls) {
      try {
        let result: string | boolean | undefined;
        if (fc.name === 'setThemeColor') {
          const color = (fc.args as { color: string }).color;
          if (color) {
            setThemeColor(color);
            result = `Tema rengi ${color} olarak ayarlandı.`;
          } else {
            throw new Error("Renk parametresi eksik.");
          }
        } else if (fc.name === 'toggleRgbCycle') {
          toggleRgbCycling();
          result = `RGB döngüsü modu ${isRgbCycling ? 'kapatıldı' : 'açıldı'}.`;
        } else if (fc.name === 'toggleFullscreen') {
          toggleFullscreen();
          result = `Tam ekran modu ${isFullscreen ? 'kapatıldı' : 'açıldı'}.`;
        } else {
          throw new Error(`Bilinmeyen fonksiyon çağrısı: ${fc.name}`);
        }
        responses.push({ id: fc.id, name: fc.name, response: { result } });
        setMessages((prev) => [...prev, { id: uuidv4(), sender: 'ata', text: result as string, timestamp: new Date() }]);
      } catch (e: any) {
        console.error(`Fonksiyon çağrısı "${fc.name}" yürütülürken hata:`, e);
        responses.push({ id: fc.id, name: fc.name, response: { result: `Hata: ${e.message}` } });
        setMessages((prev) => [...prev, { id: uuidv4(), sender: 'ata', text: `Üzgünüm, "${fc.name}" komutunu yürütürken bir sorun oluştu: ${e.message}`, timestamp: new Date() }]);
      }
    }
    return responses;
  }, [setThemeColor, toggleRgbCycling, toggleFullscreen, isRgbCycling, isFullscreen]); // Add theme context functions to dependencies


  // Define handleLiveMessage. It now accesses states via refs.
  const handleLiveMessage = useCallback((message: LiveServerMessage) => {
    // Access latest state values via refs inside the callback
    const currentIsWaitingForWakeWord = isWaitingForWakeWordRef.current;
    const currentIsAtaListening = isAtaListeningRef.current;
    const currentIsAtaSpeaking = isAtaSpeakingRef.current;

    // --- Input Transcription Handling ---
    if (message.serverContent?.inputTranscription) {
      const newPartialInput = message.serverContent.inputTranscription.text;
      currentInputTranscriptionRef.current += newPartialInput;
      const currentFullInputLower = currentInputTranscriptionRef.current.toLowerCase().trim();

      // WAKE WORD DETECTION
      if (currentIsWaitingForWakeWord && currentFullInputLower.includes(WAKE_WORD)) {
        console.log(`Wake word "${WAKE_WORD}" detected!`);
        setIsWaitingForWakeWord(false);
        setIsAtaListening(true); // Ata is now actively listening for commands
        setShowChatHistory(true); // Show chat history
        setMessages((prev) => [...prev, { id: uuidv4(), sender: 'ata', text: `Merhaba, seni dinliyorum!`, timestamp: new Date() }]);
        currentInputTranscriptionRef.current = currentFullInputLower.substring(currentFullInputLower.indexOf(WAKE_WORD) + WAKE_WORD.length).trim(); // Remove wake word
      }

      // GOODBYE PHRASE DETECTION (only if Ata is actively listening for commands)
      if (currentIsAtaListening && GOODBYE_PHRASES.some(phrase => currentFullInputLower.includes(phrase))) {
         goodbyeDetectedInThisTurnRef.current = true;
         console.log("Goodbye phrase detected!");
      }
    }

    // --- Output Transcription / Audio Handling ---
    const hasAtaOutputAudio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (hasAtaOutputAudio) {
      setIsAtaSpeaking(true);
      if (message.serverContent?.outputTranscription) {
        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
      }
    } else {
      setIsAtaSpeaking(false);
    }
    
    // --- Turn Complete Handling ---
    if (message.serverContent?.turnComplete) {
      const fullInput = currentInputTranscriptionRef.current.trim();
      const fullOutput = currentOutputTranscriptionRef.current.trim();
      const groundingChunks = message.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Add user message if they spoke and Ata is actively listening (after wake word)
      if (fullInput && currentIsAtaListening) {
        setMessages((prev) => [...prev, { id: uuidv4(), sender: 'user', text: fullInput, timestamp: new Date() }]);
      }

      // Add Ata's response if available
      if (fullOutput) {
        setMessages((prev) => [...prev, { id: uuidv4(), sender: 'ata', text: fullOutput, timestamp: new Date(), groundingChunks }]);
      }

      // Handle conversation end (after Ata's farewell response)
      if (goodbyeDetectedInThisTurnRef.current) {
        disconnectLiveSession().finally(() => {
          console.log("Conversation ended by user via command.");
        });
      } else if (currentIsAtaListening) {
        setIsAtaListening(true);
        setIsWaitingForWakeWord(false);
        setShowChatHistory(true);
      } else {
         setIsWaitingForWakeWord(true);
         setShowChatHistory(false);
      }
      resetTurnState();
    }
  }, [
    setMessages, GOODBYE_PHRASES, resetTurnState, disconnectLiveSession, // Stable deps
    setIsWaitingForWakeWord, setIsAtaListening, setShowChatHistory, setIsAtaSpeaking // Setters are stable
  ]);

  // Define requestLocationPermissionAndReconnect. It now returns the fetched location.
  const requestLocationPermissionAndReconnect = useCallback(async (): Promise<LocationData | null> => {
    const currentLocationPermissionStatus = locationPermissionStatusRef.current; // Use ref

    // Only request if not already pending or granted
    if (currentLocationPermissionStatus === 'pending' || currentLocationPermissionStatus === 'granted') {
      console.log("Location permission already pending or granted, skipping new request.");
      return locationRef.current; // Return current location from ref if already granted
    }

    setIsLoadingLocation(true);
    setLocationPermissionStatus('pending');
    console.log("Requesting geolocation permission...");

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Tarayıcınız konum servislerini desteklemiyor."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
      });

      console.log("Geolocation granted:", position.coords);
      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(newLocation); // Update state
      setError(null);
      setLocationPermissionStatus('granted');
      setIsLoadingLocation(false);
      
      return newLocation; // Return the fetched location directly
    } catch (err: any) {
      console.error("Geolocation error:", err);
      if (err.code === err.PERMISSION_DENIED) {
        setError("Konum izni reddedildi. Konum tabanlı sorular kısıtlı olabilir.");
        setLocationPermissionStatus('denied');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setError("Konum bilgisi mevcut değil.");
        setLocationPermissionStatus('denied');
      } else if (err.code === err.TIMEOUT) {
        setError("Konum bilgisi alımı zaman aşımına uğradı.");
        setLocationPermissionStatus('denied');
      } else {
        setError(`Konum bilgisi alınamadı: ${err.message || err}. Konum tabanlı sorular için izin vermeniz gerekebilir.`);
        setLocationPermissionStatus('not_supported');
      }
      setLocation(null); // Clear location state on error
      setIsLoadingLocation(false);
      return null; // Return null on error
    }
  }, [
    setError, setLocation, setIsLoadingLocation, setLocationPermissionStatus, locationPermissionStatusRef // Removed locationRef from deps as it's used for read only inside the callback
  ]);


  // Update function refs whenever the memoized functions change
  useEffect(() => {
    handleLiveMessageRef.current = handleLiveMessage;
  }, [handleLiveMessage]);

  useEffect(() => {
    requestLocationPermissionAndReconnectRef.current = requestLocationPermissionAndReconnect;
  }, [requestLocationPermissionAndReconnect]);


  // This `toggleConversation` now explicitly requests location first and uses its return value
  const toggleConversation = useCallback(async () => {
    if (isConversationStarted || isLoadingSession) {
      await disconnectLiveSession();
    } else {
      setIsLoadingSession(true);
      setError(null);
      
      // 1. Always try to get location permission first (or confirm existing)
      let obtainedLocation: LocationData | null = null;
      if (requestLocationPermissionAndReconnectRef.current) {
        console.log("Initiating location permission request before connecting session...");
        obtainedLocation = await requestLocationPermissionAndReconnectRef.current(); // Capture the returned location
      } else {
        console.error("requestLocationPermissionAndReconnectRef.current is null!");
        setError("Uygulama başlatılırken bir hata oluştu (konum servisi).");
        setIsLoadingSession(false);
        return;
      }

      try {
        if (!handleLiveMessageRef.current) {
          console.error("handleLiveMessageRef.current is null when connecting!");
          setError("İç hata: Sohbet mesajı işleyici referansı eksik.");
          setIsLoadingSession(false);
          return;
        }

        // 2. Connect the live session, using the obtainedLocation and userName
        console.log("Connecting live session with location:", obtainedLocation, "and userName:", userName);
        await connectLiveSession(
          {
            onMessage: handleLiveMessageRef.current, // Use ref
            onError: handleLiveError,
            onClose: handleLiveClose,
            onOpen: handleLiveOpen,
            onToolCall: handleToolCall, // Pass the handleToolCall function
          },
          obtainedLocation, // Use the directly obtained location
          userName, // Pass the userName here
        );
      } catch (err) {
        console.error("Failed to connect live session:", err);
        setError(`Canlı oturum başlatılamadı: ${(err as Error).message}`);
        setIsLoadingSession(false);
        setIsConversationStarted(false);
        setIsWaitingForWakeWord(false);
        setIsAtaListening(false);
        setShowChatHistory(false);
      }
    }
  }, [
    isConversationStarted, isLoadingSession, handleLiveError, handleLiveClose, handleLiveOpen,
    userName, handleToolCall // Add userName and handleToolCall as dependencies
  ]);


  // Initial session setup on mount: NO LONGER AUTO-STARTING
  useEffect(() => {
    // This useEffect is now empty, `toggleConversation` will be called by user interaction.
    // Cleanup of any existing session on unmount is still important.
    return () => {
      disconnectLiveSession();
    };
  }, []); // Empty dependency array means this runs once on mount/unmount


  const getStatusMessage = () => {
    if (isLoadingLocation) return 'Konum alınıyor...';
    if (isLoadingSession) return 'Oturum bağlanıyor...';
    if (isAtaSpeaking) return 'Ata konuşuyor...';
    if (!isConversationStarted) {
      if (locationPermissionStatus === 'denied') return 'Konum izni reddedildi. Konum tabanlı sorular kısıtlı olabilir.';
      if (locationPermissionStatus === 'not_supported') return 'Tarayıcınız konum servislerini desteklemiyor.';
      // Initial state message
      return 'Sohbeti başlatmak için butona dokun.';
    }
    if (isWaitingForWakeWord) return `Ata dinliyor... ("${WAKE_WORD}" diyerek başlatın)`;
    if (isAtaListening) return 'Ata komutunuzu bekliyor...';
    return 'Bilinmeyen durum.'; // Fallback
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <header className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 z-20">
        <h1 className="text-2xl font-bold" style={{ color: themeColor }}>Ata AI Asistanı</h1>
        <div className="flex items-center space-x-4 relative">
          <Button 
            onClick={() => setShowSettings(prev => !prev)}
            variant="outline"
            size="sm"
            style={{ color: themeColor, borderColor: themeColor }}
            className="hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.04-1.46-1.68-2.54-1.68-.92 0-1.84.51-2.32 1.39L10.3 7.23a2.99 2.99 0 000 5.54l-3.67 4.02c.48.88 1.4 1.39 2.32 1.39 1.08 0 2.16-.64 2.54-1.68l.29-.98.53.53a1.5 1.5 0 002.12-2.12l-1.42-1.41a3.001 3.001 0 000-4.24l1.42-1.42a1.5 1.5 0 00-2.12-2.12l-.53.53-.29-.98zM9 10a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
          </Button>

          {showSettings && (
            <div ref={settingsRef} className="absolute top-full right-0 mt-2 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-30 min-w-[200px]">
              <div className="mb-3">
                <label htmlFor="themeColorPicker" className="block text-gray-300 text-sm font-semibold mb-1">
                  Tema Rengi Seç:
                </label>
                <input
                  type="color"
                  id="themeColorPicker"
                  value={isRgbCycling ? '#FFFFFF' : themeColor} // Show white if cycling, otherwise current color
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-full h-8 cursor-pointer rounded-md border-gray-600 bg-gray-700"
                  disabled={isRgbCycling}
                  aria-label="Tema rengi seçici"
                />
              </div>
              <div className="mb-3">
                <Button 
                  onClick={toggleRgbCycling}
                  variant={isRgbCycling ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full"
                  style={{ 
                    backgroundColor: isRgbCycling ? themeColor : undefined,
                    borderColor: isRgbCycling ? themeColor : undefined,
                    color: isRgbCycling ? 'white' : undefined // Ensure contrast
                  }}
                >
                  {isRgbCycling ? 'RGB Modu Kapat' : 'RGB Modu Aç'}
                </Button>
              </div>
              <div>
                <Button 
                  onClick={toggleFullscreen}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  style={{ color: themeColor, borderColor: themeColor }}
                >
                  {isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekrana Geç'}
                </Button>
              </div>
              <hr className="my-4 border-gray-700" />
              <Button onClick={() => {
                localStorage.removeItem('currentUser');
                window.location.reload(); // Simple reload to go back to auth
              }} variant="outline" size="sm" className="w-full">
                Çıkış Yap
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main content area: visualizer and chat window */}
      <main className="flex-1 flex flex-col justify-center items-center relative">
        <div className={`absolute inset-0 flex flex-col justify-center items-center transition-all duration-500 ease-in-out ${showChatHistory ? 'h-1/3' : 'h-full'}`}>
            <AtaVisualizer isSpeaking={isAtaSpeaking} />
        </div>
        
        {error && (
          <div className="absolute top-0 left-0 right-0 p-2 bg-red-800 text-red-100 text-center text-sm z-20">
            {error}
          </div>
        )}

        {/* ChatWindow conditional rendering and sizing */}
        {showChatHistory && (
          <div className="absolute bottom-0 left-0 right-0 h-2/3 flex flex-col pt-4 pb-20 z-10 bg-black bg-opacity-80">
            <ChatWindow messages={messages} loading={isLoadingSession || isAtaSpeaking} />
          </div>
        )}
      </main>


      <footer className="p-4 bg-gray-900 border-t border-gray-700 flex justify-center items-center z-10">
        <Button
          onClick={toggleConversation}
          className={`rounded-full p-4 transition-colors duration-200`}
          disabled={isLoadingSession}
          aria-label={isConversationStarted ? 'Sohbeti Durdur' : 'Sohbeti Başlat'}
          style={{ 
            backgroundColor: isConversationStarted ? 'rgb(220, 38, 38)' : themeColor, // red-600 or dynamic theme color
            color: 'white' // Ensure text is always white
          }}
        >
          {isLoadingSession ? (
            <svg
              className="animate-spin h-6 w-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              {isConversationStarted ? (
                <path d="M6 6h12v12H6z"/> // Stop icon
              ) : (
                <path d="M12 2c1.103 0 2 .897 2 2v7c0 1.103-.897 2-2 2s-2-.897-2-2V4c0-1.103.897-2 2-2zm-1 17.062V22h2v-2.938c3.044-.316 5.5-2.924 5.5-6.062h-2c0 2.21-1.79 4-4 4s-4-1.79-4-4H5.5c0 3.138 2.456 5.746 5.5 6.062z" /> // Mic icon
              )}
            </svg>
          )}
        </Button>
        <span className="ml-4 text-gray-400">
          {getStatusMessage()}
        </span>
      </footer>
    </div>
  );
};

export default ChatPage;