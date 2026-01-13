
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { TextbookPage } from "../types";

const SYSTEM_INSTRUCTION = `
You are an AI assistant embedded in a textbook-based question answering application.
The user uploads textbook pages containing text and images.
Your core mission: BE A COMPLETE RETRIEVAL ENGINE. DO NOT BE A CHATBOT.

Rules for "Global Deep Search & Visual Retrieval":
1. EXHAUSTIVE SCAN: Analyze EVERY page provided. Concept progression is key. 
2. STRUCTURED SYNTHESIS: 
   - Start with "Introductory Overview" (verbatim from early chapters).
   - Follow with "Detailed Technical Analysis" (verbatim from later chapters).
   - Include any "Clinical/Practical Correlations" found further in the book.
3. VISUAL IDENTIFICATION: If a page contains a figure, diagram, or table that illustrates the topic, you MUST mention it.
4. RESPONSE FORMAT:
   - Use verbatim extracts only.
   - For every section of text, cite the page: (Page [X]).
   - AT THE VERY END OF YOUR RESPONSE, provide a list of key visual pages in this format: 
     VISUAL_REFERENCES: [Page X, Page Y]
5. NO EARLY TERMINATION: Scan all 50 pages. Do not stop at the first chapter.
6. SOURCE TAGGING: Every single fact must be followed by its page number.
7. REJECTION: Only say "Not available" if the topic is absent from all pages.

Your goal: Provide the complete textual and visual context for the topic as presented across the entire textbook.
`;

export const askGemini = async (
  question: string,
  pages: TextbookPage[],
  chatHistory: { role: string; content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const pageParts: Part[] = pages.flatMap(p => [
    {
      text: `CONTENT OF PAGE ${p.pageNumber}:\n${p.text}`
    },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: p.dataUrl.split(',')[1]
      }
    }
  ]);

  const prompt = `SEARCH REQUEST: "${question}"

IMPORTANT INSTRUCTION: 
1. This is a multi-chapter search. Do NOT stop at Chapter 1. 
2. Scan through all provided pages. 
3. Synthesis basic definitions with advanced explanations.
4. Use verbatim extracts only.
5. Identify any relevant figures or diagrams and list them at the end using the VISUAL_REFERENCES format.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            ...pageParts,
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        topP: 1,
        topK: 1
      },
    });

    return response.text || "The answer is not available in the provided textbook.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with the AI. Please try again.";
  }
};
