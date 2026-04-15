import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, Settings, Attachment } from '../types';
import { MessageItem } from './MessageItem';
import { Loader2, Trash2, MessageSquare, List, Check, X, Paperclip } from 'lucide-react';
import { generateChatStream, countTokens } from '../lib/openai';

interface ChatAreaProps {
  conversation: Conversation;
  settings: Settings;
  onUpdateConversation: (updates: Partial<Conversation> | ((prev: Conversation) => Partial<Conversation>)) => void;
}

export function ChatArea({ conversation, settings, onUpdateConversation }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessageId, setGeneratingMessageId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [groupDeleteConfirmId, setGroupDeleteConfirmId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const attachment = await res.json();
          setAttachments(prev => [...prev, attachment]);
        } else {
          console.error("Failed to upload file");
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      countTokens(conversation.messages, settings).then(setTokenCount).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [conversation.messages, settings]);

  const handleUpdateMessage = React.useCallback((id: string, updates: Partial<Message>) => {
    onUpdateConversation(prev => ({
      messages: prev.messages.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  }, [onUpdateConversation]);

  const handleDeleteMessage = React.useCallback((id: string) => {
    onUpdateConversation(prev => ({
      messages: prev.messages.filter(m => m.id !== id)
    }));
  }, [onUpdateConversation]);

  const handleAddMessage = (role: 'user' | 'model') => {
    if (!input.trim() && attachments.length === 0) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      useSummary: false,
      inContext: true,
      isCollapsed: false,
      timestamp: Date.now(),
    };
    const newMessages = [...conversation.messages, newMessage];
    const updates: Partial<Conversation> = { messages: newMessages };
    if (!conversation.title && role === 'user') {
      updates.title = newMessage.content ? newMessage.content.slice(0, 30) + (newMessage.content.length > 30 ? '...' : '') : 'File upload';
    }
    onUpdateConversation(updates);
    setInput('');
    setAttachments([]);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = React.useCallback(async (id: string) => {
    if (isGenerating) return;
    
    const msgIndex = conversation.messages.findIndex(m => m.id === id);
    if (msgIndex === -1) return;
    
    const msg = conversation.messages[msgIndex];
    let messagesToKeep = conversation.messages;
    let targetModelMessageId = '';
    
    if (msg.role === 'user') {
      // Regenerate following model message or create one
      const nextMsg = conversation.messages[msgIndex + 1];
      if (nextMsg && nextMsg.role === 'model') {
        targetModelMessageId = nextMsg.id;
        // Keep messages up to the user message, we'll replace the nextMsg
        messagesToKeep = conversation.messages.map(m => 
          m.id === targetModelMessageId ? { ...m, content: '', thought: undefined, stats: undefined } : m
        );
      } else {
        targetModelMessageId = Date.now().toString();
        const newModelMsg: Message = {
          id: targetModelMessageId,
          role: 'model',
          content: '',
          useSummary: false,
          inContext: true,
          isCollapsed: false,
          timestamp: Date.now(),
        };
        // Insert after user message
        messagesToKeep = [
          ...conversation.messages.slice(0, msgIndex + 1),
          newModelMsg,
          ...conversation.messages.slice(msgIndex + 1)
        ];
      }
    } else {
      // Regenerate this model message
      targetModelMessageId = msg.id;
      messagesToKeep = conversation.messages.map(m => 
        m.id === targetModelMessageId ? { ...m, content: '', thought: undefined, stats: undefined, error: undefined } : m
      );
    }
    
    onUpdateConversation({ messages: messagesToKeep });
    setIsGenerating(true);
    setGeneratingMessageId(targetModelMessageId);
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Only use context up to the message being regenerated
      const targetIndex = messagesToKeep.findIndex(m => m.id === targetModelMessageId);
      const contextMessages = messagesToKeep.slice(0, targetIndex);
      
      const stream = generateChatStream(contextMessages, settings, abortControllerRef.current.signal);
      
      let currentContent = '';
      let currentThought = '';
      let currentStats = undefined;
      
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          if (chunk.thought) {
            currentThought += chunk.text;
          } else {
            currentContent += chunk.text;
          }
        } else if (chunk.type === 'usage') {
          currentStats = {
            totalTokens: chunk.usage.totalTokenCount,
            promptTokens: chunk.usage.promptTokenCount,
            candidatesTokens: chunk.usage.candidatesTokenCount,
            thoughtsTokens: chunk.usage.thoughtsTokenCount,
          };
        }
        
        onUpdateConversation(prev => ({
          messages: prev.messages.map(m => 
            m.id === targetModelMessageId ? { 
              ...m, 
              content: currentContent,
              thought: currentThought || undefined,
              stats: currentStats
            } : m
          )
        }));
      }
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        console.warn('Generation aborted');
      } else {
        const err = error as { parsedMessage?: string; message: string; requestDetails: unknown; responseDetails: unknown };
        console.error("Failed to regenerate response:", error);
        onUpdateConversation(prev => ({
          messages: prev.messages.map(m => 
            m.id === targetModelMessageId ? { 
              ...m, 
              error: {
                message: err.parsedMessage || err.message,
                requestDetails: err.requestDetails,
                responseDetails: err.responseDetails
              }
            } : m
          )
        }));
      }
    } finally {
      setIsGenerating(false);
      setGeneratingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [conversation.messages, isGenerating, onUpdateConversation, settings]);

  const handleSend = React.useCallback(async () => {
    if (isGenerating) return;

    let newMessages = conversation.messages;

    if (input.trim() || attachments.length > 0) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: input.trim(),
        attachments: attachments.length > 0 ? [...attachments] : undefined,
        useSummary: false,
        inContext: true,
        isCollapsed: false,
        timestamp: Date.now(),
      };
      newMessages = [...conversation.messages, userMessage];
      
      const updates: Partial<Conversation> = { messages: newMessages };
      if (!conversation.title) {
        updates.title = userMessage.content ? userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : '') : 'File upload';
      }
      onUpdateConversation(updates);
      setInput('');
      setAttachments([]);
    }

    const modelMessageId = (Date.now() + 1).toString();
    setIsGenerating(true);
    setGeneratingMessageId(modelMessageId);
    abortControllerRef.current = new AbortController();

    try {
      let currentContent = '';
      let currentThought = '';
      let currentStats = undefined;
      
      onUpdateConversation(prev => ({
        messages: [...prev.messages, {
          id: modelMessageId,
          role: 'model',
          content: '',
          useSummary: false,
          inContext: true,
          isCollapsed: false,
          timestamp: Date.now(),
        }]
      }));

      const stream = generateChatStream(newMessages, settings, abortControllerRef.current.signal);
      
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          if (chunk.thought) {
            currentThought += chunk.text;
          } else {
            currentContent += chunk.text;
          }
        } else if (chunk.type === 'usage') {
          currentStats = {
            totalTokens: chunk.usage.totalTokenCount,
            promptTokens: chunk.usage.promptTokenCount,
            candidatesTokens: chunk.usage.candidatesTokenCount,
            thoughtsTokens: chunk.usage.thoughtsTokenCount,
          };
        }
        
        onUpdateConversation(prev => ({
          messages: prev.messages.map(m => 
            m.id === modelMessageId ? {
              ...m,
              content: currentContent,
              thought: currentThought || undefined,
              stats: currentStats
            } : m
          )
        }));
      }
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        console.warn('Generation aborted');
      } else {
        const err = error as { parsedMessage?: string; message: string; requestDetails: unknown; responseDetails: unknown };
        console.error("Failed to generate response:", error);
        onUpdateConversation(prev => ({
          messages: prev.messages.map(m => 
            m.id === modelMessageId ? {
              ...m,
              error: {
                message: err.parsedMessage || err.message,
                requestDetails: err.requestDetails,
                responseDetails: err.responseDetails
              }
            } : m
          )
        }));
      }
    } finally {
      setIsGenerating(false);
      setGeneratingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [conversation.messages, conversation.title, input, attachments, isGenerating, onUpdateConversation, settings]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateGroup = () => {
    const groupId = Date.now().toString();
    const newGroup = {
      id: groupId,
      name: 'NEW GROUP',
      isCollapsed: false,
      messageIds: []
    };
    onUpdateConversation({ groups: [...(conversation.groups || []), newGroup] });
  };

  const handleToggleGroup = (groupId: string) => {
    const newGroups = (conversation.groups || []).map(g => 
      g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
    );
    onUpdateConversation({ groups: newGroups });
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    const newGroups = (conversation.groups || []).map(g => 
      g.id === groupId ? { ...g, name: newName } : g
    );
    onUpdateConversation({ groups: newGroups });
  };

  const handleDeleteGroup = (groupId: string) => {
    onUpdateConversation(prev => ({
      groups: (prev.groups || []).filter(g => g.id !== groupId),
      messages: prev.messages.map(m => m.groupId === groupId ? { ...m, groupId: undefined } : m)
    }));
    setGroupDeleteConfirmId(null);
  };

  const handleAssignToGroup = React.useCallback((messageId: string, groupId: string | undefined) => {
    onUpdateConversation(prev => ({
      messages: prev.messages.map(m => m.id === messageId ? { ...m, groupId } : m)
    }));
  }, [onUpdateConversation]);

  const renderMessages = () => {
    const groups = conversation.groups || [];
    const rendered = [];

    let i = 0;
    while (i < conversation.messages.length) {
      const m = conversation.messages[i];
      const group = m.groupId ? groups.find(g => g.id === m.groupId) : undefined;

      if (group) {
        // Find all contiguous messages with the same groupId
        const groupMsgs = [m];
        let j = i + 1;
        while (j < conversation.messages.length && conversation.messages[j].groupId === group.id) {
          groupMsgs.push(conversation.messages[j]);
          j++;
        }

        // Only add the ID to the first instance of this group to make TOC scrolling work
        const isFirstInstance = i === conversation.messages.findIndex(msg => msg.groupId === group.id);

        rendered.push(
          <div key={`group-instance-${group.id}-${i}`} id={isFirstInstance ? `group-${group.id}` : undefined} className="border-l-2 border-border-color pl-4 mb-2">
            <div className="text-xs font-bold uppercase text-text-muted flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleToggleGroup(group.id)}>
                <span>{group.isCollapsed ? '▶' : '▼'}</span>
                <input 
                  type="text" 
                  value={group.name}
                  onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none border-b border-transparent focus:border-accent-primary uppercase"
                />
                <span className="font-normal opacity-50">({groupMsgs.length} Messages)</span>
              </div>
              
              {groupDeleteConfirmId === group.id ? (
                <div className="flex items-center gap-1 bg-red-50 rounded border border-red-200 px-1">
                  <span className="text-[10px] text-red-600 font-bold px-1">Delete Group?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group.id);
                    }}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupDeleteConfirmId(null);
                    }}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupDeleteConfirmId(group.id);
                  }}
                  className="p-1 text-text-muted hover:text-red-500 rounded"
                  title="Delete Group"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            
            {!group.isCollapsed && (
              <div className="flex flex-col">
                {groupMsgs.map(msg => (
                  <div key={msg.id} className="relative group/msg">
                    <MessageItem 
                      message={msg} 
                      onUpdate={handleUpdateMessage} 
                      onDelete={handleDeleteMessage} 
                      onRegenerate={handleRegenerate}
                      isGenerating={isGenerating && generatingMessageId === msg.id}
                      groups={groups}
                      onAssignGroup={handleAssignToGroup}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

        i = j;
      } else {
        rendered.push(
          <div key={m.id} className="relative group/msg">
            <MessageItem 
              message={m} 
              onUpdate={handleUpdateMessage} 
              onDelete={handleDeleteMessage} 
              onRegenerate={handleRegenerate}
              isGenerating={isGenerating && generatingMessageId === m.id}
              groups={groups}
              onAssignGroup={handleAssignToGroup}
            />
          </div>
        );
        i++;
      }
    }

    return rendered;
  };

  const modelName = import.meta.env.VITE_MODEL_NAME;

  return (
    <main className="flex flex-col h-full bg-bg-base flex-1 min-w-0 min-h-0">
      <header className="h-16 border-b border-border-color bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3 text-sm font-medium text-text-main">
          <span className="font-bold">{modelName}</span>
          <span className="text-[11px] text-text-muted ml-2">
            ~{tokenCount.toLocaleString()} tokens in context
          </span>
        </div>
        <div className="flex gap-4">
          <button onClick={handleCreateGroup} className="px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base text-text-main">
            New Group
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 p-8 overflow-y-auto" id="chat-scroller">
          <div className="max-w-4xl mx-auto w-full flex flex-col">
            {conversation.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-disabled mt-20">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p className="text-lg">Start a new conversation</p>
              </div>
            ) : (
              renderMessages()
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {(conversation.groups || []).length > 0 && (
          <div className="w-64 border-l border-border-color bg-white p-4 overflow-y-auto hidden lg:block">
            <h3 className="text-xs font-bold uppercase text-text-muted mb-4 flex items-center gap-2">
              <List size={14} />
              Table of Contents
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              {(conversation.groups || []).map(g => (
                <button 
                  key={`toc-${g.id}`}
                  onClick={() => {
                    const el = document.getElementById(`group-${g.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-left px-2 py-1.5 hover:bg-bg-base rounded text-text-main truncate"
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 px-8 bg-white border-t border-border-color shrink-0">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-md text-xs border border-gray-200">
                  <span className="truncate max-w-[150px] text-gray-700" title={att.name}>{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-gray-500 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or fiction prompt..."
              className="w-full border border-border-color rounded-lg pl-4 pr-12 py-3 min-h-[80px] resize-none font-inherit text-sm outline-none focus:border-accent-primary text-text-main bg-white"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isGenerating}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
                title="Attach file"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-5 items-center">
              <div className="text-[11px] text-text-muted">
                Context: {conversation.messages.filter(m => m.inContext).length} messages
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAddMessage('user')}
                disabled={!input.trim() || isGenerating}
                className="px-3 py-2 rounded border border-border-color bg-white text-text-main text-xs hover:bg-bg-base disabled:opacity-50"
              >
                Add User
              </button>
              <button
                onClick={() => handleAddMessage('model')}
                disabled={!input.trim() || isGenerating}
                className="px-3 py-2 rounded border border-border-color bg-white text-text-main text-xs hover:bg-bg-base disabled:opacity-50"
              >
                Add Model
              </button>
              <button
                onClick={isGenerating ? handleStopGeneration : handleSend}
                className={`text-white border-none px-5 py-2 rounded-md font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors text-sm ${isGenerating ? 'bg-red-500 hover:bg-red-600' : 'bg-accent-primary hover:bg-accent-primary/90'}`}
              >
                {isGenerating ? 'Stop' : 'Run Inference'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
