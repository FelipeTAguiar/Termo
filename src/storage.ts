import type { GameStatus } from "./game";

export type StoredGame = {
  puzzleId: string;
  guesses: string[];
  status: GameStatus;
};

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: number[];
  lastCompletedPuzzleId?: string;
};

const GAME_KEY = "jogo-palavras:game";
const STATS_KEY = "jogo-palavras:stats";

export const EMPTY_STATS: Stats = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
};

export function loadGame(puzzleId: string): StoredGame | null {
  const raw = localStorage.getItem(GAME_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredGame;
    return parsed.puzzleId === puzzleId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGame(game: StoredGame) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

export function loadStats(): Stats {
  const raw = localStorage.getItem(STATS_KEY);

  if (!raw) {
    return EMPTY_STATS;
  }

  try {
    const parsed = JSON.parse(raw) as Stats;
    return {
      ...EMPTY_STATS,
      ...parsed,
      distribution: parsed.distribution?.length === 6 ? parsed.distribution : EMPTY_STATS.distribution,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordResult(stats: Stats, puzzleId: string, status: GameStatus, attempts: number): Stats {
  if (stats.lastCompletedPuzzleId === puzzleId) {
    return stats;
  }

  const won = status === "won";
  const distribution = [...stats.distribution];

  if (won) {
    distribution[attempts - 1] += 1;
  }

  const currentStreak = won ? stats.currentStreak + 1 : 0;

  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    distribution,
    lastCompletedPuzzleId: puzzleId,
  };
}
