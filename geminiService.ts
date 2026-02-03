
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "./types";

/**
 * 최신 API 키를 사용하여 GoogleGenAI 인스턴스를 생성합니다.
 * 시스템 가이드라인에 따라 process.env.API_KEY를 직접 사용합니다.
 */
const createAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
    throw new Error("서비스 구성이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateQuestions = async (topic: string): Promise<Question[]> => {
  const ai = createAI();

  const prompt = `I want to make a decision about: "${topic}". 
  Please generate exactly 20 multiple-choice questions to help me narrow down the best decision. 
  Each question should have 3 to 4 clear options. 
  The questions should range from practical needs, personal preferences, budget, long-term goals, and situational context relevant to "${topic}".`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            text: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["id", "text", "options"],
          propertyOrdering: ["id", "text", "options"]
        }
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("분석을 위한 질문을 생성하지 못했습니다.");
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    throw new Error("데이터 해석 중 오류가 발생했습니다.");
  }
};

export const analyzeDecision = async (topic: string, questions: Question[], answers: Record<number, string>): Promise<string> => {
  const ai = createAI();

  const context = questions.map(q => `Q: ${q.text} | A: ${answers[q.id]}`).join('\n');
  const prompt = `The user wants to decide on: "${topic}".
  Here are 20 questions and the user's answers:
  ${context}
  
  Based on these specific answers, provide a comprehensive and helpful final decision. 
  Break it down into:
  1. The Final Recommendation (Bold and clear)
  2. Reasoning (Why this choice suits the user's answers)
  3. Pros and Cons of this choice
  4. Next Steps or Advice.
  
  Please write in a professional yet friendly tone in Korean.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
  });

  return response.text || "결과를 도출할 수 없습니다.";
};
