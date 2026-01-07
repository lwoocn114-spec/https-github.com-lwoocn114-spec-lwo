
import { GoogleGenAI, Type } from "@google/genai";
import { VisualStyle, AspectRatio, Shot, Character, Scene, Genre, QualityMode, AISettings } from "../types";

/**
 * Unified AI call supporting Gemini and OpenAI-compatible providers.
 */
async function callAI(prompt: string, settings: AISettings, systemInstruction?: string, responseSchema?: any): Promise<any> {
  // Prioritize localStorage (user-entered) over process.env (build-time)
  const apiKey = localStorage.getItem('manju_api_key') || process.env.API_KEY || "";
  
  if (!apiKey) {
    throw new Error("API configuration missing. Please enter an API Key in settings.");
  }

  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const config: any = {
      systemInstruction: systemInstruction,
    };

    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }

    const response = await ai.models.generateContent({
      model: settings.modelName || "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: config
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    if (responseSchema) {
      return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    }
    return text;
  } else {
    // OpenAI-compatible Fetch
    const url = `${settings.baseUrl || "https://api.openai.com/v1"}/chat/completions`;
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const body: any = {
      model: settings.modelName || "gpt-4o",
      messages: messages,
    };

    if (responseSchema) {
      body.response_format = { type: "json_object" };
      // Note: Some models need an explicit mention of JSON in the prompt if response_format is used
      body.messages[body.messages.length - 1].content += "\n\nOutput MUST be a raw JSON object string.";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    if (responseSchema) {
      return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }
    return content;
  }
}

// --- Pollinations.ai Image Service ---

export const QUALITY_CONFIG: Record<QualityMode, { model: string, sizes: Record<AspectRatio, { w: number, h: number }> }> = {
  speed: {
    model: 'flux-schnell',
    sizes: { 
        [AspectRatio.PORTRAIT]: { w: 576, h: 1024 }, 
        [AspectRatio.LANDSCAPE]: { w: 1024, h: 576 }, 
        [AspectRatio.SQUARE]: { w: 768, h: 768 },
        [AspectRatio.CINEMATIC]: { w: 1024, h: 432 },
        [AspectRatio.CLASSIC]: { w: 800, h: 600 }
    }
  },
  balanced: {
    model: 'flux',
    sizes: { 
        [AspectRatio.PORTRAIT]: { w: 768, h: 1344 }, 
        [AspectRatio.LANDSCAPE]: { w: 1344, h: 768 }, 
        [AspectRatio.SQUARE]: { w: 1024, h: 1024 },
        [AspectRatio.CINEMATIC]: { w: 1280, h: 544 },
        [AspectRatio.CLASSIC]: { w: 1024, h: 768 }
    }
  },
  quality: {
    model: 'flux-realism',
    sizes: { 
        [AspectRatio.PORTRAIT]: { w: 832, h: 1472 }, 
        [AspectRatio.LANDSCAPE]: { w: 1472, h: 832 }, 
        [AspectRatio.SQUARE]: { w: 1280, h: 1280 },
        [AspectRatio.CINEMATIC]: { w: 1536, h: 640 },
        [AspectRatio.CLASSIC]: { w: 1280, h: 960 }
    }
  }
};

export const getPollinationsUrl = (
    prompt: string, 
    width: number, 
    height: number, 
    seed: number, 
    model: string = 'flux-schnell',
    refImage?: string
) => {
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 1000)); 
    let url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=${model}&t=${Date.now()}`;
    if (refImage && refImage.startsWith('http') && !refImage.includes('placehold')) {
        url += `&image=${encodeURIComponent(refImage)}&strength=0.7`; 
    }
    return url;
};

const GENRE_VIBES: Record<Genre, string> = {
  [Genre.ROMANCE_CEO]: "bright, romantic lighting, luxurious atmosphere, high fashion, k-drama vibe, soft focus, elegance",
  [Genre.REVENGE_FEMALE]: "sharp contrast, intense emotions, dramatic lighting, confident posture, power dressing, cinematic",
  [Genre.HISTORICAL_POLITICS]: "ancient chinese aesthetics, intricate costumes, grand palaces, muted earth tones, atmospheric",
  [Genre.FANTASY_XIANXIA]: "ethereal, magical glowing effects, floating fabrics, mist, pastel gradients, epic scale",
  [Genre.THRILLER_HORROR]: "film noir lighting, high contrast, shadows, dark mood, desaturated colors, psychological tension",
  [Genre.CYBERPUNK]: "neon lights, rain-slicked streets, high tech low life, vibrant cyan and magenta, futuristic details",
  [Genre.SLICE_OF_LIFE]: "warm natural lighting, cozy atmosphere, pastel colors, clean lines, comfortable, ghibli-esque"
};

// --- AI Functions ---

export const translateToEnglish = async (text: string, settings: AISettings): Promise<string> => {
    const sys = "You are a professional translator for visual AI prompts. Translate Chinese to detailed English. Output ONLY English.";
    return await callAI(text, settings, sys);
};

export const optimizePrompt = async (text: string, settings: AISettings): Promise<string> => {
    const sys = "You are an expert prompt engineer. Translate Chinese character descriptions to high-quality English comma-separated prompts. Focus on visual details. Output ONLY English.";
    return await callAI(text, settings, sys);
};

export const expandScript = async (currentScript: string, genre: Genre, settings: AISettings): Promise<string> => {
    const vibe = GENRE_VIBES[genre];
    const prompt = `Continue the script. Genre: ${genre}. Vibe: ${vibe}. Add vivid visual details and dialogue. Output ONLY continued script (Chinese, ~250 words).\nScript: "${currentScript}"`;
    return await callAI(prompt, settings);
};

export const analyzeCharacters = async (script: string, genre: Genre, settings: AISettings): Promise<Character[]> => {
  const vibe = GENRE_VIBES[genre];
  const sys = `Extract main characters. Genre: ${genre}. Vibe: ${vibe}. 
  Return a JSON array of characters.`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description_zh: { type: Type.STRING },
        prompt_en: { type: Type.STRING }
      },
      required: ["name", "description_zh", "prompt_en"]
    }
  };

  const data = await callAI(script, settings, sys, schema);
  return Array.isArray(data) ? data.map((item: any, index: number) => ({
    ...item,
    id: `char-${index}`,
    isLoading: false
  })) : [];
};

export const analyzeScenes = async (script: string, genre: Genre, settings: AISettings): Promise<Scene[]> => {
  const vibe = GENRE_VIBES[genre];
  const sys = `Extract main scenes. Genre: ${genre}. Vibe: ${vibe}. 
  Return a JSON array of scenes.`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description_zh: { type: Type.STRING },
        prompt_en: { type: Type.STRING }
      },
      required: ["name", "description_zh", "prompt_en"]
    }
  };

  const data = await callAI(script, settings, sys, schema);
  return Array.isArray(data) ? data.map((item: any, index: number) => ({
    ...item,
    id: `scene-${index}`,
    isLoading: false
  })) : [];
};

export const analyzeScript = async (
  script: string, 
  style: VisualStyle,
  characters: Character[],
  scenes: Scene[],
  settings: AISettings
): Promise<Shot[]> => {
  const sys = `Break script into cinematographic shots. Style: ${style}. 
  Characters: ${characters.map(c => c.name).join(', ')}
  Return a JSON array of shots.`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        sceneId: { type: Type.STRING },
        originalScriptSegment: { type: Type.STRING },
        dialogue: { type: Type.STRING },
        visualAction: { type: Type.STRING },
        cameraAngle: { type: Type.STRING },
        img2vidPrompt: { type: Type.STRING }
      },
      required: ["sceneId", "originalScriptSegment", "visualAction", "cameraAngle", "img2vidPrompt"]
    }
  };

  const data = await callAI(script, settings, sys, schema);
  return Array.isArray(data) ? data.map((item: any, index: number) => ({
    ...item,
    id: `shot-${Date.now()}-${index}`,
    isLoading: false,
    isError: false
  })) : [];
};

export const generateCharacterImage = async (character: Character, style: VisualStyle, seed: number, refImage?: string): Promise<string> => {
    const charSeed = seed + character.name.length * 123; 
    const prompt = `((${style})), solo, ${character.prompt_en}, high quality, detailed face`;
    const config = QUALITY_CONFIG['speed'];
    const size = config.sizes[AspectRatio.SQUARE];
    return getPollinationsUrl(prompt, size.w, size.h, charSeed, config.model, refImage);
}

export const generateSceneImage = async (scene: Scene, style: VisualStyle, seed: number, refImage?: string): Promise<string> => {
    const sceneSeed = seed + scene.name.length * 456;
    const prompt = `((${style})), scenery, no humans, ${scene.prompt_en}, wide angle, highly detailed`;
    const config = QUALITY_CONFIG['speed'];
    const size = config.sizes[AspectRatio.LANDSCAPE];
    return getPollinationsUrl(prompt, size.w, size.h, sceneSeed, config.model, refImage);
}

export const generateShotImage = async (
  shot: Shot,
  style: VisualStyle,
  aspectRatio: AspectRatio,
  allScenes: Scene[],
  allCharacters: Character[],
  seed: number,
  qualityMode: QualityMode = 'speed'
): Promise<string> => {
  const scene = allScenes.find(s => s.id === shot.sceneId);
  const scenePrompt = scene ? `background: ${scene.prompt_en}` : '';
  let charAnchor = "";
  let refImage: string | undefined = undefined;

  allCharacters.forEach(char => {
      const mentioned = shot.visualAction.includes(char.name) || (shot.dialogue && shot.dialogue.includes(char.name));
      if (mentioned) {
          charAnchor += `${char.prompt_en}, `;
          if (!refImage && char.imageUrl && char.imageUrl.startsWith('http') && !char.imageUrl.includes('placehold')) {
              refImage = char.imageUrl;
          }
      }
  });

  const prompt = `((${style})), ${charAnchor} ${shot.cameraAngle}, ${shot.img2vidPrompt}, ${scenePrompt}, cinematic lighting, masterpiece, 8k`;
  const config = QUALITY_CONFIG[qualityMode];
  const size = config.sizes[aspectRatio] || config.sizes[AspectRatio.SQUARE];
  return getPollinationsUrl(prompt, size.w, size.h, seed, config.model, refImage);
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
    // Prioritize localStorage for TTS as well
    const apiKey = localStorage.getItem('manju_api_key') || process.env.API_KEY || "";
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio generated");
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
    } catch (e: any) {
        console.error("TTS Error", e);
        throw new Error("Speech generation failed.");
    }
};
