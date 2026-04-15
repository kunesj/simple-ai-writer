import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronRight, Edit2, Eye, EyeOff, FileText, AlignLeft, Trash2, Copy, RefreshCw, Brain, Check, Loader2, X, MoreVertical, FolderPlus, FolderMinus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageItemProps {
  message: Message;
  onUpdate: (id: string, updates: Partial<Message>) => void;
  onDelete: (id: string) => void;
  onRegenerate?: (id: string) => void;
  isGenerating?: boolean;
  groups?: {id: string, name: string}[];
  onAssignGroup?: (messageId: string, groupId: string | undefined) => void;
  onCreateNewGroup?: (messageId: string) => void;
}

export const MessageItem = React.memo(function MessageItem({ message, onUpdate, onDelete, onRegenerate, isGenerating, groups, onAssignGroup, onCreateNewGroup }: MessageItemProps) {
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(message.summary || '');
  
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(message.content);
  
  const [showThinking, setShowThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleToggleCollapse = () => {
    onUpdate(message.id, { isCollapsed: !message.isCollapsed });
  };

  const handleToggleContext = () => {
    const newInContext = !message.inContext;
    onUpdate(message.id, { 
      inContext: newInContext,
      isCollapsed: !newInContext ? true : message.isCollapsed 
    });
  };

  const handleToggleSummary = () => {
    onUpdate(message.id, { useSummary: !message.useSummary });
  };

  const handleSaveSummary = () => {
    onUpdate(message.id, { summary: summaryDraft });
    setIsEditingSummary(false);
  };

  const handleSaveContent = () => {
    onUpdate(message.id, { content: contentDraft });
    setIsEditingContent(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveThinking = () => {
    onUpdate(message.id, { thought: undefined });
  };

  return (
    <div className={cn(
      "bg-white border border-border-color rounded-lg p-4 relative transition-shadow mb-3",
      !message.inContext && "bg-bg-base border-dashed opacity-60"
    )}>
      <div className="flex justify-between items-center mb-3 text-xs font-semibold text-text-muted uppercase">
        <div className="flex items-center gap-2">
          <span>{message.role === 'model' ? 'AI ASSISTANT' : message.role}</span>
          {isGenerating && (
            <Loader2 size={12} className="animate-spin text-accent-primary" />
          )}
        </div>
        
        <div className="flex gap-2">
          {onRegenerate && (
            showRegenerateConfirm ? (
              <div className="flex items-center gap-1 bg-orange-50 rounded border border-orange-200 px-1">
                <span className="text-[10px] text-orange-600 font-bold px-1">Regenerate?</span>
                <button
                  onClick={() => {
                    onRegenerate(message.id);
                    setShowRegenerateConfirm(false);
                  }}
                  className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRegenerateConfirm(true)}
                className="px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base flex items-center gap-1 text-text-main"
                title="Regenerate"
              >
                <RefreshCw size={12} />
              </button>
            )
          )}
          <button
            onClick={() => {
              setContentDraft(message.content);
              setIsEditingContent(!isEditingContent);
            }}
            className="px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base flex items-center gap-1 text-text-main"
            title="Edit message"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={handleToggleSummary}
            className={cn(
              "px-2 py-1 rounded border border-border-color cursor-pointer text-[11px] flex items-center gap-1",
              message.useSummary 
                ? "bg-accent-primary text-white border-accent-primary hover:bg-accent-primary/90" 
                : "bg-white hover:bg-bg-base text-text-main"
            )}
            title={message.useSummary ? 'Show Full Text' : 'Show Summary'}
          >
            {message.useSummary ? <FileText size={12} /> : <AlignLeft size={12} />}
          </button>
          <button
            onClick={handleToggleContext}
            className={cn(
              "px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base flex items-center gap-1",
              !message.inContext ? "text-red-500" : "text-text-main"
            )}
            title={message.inContext ? 'Remove from Context' : 'Include in Context'}
          >
            {message.inContext ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            onClick={handleToggleCollapse}
            className="px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base flex items-center gap-1 text-text-main"
            title={message.isCollapsed ? 'Expand' : 'Collapse'}
          >
            {message.isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-2 py-1 rounded border border-border-color bg-white cursor-pointer text-[11px] hover:bg-bg-base flex items-center gap-1 text-text-main"
              title="More actions"
            >
              <MoreVertical size={12} />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border-color shadow-lg rounded-md py-1 z-10 w-48 max-h-64 overflow-y-auto flex flex-col">
                <button
                  onClick={() => { handleCopy(); setShowMenu(false); }}
                  className="px-3 py-2 text-left text-xs hover:bg-bg-base flex items-center gap-2 text-text-main cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  Copy to clipboard
                </button>

                {(groups || []).length === 0 && onCreateNewGroup && (
                    <button
                      onClick={() => { onCreateNewGroup(message.id); setShowMenu(false); }}
                      className="px-3 py-2 text-left text-xs hover:bg-bg-base flex items-center gap-2 text-text-main cursor-pointer w-full"
                    >
                      <FolderPlus size={12} />
                      Create group
                    </button>
                )}
                
                {showDeleteConfirm ? (
                  <div className="px-3 py-2 flex items-center justify-between bg-red-50 text-xs">
                    <span className="text-red-600 font-bold">Delete?</span>
                    <div className="flex gap-2">
                      <button onClick={() => { onDelete(message.id); setShowMenu(false); setShowDeleteConfirm(false); }} className="text-red-600 hover:text-red-800 cursor-pointer"><Check size={12} /></button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="text-red-600 hover:text-red-800 cursor-pointer"><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center gap-2 text-red-500 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}

                {groups && groups.length > 0 && onAssignGroup && (
                  <>
                    <div className="h-px bg-border-color my-1" />
                    <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase">Groups</div>
                    {message.groupId && (
                      <button
                        onClick={() => { onAssignGroup(message.id, undefined); setShowMenu(false); }}
                        className="px-3 py-2 text-left text-xs hover:bg-bg-base flex items-center gap-2 text-text-main cursor-pointer"
                      >
                        <FolderMinus size={12} />
                        Remove from Group
                      </button>
                    )}
                    {groups.filter(g => g.id !== message.groupId).map(g => (
                      <button
                        key={g.id}
                        onClick={() => { onAssignGroup(message.id, g.id); setShowMenu(false); }}
                        className="px-3 py-2 text-left text-xs hover:bg-bg-base flex items-center gap-2 text-text-main truncate cursor-pointer"
                      >
                        <FolderPlus size={12} className="shrink-0" />
                        <span className="truncate">Add to {g.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!message.isCollapsed ? (
        <div className="text-sm leading-[1.6] text-text-main">
          {message.useSummary ? (
            <div className="italic text-accent-primary border-l-2 border-accent-primary pl-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Summary Version</span>
                <button 
                  onClick={() => setIsEditingSummary(!isEditingSummary)}
                  className="text-accent-primary hover:opacity-80 cursor-pointer"
                >
                  <Edit2 size={12} />
                </button>
              </div>
              {isEditingSummary ? (
                <div className="flex flex-col gap-2 mt-2 not-italic">
                  <textarea
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    className="w-full p-2 border border-border-color rounded text-sm focus:border-accent-primary outline-none text-text-main"
                    rows={3}
                    placeholder="Write a summary..."
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsEditingSummary(false)}
                      className="px-3 py-1 text-xs text-text-muted hover:bg-gray-100 rounded border border-border-color"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveSummary}
                      className="px-3 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/90"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">
                  {message.summary || <span className="opacity-50">No summary written yet. Click edit to add one.</span>}
                </div>
              )}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-text-main">
              {message.thought && (
                <div className="mb-4 border border-border-color rounded-md overflow-hidden">
                  <div 
                    className="bg-bg-base px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                    onClick={() => setShowThinking(!showThinking)}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
                      <Brain size={14} />
                      <span>Thinking Process</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveThinking(); }}
                        className="text-text-muted hover:text-red-500 cursor-pointer"
                        title="Remove thinking"
                      >
                        <Trash2 size={14} />
                      </button>
                      {showThinking ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                  {showThinking && (
                    <div className="p-3 text-sm text-text-muted bg-white border-t border-border-color whitespace-pre-wrap">
                      {message.thought}
                    </div>
                  )}
                </div>
              )}

              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {message.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 max-w-sm">
                      {att.type.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate" title={att.name}>
                          {att.name}
                        </a>
                        <span className="text-xs text-gray-500">{(att.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isEditingContent ? (
                <div className="flex flex-col gap-2 mt-2 not-italic">
                  <textarea
                    value={contentDraft}
                    onChange={(e) => setContentDraft(e.target.value)}
                    className="w-full p-2 border border-border-color rounded text-sm focus:border-accent-primary outline-none text-text-main font-mono"
                    rows={6}
                    placeholder="Write message content..."
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsEditingContent(false)}
                      className="px-3 py-1 text-xs text-text-muted hover:bg-gray-100 rounded border border-border-color"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveContent}
                      className="px-3 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/90"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              )}
              
              {message.error && (
                <div className="mt-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-red-800">Generation Error</span>
                      <span className="text-sm text-red-600 whitespace-pre-wrap">{message.error.message}</span>
                    </div>
                    <button
                      onClick={() => setShowErrorDetails(true)}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded border border-red-200 transition-colors"
                    >
                      Show Details
                    </button>
                  </div>
                </div>
              )}

              {message.stats && (
                <div className="mt-4 pt-2 border-t border-border-color text-[10px] text-text-disabled flex gap-3">
                  {message.stats.promptTokens !== undefined && <span>Prompt: {message.stats.promptTokens}</span>}
                  {message.stats.completionTokens !== undefined && <span>Response: {message.stats.completionTokens}</span>}
                  {message.stats.totalTokens !== undefined && <span>Total: {message.stats.totalTokens}</span>}
                  {message.stats.completionTokensPerSecond !== undefined && <span>{message.stats.completionTokensPerSecond.toFixed(1)} tok/s</span>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {showErrorDetails && message.error && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-red-600">Error Details</h2>
              <button onClick={() => setShowErrorDetails(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Request Details</h3>
                <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto border border-gray-200">
                  {JSON.stringify(message.error.requestDetails, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Response Details</h3>
                <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto border border-gray-200">
                  {JSON.stringify(message.error.responseDetails, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
