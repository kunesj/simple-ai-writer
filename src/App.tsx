/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Conversation, Settings } from './types';
import { loadConversations, saveConversation, deleteConversation, loadSettings, saveSettings, defaultSettings, isSaveInProgress } from './lib/storage';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';

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
        const importedConv = JSON.parse(content) as Conversation;
        
        // Basic validation
        if (importedConv && importedConv.messages && Array.isArray(importedConv.messages)) {
          const newConv: Conversation = {
            ...importedConv,
            id: Date.now().toString(), // Always assign a new ID to avoid collisions
            updatedAt: Date.now(),
          };
          setConversations(prev => {
            const next = [newConv, ...prev];
            saveConversation(newConv);
            return next;
          });
          setActiveId(newConv.id);
        } else {
          setErrorMessage('Invalid conversation file format.');
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

