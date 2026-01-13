
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { TextbookData } from "../types";

const SYSTEM_INSTRUCTION = `
You are an AI assistant embedded in a multi-textbook study application.
The user uploads multiple textbook PDFs containing text and images.
Your core mission: BE A COMPLETE RETRIEVAL ENGINE ACROSS ALL BOOKS.

Rules for "Multi-Book Global Deep Search":
1. CROSS-BOOK SEARCH: Analyze EVERY page provided across ALL uploaded textbooks. 
2. SYNTHESIS: 
   - Combine introductory concepts from one book with detailed technical explanations from another if they share the same topic.
   - Organize logically: Basic concepts -> Technical details -> Practical/Clinical applications.
3. VISUAL IDENTIFICATION: Identify relevant figures or tables from any of the books.
4. RESPONSE FORMAT & ATTRIBUTION:
   - Use verbatim extracts ONLY. Do not paraphrase.
   - CITE EVERY SOURCE. Format: (Book: [Book Name], Page: [X]).
   - AT THE END, provide a list of key visual references in this format: 
     VISUAL_REFERENCES: [Book: "Name", Page: X; Book: "Name", Page: Y]
5. NO EARLY TERMINATION: Do not stop searching after finding an answer in the first book. Scan everything.
6. HONESTY: Only say "Not available" if the topic is absent from all provided pages of all books.

Goal: Provide the most comprehensive answer by pulling the best verbatim information from the entire library of provided textbooks.
`;

export const askGemini = async (
  question: string,
  textbooks: TextbookData[],
  chatHistory: { role: string; content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const pageParts: Part[] = textbooks.flatMap((book, bookIdx) => 
    book.pages.flatMap(p => [
      {
        text: `BOOK: "${book.name}" (Index: ${bookIdx}), PAGE ${p.pageNumber}:\n${p.text}`
      },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: p.dataUrl.split(',')[1]
        }
      }
    ])
  );

  const prompt = `SEARCH REQUEST: "${question}"

IMPORTANT INSTRUCTION: 
1. This is a multi-book search. You have ${textbooks.length} books available.
2. Scan through all pages of all books. 
3. Use verbatim extracts only.
4. Identify any relevant figures and list them using the VISUAL_REFERENCES format. 
5. Ensure you specify exactly which book and page each quote comes from.`;

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

    return response.text || "The answer is not available in the provided textbooks.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with the AI. Please try again.";
  }
};
