'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Settings,
  Image as ImageIcon,
  Camera,
  FileText,
  Mic,
  Send,
  Trash2,
  Pin,
  ChevronLeft,
  ChevronRight,
  Copy,
  Share2,
  RefreshCw,
  Play,
  ThumbsUp,
  ThumbsDown,
  X,
  FileUp,
  Maximize2,
  MicOff,
  User,
  Sun,
  Moon,
  Laptop,
  Check,
  MoreVertical,
  Edit3
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Chat, Message, ImageAttachment, PipelineStep, PipelineStepId, VoiceInputState } from '@/types/chat';

// Helper for class consolidation
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export default function VisionApp() {
  // --- Persistent States ---
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [modelPreference, setModelPreference] = useState<'auto' | 'minimax' | 'nemotron'>('auto');

  // --- UI Interactivity States ---
  const [inputText, setInputText] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // --- Camera Capture States ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // --- Voice Input States ---
  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    isRecording: false,
    transcript: ''
  });
  const speechRecognitionRef = useRef<any>(null);

  // --- Streaming & Thinking States ---
  const [isThinking, setIsThinking] = useState(false);
  const [activePipelineSteps, setActivePipelineSteps] = useState<PipelineStep[]>([]);
  const [streamedText, setStreamedText] = useState('');
  const [streamedReasoning, setStreamedReasoning] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Text-To-Speech & Audio States ---
  const [playingTtsMessageId, setPlayingTtsMessageId] = useState<string | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Load localStorage on Mount ---
  useEffect(() => {
    // ponytail: load theme first to prevent flash
    const savedTheme = localStorage.getItem('vision-theme') as 'light' | 'dark';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = savedTheme || systemTheme;
    setTheme(activeTheme);
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // load model preference
    const savedModelPref = localStorage.getItem('vision-model-preference') as 'auto' | 'minimax' | 'nemotron';
    if (savedModelPref) {
      setModelPreference(savedModelPref);
    }

    // load chats
    const savedChats = localStorage.getItem('vision-chats');
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        setChats(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse chats', e);
      }
    }
  }, []);

  // --- Save chats to localStorage whenever they change ---
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('vision-chats', JSON.stringify(chats));
    }
  }, [chats]);

  // --- Auto-scroll to bottom of messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, currentChatId, activePipelineSteps, streamedText, isThinking]);

  // --- Auto-grow input text area ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // --- Voice Input Integration (Web Speech API) ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceState({ isRecording: true, transcript: '' });
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcription = finalTranscript || interimTranscript;
        setVoiceState(prev => ({ ...prev, transcript: transcription }));
        setInputText(prev => {
          const base = prev.trim();
          return base ? `${base} ${transcription}` : transcription;
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event);
        setVoiceState({ isRecording: false, transcript: '', error: event.error });
        showToast(`Voice input error: ${event.error}`);
      };

      recognition.onend = () => {
        setVoiceState(prev => ({ ...prev, isRecording: false }));
      };

      speechRecognitionRef.current = recognition;
    }
  }, []);

  // --- Audio Context Sound Synthesizer (realtime oscillators) ---
  const playSendSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playChimeSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.03, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.start();
      osc1.stop(now + 0.35);

      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
          gain2.gain.setValueAtTime(0.03, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.45);
        } catch (e) {}
      }, 70);
    } catch (e) {}
  };

  // --- Text-To-Speech (SpeechSynthesis API) ---
  const handleTextToSpeech = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      showToast('Text-to-speech not supported in this browser.');
      return;
    }

    if (playingTtsMessageId === messageId) {
      window.speechSynthesis.cancel();
      setPlayingTtsMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/[*#`_\-~]/g, '') // remove markdown symbols
      .replace(/\[.*?\]\(.*?\)/g, ''); // remove markdown links

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => {
      setPlayingTtsMessageId(null);
    };
    utterance.onerror = () => {
      setPlayingTtsMessageId(null);
    };

    speechUtteranceRef.current = utterance;
    setPlayingTtsMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleModelPreferenceChange = (pref: 'auto' | 'minimax' | 'nemotron') => {
    setModelPreference(pref);
    localStorage.setItem('vision-model-preference', pref);
    showToast(`Preferred model set to: ${pref === 'auto' ? 'Auto Detect' : pref === 'minimax' ? 'MiniMax M3 (Multimodal)' : 'Nemotron-3 (Deep Reasoning)'}`);
  };

  const toggleVoiceRecording = () => {
    if (!speechRecognitionRef.current) {
      showToast('Speech recognition not supported in this browser.');
      return;
    }

    if (voiceState.isRecording) {
      speechRecognitionRef.current.stop();
    } else {
      speechRecognitionRef.current.start();
    }
  };

  // --- Toast notification utility ---
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // --- Theme toggling ---
  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('vision-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // --- Active Chat Helper ---
  const activeChat = chats.find(c => c.id === currentChatId);

  // --- Create a new chat ---
  const handleNewChat = () => {
    const newId = Math.random().toString(36).substring(7);
    const newChatObj: Chat = {
      id: newId,
      title: 'New Discussion',
      messages: [],
      createdAt: Date.now(),
      isPinned: false
    };
    setChats(prev => [newChatObj, ...prev]);
    setCurrentChatId(newId);
    setAttachments([]);
    setInputText('');
  };

  // --- Delete a chat ---
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== id);
    setChats(updatedChats);
    localStorage.setItem('vision-chats', JSON.stringify(updatedChats));

    if (currentChatId === id) {
      if (updatedChats.length > 0) {
        setCurrentChatId(updatedChats[0].id);
      } else {
        setCurrentChatId(null);
      }
    }
    showToast('Conversation deleted');
  };

  // --- Pin / Unpin a chat ---
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    showToast('Conversation pinned status updated');
  };

  // --- Rename a chat ---
  const handleRenameChatSubmit = (id: string) => {
    if (editTitleText.trim()) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitleText.trim() } : c));
    }
    setEditingChatId(null);
  };

  // --- Handle File Upload and conversion to base64 ---
  const processFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        showToast('Only images and PDF files are supported.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newAttachment: ImageAttachment = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  // --- Paste clipboard support ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const fileList = new DataTransfer();
              fileList.items.add(file);
              processFiles(fileList.files);
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // --- Drag and Drop handlers ---
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  // --- Camera Operations ---
  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      showToast('Could not access camera device');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
    }
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current) {
      const video = cameraVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const attachment: ImageAttachment = {
          id: Math.random().toString(36).substring(7),
          name: `Camera Capture ${new Date().toLocaleTimeString()}.jpg`,
          type: 'image/jpeg',
          size: dataUrl.length,
          dataUrl
        };
        setAttachments(prev => [...prev, attachment]);
      }
      stopCamera();
    }
  };

  // --- Determine Multimodal Experience Pipeline ---
  const selectPipeline = (promptText: string, files: ImageAttachment[]): { type: string; steps: PipelineStep[] } => {
    const prompt = promptText.toLowerCase();
    
    // Multiple Images
    if (files.length > 1) {
      return {
        type: 'compare',
        steps: [
          { id: 'observe', label: 'Aligning multiple image inputs...', status: 'idle' },
          { id: 'ocr', label: 'Comparing visual boundaries & frames...', status: 'idle' },
          { id: 'reasoning', label: 'Synthesizing inter-image relationships...', status: 'idle' },
          { id: 'answer', label: 'Generating comparative analysis...', status: 'idle' }
        ]
      };
    }

    const hasPdf = files.some(f => f.type === 'application/pdf');
    const isDoc = hasPdf || files.some(f => {
      const name = f.name.toLowerCase();
      return name.includes('pdf') || name.includes('doc') || name.includes('txt') || name.includes('paper') || name.includes('invoice') || name.includes('receipt');
    });

    if (isDoc) {
      return {
        type: 'document',
        steps: [
          { id: 'ocr', label: 'Extracting text lines (OCR)...', status: 'idle' },
          { id: 'layout', label: 'Evaluating document layout structure...', status: 'idle' },
          { id: 'reasoning', label: 'Parsing tables & logical schemas...', status: 'idle' },
          { id: 'answer', label: 'Summarizing document insights...', status: 'idle' }
        ]
      };
    }

    const isGraph = prompt.includes('graph') || prompt.includes('chart') || prompt.includes('plot') || prompt.includes('data') || files.some(f => {
      const name = f.name.toLowerCase();
      return name.includes('chart') || name.includes('graph') || name.includes('plot');
    });

    if (isGraph) {
      return {
        type: 'graph',
        steps: [
          { id: 'observe', label: 'Detecting axis bounds & grids...', status: 'idle' },
          { id: 'layout', label: 'Reading labels, legends & values...', status: 'idle' },
          { id: 'reasoning', label: 'Computing statistical trends...', status: 'idle' },
          { id: 'answer', label: 'Extracting data intelligence...', status: 'idle' }
        ]
      };
    }

    const isUI = prompt.includes('ui') || prompt.includes('ux') || prompt.includes('design') || prompt.includes('screen') || prompt.includes('wireframe') || files.some(f => {
      const name = f.name.toLowerCase();
      return name.includes('ui') || name.includes('design') || name.includes('mockup') || name.includes('screen');
    });

    if (isUI) {
      return {
        type: 'ui',
        steps: [
          { id: 'observe', label: 'Mapping UI boundaries & layout...', status: 'idle' },
          { id: 'layout', label: 'Analyzing component hierarchy...', status: 'idle' },
          { id: 'reasoning', label: 'Checking accessibility & alignment...', status: 'idle' },
          { id: 'answer', label: 'Formulating design recommendations...', status: 'idle' }
        ]
      };
    }

    const isHandwritten = prompt.includes('handwriting') || prompt.includes('handwritten') || prompt.includes('write') || files.some(f => {
      const name = f.name.toLowerCase();
      return name.includes('write') || name.includes('note') || name.includes('scribble');
    });

    if (isHandwritten) {
      return {
        type: 'handwritten',
        steps: [
          { id: 'ocr', label: 'Tracing stroke patterns...', status: 'idle' },
          { id: 'transcribe', label: 'Transcribing handwriting text...', status: 'idle' },
          { id: 'reasoning', label: 'Resolving lexicon & context...', status: 'idle' },
          { id: 'answer', label: 'Composing final transcription...', status: 'idle' }
        ]
      };
    }

    // Default Photo
    return {
      type: 'photo',
      steps: [
        { id: 'observe', label: 'Observing object shapes...', status: 'idle' },
        { id: 'ocr', label: 'Detecting textures & labels...', status: 'idle' },
        { id: 'reasoning', label: 'Analyzing visual context...', status: 'idle' },
        { id: 'answer', label: 'Composing intelligent description...', status: 'idle' }
      ]
    };
  };

  // --- Send Message ---
  const handleSendMessage = async (textOverride?: string, filesOverride?: ImageAttachment[]) => {
    const textToSend = textOverride !== undefined ? textOverride : inputText;
    const filesToSend = filesOverride !== undefined ? filesOverride : attachments;

    if (!textToSend.trim() && filesToSend.length === 0) return;

    playSendSound(); // Swoosh frequency sweep
    setIsThinking(true);
    setStreamedText('');
    setStreamedReasoning('');

    // Ensure we have an active chat, create one if empty/none
    let activeChatObj = activeChat;
    if (!activeChatObj) {
      const newId = Math.random().toString(36).substring(7);
      activeChatObj = {
        id: newId,
        title: textToSend.trim().substring(0, 30) || 'Image Discussion',
        messages: [],
        createdAt: Date.now(),
        isPinned: false
      };
      setChats(prev => [activeChatObj!, ...prev]);
      setCurrentChatId(newId);
    }

    // Create user message
    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: textToSend,
      createdAt: Date.now(),
      images: filesToSend
    };

    // Update title if first message
    if (activeChatObj.messages.length === 0) {
      activeChatObj.title = textToSend.trim().substring(0, 35) || 'Vision Analysis';
    }

    // Append user message
    const updatedMessages = [...activeChatObj.messages, userMsg];
    setChats(prev => prev.map(c => c.id === activeChatObj!.id ? { ...c, title: activeChatObj!.title, messages: updatedMessages } : c));
    
    // Reset state inputs
    setInputText('');
    setAttachments([]);

    // Select pipeline
    const pipeline = selectPipeline(textToSend, filesToSend);
    setActivePipelineSteps(pipeline.steps);

    // Fire API request immediately in background to prevent forced latency
    const apiPromise = fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [...updatedMessages],
        modelPreference: modelPreference
      })
    });

    // Animate pipeline steps quickly in parallel with network call (120ms per step)
    for (let i = 0; i < pipeline.steps.length; i++) {
      setActivePipelineSteps(prev => 
        prev.map((step, idx) => {
          if (idx === i) return { ...step, status: 'processing' as const };
          if (idx < i) return { ...step, status: 'completed' as const };
          return step;
        })
      );
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    // Call completions endpoint and read stream
    try {
      const apiResponse = await apiPromise;

      if (!apiResponse.ok) {
        throw new Error('API server returned error');
      }

      const modelUsed = apiResponse.headers.get('X-Model-Used');
      const fallbackTriggered = apiResponse.headers.get('X-Fallback-Triggered') === 'true';

      if (fallbackTriggered) {
        showToast(`Fallback triggered: switched to ${modelUsed === 'minimax' ? 'MiniMax M3' : 'Nemotron-3'}`);
      }

      // Mark all pipeline steps completed as streaming starts
      setActivePipelineSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));

      const reader = apiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedAnswer = '';
      let streamedReasoning = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data: ')) {
              const dataStr = cleanLine.slice(6);
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || '';
                const token = parsed.choices?.[0]?.delta?.content || '';
                
                if (reasoning) {
                  streamedReasoning += reasoning;
                  setStreamedReasoning(streamedReasoning);
                }
                if (token) {
                  streamedAnswer += token;
                  setStreamedText(streamedAnswer);
                }
              } catch (e) {
                // skip parse error on partial buffers
              }
            }
          }
        }
      }

      // Play finished chime sound
      playChimeSound();

      // Add assistant message
      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: streamedAnswer,
        reasoning: streamedReasoning || undefined,
        modelUsed: modelUsed || undefined,
        createdAt: Date.now(),
        pipelineSteps: pipeline.steps.map(s => ({ ...s, status: 'completed' }))
      };

      setChats(prev => prev.map(c => c.id === activeChatObj!.id ? {
        ...c,
        messages: [...updatedMessages, assistantMsg]
      } : c));

    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `**Error:** MiniMax M3 API stream was interrupted. Please check your internet connection or try again. (${err.message})`,
        reasoning: streamedReasoning || undefined,
        createdAt: Date.now(),
        pipelineSteps: pipeline.steps.map(s => ({ ...s, status: 'skipped' }))
      };
      setChats(prev => prev.map(c => c.id === activeChatObj!.id ? {
        ...c,
        messages: [...updatedMessages, errorMsg]
      } : c));
    } finally {
      setIsThinking(false);
      setActivePipelineSteps([]);
      setStreamedText('');
      setStreamedReasoning('');
    }
  };

  // --- Message Action Triggers ---
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard');
  };

  const handleShareChat = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Conversation share link copied to clipboard');
  };

  const handleRegenerate = () => {
    if (!activeChat || activeChat.messages.length < 2) return;
    const history = [...activeChat.messages];
    // Find last user message
    let lastUserMsgIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        lastUserMsgIdx = i;
        break;
      }
    }

    if (lastUserMsgIdx !== -1) {
      const userMsg = history[lastUserMsgIdx];
      // Trim messages to everything before this user message
      const cleanHistory = history.slice(0, lastUserMsgIdx);
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, messages: cleanHistory } : c));
      handleSendMessage(userMsg.content, userMsg.images);
    }
  };

  const handleContinueGeneration = () => {
    if (!activeChat || activeChat.messages.length === 0) return;
    const lastMsg = activeChat.messages[activeChat.messages.length - 1];
    if (lastMsg.role === 'assistant') {
      // Prompt model to continue its last output
      handleSendMessage(`Please continue writing from where you left off: "${lastMsg.content.substring(lastMsg.content.length - 50)}"`);
    }
  };

  const handleEditMessage = (msgId: string, newText: string) => {
    if (!activeChat) return;
    const history = [...activeChat.messages];
    const targetIdx = history.findIndex(m => m.id === msgId);
    if (targetIdx !== -1) {
      // Slice history to before this message, and trigger send with new text
      const cleanHistory = history.slice(0, targetIdx);
      const oldFiles = history[targetIdx].images;
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, messages: cleanHistory } : c));
      handleSendMessage(newText, oldFiles);
    }
  };

  // --- Export conversation data ---
  const handleExportChat = (format: 'json' | 'markdown') => {
    if (!activeChat) return;
    let dataStr = '';
    let filename = `${activeChat.title.replace(/\s+/g, '_')}`;

    if (format === 'json') {
      dataStr = JSON.stringify(activeChat, null, 2);
      filename += '.json';
    } else {
      dataStr = `# ${activeChat.title}\n\n`;
      activeChat.messages.forEach(m => {
        dataStr += `### ${m.role === 'user' ? 'User' : 'Vision'}\n\n${m.content}\n\n`;
        if (m.images && m.images.length > 0) {
          dataStr += `*Uploaded files:* ${m.images.map(img => img.name).join(', ')}\n\n`;
        }
        dataStr += `---\n\n`;
      });
      filename += '.md';
    }

    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Conversation exported as ${format.toUpperCase()}`);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K to search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('chat-search');
        searchInput?.focus();
      }
      // CMD/CTRL + \ to collapse sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
      // ESC to close modal settings
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsCameraOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Filter history based on search query ---
  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedChats = filteredChats.filter(c => c.isPinned);
  const unpinnedChats = filteredChats.filter(c => !c.isPinned);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-warm font-sans antialiased dark:bg-[#181715]">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border-warm bg-card-warm px-5 py-2.5 shadow-lg flex items-center gap-2 max-w-sm text-sm text-text-primary"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-accent-gold animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SIDEBAR --- */}
      <div
        className={cn(
          "h-full bg-card-warm border-r border-border-warm flex flex-col justify-between shrink-0 transition-all duration-300 relative z-20 dark:bg-card-warm dark:border-border-warm",
          isSidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[270px]"
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 px-4 pt-5">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 font-medium text-lg tracking-tight select-none">
              <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-accent-gold/10">
                <svg className="w-4 h-4 text-accent-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-text-primary">Vision</span>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-1.5 rounded-lg border border-border-warm hover:bg-hover-warm text-text-secondary transition-colors"
              title="Close sidebar (Cmd+\)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mb-4 rounded-xl border border-border-warm hover:bg-hover-warm text-text-primary text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="h-4 w-4 text-accent-gold" />
            <span>New Chat</span>
          </button>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
            <input
              id="chat-search"
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1.5 pl-9 pr-4 rounded-xl border border-border-warm bg-background-warm text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-gold transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-text-primary text-text-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* History Scrollbox */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 select-none">
            {/* Pinned Section */}
            {pinnedChats.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium px-2">
                  <Pin className="h-3 w-3 rotate-45" />
                  <span>Pinned</span>
                </div>
                {pinnedChats.map(c => renderChatListItem(c))}
              </div>
            )}

            {/* Recents Section */}
            <div className="space-y-1">
              {pinnedChats.length > 0 && unpinnedChats.length > 0 && (
                <div className="text-xs text-text-secondary font-medium px-2 pt-2">
                  <span>Recents</span>
                </div>
              )}
              {unpinnedChats.length > 0 ? (
                unpinnedChats.map(c => renderChatListItem(c))
              ) : (
                pinnedChats.length === 0 && (
                  <div className="text-center py-8 text-xs text-text-secondary">
                    No conversations found.
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border-warm flex flex-col gap-2">
          {/* Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-hover-warm/60 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-accent-gold/15 flex items-center justify-center text-accent-gold">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-text-primary leading-tight">Alex Johnson</span>
                <span className="text-[10px] text-text-secondary leading-none">Developer Account</span>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-hover-warm text-text-secondary hover:text-text-primary transition-colors"
              title="Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Expand Sidebar Button */}
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed top-5 left-5 z-30 p-2 rounded-xl border border-border-warm bg-card-warm hover:bg-hover-warm text-text-secondary shadow-md transition-all animate-fade-in"
          title="Open sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        
        {/* Drag Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-background-warm/80 backdrop-blur-sm border-2 border-dashed border-accent-gold m-4 rounded-3xl flex flex-col items-center justify-center gap-3"
            >
              <div className="h-14 w-14 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                <FileUp className="h-7 w-7 animate-bounce" />
              </div>
              <span className="text-lg font-medium text-text-primary">Drop files here to upload</span>
              <span className="text-xs text-text-secondary">Supports images & PDFs</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar (for collapsed / options) */}
        <div className="h-14 border-b border-border-warm flex items-center justify-between px-6 bg-background-warm/60 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {isSidebarCollapsed && <div className="w-10" />} {/* Spacer */}
            {activeChat && (
              <span className="text-sm font-medium text-text-primary truncate max-w-[120px] md:max-w-xs hidden sm:inline">
                {activeChat.title}
              </span>
            )}

            {/* Premium Model Selection Control */}
            <div className="flex border border-border-warm rounded-xl overflow-hidden p-0.5 bg-card-warm scale-90 md:scale-95 shadow-sm">
              <button
                onClick={() => handleModelPreferenceChange('auto')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer",
                  modelPreference === 'auto' ? "bg-hover-warm text-accent-gold shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
                title="Auto Detect: MiniMax for images, Nemotron for text."
              >
                Auto Detect
              </button>
              <button
                onClick={() => handleModelPreferenceChange('minimax')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer",
                  modelPreference === 'minimax' ? "bg-hover-warm text-accent-gold shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
                title="Force MiniMax M3 (Multimodal)"
              >
                MiniMax
              </button>
              <button
                onClick={() => handleModelPreferenceChange('nemotron')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer",
                  modelPreference === 'nemotron' ? "bg-hover-warm text-accent-gold shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
                title="Force Nemotron-3 (Reasoning)"
              >
                Nemotron
              </button>
            </div>
          </div>
          {activeChat && activeChat.messages.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportChat('json')}
                className="text-xs py-1.5 px-3 rounded-lg border border-border-warm hover:bg-hover-warm text-text-secondary hover:text-text-primary transition-all font-medium"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExportChat('markdown')}
                className="text-xs py-1.5 px-3 rounded-lg border border-border-warm hover:bg-hover-warm text-text-secondary hover:text-text-primary transition-all font-medium"
              >
                Export Markdown
              </button>
              <button
                onClick={handleShareChat}
                className="p-1.5 rounded-lg border border-border-warm hover:bg-hover-warm text-text-secondary hover:text-text-primary transition-all"
                title="Share Conversation"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Conversations Log / Welcome Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-[850px] mx-auto w-full flex flex-col h-full justify-between">
            
            {!activeChat || activeChat.messages.length === 0 ? (
              // --- WELCOME SCREEN ---
              <div className="flex flex-col items-center justify-center my-auto py-12 text-center">
                {/* Glowing Animated Eye Logo */}
                <motion.div
                  animate={{
                    scale: [1, 1.03, 1],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-accent-gold/20 via-accent-gold/45 to-transparent shadow-lg mb-8"
                >
                  <div className="absolute inset-0.5 rounded-full bg-card-warm flex items-center justify-center border border-border-warm dark:bg-[#201E1B]">
                    <svg className="w-8 h-8 text-accent-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </motion.div>

                <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-4">
                  What can I help you understand today?
                </h1>
                <p className="text-text-secondary max-w-md mb-8 text-sm leading-relaxed">
                  Upload visual data—photos, code screenshots, layouts, math problems, PDF papers, graphs, or handwritten notes—and ask absolutely anything.
                </p>

                {/* Upload Card Area */}
                <div
                  onClick={handleFileUploadClick}
                  className="w-full max-w-lg p-10 rounded-2xl border border-dashed border-border-warm bg-card-warm/50 hover:bg-card-warm hover:border-accent-gold cursor-pointer transition-all flex flex-col items-center gap-3.5 shadow-sm group"
                >
                  <div className="h-12 w-12 rounded-xl bg-hover-warm flex items-center justify-center text-text-secondary group-hover:text-accent-gold transition-colors">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-text-primary">Drag files here or click to upload</span>
                    <span className="text-xs text-text-secondary">Supports multi-image comparative mode & documents</span>
                  </div>
                </div>
              </div>
            ) : (
              // --- MESSAGE LIST ---
              <div className="space-y-8 flex-1 pb-16">
                {activeChat.messages.map((m) => (
                  <div key={m.id} className="space-y-4">
                    {/* User Message Bubble */}
                    {m.role === 'user' && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="bg-[#EFEADF] dark:bg-[#2F2D28] text-text-primary py-3 px-4.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm leading-relaxed text-sm">
                          {m.content}
                        </div>
                        {/* Attachments rendering */}
                        {m.images && m.images.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 mt-1 justify-end max-w-[85%]">
                            {m.images.map((img) => (
                              <div key={img.id} className="relative group rounded-xl overflow-hidden shadow border border-border-warm bg-card-warm shrink-0">
                                <img src={img.dataUrl} alt={img.name} className="h-28 w-32 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <button
                                    onClick={() => {
                                      // preview popup
                                      const w = window.open();
                                      w?.document.write(`<img src="${img.dataUrl}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                    }}
                                    className="p-1.5 bg-white/20 rounded-lg text-white hover:bg-white/40 transition-colors"
                                    title="View Fullscreen"
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assistant Message Bubble */}
                    {m.role === 'assistant' && (
                      <div className="flex items-start gap-4">
                        <div className="h-8 w-8 rounded-full bg-accent-gold/15 flex items-center justify-center text-accent-gold shrink-0 mt-0.5">
                          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          {m.reasoning && (
                            <details className="mb-3 text-xs text-text-secondary border border-border-warm rounded-xl bg-hover-warm/30 overflow-hidden group">
                              <summary className="cursor-pointer py-2 px-3 hover:bg-hover-warm/60 font-semibold list-none flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-accent-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  <span>Thought Process</span>
                                </div>
                                <span className="text-[10px] text-accent-gold group-open:hidden">Show</span>
                                <span className="text-[10px] text-accent-gold hidden group-open:inline">Hide</span>
                              </summary>
                              <div className="p-3 border-t border-border-warm/60 font-mono leading-relaxed bg-[#FFFDF8] dark:bg-[#1E1C18] whitespace-pre-wrap">
                                {m.reasoning}
                              </div>
                            </details>
                          )}
                          <MarkdownRenderer content={m.content} />
                          
                          {/* Message Actions */}
                          <div className="flex items-center gap-1.5 text-text-secondary pt-2">
                            <button
                              onClick={() => handleCopyMessage(m.content)}
                              className="p-1.5 rounded-lg hover:bg-hover-warm hover:text-text-primary transition-colors"
                              title="Copy Answer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            
                            {/* Native Text-To-Speech Reader */}
                            <button
                              onClick={() => handleTextToSpeech(m.id, m.content)}
                              className={cn(
                                "p-1.5 rounded-lg hover:bg-hover-warm transition-colors cursor-pointer",
                                playingTtsMessageId === m.id ? "text-accent-gold bg-hover-warm animate-pulse" : "hover:text-text-primary"
                              )}
                              title={playingTtsMessageId === m.id ? "Stop Reading" : "Read Aloud"}
                            >
                              {playingTtsMessageId === m.id ? (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                </svg>
                              )}
                            </button>

                            <button
                              onClick={handleRegenerate}
                              className="p-1.5 rounded-lg hover:bg-hover-warm hover:text-text-primary transition-colors"
                              title="Regenerate Response"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={handleContinueGeneration}
                              className="p-1.5 rounded-lg hover:bg-hover-warm hover:text-text-primary transition-colors font-medium text-xs flex items-center gap-1"
                              title="Continue Writing"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Continue</span>
                            </button>
                            <span className="h-3 w-px bg-border-warm mx-1" />
                            <button
                              onClick={() => showToast('Response liked')}
                              className="p-1.5 rounded-lg hover:bg-hover-warm hover:text-text-primary transition-colors"
                              title="Like"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>

                            {/* Active Model Indicator Badge */}
                            {m.modelUsed && (
                              <span className="text-[9px] bg-hover-warm/80 text-accent-gold border border-border-warm/60 px-2 py-0.5 rounded-full font-medium select-none capitalize ml-2">
                                {m.modelUsed === 'minimax' ? 'MiniMax M3' : 'Nemotron-3'}
                              </span>
                            )}
                            <button
                              onClick={() => showToast('Response disliked')}
                              className="p-1.5 rounded-lg hover:bg-hover-warm hover:text-text-primary transition-colors"
                              title="Dislike"
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Stream / Thinking State Bubble */}
                {isThinking && (
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-accent-gold/15 flex items-center justify-center text-accent-gold shrink-0 mt-0.5">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3 select-none">
                      
                      {/* Simulated Pipeline Steps Checklist */}
                      {activePipelineSteps.length > 0 && (
                        <div className="border border-border-warm bg-card-warm p-4 rounded-2xl shadow-sm max-w-sm space-y-2.5">
                          <span className="text-xs font-semibold text-text-secondary block mb-1">REASONING PIPELINE:</span>
                          {activePipelineSteps.map((step) => (
                            <div key={step.id} className="flex items-center justify-between text-xs">
                              <span className={cn(
                                "font-medium",
                                step.status === 'completed' && "text-text-secondary line-through decoration-accent-gold/30",
                                step.status === 'processing' && "text-accent-gold font-semibold",
                                step.status === 'idle' && "text-neutral-400"
                              )}>
                                {step.label}
                              </span>
                              {step.status === 'completed' && <Check className="h-3.5 w-3.5 text-success-green" />}
                              {step.status === 'processing' && (
                                <div className="flex gap-1">
                                  <span className="w-1.5 h-1.5 bg-accent-gold rounded-full animate-bounce" />
                                  <span className="w-1.5 h-1.5 bg-accent-gold rounded-full animate-bounce [animation-delay:0.2s]" />
                                  <span className="w-1.5 h-1.5 bg-accent-gold rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                              )}
                              {step.status === 'idle' && <div className="h-2 w-2 rounded-full border border-neutral-300" />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live streaming reasoning */}
                      {streamedReasoning && (
                        <div className="mb-3 text-xs text-text-secondary border border-border-warm rounded-xl bg-hover-warm/30 overflow-hidden">
                          <div className="py-2 px-3 font-semibold flex items-center gap-1.5 border-b border-border-warm bg-hover-warm/40">
                            <div className="h-2 w-2 bg-accent-gold rounded-full animate-pulse" />
                            <span>Thinking Process...</span>
                          </div>
                          <div className="p-3 font-mono leading-relaxed bg-[#FFFDF8] dark:bg-[#1E1C18] whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {streamedReasoning}
                          </div>
                        </div>
                      )}

                      {/* Answer Streaming Content with Typewriter cursor */}
                      {streamedText && (
                        <div className="streaming-cursor">
                          <MarkdownRenderer content={streamedText} />
                        </div>
                      )}

                      {/* Blinking Gradient Pulsing Indicator if not streaming tokens yet */}
                      {!streamedText && !streamedReasoning && (
                        <div className="flex items-center gap-1.5 h-6">
                          <div className="h-2 w-2 bg-accent-gold rounded-full animate-pulse" />
                          <div className="h-2 w-2 bg-accent-gold rounded-full animate-pulse [animation-delay:0.3s]" />
                          <div className="h-2 w-2 bg-accent-gold rounded-full animate-pulse [animation-delay:0.6s]" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* --- BOTTOM INPUT BAR --- */}
        <div className="bg-background-warm/95 border-t border-border-warm/60 px-4 pt-4 pb-6 md:px-8">
          <div className="max-w-[850px] mx-auto w-full flex flex-col gap-3">
            
            {/* Thumbnail preview zone above input bar */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 p-3 rounded-2xl border border-border-warm bg-card-warm/50 animate-fade-in shadow-inner">
                {attachments.map((file, idx) => (
                  <div key={file.id} className="relative group rounded-xl overflow-hidden border border-border-warm bg-card-warm shadow-md">
                    {file.type.startsWith('image/') ? (
                      <img src={file.dataUrl} alt={file.name} className="h-16 w-20 object-cover" />
                    ) : (
                      <div className="h-16 w-20 flex flex-col items-center justify-center p-1.5 bg-neutral-100 dark:bg-neutral-800 text-center">
                        <FileText className="h-5 w-5 text-accent-gold mb-1" />
                        <span className="text-[9px] text-text-secondary truncate max-w-full font-medium">{file.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 p-0.5 bg-neutral-900/60 hover:bg-neutral-900 text-white rounded-full transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Pills and Container */}
            <div className="rounded-2xl border border-border-warm bg-card-warm p-2 shadow-sm transition-all focus-within:border-accent-gold focus-within:shadow-md flex flex-col gap-1">
              
              {/* Text Input Row */}
              <div className="flex items-start gap-2">
                
                {/* Left Attachment Actions */}
                <div className="flex items-center gap-1 mt-1 shrink-0">
                  <button
                    onClick={handleFileUploadClick}
                    className="p-2 rounded-xl text-text-secondary hover:bg-hover-warm hover:text-text-primary transition-all"
                    title="Upload File"
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={startCamera}
                    className="p-2 rounded-xl text-text-secondary hover:bg-hover-warm hover:text-text-primary transition-all"
                    title="Capture from Camera"
                  >
                    <Camera className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={handleFileUploadClick}
                    className="p-2 rounded-xl text-text-secondary hover:bg-hover-warm hover:text-text-primary transition-all"
                    title="Upload PDF Document"
                  >
                    <FileText className="h-4.5 w-4.5" />
                  </button>
                </div>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,application/pdf"
                />

                {/* Auto-growing Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Ask anything about your images..."
                  className="flex-1 py-2 px-2 resize-none max-h-48 overflow-y-auto bg-transparent border-0 outline-none text-sm text-text-primary placeholder-text-secondary focus:ring-0 leading-relaxed font-sans"
                />

                {/* Right Action buttons */}
                <div className="flex items-center gap-1.5 mt-1 shrink-0">
                  {/* Microphone / Speech */}
                  <button
                    onClick={toggleVoiceRecording}
                    className={cn(
                      "p-2 rounded-xl transition-all relative",
                      voiceState.isRecording
                        ? "bg-error-red/10 text-error-red hover:bg-error-red/20 animate-pulse"
                        : "text-text-secondary hover:bg-hover-warm hover:text-text-primary"
                    )}
                    title={voiceState.isRecording ? "Recording... Click to stop" : "Voice input"}
                  >
                    {voiceState.isRecording ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
                  </button>

                  {/* Send Button */}
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isThinking || (!inputText.trim() && attachments.length === 0)}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      (inputText.trim() || attachments.length > 0) && !isThinking
                        ? "bg-accent-gold text-white hover:bg-accent-gold/90 shadow-md shadow-accent-gold/15"
                        : "text-neutral-300 dark:text-neutral-700 bg-neutral-50 dark:bg-neutral-900 cursor-not-allowed"
                    )}
                    title="Send message (Enter)"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </div>

              </div>

              {/* Speech-to-text live view */}
              {voiceState.isRecording && voiceState.transcript && (
                <div className="text-xs text-text-secondary px-3 py-1 font-medium bg-hover-warm/40 rounded-xl flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-error-red animate-ping" />
                  <span>Speech preview: &quot;{voiceState.transcript}&quot;</span>
                </div>
              )}

            </div>
            
            {/* Keyboard Shortcuts Label */}
            <div className="text-[10px] text-text-secondary text-center">
              Vision can make mistakes. Consider checking important information. Press <kbd className="bg-hover-warm px-1 rounded font-mono">Cmd+\</kbd> to toggle sidebar.
            </div>

          </div>
        </div>

      </div>

      {/* --- SETTINGS MODAL --- */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border-warm bg-card-warm p-6 shadow-xl text-text-primary"
            >
              <div className="flex items-center justify-between border-b border-border-warm pb-4 mb-4">
                <h3 className="text-base font-semibold">Settings</h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-hover-warm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Theme Settings */}
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Color Mode</span>
                  <div className="flex border border-border-warm rounded-xl overflow-hidden p-0.5 bg-background-warm">
                    <button
                      onClick={() => toggleTheme('light')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        theme === 'light' ? "bg-card-warm text-accent-gold shadow-sm" : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => toggleTheme('dark')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        theme === 'dark' ? "bg-[#2A2823] text-accent-gold shadow-sm" : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                <hr className="border-border-warm" />

                {/* Keyboard Shortcuts List */}
                <div>
                  <span className="font-semibold block mb-2 text-xs text-text-secondary tracking-wide uppercase">Keyboard Shortcuts</span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary font-medium">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background-warm/50 border border-border-warm/40">
                      <span>Search chats</span>
                      <kbd className="bg-hover-warm px-1.5 py-0.5 rounded font-mono">Cmd+K</kbd>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background-warm/50 border border-border-warm/40">
                      <span>Toggle Sidebar</span>
                      <kbd className="bg-hover-warm px-1.5 py-0.5 rounded font-mono">Cmd+\</kbd>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background-warm/50 border border-border-warm/40 col-span-2">
                      <span>Submit Query</span>
                      <kbd className="bg-hover-warm px-1.5 py-0.5 rounded font-mono">Enter</kbd>
                    </div>
                  </div>
                </div>

                <hr className="border-border-warm" />

                {/* Export/Clear Storage settings */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete all local history? This action is permanent.')) {
                        setChats([]);
                        setCurrentChatId(null);
                        localStorage.removeItem('vision-chats');
                        showToast('Conversations history cleared');
                        setIsSettingsOpen(false);
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-xl border border-error-red/20 text-error-red hover:bg-error-red/5 font-semibold text-xs transition-colors"
                  >
                    Clear History
                  </button>
                  <button
                    onClick={() => {
                      // backup export
                      const blob = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `vision_chats_backup_${Date.now()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                      showToast('Backup JSON downloaded');
                    }}
                    className="flex-1 py-2 px-3 rounded-xl border border-border-warm bg-background-warm hover:bg-hover-warm text-text-primary font-semibold text-xs transition-colors"
                  >
                    Export Backup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CAMERA CAPTURE MODAL --- */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden border border-border-warm bg-card-warm shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-border-warm p-4 text-text-primary bg-card-warm">
                <span className="font-semibold text-sm">Capture Image</span>
                <button
                  onClick={stopCamera}
                  className="p-1.5 rounded-lg hover:bg-hover-warm text-text-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Video stream container */}
              <div className="aspect-video bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>

              {/* Camera Actions */}
              <div className="p-4 bg-card-warm border-t border-border-warm flex justify-center gap-3">
                <button
                  onClick={stopCamera}
                  className="py-2.5 px-5 text-xs font-semibold rounded-xl border border-border-warm text-text-secondary hover:bg-hover-warm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="py-2.5 px-6 text-xs font-semibold rounded-xl bg-accent-gold text-white hover:bg-accent-gold/90 shadow-md transition-colors"
                >
                  Capture Photo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  // --- Render Chat Item in History ---
  function renderChatListItem(c: Chat) {
    const isActive = c.id === currentChatId;
    
    return (
      <div
        key={c.id}
        onClick={() => {
          setCurrentChatId(c.id);
          setAttachments([]);
          setInputText('');
        }}
        className={cn(
          "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border text-sm font-medium",
          isActive
            ? "bg-hover-warm border-border-warm text-text-primary shadow-sm"
            : "border-transparent text-text-secondary hover:bg-hover-warm/50 hover:text-text-primary"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {c.isPinned ? (
            <Pin className="h-3.5 w-3.5 text-accent-gold rotate-45 shrink-0" />
          ) : (
            <svg className="w-3.5 h-3.5 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}

          {editingChatId === c.id ? (
            <input
              type="text"
              value={editTitleText}
              onChange={(e) => setEditTitleText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameChatSubmit(c.id);
                if (e.key === 'Escape') setEditingChatId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="bg-card-warm border border-accent-gold text-xs px-1 py-0.5 rounded outline-none w-full"
            />
          ) : (
            <span className="truncate text-xs leading-none pt-0.5">
              {c.title || 'Untitled Conversation'}
            </span>
          )}
        </div>

        {/* Item Operations (Visible on Hover) */}
        <div className={cn(
          "flex items-center gap-1 opacity-0 shrink-0",
          isActive ? "opacity-100" : "group-hover:opacity-100"
        )}>
          {editingChatId !== c.id && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingChatId(c.id);
                  setEditTitleText(c.title);
                }}
                className="p-1 rounded hover:bg-hover-warm text-neutral-400 hover:text-text-primary transition-colors"
                title="Rename"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => handleTogglePin(c.id, e)}
                className="p-1 rounded hover:bg-hover-warm text-neutral-400 hover:text-accent-gold transition-colors"
                title={c.isPinned ? "Unpin Chat" : "Pin Chat"}
              >
                <Pin className="h-3 w-3 rotate-45" />
              </button>
              <button
                onClick={(e) => handleDeleteChat(c.id, e)}
                className="p-1 rounded hover:bg-hover-warm text-neutral-400 hover:text-error-red transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
}
