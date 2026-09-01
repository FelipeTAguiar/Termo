import { normalizeWord } from "./game";
import validWordsRaw from "./data/valid-words.txt?raw";

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 6;

export const ANSWERS = [
  "LIVRO",
  "CASAL",
  "PLANO",
  "VERDE",
  "MUNDO",
  "PRAIA",
  "FORCA",
  "BRISA",
  "RISCO",
  "BANCO",
  "FESTA",
  "SONHO",
  "TARDE",
  "NORTE",
  "FOLHA",
  "CHAVE",
  "LINHA",
  "PEDRA",
  "CLARO",
  "VISTO",
  "CANTO",
  "CAMPO",
  "JOVEM",
  "PONTE",
  "TEMPO",
  "SORTE",
  "NUVEM",
  "PISTA",
  "GRUPO",
  "BICHO",
  "FEIRA",
  "CORPO",
  "FALHA",
  "CUSTO",
  "CAIXA",
  "MOTOR",
  "PONTO",
  "CIVIL",
  "DOBRA",
  "AREIA",
  "MISTO",
  "CARTA",
  "TRAMA",
  "SALTO",
  "FIRME",
  "ROCHA",
  "FRASE",
  "METAL",
  "POSTE",
  "LUGAR",
  "VALOR",
  "PARTE",
  "NOITE",
  "JEITO",
  "PODER",
  "TELHA",
  "MORAL",
  "TEXTO",
  "ROSTO",
  "BRAVO",
  "PORTA",
  "FLORA",
  "VINHO",
  "GOSTO",
  "LARGO",
  "VENTO",
  "CULPA",
  "TERRA",
  "CENAS",
  "DENTE",
  "RITMO",
  "LESTE",
  "JUSTO",
  "SINAL",
  "FONTE",
  "LENTO",
  "MAGRO",
  "PRATO",
  "QUEDA",
  "RAIVA",
  "RUMOR",
  "SABOR",
  "TINTA",
  "UNIAO",
  "VELHO",
  "ZEBRA",
  "ALTAR",
  "BEIJO",
  "CINTO",
  "DANCA",
  "ETAPA",
  "FAROL",
  "GANHO",
  "HONRA",
  "IDADE",
  "JUNTO",
  "LIMPO",
  "MARCA",
  "NAVIO",
  "ORDEM",
  "POETA",
];

const DICTIONARY_WORDS = validWordsRaw
  .split(/\s+/)
  .map(normalizeWord)
  .filter((word) => word.length === WORD_LENGTH);

export const VALID_WORDS = new Set(
  [...ANSWERS, ...DICTIONARY_WORDS]
    .map(normalizeWord)
    .filter((word) => word.length === WORD_LENGTH),
);

export const VALID_WORD_COUNT = VALID_WORDS.size;

export function getDailyAnswer(dayIndex: number) {
  const normalizedIndex = ((dayIndex % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return ANSWERS[normalizedIndex];
}
