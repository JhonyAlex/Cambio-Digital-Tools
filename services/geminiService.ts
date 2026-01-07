
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

// --- DYNAMIC IMPORT HELPER ---
// Ensures the app loads even if the SDK fails to download initially
const loadGeminiSDK = async () => {
    try {
        // @ts-ignore
        const module = await import("@google/genai");
        return module;
    } catch (e) {
        console.error("Failed to load Google GenAI SDK", e);
        throw new Error("No se pudo cargar la librería de IA. Verifica tu conexión a internet.");
    }
};

// --- TEST CONNECTION FUNCTION ---
export const testApiConnection = async (config: ApiConfig): Promise<string> => {
  if (config.provider === 'gemini') {
    const apiKey = getApiKey(config);

    try {
      const { GoogleGenAI } = await loadGeminiSDK();
      const ai = new GoogleGenAI({ apiKey });
      
      let model = config.models.fast || 'gemini-flash-latest';
      if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

      await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: 'Ping' }] },
      });
      return `Google Gemini OK (${model})`;
    } catch (e: any) {
      const msg = e.message || JSON.stringify(e);
      if (msg.includes("API_KEY_INVALID") || msg.includes("400")) {
          throw new Error("API Key inválida. Verifica que has copiado la clave correctamente en Ajustes.");
      }
      throw new Error(`Gemini Error: ${msg}`);
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
      throw new Error("OpenAI implementation only supports Audio in this version. Use Gemini for Multimodal.");
  }

  const apiKey = getApiKey(config);
  const { GoogleGenAI } = await loadGeminiSDK();
  const ai = new GoogleGenAI({ apiKey });
  const fileType = detectFileType(file);

  let parts: any[] = [];
  let prompt = "";

  if (fileType === 'text') {
      const textContent = await readFileAsText(file);
      parts = [{ text: textContent }];
      prompt = `
        Analiza el texto proporcionado.
        1. "transcription": Devuelve el contenido principal limpio y formateado.
        2. "summary": Genera un resumen de UNA sola frase que capture la esencia.
      `;
  } else {
      const mediaPart = await fileToGenerativePart(file);
      parts = [mediaPart];
      
      if (fileType === 'audio') {
          prompt = `
            Actúa como un transcriptor experto en español.
            Transcribe la siguiente nota de voz. Usa el contexto para corregir errores fonéticos. Mantén el mensaje original.
            Genera un resumen de UNA sola frase que capture la esencia.
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
            2. "summary": Genera un resumen de UNA sola frase que capture la esencia.
          `;
      }
  }

  prompt += `
    Output JSON schema:
    {
      "transcription": "The main content/text...",
      "summary": "The summary..."
    }
  `;

  parts.push({ text: prompt });

  try {
    let model = fileType === 'audio' 
        ? (config.models.fast || 'gemini-flash-latest') 
        : (config.models.complex || 'gemini-3-pro-preview');
    
    if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

    const response = await ai.models.generateContent({
      model: model,
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
    if (msg.includes("400")) throw new Error("Error 400: Archivo demasiado grande o formato no soportado. Usa MP3/M4A/WAV.");
    if (msg.includes("API_KEY")) throw new Error("Error de API Key: Verifica tu configuración en Ajustes.");
    if (msg.includes("404") || msg.includes("not found")) throw new Error("Modelo no encontrado. Se ha corregido la configuración, intenta de nuevo.");
    throw new Error(`Gemini Error: ${msg}`);
  }
};

// --- TEXT POLISHER ---
export const polishTextContent = async (textInput: string, files: File[], config: ApiConfig): Promise<string> => {
    const apiKey = getApiKey(config);
    const { GoogleGenAI } = await loadGeminiSDK();
    const ai = new GoogleGenAI({ apiKey });
    
    const systemPrompt = `
**Rol principal:**
Eres un redactor experto y meticuloso. Tu trabajo es recibir un borrador (texto o archivo) y generar múltiples versiones mejoradas, **manteniendo una fidelidad absoluta al mensaje original**.

## **Reglas de Oro (NO ROMPER):**
1. **Fidelidad:** No inventes hechos, cifras ni nombres. No asumas información que no está en el input.
2. **Ortografía y Gramática:** Impecables en todas las versiones.
3. **Estructura:** Sigue el formato solicitado abajo.

## **Formato de Respuesta Requerido:**

### A. Versión WhatsApp
- **IMPORTANTE:** El contenido de esta versión DEBE estar dentro de un bloque de código markdown (\`\`\`).
- Formato interno: Usa *asterisco simple* para negritas.
- Estilo: Cercano, uso de emojis moderado.

### B. Versión Correo Electrónico
- **Formato:** Markdown estándar (NO bloques de código).
- Usa **doble asterisco** para negritas (Ej: **Asunto:**).
- Estructura:
  - **Asunto:** [Asunto Propuesto]
  - [Cuerpo del correo con párrafos bien separados]

### C. Versión Chat Rápido (Slack/Teams)
- Directo, sin saludos formales.
- Usa listas con guiones (-).

### D. Versión Documento/Formal (Opcional)
- Redacción impersonal en tercera persona.
- Párrafos claros.

Si recibes archivos, extrae su contenido y úsalo como base.
    `;

    const parts: any[] = [];

    for (const file of files) {
        const part = await fileToGenerativePart(file);
        parts.push(part);
    }

    if (textInput.trim()) {
        parts.push({ text: textInput });
    } else if (files.length === 0) {
        throw new Error("Debes proporcionar texto o archivos.");
    }

    try {
        const hasHeavyMedia = files.some(f => detectFileType(f) === 'audio');
        let model = hasHeavyMedia 
            ? (config.models.fast || 'gemini-flash-latest') 
            : (config.models.complex || 'gemini-3-pro-preview');
        
        if (model === 'gemini-2.5-flash-latest') model = 'gemini-flash-latest';

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                systemInstruction: systemPrompt
            }
        });
        
        return response.text || "No se pudo generar una respuesta.";
    } catch (e: any) {
        console.error("Polisher Error:", e);
        const msg = e.message || "";
        if (msg.includes("API_KEY")) throw new Error("API Key inválida. Verifica tu configuración.");
        throw new Error(`Error generando mejoras: ${msg}`);
    }
};

// --- MEETING ANALYSIS ---
export const analyzeMeetingTranscript = async (transcript: string, config: ApiConfig): Promise<Omit<MeetingAnalysis, 'id' | 'userId' | 'createdAt'>> => {
    const apiKey = getApiKey(config);
    const { GoogleGenAI } = await loadGeminiSDK();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
        Actúa como un Analista de Reuniones Senior con IA.
        Tu tarea es procesar la siguiente transcripción de una reunión y extraer conocimiento estructurado.
        
        TRANSCRIPCIÓN:
        """
        ${transcript.substring(0, 50000)} 
        """
        (Si la transcripción se corta, analiza lo que hay disponible).

        REQUISITOS OBLIGATORIOS:
        1. **Meta:** Deduce el título, tipo de reunión, equipo probable, fecha (si se menciona, sino pon la fecha de hoy).
        2. **CLIENTE (CRÍTICO):** Intenta identificar para qué **Cliente, Empresa Externa o Proyecto** fue esta reunión. Si es una reunión interna, pon "Interno". Si mencionan un nombre de empresa repetidamente, úsalo.
        3. **Resumen:** Crea un resumen ejecutivo claro, lista de decisiones tomadas y problemas mencionados.
        4. **Capítulos:** Divide la reunión en temas lógicos. Intenta inferir timestamps si el texto los tiene (ej: [00:10]), si no, usa null.
        5. **Preguntas Clave:** Identifica preguntas importantes hechas y su respuesta (o "Sin respuesta").
        6. **Tareas (CRÍTICO):** Detecta acciones. Asigna tipo (operativa, técnica, etc), estado (pending), responsable (si se menciona) y fecha límite (si se infiere).
        7. **Métricas:** Calcula un sentimiento general (positive, neutral, negative), puntuación de participación (0-100) y calidad de la comunicación (0-100).

        FORMATO JSON EXACTO:
        {
            "meta": { "title": "string", "type": "string", "team": "string", "date": "YYYY-MM-DD", "client": "string (e.g. 'Cliente X' or 'Interno')" },
            "summary": { 
                "executive": "string", 
                "decisions": ["string"], 
                "problems": ["string"],
                "proposals": ["string"]
            },
            "chapters": [ { "title": "string", "startTime": "string (optional)", "summary": "string" } ],
            "questions": [ { "question": "string", "answer": "string" } ],
            "tasks": [ 
                { 
                    "id": "generate_uuid", 
                    "description": "string", 
                    "type": "operational|technical|administrative|follow_up", 
                    "status": "pending", 
                    "assignee": "string", 
                    "dueDate": "YYYY-MM-DD (optional)"
                } 
            ],
            "metrics": { "sentiment": "positive|neutral|negative", "participationScore": number, "qualityScore": number }
        }
    `;

    try {
        let model = config.models.complex;
        if (!model || model.includes('flash') || model === 'gemini-2.5-flash-latest') {
            model = 'gemini-3-pro-preview';
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const jsonText = response.text || "{}";
        const parsed = JSON.parse(jsonText);
        
        return {
            ...parsed,
            originalTranscript: transcript
        };

    } catch (e: any) {
        console.error("Meeting Analysis Error:", e);
        const msg = e.message || JSON.stringify(e);
        if (msg.includes('400')) throw new Error("Error en solicitud a Google Cloud (400). Verifica si el texto es demasiado largo o si la API Key es válida.");
        throw new Error(`Error analizando reunión: ${msg}`);
    }
};

// --- GLOBAL SUMMARY GENERATION ---
export const generateGlobalSummary = async (
    transcripts: string[], 
    config: ApiConfig, 
    options: SummaryOptions
): Promise<string> => {
  if (transcripts.length === 0) return "";
  
  if (config.provider === 'gemini') {
    const apiKey = getApiKey(config);
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

    try {
        const { GoogleGenAI } = await loadGeminiSDK();
        const ai = new GoogleGenAI({ apiKey });
        let model = config.models.complex || 'gemini-3-pro-preview';
        
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: prompt }] }
        });
        return response.text || "No se pudo generar el resumen (Respuesta vacía del modelo).";
    } catch (e: any) {
        throw new Error("Gemini Error: " + (e.message || "Unknown"));
    }
  } else {
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
  if (config.provider === 'gemini') {
      const apiKey = getApiKey(config);
      const validFiles = files.filter(f => f.status === 'completed' && f.transcript);

      if (validFiles.length === 0) return "No encuentro información sobre eso en los registros.";

      const contextData = validFiles.map((f, i) => 
        `FILE ${i+1} [Type: ${f.fileType || 'unknown'}]: "${f.name}" (${f.date.toLocaleDateString()}):\n${f.transcript}`
      ).join("\n\n----------------\n\n");

      const systemInstruction = `
        Eres Chronos AI, un asistente de conocimiento experto. Responde basándote ÚNICAMENTE en el contexto proporcionado.
        CONTEXT:
        ${contextData}
      `;

      const pastMessages = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

      const { GoogleGenAI } = await loadGeminiSDK();
      const ai = new GoogleGenAI({ apiKey });
      const contents = [
          ...pastMessages,
          { role: 'user', parts: [{ text: message }] }
      ];

      let model = config.models.complex || 'gemini-3-pro-preview';

      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: { systemInstruction: systemInstruction }
      });

      return response.text || "No response.";
  } else {
      return "OpenAI Chat not supported in this version.";
  }
};

// --- OPENAI TRANSCRIPTION ---
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
