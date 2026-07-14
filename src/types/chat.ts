export interface ImageAttachment {
  id: string;
  name: string;
  type: string; // e.g. 'image/png', 'application/pdf'
  size: number;
  dataUrl: string; // base64 representation or URL
  previewUrl?: string; // object URL for rendering if needed
}

export type PipelineStepId = 'observe' | 'ocr' | 'layout' | 'transcribe' | 'reasoning' | 'answer';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: 'idle' | 'processing' | 'completed' | 'skipped';
  details?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  images?: ImageAttachment[];
  pipelineSteps?: PipelineStep[];
  isStreaming?: boolean;
  reasoning?: string;
  modelUsed?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  isPinned: boolean;
}

export interface VoiceInputState {
  isRecording: boolean;
  transcript: string;
  error?: string;
}
