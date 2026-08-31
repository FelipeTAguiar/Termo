import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  evaluateGuess,
  getDayIndex,
  getPuzzleId,
  mergeKeyboardStatus,
  normalizeWord,
  type GameStatus,
  type LetterStatus,
} from "./game";
import { getDailyAnswer, MAX_ATTEMPTS, WORD_LENGTH } from "./words";
import { loadGame, loadStats, recordResult, saveGame, saveStats, type Stats } from "./storage";

const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const STATUS_LABEL: Record<LetterStatus, string> = {
  correct: "certa",
  present: "presente",
  absent: "ausente",
};

function createEmptyRows(guesses: string[], currentGuess: string) {
  return Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
    if (rowIndex < guesses.length) {
      return getGuessSlots(guesses[rowIndex]);
    }

    if (rowIndex === guesses.length) {
      return getGuessSlots(currentGuess);
    }

    return Array.from({ length: WORD_LENGTH }, () => " ");
  });
}

function getGuessSlots(guess: string) {
  return guess.padEnd(WORD_LENGTH, " ").slice(0, WORD_LENGTH).split("");
}

function slotsToGuess(slots: string[]) {
  return slots.join("").replace(/\s+$/g, "");
}

function getNextMidnightLabel() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return tomorrow.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const dayIndex = getDayIndex();
  const puzzleId = getPuzzleId();
  const answer = useMemo(() => getDailyAnswer(dayIndex), [dayIndex]);
  const storedGame = useMemo(() => loadGame(puzzleId), [puzzleId]);
  const [guesses, setGuesses] = useState<string[]>(storedGame?.guesses ?? []);
  const [currentGuess, setCurrentGuess] = useState("");
  const [status, setStatus] = useState<GameStatus>(storedGame?.status ?? "playing");
  const [message, setMessage] = useState("Boa sorte na palavra de hoje.");
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [copied, setCopied] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(0);

  const keyboardStatus = useMemo(() => {
    return guesses.reduce<Record<string, LetterStatus>>((current, guess) => {
      return mergeKeyboardStatus(current, evaluateGuess(guess, answer));
    }, {});
  }, [answer, guesses]);

  const rows = createEmptyRows(guesses, currentGuess);
  const hasFinished = status !== "playing";

  const commitGuess = useCallback(() => {
    if (status !== "playing") {
      return;
    }

    const currentLetters = getGuessSlots(currentGuess);
    const normalizedGuess = normalizeWord(currentLetters.join(""));

    if (currentLetters.some((letter) => !letter.trim())) {
      setMessage("Preencha os 5 quadros antes de enviar.");
      setSelectedColumn(currentLetters.findIndex((letter) => !letter.trim()));
      return;
    }

    if (!/^[A-Z]{5}$/.test(normalizedGuess)) {
      setMessage("Use apenas letras.");
      return;
    }

    const nextGuesses = [...guesses, normalizedGuess];
    const nextStatus =
      normalizedGuess === answer
        ? "won"
        : nextGuesses.length === MAX_ATTEMPTS
          ? "lost"
          : "playing";

    setGuesses(nextGuesses);
    setCurrentGuess("");
    setSelectedColumn(0);
    setStatus(nextStatus);
    saveGame({ puzzleId, guesses: nextGuesses, status: nextStatus });

    if (nextStatus === "won") {
      setMessage(`Mandou bem. Voce resolveu em ${nextGuesses.length}/6.`);
    } else if (nextStatus === "lost") {
      setMessage(`A palavra era ${answer}. Amanha tem mais.`);
    } else {
      setMessage("Continue testando.");
    }
  }, [answer, currentGuess, guesses, puzzleId, status]);

  const pressKey = useCallback(
    (key: string) => {
      if (status !== "playing") {
        return;
      }

      if (key === "Enter") {
        commitGuess();
        return;
      }

      if (key === "Backspace") {
        setCurrentGuess((guess) => {
          const letters = getGuessSlots(guess);
          const shouldMoveBack = !letters[selectedColumn].trim() && selectedColumn > 0;
          const targetColumn = shouldMoveBack ? selectedColumn - 1 : selectedColumn;

          letters[targetColumn] = " ";

          if (shouldMoveBack) {
            setSelectedColumn(targetColumn);
          }

          return slotsToGuess(letters);
        });
        return;
      }

      const normalized = normalizeWord(key);
      if (/^[A-Z]$/.test(normalized)) {
        setCurrentGuess((guess) => {
          const letters = getGuessSlots(guess);
          letters[selectedColumn] = normalized;
          return slotsToGuess(letters);
        });
        setSelectedColumn((column) => Math.min(WORD_LENGTH - 1, column + 1));
      }
    },
    [commitGuess, selectedColumn, status],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === "Enter" || event.key === "Backspace" || /^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressKey]);

  useEffect(() => {
    if (!hasFinished) {
      return;
    }

    const nextStats = recordResult(stats, puzzleId, status, guesses.length);
    if (nextStats !== stats) {
      setStats(nextStats);
      saveStats(nextStats);
    }
  }, [guesses.length, hasFinished, puzzleId, stats, status]);

  async function shareResult() {
    const blocks = guesses
      .map((guess) =>
        evaluateGuess(guess, answer)
          .map((item) => {
            if (item.status === "correct") return "🟩";
            if (item.status === "present") return "🟨";
            return "⬛";
          })
          .join(""),
      )
      .join("\n");
    const score = status === "won" ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const text = `Jogo de Palavras #${dayIndex} ${score}\n${blocks}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setMessage("Resultado copiado.");
    window.setTimeout(() => setCopied(false), 2000);
  }

  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDistribution = Math.max(1, ...stats.distribution);

  return (
    <main className="app-shell">
      <aside className="corner-panel left-panel" aria-label="Distribuicao de tentativas">
        <section className="distribution">
          <h2>Distribuicao</h2>
          {stats.distribution.map((count, index) => (
            <div className="bar-row" key={index}>
              <span>{index + 1}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.max(10, (count / maxDistribution) * 100)}%` }}>
                  {count}
                </div>
              </div>
            </div>
          ))}
        </section>
      </aside>

      <section className="game-panel" aria-label="Jogo de palavras diario">
        <header className="topbar">
          <div>
            <p className="eyebrow">Desafio diario #{dayIndex}</p>
            <h1>Jogo de Palavras</h1>
          </div>
          <div className="status-pill">{hasFinished ? "Finalizado" : "Em jogo"}</div>
        </header>

        <div className="board" aria-label="Tabuleiro">
          {rows.map((row, rowIndex) => {
            const evaluated = rowIndex < guesses.length ? evaluateGuess(guesses[rowIndex], answer) : null;

            return (
              <div className="board-row" key={rowIndex}>
                {row.map((letter, columnIndex) => {
                  const statusClass = evaluated?.[columnIndex].status;
                  const label = statusClass
                    ? `${letter}, ${STATUS_LABEL[statusClass]}`
                    : letter.trim()
                      ? letter
                      : "vazio";

                  return (
                    <button
                      type="button"
                      aria-label={label}
                      className={`tile ${statusClass ?? ""} ${letter.trim() ? "filled" : ""} ${
                        rowIndex === guesses.length && status === "playing" ? "selectable" : ""
                      } ${rowIndex === guesses.length && selectedColumn === columnIndex && status === "playing" ? "selected" : ""}`}
                      key={`${rowIndex}-${columnIndex}`}
                      onClick={() => {
                        if (rowIndex === guesses.length && status === "playing") {
                          setSelectedColumn(columnIndex);
                        }
                      }}
                      tabIndex={rowIndex === guesses.length && status === "playing" ? 0 : -1}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <p className="message" role="status">
          {message}
        </p>

        <div className="keyboard" aria-label="Teclado virtual">
          {KEYS.map((row, index) => (
            <div className="key-row" key={row}>
              {index === 2 && (
                <button className="key wide" type="button" onClick={() => pressKey("Enter")}>
                  Enter
                </button>
              )}
              {row.split("").map((key) => (
                <button
                  className={`key ${keyboardStatus[key] ?? ""}`}
                  key={key}
                  type="button"
                  onClick={() => pressKey(key)}
                  aria-label={`Letra ${key}`}
                >
                  {key}
                </button>
              ))}
              {index === 2 && (
                <button className="key wide" type="button" onClick={() => pressKey("Backspace")}>
                  Apagar
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <aside className="corner-panel right-panel" aria-label="Estatisticas">
        <div className="daily-card">
          <span className="mini-label">Proxima palavra</span>
          <strong>{getNextMidnightLabel()}</strong>
        </div>

        <section className="stats-grid" aria-label="Resumo">
          <div>
            <strong>{stats.played}</strong>
            <span>jogos</span>
          </div>
          <div>
            <strong>{winRate}%</strong>
            <span>vitorias</span>
          </div>
          <div>
            <strong>{stats.currentStreak}</strong>
            <span>sequencia</span>
          </div>
          <div>
            <strong>{stats.bestStreak}</strong>
            <span>recorde</span>
          </div>
        </section>

        <button className="share-button" type="button" disabled={!hasFinished} onClick={shareResult}>
          {copied ? "Copiado" : "Compartilhar resultado"}
        </button>
      </aside>
    </main>
  );
}
