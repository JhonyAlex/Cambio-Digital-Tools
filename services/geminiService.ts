import { GoogleGenAI } from "@google/genai";
import { fileToGenerativePart, readFileAsText, detectFileType } from '../utils';
import { ApiConfig, AudioFile, ChatMessage, SummaryOptions, FileType } from '../types';
import { translations as t } from '../translations';
import { getEffectiveApiKey } from './config';

// --- TEST CONNECTION FUNCTION ---
export const testApiConnection = async (config: ApiConfig): Promise<string> => {
  // Use centralized logic to determine key (Custom vs Env)
  const apiKey = getEffectiveApiKey(config.apiKey);
  
  if (!apiKey) throw new Error("API Key is empty. Please configure it or check environment variables.");

  if (config.provider === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      await ai.models.generateContent({
        model: config.model || 'gemini-2.5-flash',
        contents: { parts: [{ text: 'Ping' }] },
      });
      return "Google Gemini Connection Success.";
    } catch (e: any) {
      const msg = e.message || JSON.stringify(e);
      throw new Error(`Gemini Error: ${msg}`);
    }
  } else {
    // OpenAI fallback check
    return "OpenAI Connection Success (Mock Check).";
  }
};

// --- UNIFIED MULTIMODAL PROCESSOR ---
export const processMultimodalContent = async (file: File, config: ApiConfig): Promise<{ text: string; summary: string }> => {
  const apiKey = getEffectiveApiKey(config.apiKey);
  
  if (!apiKey || apiKey.length < 10) throw new Error("API Key missing.");

  // For OpenAI, we still route to legacy handler for audio only, as OpenAI's multimodal is different endpoint wise.
  // For this update, we focus on Gemini's multimodal capabilities.
  if (config.provider === 'openai') {
      const type = detectFileType(file);
      if (type === 'audio') return transcribeWithOpenAI(file, apiKey, config);
      throw new Error("OpenAI implementation only supports Audio in this version. Use Gemini for Multimodal.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const fileType = detectFileType(file);

  let parts: any[] = [];
  let prompt = "";

  // 1. PREPARE CONTENT
  if (fileType === 'text') {
      const textContent = await readFileAsText(file);
      parts = [{ text: textContent }];
      prompt = `
        Analiza el texto proporcionado.
        1. "transcription": Devuelve el contenido principal limpio y formateado.
        2. "summary": ${t.prompt_summary}
      `;
  } else {
      // Audio, Image, PDF
      const mediaPart = await fileToGenerativePart(file);
      parts = [mediaPart];
      
      if (fileType === 'audio') {
          prompt = `
            ${t.prompt_transcribe_role}
            ${t.prompt_transcribe_inst}
            ${t.prompt_summary}
          `;
      } else if (fileType === 'image') {
          prompt = `
            Actúa como experto en Visión por Computador.
            1. "transcription": Realiza OCR (Reconocimiento Óptico de Caracteres). Extrae TODO el texto visible. Si no hay texto, describe el contenido visual en alto detalle.
            2. "summary": Resume el contenido visual o el significado del texto en una frase.
          `;
      } else if (fileType === 'document') {
           prompt = `
            Actúa como Analista de Documentos.
            1. "transcription": Extrae el texto clave de este documento. Mantén la estructura donde sea posible.
            2. "summary": ${t.prompt_summary}
          `;
      }
  }

  // 2. APPEND JSON INSTRUCTION
  prompt += `
    Output JSON schema:
    {
      "transcription": "The main content/text...",
      "summary": "The summary..."
    }
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json"
      }
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
      console.warn("Gemini JSON parse error", e);
      return { text: responseText, summary: "Summary error (Format)" };
    }
  } catch (e: any) {
    console.error("Gemini API Error:", e);
    const msg = e.message || JSON.stringify(e);
    if (msg.includes("400")) throw new Error("Error 400: Invalid Request or File too large/unsupported.");
    throw new Error(`Gemini Error: ${msg}`);
  }
};

// --- GLOBAL SUMMARY GENERATION ---
export const generateGlobalSummary = async (
    transcripts: string[], 
    config: ApiConfig, 
    options: SummaryOptions
): Promise<string> => {
  if (transcripts.length === 0) return "";
  
  const apiKey = getEffectiveApiKey(config.apiKey);
  if (!apiKey) throw new Error("API Key missing.");

  const combinedText = transcripts.join("\n\n---\n\n");
  
  let role = "Actúa como un Analista de Negocios Senior.";
  let focusInstruction = "";
  
  switch (options.focus) {
      case 'action_items':
          role = "Actúa como un Project Manager.";
          focusInstruction = "Enfócate en Acciones, Tareas y Fechas Límite.";
          break;
      case 'decisions':
          role = "Actúa como un Secretario de la Junta.";
          focusInstruction = "Enfócate en Decisiones y Acuerdos.";
          break;
      case 'sentiment':
          role = "Actúa como un Psicólogo.";
          focusInstruction = "Analiza el tono y sentimiento.";
          break;
      default: 
          role = "Actúa como un Analista de Negocios Senior.";
          focusInstruction = "Provee un Resumen Ejecutivo comprensivo.";
  }

  const lengthInstruction = options.length === 'detailed' ? "Provee un reporte DETALLADO." : "Sé CONCISO.";
  const langInstruction = "RESPONDE SIEMPRE EN ESPAÑOL.";

  const prompt = `
    ${role}
    ${langInstruction}
    INPUT DATA:
    ${combinedText}
    INSTRUCTIONS:
    1. ${focusInstruction}
    2. ${lengthInstruction}
    3. Output format: ${options.format}
  `;

  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] }
    });
    return response.text || "Failed to generate summary.";
  } else {
     // OpenAI Fallback
     return "OpenAI Summary not implemented in this demo update.";
  }
};

// --- CHAT WITH CONTEXT ---
export const chatWithProjectContext = async (
  message: string, 
  history: ChatMessage[], 
  files: AudioFile[], 
  config: ApiConfig
): Promise<string> => {
  const apiKey = getEffectiveApiKey(config.apiKey);
  if (!apiKey) throw new Error("API Key missing.");

  const validFiles = files.filter(f => f.status === 'completed' && f.transcript);

  if (validFiles.length === 0) return t.prompt_no_info;

  const contextData = validFiles.map((f, i) => 
    `FILE ${i+1} [Type: ${f.fileType || 'unknown'}]: "${f.name}" (${f.date.toLocaleDateString()}):\n${f.transcript}`
  ).join("\n\n----------------\n\n");

  const systemInstruction = `
    ${t.prompt_chat_system}
    CONTEXT:
    ${contextData}
  `;

  const pastMessages = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  const ai = new GoogleGenAI({ apiKey });
  const contents = [
      ...pastMessages,
      { role: 'user', parts: [{ text: message }] }
  ];

  const response = await ai.models.generateContent({
    model: config.model || 'gemini-2.5-flash',
    contents: contents,
    config: { systemInstruction: systemInstruction }
  });

  return response.text || "No response.";
};

// --- OPENAI TRANSCRIPTION (LEGACY AUDIO ONLY) ---
const transcribeWithOpenAI = async (file: File, apiKey: string, config: ApiConfig): Promise<{ text: string; summary: string }> => {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1"); 
  formData.append("language", "es");

  const transcriptResponse = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData
  });

  if (!transcriptResponse.ok) throw new Error(`Whisper Error: ${transcriptResponse.status}`);
  const transcriptData = await transcriptResponse.json();
  const rawText = transcriptData.text;

  return { text: rawText, summary: "Summary not available in legacy mode." };
};