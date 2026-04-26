const state = {
  questionsByLevel: {},
  usedByLevel: { "1": new Set(), "2": new Set(), "3": new Set() },
  currentLevel: null,
  currentQuestion: null,
  currentQuestionIndex: null,
  questionLocked: false,
  returnTimer: null,
  loaded: false,
};

const SIMILARITY_THRESHOLD = 0.78;

const els = {
  menu: document.getElementById("menu"),
  game: document.getElementById("game"),
  menuText: document.getElementById("menuText"),
  question: document.getElementById("question"),
  answers: document.getElementById("answers"),
  result: document.getElementById("result"),
  status: document.getElementById("status"),
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?\'"“”„()\[\]{}\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitUserList(value) {
  return String(value || "")
    .split(/[\n,;/]+/)
    .map((s) => normalize(s))
    .filter(Boolean);
}

function levenshtein(a, b) {
  const left = normalize(a);
  const right = normalize(b);

  const matrix = Array.from({ length: right.length + 1 }, () => []);
  for (let i = 0; i <= right.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= left.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= right.length; i += 1) {
    for (let j = 1; j <= left.length; j += 1) {
      const cost = left[j - 1] === right[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[right.length][left.length];
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);

  if (!left && !right) return 1;
  const longer = Math.max(left.length, right.length);
  if (longer === 0) return 1;

  return (longer - levenshtein(left, right)) / longer;
}

function showStatus(message, timeout = 2500) {
  if (!els.status) return;

  els.status.innerText = message;
  clearTimeout(showStatus._timer);
  if (timeout > 0) {
    showStatus._timer = setTimeout(() => {
      els.status.innerText = "";
    }, timeout);
  }
}

function setMenuVisible(isVisible) {
  els.menu.style.display = isVisible ? "block" : "none";
  els.game.style.display = isVisible ? "none" : "block";
}

function disableCurrentInputs() {
  els.answers.querySelectorAll("button, input, textarea").forEach((node) => {
    node.disabled = true;
  });
}

function scheduleReturn(ms = 3000) {
  clearTimeout(state.returnTimer);
  state.returnTimer = setTimeout(() => {
    backToMenu();
  }, ms);
}

function ensureLoaded() {
  if (state.loaded) return true;
  showStatus("Fragen werden noch geladen. Bitte kurz warten.");
  return false;
}

function getQuestionsForLevel(level) {
  return Array.isArray(state.questionsByLevel[level])
    ? state.questionsByLevel[level]
    : [];
}

function pickRandomUnusedQuestion(level) {
  const all = getQuestionsForLevel(level);
  const used = state.usedByLevel[level] || new Set();
  const availableIndexes = all
    .map((_, index) => index)
    .filter((index) => !used.has(index));

  if (availableIndexes.length === 0) {
    return null;
  }

  const randomIndex =
    availableIndexes[Math.floor(Math.random() * availableIndexes.length)];

  used.add(randomIndex);
  state.usedByLevel[level] = used;

  return { index: randomIndex, question: all[randomIndex] };
}

function renderMc(question) {
  (question.antworten || []).forEach((answer, idx) => {
    const button = document.createElement("button");
    button.innerText = answer;
    button.type = "button";
    button.addEventListener("click", () => checkMcAnswer(idx));
    els.answers.appendChild(button);
  });
}

function renderTextInput({ multiline = false, placeholder = "Antwort eingeben", onCheck, buttonLabel = "Antwort prüfen" }) {
  const input = document.createElement(multiline ? "textarea" : "input");
  input.id = "textAnswer";
  input.placeholder = placeholder;

  if (multiline) {
    input.rows = 4;
    input.cols = 40;
  } else {
    input.type = "text";
    input.autocomplete = "off";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onCheck();
      }
    });
  }

  const button = document.createElement("button");
  button.type = "button";
  button.innerText = buttonLabel;
  button.addEventListener("click", onCheck);

  els.answers.appendChild(input);
  els.answers.appendChild(button);
}

function renderQuestion(question) {
  els.question.innerText = question.frage || "Frage";
  els.answers.innerHTML = "";
  els.result.innerText = "";

  switch (question.type) {
    case "mc":
      renderMc(question);
      break;
    case "multi":
      renderTextInput({
        multiline: true,
        placeholder: "Mehrere Antworten mit Komma oder Zeilenumbruch trennen",
        onCheck: checkMultiAnswer,
      });
      break;
    case "free":
      renderTextInput({
        multiline: true,
        placeholder: "Freie Antwort eingeben",
        buttonLabel: "Antwort speichern",
        onCheck: checkOpenAnswer,
      });
      break;
    case "manual":
      renderTextInput({
        multiline: true,
        placeholder: "Antwort oder Analyse eingeben",
        buttonLabel: "Lösung anzeigen",
        onCheck: checkOpenAnswer,
      });
      break;
    case "text":
    default:
      renderTextInput({ onCheck: checkTextAnswer });
      break;
  }
}

function showResultAndReturn(message, ms = 3000) {
  els.result.innerText = message;
  scheduleReturn(ms);
}

function startGame(level) {
  const normalizedLevel = String(level);
  if (!ensureLoaded()) return;

  if (!state.questionsByLevel[normalizedLevel]) {
    showStatus(`Unbekanntes Level: ${normalizedLevel}`);
    return;
  }

  clearTimeout(state.returnTimer);
  state.currentLevel = normalizedLevel;
  state.questionLocked = false;

  setMenuVisible(false);
  loadQuestion();
}

function loadQuestion() {
  const picked = pickRandomUnusedQuestion(state.currentLevel);
  if (!picked) {
    els.result.innerText = "Alle Fragen in diesem Level wurden benutzt.";
    scheduleReturn(2200);
    return;
  }

  state.currentQuestion = picked.question;
  state.currentQuestionIndex = picked.index;
  state.questionLocked = false;

  renderQuestion(state.currentQuestion);
}

function checkMcAnswer(index) {
  if (state.questionLocked || !state.currentQuestion) return;
  state.questionLocked = true;
  disableCurrentInputs();

  const correctIndex = Number(state.currentQuestion.correct);
  if (index === correctIndex) {
    showResultAndReturn("Richtig!");
    return;
  }

  const answers = state.currentQuestion.antworten || [];
  const correctAnswer = answers[correctIndex] || "(keine hinterlegt)";
  showResultAndReturn(`Falsch! Richtige Antwort: ${correctAnswer}`);
}

function checkTextAnswer() {
  if (state.questionLocked || !state.currentQuestion) return;
  state.questionLocked = true;
  disableCurrentInputs();

  const userValue = document.getElementById("textAnswer")?.value || "";
  const correctAnswer = state.currentQuestion.answer || "";
  const accepted = Array.isArray(state.currentQuestion.accepted)
    ? state.currentQuestion.accepted
    : [];

  const allCandidates = [correctAnswer, ...accepted]
    .filter(Boolean)
    .map((value) => normalize(value));

  const isCorrect = allCandidates.some((candidate) => {
    const userNorm = normalize(userValue);
    return (
      userNorm === candidate || similarity(userNorm, candidate) >= SIMILARITY_THRESHOLD
    );
  });

  if (isCorrect) {
    showResultAndReturn("Richtig!");
  } else {
    showResultAndReturn(`Falsch! Richtige Antwort: ${correctAnswer || "(keine hinterlegt)"}`);
  }
}

function checkMultiAnswer() {
  if (state.questionLocked || !state.currentQuestion) return;
  state.questionLocked = true;
  disableCurrentInputs();

  const userAnswers = splitUserList(document.getElementById("textAnswer")?.value || "");
  const accepted = (state.currentQuestion.accepted || []).map((a) => normalize(a));
  const minCorrect = Number(state.currentQuestion.minCorrect || 1);

  let correctCount = 0;
  const usedCandidates = new Set();

  userAnswers.forEach((user) => {
    const match = accepted.find(
      (candidate) =>
        !usedCandidates.has(candidate) &&
        (user === candidate || similarity(user, candidate) >= SIMILARITY_THRESHOLD)
    );

    if (match) {
      usedCandidates.add(match);
      correctCount += 1;
    }
  });

  if (correctCount >= minCorrect) {
    showResultAndReturn(`Richtig! (${correctCount}/${minCorrect})`);
  } else {
    const modelAnswer = state.currentQuestion.modelAnswer || "Keine Beispielantwort hinterlegt.";
    showResultAndReturn(
      `Noch nicht genug richtige Antworten (${correctCount}/${minCorrect}). Beispiel: ${modelAnswer}`
    );
  }
}

function checkOpenAnswer() {
  if (state.questionLocked || !state.currentQuestion) return;
  state.questionLocked = true;
  disableCurrentInputs();

  const model = state.currentQuestion.modelAnswer
    ? `\nHinweis: ${state.currentQuestion.modelAnswer}`
    : "";

  showResultAndReturn(`Antwort übernommen.${model}`, 3600);
}

function backToMenu() {
  clearTimeout(state.returnTimer);
  state.returnTimer = null;
  state.questionLocked = false;
  state.currentQuestion = null;
  state.currentQuestionIndex = null;

  els.question.innerText = "";
  els.answers.innerHTML = "";
  els.result.innerText = "";
  els.menuText.innerText = "Wähle einen Stapel / ein Level.";

  setMenuVisible(true);
}

function resetGame() {
  state.usedByLevel = { "1": new Set(), "2": new Set(), "3": new Set() };
  state.currentLevel = null;

  backToMenu();
  showStatus("Spiel wurde zurückgesetzt.");
}

function init() {
  showStatus("Lade Fragen ...", 0);

  fetch("questions.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      state.questionsByLevel = data || {};
      state.loaded = true;
      showStatus("Fragen geladen.");
    })
    .catch((err) => {
      console.error("Fehler beim Laden von questions.json:", err);
      showStatus("Fragen konnten nicht geladen werden.", 5000);
    });
}

window.startGame = startGame;
window.resetGame = resetGame;

init();
