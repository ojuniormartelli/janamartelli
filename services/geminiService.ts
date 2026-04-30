
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Tenta pegar de várias formas possíveis em diferentes ambientes
    const apiKey = 
      import.meta.env.VITE_GEMINI_API_KEY || 
      (import.meta as any).env?.VITE_GEMINI_API_KEY || 
      process.env.GEMINI_API_KEY ||
      (process.env as any).VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      throw new Error("Chave API do Gemini não encontrada. Certifique-se de que a variável 'VITE_GEMINI_API_KEY' está configurada corretamente no painel da Vercel e que você fez um novo Deploy após salvá-la.");
    }
    
    // Inicializa com o objeto de configuração para maior clareza
    aiInstance = new GoogleGenAI(apiKey);
  }
  return aiInstance;
}

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
    Analise o texto abaixo que contém uma lista de produtos de um romaneio da marca 'TRIBO DO SONO'.
    Extraia individualmente cada linha de produto e mapeie para o formato JSON solicitado.
    
    Regras de Mapeamento:
    1. SKU: O número inicial antes do primeiro hífen (ex: 14697).
    2. Categoria: A primeira parte da descrição (ex: 'PIJAMA FEMININO INVERNO' ou 'PIJAMA MASCULINO VERAO').
    3. Nome do Produto: O modelo central (ex: 'CAMISA DE VISCO C/BOTOES CALCA VISCO' ou 'CAMISETA LISA C/BOLSO SHORT LISO').
    4. Variação de Modelo/Cor: O texto que vem logo após o nome e antes do tamanho (ex: 'MOCHA MOUSSE', 'GRAFITE/MARINHO', 'ROSA').
    5. Tamanho: Identifique o tamanho no final (P, M, G, GG, PP, XG, etc).
    6. Quantidade: O valor da coluna Qtd. Converta para número.
    7. Preço de Custo: O valor da coluna Unit. Converta para número decimal.

    Texto do Romaneio:
    ${text}
  `;

  try {
    const ai = getAI();
    // Usando gemini-1.5-flash que é mais estável para produção
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
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

    const result = JSON.parse(response.response.text() || "[]");
    return result as RomaneioItem[];
  } catch (error: any) {
    console.error("Erro ao processar romaneio com Gemini:", error);
    if (error.message?.includes("API key")) {
        throw new Error("Erro de Autenticação: A chave do Gemini não foi processada corretamente. Verifique se a variável VITE_GEMINI_API_KEY está visível no ambiente de build.");
    }
    throw new Error("Falha ao processar o texto do romaneio: " + error.message);
  }
}
