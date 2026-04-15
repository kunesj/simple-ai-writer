import React, { useState } from 'react';
import { Settings, ServerConfig } from '../types';
import { X, Plus, Trash2, ChevronDown, ChevronRight, Server } from 'lucide-react';

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [serversExpanded, setServersExpanded] = useState(true);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  const handleChange = (field: keyof Settings, value: string | number | boolean | ServerConfig[] | string | null) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const formatNumber = (value: number | undefined): string => {
    return value !== undefined ? String(value) : '';
  };

  const parseNumber = (value: string): number | undefined => {
    if (value === '') return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  const createNewServer = (): ServerConfig => {
    const id = `server-${Date.now()}`;
    return {
      id,
      name: 'New Server',
      baseUrl: '',
      apiKey: '',
      modelName: '',
    };
  };

  const addServer = () => {
    const newServer = createNewServer();
    setDraft(prev => ({
      ...prev,
      servers: [...prev.servers, newServer],
      activeServerId: newServer.id,
    }));
    setEditingServerId(newServer.id);
  };

  const updateServer = (id: string, updates: Partial<ServerConfig>) => {
    setDraft(prev => ({
      ...prev,
      servers: prev.servers.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  };

  const deleteServer = (id: string) => {
    setDraft(prev => {
      const newServers = prev.servers.filter(s => s.id !== id);
      let newActiveId = prev.activeServerId;
      if (newActiveId === id) {
        newActiveId = newServers.length > 0 ? newServers[0].id : null;
      }
      return {
        ...prev,
        servers: newServers,
        activeServerId: newActiveId,
      };
    });
    if (editingServerId === id) {
      setEditingServerId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-gray-700">System Instructions</label>
            <textarea 
              value={draft.systemInstruction}
              onChange={(e) => handleChange('systemInstruction', e.target.value)}
              className="border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
              placeholder="You are a helpful assistant..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-gray-700">
                <span>Temperature</span>
              </label>
              <input 
                type="number" 
                min="0" max="2" step="0.1"
                value={formatNumber(draft.temperature)}
                onChange={(e) => handleChange('temperature', parseNumber(e.target.value))}
                className="border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="default"
                title="0-2, empty = use model default"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-gray-700">
                <span>Top K</span>
              </label>
              <input 
                type="number" 
                min="1" max="100" step="1"
                value={formatNumber(draft.topK)}
                onChange={(e) => handleChange('topK', parseNumber(e.target.value))}
                className="border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="default"
                title="1-100, empty = use model default"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-gray-700">
                <span>Top P</span>
              </label>
              <input 
                type="number" 
                min="0" max="1" step="0.05"
                value={formatNumber(draft.topP)}
                onChange={(e) => handleChange('topP', parseNumber(e.target.value))}
                className="border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="default"
                title="0-1, empty = use model default"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <button 
              onClick={() => setServersExpanded(!serversExpanded)}
              className="flex items-center gap-2 font-medium text-sm text-gray-700 w-full hover:bg-gray-50 p-2 -mx-2 rounded-lg"
            >
              {serversExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Server size={16} />
              <span>Server Configurations</span>
              <span className="text-xs text-gray-400 ml-1">({draft.servers.length})</span>
            </button>

            {serversExpanded && (
              <div className="mt-3 flex flex-col gap-3">
                {draft.servers.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-2">
                    No server configurations. Add one to connect to an AI backend.
                  </p>
                ) : (
                  draft.servers.map(server => (
                    <div key={server.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="activeServer"
                            checked={draft.activeServerId === server.id}
                            onChange={() => handleChange('activeServerId', server.id)}
                            className="accent-blue-600"
                          />
                          <span className="font-medium text-sm">{server.name || 'Unnamed Server'}</span>
                          {draft.activeServerId === server.id && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingServerId(editingServerId === server.id ? null : server.id)}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            {editingServerId === server.id ? 'Done' : 'Edit'}
                          </button>
                          <button
                            onClick={() => deleteServer(server.id)}
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {editingServerId === server.id && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Name</label>
                            <input
                              type="text"
                              value={server.name}
                              onChange={(e) => updateServer(server.id, { name: e.target.value })}
                              className="border rounded p-2 text-sm"
                              placeholder="My Server"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Model Name</label>
                            <input
                              type="text"
                              value={server.modelName}
                              onChange={(e) => updateServer(server.id, { modelName: e.target.value })}
                              className="border rounded p-2 text-sm"
                              placeholder="gemini-2.0-flash"
                            />
                          </div>
                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-xs text-gray-600">Base URL</label>
                            <input
                              type="text"
                              value={server.baseUrl}
                              onChange={(e) => updateServer(server.id, { baseUrl: e.target.value })}
                              className="border rounded p-2 text-sm"
                              placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                            />
                          </div>
                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-xs text-gray-600">API Key</label>
                            <input
                              type="password"
                              value={server.apiKey}
                              onChange={(e) => updateServer(server.id, { apiKey: e.target.value })}
                              className="border rounded p-2 text-sm"
                              placeholder="Enter API key..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <button
                  onClick={addServer}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus size={16} />
                  Add Server Configuration
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
