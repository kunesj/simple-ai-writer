import React, { useRef, useState } from 'react';
import { Conversation } from '../types';
import { MessageSquare, Plus, Settings as SettingsIcon, Trash2, Copy, Download, Upload, Check, X } from 'lucide-react';
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
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onDuplicate, onExport, onImport, onOpenSettings }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            className="flex-1 flex items-center justify-center gap-2 bg-accent-primary text-white py-2 px-4 rounded-md hover:bg-accent-primary/90 transition-colors font-semibold text-sm"
          >
            <Plus size={16} />
            New
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-white border border-border-color text-text-main py-2 px-4 rounded-md hover:bg-bg-base transition-colors font-semibold text-sm"
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
                "group p-2.5 px-3 rounded-md text-sm cursor-pointer mb-1 flex justify-between items-center transition-colors",
                activeId === conv.id ? "bg-[#f0f7ff] text-accent-primary font-semibold" : "hover:bg-gray-100 text-text-main"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare size={14} className="shrink-0" />
                <span className="truncate">{conv.title || 'Untitled Chat'}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(conv.id);
                  }}
                  className="p-1 text-text-muted hover:text-accent-primary"
                  title="Export"
                >
                  <Download size={14} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(conv.id);
                  }}
                  className="p-1 text-text-muted hover:text-accent-primary"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                {deleteConfirmId === conv.id ? (
                  <div className="flex items-center gap-1 bg-red-50 rounded border border-red-200 px-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                        setDeleteConfirmId(null);
                      }}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
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
                      setDeleteConfirmId(conv.id);
                    }}
                    className="p-1 text-text-muted hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
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

      <div className="p-5 border-t border-border-color text-xs text-text-muted">
        Running on Linux x64<br/>
        Disk Usage: Local Storage
      </div>
    </aside>
  );
}
