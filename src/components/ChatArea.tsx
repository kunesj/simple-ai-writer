import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, Settings, Attachment, ServerConfig } from '../types';
import { MessageItem } from './MessageItem';
import { Loader2, Trash2, MessageSquare, List, Check, X, Paperclip, MoreVertical, Pencil, ChevronDown } from 'lucide-react';
import { generateChatStream, countTokens } from '../lib/openai';
import { flushSave, getEffectiveServerConfig } from '../lib/storage';

interface ChatAreaProps {
  conversation: Conversation;
  settings: Settings;
  serverConfig: ServerConfig | null;
  onUpdateConversation: (updates: Partial<Conversation> | ((prev: Conversation) => Partial<Conversation>)) => void;
  onOpenSettings: () => void;
  onChangeActiveServer: (serverId: string) => void;
}

export function ChatArea({ conversation, settings, serverConfig, onUpdateConversation, onOpenSettings, onChangeActiveServer }: ChatAreaProps) {
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
  const [tocMenuOpenId, setTocMenuOpenId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tocRenamingId, setTocRenamingId] = useState<string | null>(null);
  const [tocRenameValue, setTocRenameValue] = useState('');
  const [tocDeleteConfirmId, setTocDeleteConfirmId] = useState<string | null>(null);
  const tocMenuRef = useRef<HTMLDivElement>(null);

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

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 160), window.innerHeight * 0.5);
    textarea.style.height = `${newHeight}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setTimeout(adjustTextareaHeight, 0);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tocMenuRef.current && !tocMenuRef.current.contains(event.target as Node)) {
        setTocMenuOpenId(null);
      }
    };
    if (tocMenuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tocMenuOpenId]);

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
      flushSave(conversation.id);
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
          m.id === targetModelMessageId ? { ...m, content: '', thought: undefined, stats: undefined, error: undefined } : m
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
      
      if (!serverConfig) {
        throw new Error('No server configured. Please add a server in Settings.');
      }
      const stream = generateChatStream(contextMessages, settings, serverConfig, abortControllerRef.current.signal);
      
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
            completionTokens: chunk.usage.completionTokenCount,
            promptTokensPerSecond: chunk.usage.promptTokensPerSecond,
            completionTokensPerSecond: chunk.usage.completionTokensPerSecond,
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
      flushSave(conversation.id);
    }
  }, [conversation.id, conversation.messages, isGenerating, onUpdateConversation, settings, serverConfig]);

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

      if (!serverConfig) {
        throw new Error('No server configured. Please add a server in Settings.');
      }
      const stream = generateChatStream(newMessages, settings, serverConfig, abortControllerRef.current.signal);
      
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
            completionTokens: chunk.usage.completionTokenCount,
            promptTokensPerSecond: chunk.usage.promptTokensPerSecond,
            completionTokensPerSecond: chunk.usage.completionTokensPerSecond,
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
      flushSave(conversation.id);
    }
  }, [conversation.id, conversation.messages, conversation.title, input, attachments, isGenerating, onUpdateConversation, settings, serverConfig]);

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

  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const effectiveServerConfig = serverConfig || getEffectiveServerConfig(settings);

  return (
    <main className="flex flex-col h-full bg-bg-base flex-1 min-w-0 min-h-0">
      <header className="h-10 border-b border-border-color bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3 text-sm font-medium text-text-main">
          <div className="relative">
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              className="flex items-center gap-2 font-bold hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
            >
              <span>{effectiveServerConfig?.modelName || 'No Server'}</span>
              <ChevronDown size={14} />
            </button>
            {serverDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setServerDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-border-color shadow-lg rounded-lg py-1 z-20 min-w-[200px]">
                  {settings.servers.map(server => (
                    <button
                      key={server.id}
                      onClick={() => {
                        setServerDropdownOpen(false);
                        onChangeActiveServer(server.id);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${settings.activeServerId === server.id ? 'bg-blue-50' : ''}`}
                    >
                      <div>
                        <div className="font-medium">{server.name || 'Unnamed'}</div>
                        <div className="text-xs text-gray-500">{server.modelName}</div>
                      </div>
                      {settings.activeServerId === server.id && (
                        <Check size={14} className="text-blue-600" />
                      )}
                    </button>
                  ))}
                  {settings.servers.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No servers configured
                    </div>
                  )}
                  <div className="border-t mt-1 pt-1">
                    <button
                      onClick={() => {
                        setServerDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      Configure Servers...
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <span className="text-[11px] text-text-muted ml-2">
            Context: {conversation.messages.filter(m => m.inContext).length} messages (~{tokenCount.toLocaleString()} tokens)
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
                <div key={`toc-${g.id}`} className="relative group">
                  {tocRenamingId === g.id ? (
                    <div className="flex items-center gap-1 px-1">
                      <input
                        type="text"
                        value={tocRenameValue}
                        onChange={(e) => setTocRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameGroup(g.id, tocRenameValue);
                            setTocRenamingId(null);
                          } else if (e.key === 'Escape') {
                            setTocRenamingId(null);
                          }
                        }}
                        onBlur={() => {
                          handleRenameGroup(g.id, tocRenameValue);
                          setTocRenamingId(null);
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-border-color rounded focus:border-accent-primary outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          handleRenameGroup(g.id, tocRenameValue);
                          setTocRenamingId(null);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setTocRenamingId(null)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        const el = document.getElementById(`group-${g.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-bg-base rounded text-text-main truncate flex items-center justify-between cursor-pointer"
                    >
                      <span>{g.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTocMenuOpenId(tocMenuOpenId === g.id ? null : g.id);
                        }}
                        className="p-1 text-text-muted hover:text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  )}
                  {tocMenuOpenId === g.id && !tocRenamingId && (
                    <div ref={tocMenuRef} className="absolute right-0 top-full mt-1 bg-white border border-border-color shadow-lg rounded-md py-1 z-10 w-32">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTocMenuOpenId(null);
                          setTocRenamingId(g.id);
                          setTocRenameValue(g.name);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2 text-text-main cursor-pointer"
                      >
                        <Pencil size={12} />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTocMenuOpenId(null);
                          setTocDeleteConfirmId(g.id);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center gap-2 text-red-500 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                  {tocDeleteConfirmId === g.id && (
                    <div className="flex items-center gap-1 bg-red-50 rounded border border-red-200 px-2 py-1 mt-1">
                      <span className="text-[10px] text-red-600 font-bold flex-1">Delete?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(g.id);
                          setTocDeleteConfirmId(null);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTocDeleteConfirmId(null);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-2 px-8 bg-white border-t border-border-color shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
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
              className="absolute left-3 bottom-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
              title="Attach file"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or fiction prompt..."
              className="w-full border border-border-color rounded-lg pl-4 pr-4 py-3 pb-14 min-h-[120px] max-h-[50vh] font-inherit text-sm outline-none focus:border-accent-primary text-text-main bg-white resize-none"
            />
            <div className="absolute right-3 bottom-3 flex gap-2">
              <button
                onClick={() => handleAddMessage('user')}
                disabled={!input.trim() || isGenerating}
                className="px-3 py-2 rounded border border-border-color bg-white text-text-main text-xs hover:bg-bg-base disabled:opacity-50 cursor-pointer"
              >
                Add User
              </button>
              <button
                onClick={() => handleAddMessage('model')}
                disabled={!input.trim() || isGenerating}
                className="px-3 py-2 rounded border border-border-color bg-white text-text-main text-xs hover:bg-bg-base disabled:opacity-50 cursor-pointer"
              >
                Add Model
              </button>
              <button
                onClick={isGenerating ? handleStopGeneration : handleSend}
                className={`text-white border-none px-5 py-2 rounded-md font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors text-sm ${isGenerating ? 'bg-red-500 hover:bg-red-600' : 'bg-accent-primary hover:bg-accent-primary/90'}`}
              >
                {isGenerating ? 'Stop' : 'Run'}
              </button>
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-md text-xs border border-gray-200">
                  <span className="truncate max-w-[150px] text-gray-700" title={att.name}>{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-gray-500 hover:text-red-500 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
