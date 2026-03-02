import { GroundingChunk, FunctionCall, ToolResponsePart, LiveServerMessage } from "@google/genai";

export interface User {
  name: string;
  surname: string;
  phone: string;
  password: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ata';
  text: string;
  timestamp: Date;
  groundingChunks?: GroundingChunk[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export type AuthState = 'login' | 'signup';

export type ThemeColorState = string | 'rgb-cycle';

export interface LiveSessionCallbacks {
  onMessage: (message: LiveServerMessage) => void;
  onError: (error: Error) => void;
    onClose: (event: CloseEvent) => void;
  onOpen: () => void;
  onToolCall: (functionCalls: FunctionCall[]) => Promise<ToolResponsePart[]>;
}