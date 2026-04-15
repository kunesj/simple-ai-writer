import React, { useRef, useState, useEffect } from 'react';
import { Conversation } from '../types';
import { MessageSquare, Plus, Settings as SettingsIcon, Trash2, Copy, Download, Upload, Check, X, MoreVertical, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (file: File) => void;
  onOpenSettings: () => void;
  onRename: (id: string, title: string) => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onDuplicate, onExport, onImport, onOpenSettings, onRename }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartRename = (conv: Conversation) => {
    setOpenMenuId(null);
    setRenamingId(conv.id);
    setRenameValue(conv.title || '');
  };

  const handleFinishRename = () => {
    if (renamingId) {
      onRename(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  };

  return (
    <aside className="bg-bg-sidebar border-r border-border-color flex flex-col h-full w-[280px] shrink-0">
      <div className="p-6 border-b border-border-color font-bold text-sm tracking-[1px] uppercase flex items-center gap-2.5">
        <div className="w-3 h-3 bg-accent-primary rounded-[3px]"></div>
        AI Studio Offline
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex gap-2 mb-4">
          <button 
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-2 bg-accent-primary text-white py-2 px-4 rounded-md hover:bg-accent-primary/90 transition-colors font-semibold text-sm cursor-pointer"
          >
            <Plus size={16} />
            New
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-white border border-border-color text-text-main py-2 px-4 rounded-md hover:bg-bg-base transition-colors font-semibold text-sm cursor-pointer"
            title="Import Conversation"
          >
            <Upload size={16} />
          </button>
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        <div className="flex flex-col">
          {conversations.map(conv => (
            <div 
              key={conv.id}
              className={cn(
                "group p-2.5 px-3 rounded-md text-sm cursor-pointer mb-1 transition-colors",
                activeId === conv.id ? "bg-[#f0f7ff] text-accent-primary font-semibold" : "hover:bg-gray-100 text-text-main"
              )}
              onClick={() => !renamingId && onSelect(conv.id)}
            >
              {renamingId === conv.id ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleFinishRename}
                    className="flex-1 px-2 py-1 text-sm border border-border-color rounded focus:border-accent-primary outline-none"
                  />
                  <button
                    onClick={handleFinishRename}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                  </div>
                  <div className="relative" ref={openMenuId === conv.id ? menuRef : null}>
<button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                        }}
                        className="p-1 text-text-muted hover:text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="More options"
                      >
                      <MoreVertical size={14} />
                    </button>
                    {openMenuId === conv.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-border-color shadow-lg rounded-md py-1 z-10 w-40">
                        <button
                          onClick={() => handleStartRename(conv)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2 text-text-main cursor-pointer"
                        >
                          <Pencil size={12} />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            onExport(conv.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2 text-text-main cursor-pointer"
                        >
                          <Download size={12} />
                          Export
                        </button>
                        <button
                          onClick={() => {
                            onDuplicate(conv.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2 text-text-main cursor-pointer"
                        >
                          <Copy size={12} />
                          Duplicate
                        </button>
                        <div className="h-px bg-border-color my-1" />
                        <button
                          onClick={() => {
                            onDelete(conv.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center gap-2 text-red-500 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 px-3">
            <p className="text-[11px] font-bold text-text-muted uppercase mb-2">System</p>
            <div 
              className="p-2.5 rounded-md text-sm cursor-pointer mb-1 flex items-center gap-2 hover:bg-gray-100 text-text-main"
              onClick={onOpenSettings}
            >
              <SettingsIcon size={14} />
              Settings
            </div>
        </div>
      </div>
    </aside>
  );
}
