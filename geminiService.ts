
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "./types";

// Vercel/Vite 빌드 환경에서 전역 process 객체에 대한 타입 에러를 방지합니다.
declare var process: { env: { [key: string]: string | undefined } };

const getAIInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API 키가 설정되지 않았습니다. Vercel 프로젝트 설정에서 API_KEY 환경 변수를 확인해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateQuestions = async (topic: string): Promise<Question[]> => {
  const ai = getAIInstance();

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
    throw new Error("질문을 생성하는 도중 오류가 발생했습니다. AI 응답이 비어있습니다.");
  }

  try {
    const questions = JSON.parse(responseText);
    return questions;
  } catch (e) {
    console.error("Failed to parse questions", e);
    throw new Error("질문 데이터를 해석하는 도중 오류가 발생했습니다.");
  }
};

export const analyzeDecision = async (topic: string, questions: Question[], answers: Record<number, string>): Promise<string> => {
  const ai = getAIInstance();

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
