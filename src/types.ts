export type Role = 'user' | 'model' | 'system';

export interface Attachment {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  thought?: string;
  summary?: string;
  useSummary: boolean;
  inContext: boolean;
  isCollapsed: boolean;
  groupId?: string;
  timestamp: number;
  stats?: {
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  error?: {
    message: string;
    requestDetails: unknown;
    responseDetails: unknown;
  };
}

export interface MessageGroup {
  id: string;
  name: string;
  isCollapsed: boolean;
  messageIds: string[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  groups: MessageGroup[];
  updatedAt: number;
}

export interface Settings {
  systemInstruction: string;
  temperature: number;
  topK: number;
  topP: number;
}
