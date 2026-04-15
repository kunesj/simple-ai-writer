import { encode } from 'gpt-tokenizer';
import { Message, Settings } from '../types';

export class ApiError extends Error {
  public requestDetails: unknown;
  public responseDetails: unknown;
  public parsedMessage: string;

  constructor(message: string, requestDetails: unknown, responseDetails: unknown, parsedMessage: string) {
    super(message);
    this.requestDetails = requestDetails;
    this.responseDetails = responseDetails;
    this.parsedMessage = parsedMessage;
  }
}

export async function countTokens(messages: Message[], _settings: Settings): Promise<number> {
  const contextMessages = messages.filter((m) => m.inContext);
  if (contextMessages.length === 0) return 0;
  
  const text = contextMessages.map(m => m.useSummary && m.summary ? m.summary : m.content).join('\n\n');
  
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (e) {
    console.error("Token counting failed:", e);
    // Fallback estimate
    return Math.ceil(text.length / 4);
  }
}

export async function* generateChatStream(
  messages: Message[],
  settings: Settings,
  abortSignal?: AbortSignal,
  newMessageContent?: string
) {
  const contextMessages = messages.filter((m) => m.inContext);
  
  const formattedMessages = await Promise.all(contextMessages.map(async (m) => {
    const textContent = m.useSummary && m.summary ? m.summary : m.content;
    
    if (m.attachments && m.attachments.length > 0) {
      const contentArray: { type: string; text?: string; image_url?: { url: string } }[] = [];
      if (textContent) {
        contentArray.push({ type: "text", text: textContent });
      }
      
      for (const att of m.attachments) {
        if (att.type.startsWith('image/')) {
          try {
            const res = await fetch(att.url);
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            contentArray.push({
              type: "image_url",
              image_url: { url: base64 }
            });
          } catch (e) {
            console.error("Failed to load attachment", e);
          }
        } else {
          try {
            const res = await fetch(att.url);
            const text = await res.text();
            contentArray.push({
              type: "text",
              text: `\n\n--- File: ${att.name} ---\n${text}\n--- End of File ---\n`
            });
          } catch (e) {
            console.error("Failed to load text attachment", e);
          }
        }
      }
      
      return {
        role: m.role === 'user' ? 'user' : 'assistant',
        content: contentArray.length > 0 ? contentArray : textContent,
      };
    } else {
      return {
        role: m.role === 'user' ? 'user' : 'assistant',
        content: textContent,
      };
    }
  }));

  if (settings.systemInstruction) {
    formattedMessages.unshift({
      role: 'system',
      content: settings.systemInstruction,
    });
  }

  if (newMessageContent) {
    formattedMessages.push({
      role: 'user',
      content: newMessageContent,
    });
  }

  const baseUrl = (import.meta.env.VITE_OPENAI_BASE_URL || '').replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  const modelName = import.meta.env.VITE_MODEL_NAME || '';

  if (!baseUrl || !modelName) {
    throw new Error('Missing required environment variables: VITE_OPENAI_BASE_URL and VITE_MODEL_NAME must be set');
  }

  const requestBody = {
    model: modelName,
    messages: formattedMessages,
    temperature: settings.temperature,
    top_p: settings.topP,
    stream: true,
    stream_options: { include_usage: true }
  };

  const requestDetails = {
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey ? apiKey.substring(0, 8) + '...' : 'none'}`,
    },
    body: requestBody
  };

  const response = await fetch(requestDetails.url, {
    method: requestDetails.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedMessage = errText;
    const responseDetails: { status: number; statusText: string; body: string } = { status: response.status, statusText: response.statusText, body: errText };
    
    try {
      const parsed = JSON.parse(errText);
      responseDetails.body = parsed;
      // Try to extract a meaningful error message
      if (Array.isArray(parsed) && parsed[0]?.error?.message) {
        parsedMessage = parsed[0].error.message;
      } else if (parsed.error?.message) {
        parsedMessage = parsed.error.message;
      }
    } catch {
      // Not JSON, keep as text
    }
    
    throw new ApiError(`API Error: ${response.status}`, requestDetails, responseDetails, parsedMessage);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(dataStr);
            
            if (data.choices && data.choices.length > 0) {
              const delta = data.choices[0].delta;
              if (delta && delta.content) {
                yield {
                  type: 'content',
                  text: delta.content,
                  thought: false
                };
              }
              else if (delta && delta.reasoning_content) {
                yield {
                  type: 'content',
                  text: delta.reasoning_content,
                  thought: true
                };
              }
            }
            
            if (data.usage) {
              yield {
                type: 'usage',
                usage: {
                  totalTokenCount: data.usage.total_tokens,
                  promptTokenCount: data.usage.prompt_tokens,
                  candidatesTokenCount: data.usage.completion_tokens,
                  thoughtsTokenCount: 0
                }
              };
            }
          } catch (e) {
            console.warn("Failed to parse SSE JSON", e, dataStr);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
