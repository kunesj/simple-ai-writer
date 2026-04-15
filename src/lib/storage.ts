import { Conversation, Settings, ServerConfig } from '../types';

export const defaultSettings: Settings = {
  systemInstruction: '',
  servers: [],
  activeServerId: null,
};

export function getEffectiveServerConfig(settings: Settings): ServerConfig | null {
  if (settings.servers.length > 0 && settings.activeServerId) {
    return settings.servers.find(s => s.id === settings.activeServerId) || settings.servers[0] || null;
  }
  return null;
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const res = await fetch('/api/conversations');
    if (res.ok) {
      const data = await res.json();
      return data || [];
    }
  } catch (e) {
    console.error("Failed to load conversations", e);
  }
  return [];
}

const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSaves = new Map<string, Conversation>();
const DEBOUNCE_MS = 500;
const saveInProgress = new Set<string>();

export function saveConversation(conversation: Conversation): void {
  pendingSaves.set(conversation.id, conversation);
  
  if (saveTimeouts.has(conversation.id)) {
    return;
  }
  
  const timeout = setTimeout(() => {
    saveTimeouts.delete(conversation.id);
    const pending = pendingSaves.get(conversation.id);
    if (pending) {
      pendingSaves.delete(conversation.id);
      saveInProgress.add(pending.id);
      doSaveConversation(pending).finally(() => {
        setTimeout(() => saveInProgress.delete(pending.id), 100);
      });
    }
  }, DEBOUNCE_MS);
  
  saveTimeouts.set(conversation.id, timeout);
}

export function flushSave(conversationId: string): void {
  const timeout = saveTimeouts.get(conversationId);
  if (timeout) {
    clearTimeout(timeout);
    saveTimeouts.delete(conversationId);
  }
  const pending = pendingSaves.get(conversationId);
  if (pending) {
    pendingSaves.delete(conversationId);
    saveInProgress.add(pending.id);
    doSaveConversation(pending).finally(() => {
      setTimeout(() => saveInProgress.delete(pending.id), 100);
    });
  }
}

export function flushAllSaves(): void {
  for (const id of saveTimeouts.keys()) {
    flushSave(id);
  }
}

export function isSaveInProgress(conversationId: string): boolean {
  return saveInProgress.has(conversationId);
}

async function doSaveConversation(conversation: Conversation): Promise<void> {
  try {
    await fetch(`/api/conversations/${conversation.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation)
    });
  } catch (e) {
    console.error("Failed to save conversation", e);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.error("Failed to delete conversation", e);
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      return data || defaultSettings;
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return defaultSettings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch (e) {
    console.error("Failed to save settings", e);
  }
}
