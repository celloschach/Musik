let questions = {};
let usedQuestions = { "1": [], "2": [], "3": [] };

let currentLevel = null;
let currentQuestion = null;
let questionLocked = false;
let returnTimer = null;
let statusTimer = null;

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq, duration = 0.12, type = "sine", gainValue = 0.04, when = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + when);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + duration + 0.02);
}

function soundClick() {
  playTone(520, 0.05, "triangle", 0.03);
}

function soundCorrect() {
  playTone(523.25, 0.10, "triangle", 0.05, 0.00);
  playTone(659.25, 0.10, "triangle", 0.05, 0.10);
  playTone(783.99, 0.14, "triangle", 0.05, 0.20);
}

function soundWrong() {
  playTone(220, 0.12, "sawtooth", 0.04, 0.00);
  playTone(185, 0.14, "sawtooth", 0.04, 0.12);
}

function soundReset() {
  playTone(392, 0.08, "sine", 0.035, 0.00);
  playTone(330, 0.08, "sine", 0.035, 0.09);
  playTone(262, 0.10, "sine", 0.035, 0.18);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?'"“”„()[\]{}\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitUserList(value) {
  return String(value || "")
    .split(/[\n,;/]+/)
    .map(s => normalize(s))
    .filter(Boolean);
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);

  const matrix = Array.from({ length: b.length + 1 }, () => []);
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);

  if (!a && !b) return 1;
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;

  const distance = levenshtein(a, b);
  return (longer - distance) / longer;
}

function matchesTextAnswer(userInput, correctAnswer, acceptedAnswers = []) {
  const user = normalize(userInput);
  const candidates = [correctAnswer, ...acceptedAnswers].filter(Boolean).map(normalize);

  for (const candidate of candidates) {
    if (user === candidate) return true;
    const sim = similarity(user, candidate);
    const shortEnough = Math.max(user.length, candidate.length) <= 12;
    if ((shortEnough && sim >= 0.72) || (!shortEnough && sim >= 0.78)) return true;
  }

  return false;
}

function showStatus(message, good = true) {
  const statusEl = document.getElementById("statusText");
  const badgeEl = document.getElementById("statusBadge");
  if (!statusEl || !badgeEl) return;

  statusEl.innerText = message;
  badgeEl.innerText = message;

  statusEl.style.color = good ? "var(--accent2)" : "var(--danger)";
  badgeEl.style.background = good
    ? "linear-gradient(135deg, rgba(105,226,195,0.25), rgba(255,255,255,0.08))"
    : "linear-gradient(135deg, rgba(255,101,122,0.25), rgba(255,255,255,0.08))";

  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (statusEl.innerText === message) {
      statusEl.innerText = "";
      badgeEl.innerText = "Bereit";
      badgeEl.style.background = "rgba(255,255,255,0.08)";
    }
  }, 2500);
}

function clearTimers() {
  clearTimeout(returnTimer);
  returnTimer = null;
  clearTimeout(statusTimer);
  statusTimer = null;
}

fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questions = data;
    updateMenuCounts();
    showStatus("Fragen geladen.");
  })
  .catch(err => {
    console.error("Fehler beim Laden von questions.json:", err);
    showStatus("Fragen konnten nicht geladen werden.", false);
  });

function updateMenuCounts() {
  ["1", "2", "3"].forEach(level => {
    const total = (questions[level] || []).length;
    const used = usedQuestions[level].length;
    const remaining = Math.max(0, total - used);
    const el = document.getElementById(`remaining-${level}`);
    if (el) {
      el.innerText = `${remaining} Fragen übrig`;
    }
  });
  updateProgressPill();
}

function updateProgressPill() {
  const pill = document.getElementById("progressPill");
  if (!pill || currentLevel === null) return;
  const total = (questions[currentLevel] || []).length;
  const used = usedQuestions[currentLevel].length;
  const remaining = Math.max(0, total - used);
  pill.innerText = `${remaining} übrig`;
}

function startGame(level) {
  ensureAudio();
  soundClick();

  currentLevel = String(level);

  if (!questions[currentLevel]) {
    showStatus("Fragen werden noch geladen. Bitte kurz warten.", false);
    return;
  }

  clearTimers();
  questionLocked = false;

  document.getElementById("menu").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  const levelNames = { "1": "Level 1", "2": "Mittel", "3": "Schwer" };
  document.getElementById("levelPill").innerText = levelNames[currentLevel] || "Level";
  updateProgressPill();

  document.getElementById("result").className = "result-box";
  document.getElementById("result").innerText = "";

  loadQuestion();
}

function getRandomQuestion(level) {
  const all = questions[level] || [];
  const available = all.filter((_, i) => !usedQuestions[level].includes(i));

  if (available.length === 0) {
    document.getElementById("result").className = "result-box fail";
    document.getElementById("result").innerText = "Alle Fragen in diesem Level wurden benutzt.";
    soundWrong();
    returnTimer = setTimeout(backToMenu, 2000);
    return null;
  }

  const q = available[Math.floor(Math.random() * available.length)];
  const index = all.indexOf(q);
  usedQuestions[level].push(index);
  return q;
}

function loadQuestion() {
  const q = getRandomQuestion(currentLevel);
  if (!q) return;

  currentQuestion = q;
  questionLocked = false;

  const questionEl = document.getElementById("question");
  const hintEl = document.getElementById("questionHint");
  const answersEl = document.getElementById("answers");
  const resultEl = document.getElementById("result");

  questionEl.innerText = q.frage;
  resultEl.innerText = "";
  resultEl.className = "result-box";
  answersEl.innerHTML = "";

  if (q.type === "mc") {
    hintEl.innerText = "Wähle eine Antwort.";
    q.antworten.forEach((answer, i) => {
      const btn = document.createElement("button");
      btn.innerText = answer;
      btn.onclick = () => {
        ensureAudio();
        soundClick();
        checkMcAnswer(i);
      };
      answersEl.appendChild(btn);
    });
  } else if (q.type === "multi") {
    hintEl.innerText = `Mehrfachantwort: mindestens ${q.minCorrect || 1} richtige Begriffe.`;
    const input = document.createElement("textarea");
    input.id = "textAnswer";
    input.rows = 4;
    input.placeholder = "Mehrere Antworten mit Komma oder Zeilenumbruch trennen";
    answersEl.appendChild(input);

    const row = document.createElement("div");
    row.className = "submit-row";

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = () => {
      ensureAudio();
      soundClick();
      checkMultiAnswer();
    };

    row.appendChild(btn);
    answersEl.appendChild(row);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        ensureAudio();
        soundClick();
        checkMultiAnswer();
      }
    });
  } else {
    hintEl.innerText = "Freitext-Frage.";
    const input = document.createElement("input");
    input.id = "textAnswer";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Antwort eingeben";
    answersEl.appendChild(input);

    const row = document.createElement("div");
    row.className = "submit-row";

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = () => {
      ensureAudio();
      soundClick();
      checkTextAnswer();
    };

    row.appendChild(btn);
    answersEl.appendChild(row);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        ensureAudio();
        soundClick();
        checkTextAnswer();
      }
    });
  }
}

function finishRound(message, success) {
  const resultEl = document.getElementById("result");
  resultEl.className = success ? "result-box success" : "result-box fail";
  resultEl.innerText = message;

  disableAllInputs();
  if (success) {
    soundCorrect();
  } else {
    soundWrong();
  }

  updateMenuCounts();
  returnTimer = setTimeout(backToMenu, 3000);
}

function checkMcAnswer(index) {
  if (questionLocked) return;
  questionLocked = true;

  const correctIndex = currentQuestion.correct;
  if (index === correctIndex) {
    finishRound("Richtig!", true);
  } else {
    finishRound("Falsch! Richtige Antwort: " + currentQuestion.antworten[correctIndex], false);
  }
}

function checkTextAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  const inputEl = document.getElementById("textAnswer");
  const userValue = inputEl ? inputEl.value : "";
  const correctAnswer = currentQuestion.answer || "";
  const accepted = currentQuestion.accepted || [];

  if (currentQuestion.type === "free" || currentQuestion.type === "manual") {
    const shown = currentQuestion.modelAnswer || "Offene Frage.";
    finishRound("Antwort übernommen. Beispiel: " + shown, true);
    return;
  }

  if (matchesTextAnswer(userValue, correctAnswer, accepted)) {
    finishRound("Richtig!", true);
  } else {
    finishRound("Falsch! Richtige Antwort: " + correctAnswer, false);
  }
}

function checkMultiAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  const inputEl = document.getElementById("textAnswer");
  const userAnswers = splitUserList(inputEl ? inputEl.value : "");
  const accepted = (currentQuestion.accepted || []).map(normalize);
  const minCorrect = currentQuestion.minCorrect || 1;

  let correctCount = 0;
  const used = new Set();

  for (const user of userAnswers) {
    for (const candidate of accepted) {
      if (!used.has(candidate) && similarity(user, candidate) >= 0.78) {
        used.add(candidate);
        correctCount++;
        break;
      }
    }
  }

  if (correctCount >= minCorrect) {
    finishRound("Richtig!", true);
  } else {
    finishRound("Falsch! Beispielantwort: " + currentQuestion.modelAnswer, false);
  }
}

function disableAllInputs() {
  document.querySelectorAll("#answers button").forEach(btn => btn.disabled = true);
  const input = document.getElementById("textAnswer");
  if (input) input.disabled = true;
}

function backToMenu() {
  clearTimers();
  questionLocked = false;

  document.getElementById("game").classList.add("hidden");
  document.getElementById("menu").classList.remove("hidden");
  document.getElementById("question").innerText = "";
  document.getElementById("questionHint").innerText = "";
  document.getElementById("answers").innerHTML = "";
  document.getElementById("result").innerText = "";
  document.getElementById("result").className = "result-box";
  document.getElementById("levelPill").innerText = "Level";
  updateMenuCounts();
  showStatus("Zurück zur Auswahl.");
}

function resetGame() {
  ensureAudio();
  soundReset();

  usedQuestions = { "1": [], "2": [], "3": [] };
  questionLocked = false;

  backToMenu();
  showStatus("Reset funktioniert.");
}

document.addEventListener("pointerdown", ensureAudio, { once: true });

