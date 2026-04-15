import { Conversation, Settings } from '../types';

export const defaultSettings: Settings = {
  systemInstruction: '',
  temperature: 1,
  topK: 64,
  topP: 0.95,
};

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

export async function saveConversation(conversation: Conversation): Promise<void> {
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
