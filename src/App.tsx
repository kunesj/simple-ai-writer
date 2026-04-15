/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Conversation, Settings, Message, Attachment } from './types';
import { loadConversations, saveConversation, deleteConversation, loadSettings, saveSettings, defaultSettings, isSaveInProgress } from './lib/storage';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';

interface LlamaCppExtra {
  type: string;
  name: string;
  content: string;
}

interface LlamaCppMessage {
  id: string;
  convId: string;
  type: string;
  timestamp: number;
  role: string;
  content: string;
  toolCalls: string;
  children: string[];
  extra: LlamaCppExtra[];
  parent: string;
  model?: string;
  reasoningContent?: string;
  timings?: Record<string, unknown>;
}

interface LlamaCppExport {
  conv: {
    id: string;
    name: string;
    lastModified: number;
    currNode: string;
  };
  messages: LlamaCppMessage[];
}

function convertLlamaCppExport(data: LlamaCppExport): Conversation {
  const messages: Message[] = data.messages.map((msg) => {
    const message: Message = {
      id: msg.id,
      role: msg.role === 'assistant' ? 'model' : msg.role === 'user' ? 'user' : 'system',
      content: msg.content,
      useSummary: false,
      inContext: true,
      isCollapsed: false,
      timestamp: msg.timestamp,
    };

    if (msg.reasoningContent) {
      message.thought = msg.reasoningContent;
    }

    if (msg.timings) {
      message.stats = {
        completionTokensPerSecond: msg.timings.predicted_per_second as number | undefined,
        promptTokensPerSecond: msg.timings.prompt_per_second as number | undefined,
      };
    }

    if (msg.extra && msg.extra.length > 0) {
      const attachments: Attachment[] = msg.extra
        .filter((e) => e.type === 'TEXT')
        .map((e) => ({
          id: `${msg.id}-${e.name}`,
          url: `data:text/plain;charset=utf-8,${encodeURIComponent(e.content)}`,
          name: e.name,
          type: 'text/plain',
          size: e.content.length,
        }));
      if (attachments.length > 0) {
        message.attachments = attachments;
      }
    }

    return message;
  });

  return {
    id: data.conv.id,
    title: data.conv.name || '',
    messages,
    groups: [],
    updatedAt: data.conv.lastModified,
  };
}

interface GoogleAIChunk {
  driveDocument?: { id: string };
  text?: string;
  role: string;
  tokenCount?: number;
  createTime?: string;
  finishReason?: string;
}

interface GoogleAIExport {
  runSettings?: {
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  systemInstruction?: Record<string, unknown>;
  chunkedPrompt?: {
    chunks: GoogleAIChunk[];
    pendingInputs?: Array<{ role: string }>;
  };
}

function convertGoogleAIExport(data: GoogleAIExport): { conversation: Conversation; settings: Settings } {
  const settings: Settings = {
    systemInstruction: data.systemInstruction ? '' : '',
    temperature: data.runSettings?.temperature,
    topP: data.runSettings?.topP,
    topK: data.runSettings?.topK,
  };

  const chunks = data.chunkedPrompt?.chunks || [];
  const messages: Message[] = chunks.map((chunk, index) => {
    const content = chunk.text || '';

    const message: Message = {
      id: `msg-${index}-${chunk.createTime || Date.now()}`,
      role: chunk.role === 'model' ? 'model' : chunk.role === 'user' ? 'user' : 'system',
      content,
      useSummary: false,
      inContext: true,
      isCollapsed: false,
      timestamp: chunk.createTime ? new Date(chunk.createTime).getTime() : Date.now(),
    };

    if (chunk.tokenCount) {
      message.stats = {
        completionTokens: chunk.tokenCount,
      };
    }

    return message;
  });

  const conversation: Conversation = {
    id: `conv-${Date.now()}`,
    title: '',
    messages,
    groups: [],
    updatedAt: Date.now(),
  };

  return { conversation, settings };
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const initializedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const loadedConvs = await loadConversations();
      const loadedSettings = await loadSettings();
      setConversations(loadedConvs);
      setSettings(loadedSettings);
      if (loadedConvs.length > 0) {
        setActiveId(loadedConvs[0].id);
      }
      setIsLoaded(true);
      initializedRef.current = true;
    }
    init();

    const eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('settings_changed', async () => {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
    });

    eventSource.addEventListener('conversations_changed', async () => {
      if (!initializedRef.current) {
        return;
      }
      const currentActiveId = activeIdRef.current;
      if (currentActiveId && isSaveInProgress(currentActiveId)) {
        return;
      }
      const loadedConvs = await loadConversations();
      setConversations(loadedConvs);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '',
      messages: [],
      groups: [],
      updatedAt: Date.now(),
    };
    setConversations(prev => {
      const next = [newConv, ...prev];
      saveConversation(newConv);
      return next;
    });
    setActiveId(newConv.id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      deleteConversation(id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleDuplicateConversation = (id: string) => {
    setConversations(prev => {
      const conv = prev.find(c => c.id === id);
      if (conv) {
        const newConv: Conversation = {
          ...conv,
          id: Date.now().toString(),
          title: conv.title ? `${conv.title} (Copy)` : 'Untitled Chat (Copy)',
          updatedAt: Date.now(),
        };
        const next = [newConv, ...prev];
        saveConversation(newConv);
        setActiveId(newConv.id);
        return next;
      }
      return prev;
    });
  };

  const handleExportConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conv, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${conv.title || 'conversation'}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  };

  const handleImportConversation = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        let newConv: Conversation;
        let newSettings = settings;
        
        // Detect llama.cpp export format
        if (parsed.conv && parsed.messages && Array.isArray(parsed.messages)) {
          newConv = convertLlamaCppExport(parsed as LlamaCppExport);
        } 
        // Detect Google AI Studio export format
        else if (parsed.chunkedPrompt && parsed.runSettings) {
          const converted = convertGoogleAIExport(parsed as GoogleAIExport);
          newConv = converted.conversation;
          newSettings = converted.settings;
        }
        else {
          // Try our own format
          const importedConv = parsed as Conversation;
          if (importedConv && importedConv.messages && Array.isArray(importedConv.messages)) {
            newConv = {
              ...importedConv,
              id: Date.now().toString(),
              updatedAt: Date.now(),
            };
          } else {
            setErrorMessage('Invalid conversation file format.');
            return;
          }
        }
        
        // Always assign a new ID to avoid collisions
        newConv = {
          ...newConv,
          id: Date.now().toString(),
          updatedAt: Date.now(),
        };
        
        setConversations(prev => {
          const next = [newConv, ...prev];
          saveConversation(newConv);
          return next;
        });
        setActiveId(newConv.id);
        
        if (newSettings !== settings) {
          setSettings(newSettings);
          saveSettings(newSettings);
        }
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        setErrorMessage('Failed to parse conversation file.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateConversation = React.useCallback((updates: Partial<Conversation> | ((prev: Conversation) => Partial<Conversation>)) => {
    setConversations(prev => {
      const next = prev.map(c => {
        if (c.id === activeId) {
          const resolvedUpdates = typeof updates === 'function' ? updates(c) : updates;
          const updatedConv = { ...c, ...resolvedUpdates, updatedAt: Date.now() };
          saveConversation(updatedConv);
          return updatedConv;
        }
        return c;
      });
      return next;
    });
  }, [activeId]);

  const handleRenameConversation = (id: string, title: string) => {
    setConversations(prev => {
      const next = prev.map(c => {
        if (c.id === id) {
          const updatedConv = { ...c, title, updatedAt: Date.now() };
          saveConversation(updatedConv);
          return updatedConv;
        }
        return c;
      });
      return next;
    });
  };

  if (!isLoaded) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  const activeConversation = conversations.find(c => c.id === activeId);

  return (
    <div className="grid grid-cols-[280px_1fr] h-screen overflow-hidden bg-bg-base text-text-main font-sans">
      <Sidebar 
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onDuplicate={handleDuplicateConversation}
        onExport={handleExportConversation}
        onImport={handleImportConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRename={handleRenameConversation}
      />
      
      {activeConversation ? (
        <ChatArea 
          conversation={activeConversation}
          settings={settings}
          onUpdateConversation={handleUpdateConversation}
        />
      ) : (
        <main className="flex flex-col h-full bg-bg-base flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-text-main mb-2">Google AI Studio Offline</h2>
            <p className="text-text-muted mb-4">Create a new chat to get started.</p>
            <button 
              onClick={handleNewConversation}
              className="px-6 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 font-medium"
            >
              New Chat
            </button>
          </div>
        </main>
      )}

      {isSettingsOpen && (
        <SettingsModal 
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            saveSettings(newSettings);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {errorMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-text-main mb-2">Error</h3>
            <p className="text-sm text-text-muted mb-6">{errorMessage}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary/90 text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

