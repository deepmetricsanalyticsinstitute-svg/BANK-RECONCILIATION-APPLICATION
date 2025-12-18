import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from '../types';

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT' });

// Schema for transaction extraction
const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
          description: { type: Type.STRING, description: "Description or payee of the transaction" },
          amount: { type: Type.NUMBER, description: "Absolute numeric value of the transaction amount" },
          type: { type: Type.STRING, description: "Either 'credit' (deposit/income) or 'debit' (withdrawal/expense)" },
        },
        required: ["date", "description", "amount", "type"],
      },
    },
  },
};

export const parseFileWithGemini = async (
  file: File, 
  source: 'bank' | 'ledger'
): Promise<Transaction[]> => {
  try {
    const ai = getClient();
    const base64Data = await fileToBase64(file);
    const mimeType = file.type;

    const prompt = `
      Extract all financial transactions from this ${source === 'bank' ? 'Bank Statement' : 'General Ledger'} document.
      Return the data as a clean JSON list.
      Ensure all dates are converted to YYYY-MM-DD format.
      Ensure all amounts are positive numbers. Use the 'type' field to indicate credit or debit.
      Ignore headers, footers, and page numbers.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);
    
    if (!result.transactions || !Array.isArray(result.transactions)) {
      throw new Error("Invalid format returned by AI");
    }

    // Post-process to ensure IDs and Source
    return result.transactions.map((t: any, index: number) => ({
      id: `${source}-${Date.now()}-${index}`,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type.toLowerCase() as 'credit' | 'debit',
      source: source,
    }));

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to extract data from file using Gemini.");
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
