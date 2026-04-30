
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface RomaneioItem {
  sku: string;
  category: string;
  name: string;
  variant: string;
  size: string;
  cost: number;
  quantity: number;
}

export async function parseRomaneioText(text: string): Promise<RomaneioItem[]> {
  const prompt = `
    Analise o texto abaixo que contém uma lista de produtos de um romaneio.
    Extraia individualmente cada linha de produto e mapeie para o formato JSON solicitado.
    
    Regras de Mapeamento:
    1. SKU: O número inicial antes do primeiro hífen (ex: 14697).
    2. Categoria: A primeira parte da descrição que se repete em vários itens (ex: 'PIJAMA FEMININO INVERNO').
    3. Nome do Produto: A parte central da descrição, que identifica o modelo da peça (ex: 'CAMISA DE VISCO C/BOTOES CALCA VISCO').
    4. Variação de Modelo/Cor: O texto que vem logo após o nome e antes do tamanho (ex: 'MOCHA MOUSSE').
    5. Tamanho: Geralmente a última letra ou combinação de letras no final da descrição (P, M, G, GG, PP, XG, etc).
    6. Quantidade: O valor da coluna Qtd (geralmente formatado como 1,000). Converta para número inteiro.
    7. Preço de Custo: O valor da coluna Unit (ex: 125,90). Converta para número decimal.

    Texto do Romaneio:
    ${text}
  `;

  try {
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
              sku: { type: Type.STRING },
              category: { type: Type.STRING },
              name: { type: Type.STRING },
              variant: { type: Type.STRING },
              size: { type: Type.STRING },
              cost: { type: Type.NUMBER },
              quantity: { type: Type.NUMBER },
            },
            required: ["sku", "category", "name", "variant", "size", "cost", "quantity"],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result as RomaneioItem[];
  } catch (error) {
    console.error("Erro ao processar romaneio com Gemini:", error);
    throw new Error("Falha ao processar o texto do romaneio.");
  }
}
