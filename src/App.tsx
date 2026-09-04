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
import { getDailyAnswer, getRandomAnswer, MAX_ATTEMPTS, VALID_WORDS, WORD_LENGTH } from "./words";
import { loadGame, loadStats, recordResult, saveGame, saveStats, type Stats } from "./storage";

const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
type GameMode = "daily" | "training";

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
  const dailyPuzzleId = getPuzzleId();
  const dailyAnswer = useMemo(() => getDailyAnswer(dayIndex), [dayIndex]);
  const storedGame = useMemo(() => loadGame(dailyPuzzleId), [dailyPuzzleId]);
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [trainingAnswer, setTrainingAnswer] = useState(() => getRandomAnswer(dailyAnswer));
  const [trainingPuzzleId, setTrainingPuzzleId] = useState(() => `treino-${Date.now()}`);
  const [guesses, setGuesses] = useState<string[]>(storedGame?.guesses ?? []);
  const [currentGuess, setCurrentGuess] = useState("");
  const [status, setStatus] = useState<GameStatus>(storedGame?.status ?? "playing");
  const [message, setMessage] = useState("Boa sorte na palavra de hoje.");
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [copied, setCopied] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(0);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const answer = gameMode === "daily" ? dailyAnswer : trainingAnswer;
  const puzzleId = gameMode === "daily" ? dailyPuzzleId : trainingPuzzleId;
  const isTraining = gameMode === "training";

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

    if (!VALID_WORDS.has(normalizedGuess)) {
      setMessage("Essa palavra nao esta no dicionario.");
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

    if (gameMode === "daily") {
      saveGame({ puzzleId, guesses: nextGuesses, status: nextStatus });
    }

    if (nextStatus === "won") {
      setMessage(`Mandou bem. Voce resolveu em ${nextGuesses.length}/6.`);
    } else if (nextStatus === "lost") {
      setMessage(`A palavra era ${answer}. Amanha tem mais.`);
    } else {
      setMessage("Continue testando.");
    }
  }, [answer, currentGuess, gameMode, guesses, puzzleId, status]);

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
      if (event.key === "Escape" && isRulesOpen) {
        setIsRulesOpen(false);
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isRulesOpen) {
        return;
      }

      if (event.key === "Enter" || event.key === "Backspace" || /^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRulesOpen, pressKey]);

  useEffect(() => {
    if (!hasFinished || gameMode !== "daily") {
      return;
    }

    const nextStats = recordResult(stats, puzzleId, status, guesses.length);
    if (nextStats !== stats) {
      setStats(nextStats);
      saveStats(nextStats);
    }
  }, [gameMode, guesses.length, hasFinished, puzzleId, stats, status]);

  function resetBoard(nextMode: GameMode, nextAnswer: string, nextPuzzleId: string, nextMessage: string) {
    setGameMode(nextMode);
    setTrainingAnswer(nextAnswer);
    setTrainingPuzzleId(nextPuzzleId);
    setGuesses([]);
    setCurrentGuess("");
    setSelectedColumn(0);
    setStatus("playing");
    setCopied(false);
    setMessage(nextMessage);
  }

  function startDailyGame() {
    const latestStoredGame = loadGame(dailyPuzzleId);

    setGameMode("daily");
    setGuesses(latestStoredGame?.guesses ?? []);
    setCurrentGuess("");
    setSelectedColumn(0);
    setStatus(latestStoredGame?.status ?? "playing");
    setCopied(false);
    setMessage("Boa sorte na palavra de hoje.");
  }

  function startTrainingGame() {
    resetBoard("training", getRandomAnswer(answer), `treino-${Date.now()}`, "Modo treino: tente descobrir a palavra aleatoria.");
  }

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
    const label = isTraining ? "Treino" : `#${dayIndex}`;
    const text = `Jogo de Palavras ${label} ${score}\n${blocks}`;

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
            <p className="eyebrow">{isTraining ? "Modo treino" : `Desafio diario #${dayIndex}`}</p>
            <h1>Jogo de Palavras</h1>
          </div>
          <div className="topbar-actions">
            {isTraining && (
              <button className="mode-button" type="button" onClick={startDailyGame}>
                Diario
              </button>
            )}
            <button className="mode-button primary" type="button" onClick={startTrainingGame}>
              {isTraining ? "Novo treino" : "Treino"}
            </button>
            <button className="rules-button" type="button" onClick={() => setIsRulesOpen(true)}>
              Regras
            </button>
            <div className="status-pill">{hasFinished ? "Finalizado" : "Em jogo"}</div>
          </div>
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

      {isRulesOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsRulesOpen(false)}>
          <section
            aria-labelledby="rules-title"
            aria-modal="true"
            className="rules-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="rules-title">Regras</h2>
              <button className="modal-close" type="button" aria-label="Fechar regras" onClick={() => setIsRulesOpen(false)}>
                X
              </button>
            </header>

            <p className="rules-copy">
              Descubra a palavra do dia em ate {MAX_ATTEMPTS} tentativas. Cada tentativa precisa ter {WORD_LENGTH} letras.
            </p>

            <div className="rules-list">
              <div className="rule-row">
                <span className="rule-sample correct">A</span>
                <span>Verde: letra certa no lugar certo.</span>
              </div>
              <div className="rule-row">
                <span className="rule-sample present">E</span>
                <span>Amarela: letra existe, mas esta em outro lugar.</span>
              </div>
              <div className="rule-row">
                <span className="rule-sample absent">R</span>
                <span>Cinza: letra nao existe na palavra.</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
