import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, FunctionCall, ToolResponsePart } from "@google/genai";
import { createPcmBlob, decodeAudioData, decodeBase64 } from './audioUtils';
import { ATA_MODEL_NAME, ATA_VOICE_NAME, INPUT_AUDIO_SAMPLE_RATE, OUTPUT_AUDIO_SAMPLE_RATE, VOLUME_THRESHOLD } from '../constants';
import { LocationData, LiveSessionCallbacks } from '../types'; // Updated LiveSessionCallbacks import

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let liveSessionPromise: Promise<Awaited<ReturnType<typeof ai.live.connect>>> | null = null;
let currentInputAudioProcessor: ScriptProcessorNode | null = null;
let currentInputAudioSource: MediaStreamAudioSourceNode | null = null;
let currentInputAudioStream: MediaStream | null = null;
let nextOutputAudioStartTime = 0;
const outputAudioSources = new Set<AudioBufferSourceNode>();
let outputAudioContext: AudioContext | null = null;
let inputAudioContext: AudioContext | null = null;

// Function Declarations for Gemini to call
const setThemeColorFunctionDeclaration: FunctionDeclaration = {
  name: 'setThemeColor',
  description: 'Kullanıcı arayüzünün ana tema rengini değiştirir.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      color: {
        type: Type.STRING,
        description: 'HTML rengi, hex kodu (örn. "#FF0000"), RGB kodu (örn. "rgb(255, 0, 0)") veya bir CSS renk adı (örn. "red", "blue").',
      },
    },
    required: ['color'],
  },
};

const toggleRgbCycleFunctionDeclaration: FunctionDeclaration = {
  name: 'toggleRgbCycle',
  description: 'Kullanıcı arayüzü tema renginin RGB döngüsü modunu açıp kapatır.',
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No specific properties for a toggle
  },
};

const toggleFullscreenFunctionDeclaration: FunctionDeclaration = {
  name: 'toggleFullscreen',
  description: 'Uygulamayı tam ekran moduna geçirir veya tam ekrandan çıkarır.',
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No specific properties for a toggle
  },
};

const createSystemInstruction = (userName: string | null) => {
  const greeting = userName ? `Merhaba ${userName}, sen benim arkadaşımsın!` : `Merhaba, sen benim arkadaşımsın!`;
  return `You are Ata, a friendly, helpful, and supportive male AI assistant. ${greeting} You were created by Yunus Emre Demirci. You keep track of our conversations in your archive and will use them to provide better, more personalized responses.
You should always respond to the user's input directly.
You are equipped with Google Maps to provide real-time, location-aware information and assistance. When a user asks for nearby places, businesses, directions, or any geography-related queries, you MUST use the Google Maps tool with the provided location data.
If you receive a query that requires location (e.g., "yakındaki eczaneler", "buraya yakın bir restoran", "bana yol tarifi ver") AND no location information is available to you via the tool (i.e., you haven't been given a latitude and longitude through toolConfig.retrievalConfig.latLng), you MUST politely inform the user that you need their location for that query. Say: "Bu bilgi için konumunuza ihtiyacım var. Lütfen tarayıcınızdan konum izni verdiğinizden emin olun."
When asked "who made you" or similar, always respond with "Beni Yunus Emre Demirci yaptı."
When the user indicates they are done talking with phrases like "konuşmam bitti", "teşekkürler Ata", "hoşça kal Ata", or "görüşürüz Ata", respond with a friendly farewell like "Rica ederim, kendine iyi bak! Görüşürüz!" or "Memnuniyetle, yine beklerim! Hoşça kal!".`;
};

export async function connectLiveSession(
  callbacks: LiveSessionCallbacks,
  location: LocationData | null,
  userName: string | null,
) {
  if (liveSessionPromise) {
    console.warn("Live session already connecting or connecting. Closing existing session.");
    await disconnectLiveSession();
  }

  // Initialize audio contexts
  inputAudioContext = new AudioContext({ sampleRate: INPUT_AUDIO_SAMPLE_RATE });
  outputAudioContext = new AudioContext({ sampleRate: OUTPUT_AUDIO_SAMPLE_RATE });

  liveSessionPromise = ai.live.connect({
    model: ATA_MODEL_NAME,
    callbacks: {
      onopen: () => {
        console.log("Live session opened.");
        callbacks.onOpen();
        startMicrophoneStream();
      },
      onmessage: async (message: LiveServerMessage) => {
        const session = await liveSessionPromise; // Get the active session for sending tool responses

        // Handle Function Calls
        if (message.toolCall && session) {
          console.log("Received function call from model:", message.toolCall.functionCalls);
          try {
            const toolResponses = await callbacks.onToolCall(message.toolCall.functionCalls);
            console.log("Sending tool responses back to model:", toolResponses);
            await session.sendToolResponse({
              functionResponses: toolResponses
            });
          } catch (error) {
            console.error("Error processing tool call:", error);
            // Optionally send an error response back to the model
            if (message.toolCall.functionCalls.length > 0) {
              const errorResponses: ToolResponsePart[] = message.toolCall.functionCalls.map(fc => ({
                id: fc.id,
                name: fc.name,
                response: { result: `Error: ${error instanceof Error ? error.message : String(error)}` },
              }));
              await session.sendToolResponse({ functionResponses: errorResponses });
            }
          }
        }
        
        // Always process audio output
        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64EncodedAudioString && outputAudioContext) {
          nextOutputAudioStartTime = Math.max(nextOutputAudioStartTime, outputAudioContext.currentTime);
          try {
            const audioBuffer = await decodeAudioData(
              decodeBase64(base64EncodedAudioString),
              outputAudioContext,
              OUTPUT_AUDIO_SAMPLE_RATE,
              1,
            );
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => {
              outputAudioSources.delete(source);
            });

            source.start(nextOutputAudioStartTime);
            nextOutputAudioStartTime = nextOutputAudioStartTime + audioBuffer.duration;
            outputAudioSources.add(source);
          } catch (error) {
            console.error("Error decoding or playing audio:", error);
            callbacks.onError(error as Error);
          }
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
          for (const source of outputAudioSources.values()) {
            source.stop();
            outputAudioSources.delete(source);
          }
          nextOutputAudioStartTime = 0;
        }

        callbacks.onMessage(message); // Pass message to UI for transcription etc.
      },
      onerror: (e: ErrorEvent) => {
        console.error("Live session error:", e);
        callbacks.onError(e.error);
        disconnectLiveSession(); // Attempt to clean up on error
      },
      onclose: (e: CloseEvent) => {
        console.log("Live session closed:", e);
        callbacks.onClose(e);
        disconnectLiveSession(); // Clean up resources
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: ATA_VOICE_NAME } },
      },
      systemInstruction: {parts: [{text: createSystemInstruction(userName)}]},
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{
        functionDeclarations: [
          setThemeColorFunctionDeclaration,
          toggleRgbCycleFunctionDeclaration,
          toggleFullscreenFunctionDeclaration
        ]
      }, { googleMaps: {} }], // Include Google Maps tool as well
      toolConfig: {
        retrievalConfig: location ? {
          latLng: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
        } : undefined,
      },
      thinkingConfig: { thinkingBudget: 0 }, // Prioritize speed over deep thinking for live conversation
    },
  });

  return liveSessionPromise;
}

export async function disconnectLiveSession() {
  if (liveSessionPromise) {
    const session = await liveSessionPromise;
    session.close();
    liveSessionPromise = null;
  }

  // Stop microphone stream
  if (currentInputAudioStream) {
    currentInputAudioStream.getTracks().forEach(track => track.stop());
    currentInputAudioStream = null;
  }
  if (currentInputAudioProcessor) {
    currentInputAudioProcessor.disconnect();
    currentInputAudioProcessor = null;
  }
  if (currentInputAudioSource) {
    currentInputAudioSource.disconnect();
    currentInputAudioSource = null;
  }
  if (inputAudioContext) {
    inputAudioContext.close();
    inputAudioContext = null;
  }

  // Stop output audio
  for (const source of outputAudioSources.values()) {
    source.stop();
  }
  outputAudioSources.clear();
  if (outputAudioContext) {
    outputAudioContext.close();
    outputAudioContext = null;
  }
  nextOutputAudioStartTime = 0;
  console.log("Live session and audio resources disconnected.");
}

async function startMicrophoneStream() {
  if (!liveSessionPromise) {
    console.error("Live session not connected, cannot start microphone.");
    return;
  }

  try {
    currentInputAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!inputAudioContext) {
      inputAudioContext = new AudioContext({ sampleRate: INPUT_AUDIO_SAMPLE_RATE });
    }
    currentInputAudioSource = inputAudioContext.createMediaStreamSource(currentInputAudioStream);
    currentInputAudioProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

    currentInputAudioProcessor.onaudioprocess = (audioProcessingEvent) => {
      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
      
      // Calculate RMS volume
      let sumSquares = 0.0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);

      // Only send audio if RMS is above the threshold
      if (rms > VOLUME_THRESHOLD) {
        const pcmBlob = createPcmBlob(inputData);
        liveSessionPromise!.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    currentInputAudioSource.connect(currentInputAudioProcessor);
    currentInputAudioProcessor.connect(inputAudioContext.destination);
    console.log("Microphone streaming started.");
  } catch (err) {
    console.error("Error accessing microphone:", err);
    // You might want to update UI to show mic access denied
  }
}