export type LetterStatus = "correct" | "present" | "absent";
export type GameStatus = "playing" | "won" | "lost";

export type EvaluatedLetter = {
  letter: string;
  status: LetterStatus;
};

const PRIORITY: Record<LetterStatus, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

export function normalizeWord(word: string) {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/Ç/g, "C")
    .toUpperCase();
}

export function evaluateGuess(guess: string, answer: string): EvaluatedLetter[] {
  const guessLetters = normalizeWord(guess).split("");
  const answerLetters = normalizeWord(answer).split("");
  const result: EvaluatedLetter[] = guessLetters.map((letter) => ({
    letter,
    status: "absent",
  }));
  const remaining = new Map<string, number>();

  answerLetters.forEach((letter, index) => {
    if (guessLetters[index] === letter) {
      result[index].status = "correct";
      return;
    }

    remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  });

  guessLetters.forEach((letter, index) => {
    if (result[index].status === "correct") {
      return;
    }

    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      result[index].status = "present";
      remaining.set(letter, count - 1);
    }
  });

  return result;
}

export function mergeKeyboardStatus(
  current: Record<string, LetterStatus>,
  evaluated: EvaluatedLetter[],
) {
  return evaluated.reduce<Record<string, LetterStatus>>((next, item) => {
    const previous = next[item.letter];

    if (!previous || PRIORITY[item.status] > PRIORITY[previous]) {
      next[item.letter] = item.status;
    }

    return next;
  }, { ...current });
}

export function getDayIndex(date = new Date()) {
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000);
}

export function getPuzzleId(date = new Date()) {
  return `palavra-${getDayIndex(date)}`;
}
