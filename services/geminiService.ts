
import { fileToGenerativePart, readFileAsText, detectFileType } from '../utils';
import { ApiConfig, AudioFile, ChatMessage, SummaryOptions, MeetingAnalysis } from '../types';
import { getEffectiveApiKey } from './config'; 

// Helper to get the most reliable key
const getApiKey = (config: ApiConfig): string => {
    if (config.apiKey && config.apiKey.trim().length >= 10) return config.apiKey.trim();
    const systemKey = getEffectiveApiKey(config.provider);
    if (systemKey && systemKey.length >= 10) return systemKey;
    throw new Error(`Falta la API Key para ${config.provider === 'gemini' ? 'Google Gemini' : 'OpenAI/Compatible'}. Por favor configúrala en Ajustes (⚙️).`);
};

// --- DYNAMIC IMPORT HELPER (SINGLETON PATTERN) ---
// Ensures we only fetch the module once to prevent context issues during large batch processing
let sdkPromise: Promise<any> | null = null;

const loadGeminiSDK = async () => {
    if (!sdkPromise) {
        // @ts-ignore
        sdkPromise = import("@google/genai").catch(e => {
            sdkPromise = null; // Reset on failure so we can try again
            console.error("Failed to load Google GenAI SDK", e);
            throw new Error("No se pudo cargar la librería de IA. Verifica tu conexión a internet.");
        });
    }
    return sdkPromise;
};

// --- RETRY LOGIC WITH EXPONENTIAL BACKOFF ---
// Crucial for processing 100+ files where rate limits (429) or transient network errors occur.
async function executeWithRetry<T>(operation: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const msg = error.message || JSON.stringify(error);
        
        // Critical errors that should NOT be retried
        if (msg.includes("API_KEY") || msg.includes("PERMISSION_DENIED") || msg.includes("400") || msg.includes("403")) {
            throw error;
        }

        if (retries <= 0) {
            if (msg.includes("Extension context invalidated")) {
                throw new Error("El navegador interrumpió la conexión. Por favor recarga la página (F5) e intenta de nuevo.");
            }
            throw error;
        }

        // Retry on 429 (Rate Limit), 5xx (Server Error), or Network Glitches
        console.warn(`Retrying operation... Attempts left: ${retries}. Waiting ${baseDelay}ms. Error: ${msg}`);
        await new Promise(resolve => setTimeout(resolve, baseDelay));
        
        // Exponential backoff: 2s -> 4s -> 8s
        return executeWithRetry(operation, retries - 1, baseDelay * 2);
    }
}

// Helper to sanitize Gemini Errors
const handleGeminiError = (e: any, context: string) => {
    console.error(`Gemini Error (${context}):`, e);
    const msg = e.message || JSON.stringify(e);

    if (msg.includes("SERVICE_DISABLED") || msg.includes("Generative Language API has not been used")) {
        const projectIdMatch = msg.match(/project (\d+)/);
        const pid = projectIdMatch ? projectIdMatch[1] : "tu-proyecto";
        const url = `https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=${pid}`;
        throw new Error(`⚠️ API DESHABILITADA (PROYECTO ${pid}):\n\nDebes habilitar la 'Generative Language API' en tu consola de Google Cloud.\n\nEnlace: ${url}`);
    }

    if (msg.includes("400")) throw new Error("Error 400: Solicitud inválida. Verifica el formato del archivo.");
    if (msg.includes("403")) throw new Error("Error 403: Acceso denegado. Verifica tu API Key.");
    if (msg.includes("404") || msg.includes("not found")) throw new Error("Modelo no encontrado. Revisa Ajustes.");
    if (msg.includes("Extension context invalidated")) throw new Error("Error de navegador: Recarga la página.");
    if (msg.includes("429")) throw new Error("Límite de cuota excedido (429). Intenta más tarde.");
    
    throw new Error(`${context}: ${msg.substring(0, 200)}...`);
};

// --- TEST CONNECTION FUNCTION ---
export const testApiConnection = async (config: ApiConfig): Promise<string> => {
  if (config.provider === 'gemini') {
    const apiKey = getApiKey(config);

    try {
      const { GoogleGenAI } = await loadGeminiSDK();
      
      return await executeWithRetry(async () => {
          const ai = new GoogleGenAI({ apiKey });
          let model = config.models.fast || 'gemini-flash-latest';
          if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

          await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: 'Ping' }] },
          });
          return `Google Gemini OK (${model})`;
      });
    } catch (e: any) {
      handleGeminiError(e, "Test Connection");
      return "Error"; 
    }
  } else {
    // OpenAI Connection Check
    const apiKey = getApiKey(config);
    const baseUrl = config.baseUrl || "https://api.openai.com/v1";
    const model = config.models.fast || "gpt-4o-mini";

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Ping" }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Status ${response.status}: ${errText}`);
        }
        
        return `OpenAI Compatible OK (${model})`;
    } catch (e: any) {
        throw new Error(`OpenAI Error: ${e.message}`);
    }
  }
};

// --- UNIFIED MULTIMODAL PROCESSOR ---
export const processMultimodalContent = async (file: File, config: ApiConfig): Promise<{ text: string; summary: string }> => {
  if (config.provider === 'openai') {
      const apiKey = getApiKey(config); 
      const type = detectFileType(file);
      if (type === 'audio') return transcribeWithOpenAI(file, apiKey, config);
      throw new Error("OpenAI only supports Audio in this version.");
  }

  const apiKey = getApiKey(config);
  const { GoogleGenAI } = await loadGeminiSDK();
  
  const fileType = detectFileType(file);
  let parts: any[] = [];
  let prompt = "";

  // Prepare parts (Heavy operation, do once outside retry if possible)
  if (fileType === 'text') {
      const textContent = await readFileAsText(file);
      parts = [{ text: textContent }];
      prompt = `Analiza el texto. 1. "transcription": Contenido limpio. 2. "summary": Resumen de UNA frase.`;
  } else {
      const mediaPart = await fileToGenerativePart(file);
      parts = [mediaPart];
      
      if (fileType === 'audio') {
          prompt = `Actúa como transcriptor experto. Transcribe la nota de voz completa. Resume en una frase el tema principal.`;
      } else if (fileType === 'image') {
          prompt = `Actúa como experto en Visión. OCR completo y descripción detallada. Resume en una frase.`;
      } else if (fileType === 'document') {
           prompt = `Actúa como Analista de Documentos. Extrae texto clave. Resume en una frase.`;
      }
  }

  prompt += ` Output JSON schema: { "transcription": "Content...", "summary": "Summary..." }`;
  parts.push({ text: prompt });

  return executeWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey });
      let model = fileType === 'audio' 
          ? (config.models.fast || 'gemini-flash-latest') 
          : (config.models.complex || 'gemini-3-pro-preview');
      
      if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: { responseMimeType: "application/json" }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("Empty response from Gemini.");

      try {
        const json = JSON.parse(responseText);
        return {
          text: json.transcription || "Content extraction failed.",
          summary: json.summary || "No summary."
        };
      } catch (e) {
        console.warn("Gemini JSON parse error, returning raw text", e);
        // Fallback for when JSON mode fails slightly but text is there
        return { text: responseText, summary: "Resumen automático no disponible (Formato)" };
      }
  }).catch(e => {
      if (e.message.includes("400") && fileType === 'audio') {
          throw new Error("⚠️ Audio incompatible. Convierte a MP3/WAV.");
      }
      handleGeminiError(e, "Multimodal Processing");
      return { text: "", summary: "" };
  });
};

// --- TEXT POLISHER ---
export const polishTextContent = async (textInput: string, files: File[], config: ApiConfig): Promise<string> => {
    const apiKey = getApiKey(config);
    const { GoogleGenAI } = await loadGeminiSDK();
    
    const systemPrompt = `
**Rol:** Redactor experto. Genera versiones mejoradas manteniendo fidelidad absoluta.
**Formatos:**
1. WhatsApp (con markdown de bloque de código)
2. Email (Estructurado)
3. Chat Rápido (Lista)
`;

    const parts: any[] = [];
    for (const file of files) {
        const part = await fileToGenerativePart(file);
        parts.push(part);
    }
    if (textInput.trim()) parts.push({ text: textInput });
    else if (files.length === 0) throw new Error("Falta contenido.");

    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey });
        const hasHeavyMedia = files.some(f => detectFileType(f) === 'audio');
        let model = hasHeavyMedia ? (config.models.fast || 'gemini-flash-latest') : (config.models.complex || 'gemini-3-pro-preview');
        if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: { systemInstruction: systemPrompt }
        });
        
        return response.text || "Sin respuesta.";
    }).catch(e => {
        handleGeminiError(e, "Text Polisher");
        return "";
    });
};

// --- MEETING ANALYSIS ---
export const analyzeMeetingTranscript = async (transcript: string, config: ApiConfig): Promise<Omit<MeetingAnalysis, 'id' | 'userId' | 'createdAt'>> => {
    const apiKey = getApiKey(config);
    const { GoogleGenAI } = await loadGeminiSDK();

    const prompt = `
        Actúa como Analista de Reuniones Senior.
        TRANSCRIPCIÓN: """${transcript.substring(0, 50000)}"""
        
        Extrae:
        1. Meta (título, fecha, CLIENTE/PROYECTO).
        2. Resumen ejecutivo.
        3. Capítulos.
        4. Preguntas clave.
        5. TAREAS (Responsable, estado, deadline).
        6. Métricas (sentimiento, calidad).

        Output JSON: { "meta": {...}, "summary": {...}, "chapters": [...], "questions": [...], "tasks": [...], "metrics": {...} }
    `;

    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey });
        let model = config.models.complex || 'gemini-3-pro-preview';
        if (model === 'gemini-2.5-flash-latest') model = 'gemini-3-pro-preview';

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const jsonText = response.text || "{}";
        const parsed = JSON.parse(jsonText);
        return { ...parsed, originalTranscript: transcript };
    }).catch(e => {
        handleGeminiError(e, "Meeting Analysis");
        return {} as any;
    });
};

// --- GLOBAL SUMMARY GENERATION ---
export const generateGlobalSummary = async (transcripts: string[], config: ApiConfig, options: SummaryOptions): Promise<string> => {
  if (transcripts.length === 0) return "";
  
  if (config.provider === 'gemini') {
    const apiKey = getApiKey(config);
    // Batch large summaries to avoid context limit
    const combinedText = transcripts.join("\n\n---\n\n").substring(0, 800000); 
    const prompt = `Actúa como Analista. Genera resumen (${options.focus}) en formato ${options.format}. Input: ${combinedText}`;

    return executeWithRetry(async () => {
        const { GoogleGenAI } = await loadGeminiSDK();
        const ai = new GoogleGenAI({ apiKey });
        let model = config.models.complex || 'gemini-3-pro-preview';
        
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: prompt }] }
        });
        return response.text || "Respuesta vacía.";
    }).catch(e => {
        handleGeminiError(e, "Global Summary");
        return "";
    });
  } else {
     return "OpenAI Summary not available.";
  }
};

// --- CHAT WITH CONTEXT ---
export const chatWithProjectContext = async (message: string, history: ChatMessage[], files: AudioFile[], config: ApiConfig): Promise<string> => {
  if (config.provider === 'gemini') {
      const apiKey = getApiKey(config);
      const validFiles = files.filter(f => f.status === 'completed' && f.transcript);
      if (validFiles.length === 0) return "No hay información en el contexto.";

      // Truncate context to safe limits (~100 files might be too big for Flash without careful pruning, but Pro handles 1M tokens)
      // We will assume 1.5 Pro or Flash 1.5 which has large context.
      const contextData = validFiles.map((f, i) => `FILE ${i+1} (${f.name}):\n${f.transcript}`).join("\n---\n");
      const systemInstruction = `Eres Chronos AI. Responde usando este contexto:\n${contextData}`;
      
      const contents = [...history.map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] })), { role: 'user', parts: [{ text: message }] }];

      return executeWithRetry(async () => {
          const { GoogleGenAI } = await loadGeminiSDK();
          const ai = new GoogleGenAI({ apiKey });
          let model = config.models.complex || 'gemini-3-pro-preview';

          const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: { systemInstruction: systemInstruction }
          });
          return response.text || "No response.";
      }).catch(e => {
          handleGeminiError(e, "Chat Context");
          return "";
      });
  } else {
      return "OpenAI Chat not supported.";
  }
};

// --- OPENAI TRANSCRIPTION ---
const transcribeWithOpenAI = async (file: File, apiKey: string, config: ApiConfig): Promise<{ text: string; summary: string }> => {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1"); 
  formData.append("language", "es");

  return executeWithRetry(async () => {
      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body: formData
      });

      if (!response.ok) throw new Error(`Whisper Error: ${response.status}`);
      const data = await response.json();
      return { text: data.text, summary: "Summary not available in legacy mode." };
  });
};
