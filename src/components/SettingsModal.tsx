import React from 'react';
import { Settings } from '../types';
import { X } from 'lucide-react';

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = React.useState<Settings>(settings);

  const handleChange = (field: keyof Settings, value: string | number | boolean) => {
    setDraft(prev => ({ ...prev, [field]: value }));
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
              <label className="font-medium text-sm text-gray-700 flex justify-between">
                <span>Temperature</span>
                <span className="text-gray-500">{draft.temperature}</span>
              </label>
              <input 
                type="range" 
                min="0" max="2" step="0.1" 
                value={draft.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-gray-700 flex justify-between">
                <span>Top K</span>
                <span className="text-gray-500">{draft.topK}</span>
              </label>
              <input 
                type="range" 
                min="1" max="100" step="1" 
                value={draft.topK}
                onChange={(e) => handleChange('topK', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-gray-700 flex justify-between">
                <span>Top P</span>
                <span className="text-gray-500">{draft.topP}</span>
              </label>
              <input 
                type="range" 
                min="0" max="1" step="0.05" 
                value={draft.topP}
                onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
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
