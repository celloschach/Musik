let questions = {};
let usedQuestions = { "1": [], "2": [], "3": [] };
let currentLevel = null;
let currentQuestion = null;
let questionLocked = false;
let returnTimer = null;
let statusTimer = null;
let audioCtx = null;
let solutionVisible = false;

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

function tokenize(text) {
  return normalize(text).split(" ").filter(Boolean);
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

function displayName(level) {
  if (level === "1") return "Einfach";
  if (level === "2") return "Mittel";
  if (level === "3") return "Schwer";
  return "Level";
}

function clearTimers() {
  clearTimeout(returnTimer);
  returnTimer = null;
  clearTimeout(statusTimer);
  statusTimer = null;
}

function showStatus(message, good = true) {
  const statusEl = document.getElementById("statusText");
  const badgeEl = document.getElementById("statusBadge");
  if (!statusEl || !badgeEl) return;

  statusEl.innerText = message;
  badgeEl.innerText = message;

  statusEl.style.color = good ? "#69e2c3" : "#ff657a";
  badgeEl.style.background = good
    ? "linear-gradient(135deg,rgba(105,226,195,.25),rgba(255,255,255,.08))"
    : "linear-gradient(135deg,rgba(255,101,122,.25),rgba(255,255,255,.08))";

  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (statusEl.innerText === message) {
      statusEl.innerText = "";
      badgeEl.innerText = "Bereit";
      badgeEl.style.background = "rgba(255,255,255,.08)";
    }
  }, 2500);
}

function updateMenuCounts() {
  ["1", "2", "3"].forEach(level => {
    const total = (questions[level] || []).length;
    const used = usedQuestions[level].length;
    const el = document.getElementById(`remaining-${level}`);
    if (el) el.innerText = `${Math.max(0, total - used)} Fragen übrig`;
  });
  updateProgressPill();
}

function updateProgressPill() {
  const pill = document.getElementById("progressPill");
  if (!pill || currentLevel === null) return;

  const total = (questions[currentLevel] || []).length;
  const used = usedQuestions[currentLevel].length;
  pill.innerText = `${Math.max(0, total - used)} übrig`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function backToMenu() {
  clearTimers();
  questionLocked = false;
  solutionVisible = false;

  document.getElementById("game").classList.add("hidden");
  document.getElementById("menu").classList.remove("hidden");
  document.getElementById("question").innerText = "";
  document.getElementById("questionHint").innerText = "";
  document.getElementById("answers").innerHTML = "";
  document.getElementById("solution").innerHTML = "";
  document.getElementById("solution").classList.add("hidden");
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
  solutionVisible = false;

  backToMenu();
  showStatus("Reset funktioniert.");
}

function getRandomQuestion(level) {
  const all = questions[level] || [];
  const available = all.filter((_, i) => !usedQuestions[level].includes(i));

  if (!available.length) {
    document.getElementById("result").className = "result-box fail";
    document.getElementById("result").innerText = "Alle Fragen in diesem Level wurden benutzt.";
    soundWrong();
    returnTimer = setTimeout(backToMenu, 2000);
    return null;
  }

  const q = available[Math.floor(Math.random() * available.length)];
  usedQuestions[level].push(all.indexOf(q));
  return q;
}

function renderSolution(question) {
  const box = document.getElementById("solution");
  box.classList.remove("hidden");

  let html = `<p class="solution-head">Lösung</p>`;

  if (question.type === "mc") {
    html += `<p><strong>Richtig:</strong> ${escapeHtml(question.antworten[question.correct])}</p>`;
  } else {
    const list = [];
    if (question.answer) list.push(question.answer);
    if (Array.isArray(question.accepted)) list.push(...question.accepted);

    const unique = [...new Set(list.filter(Boolean))];
    html += `<ul class="solution-list">`;
    for (const item of unique) {
      html += `<li>${escapeHtml(item)}</li>`;
    }
    html += `</ul>`;
  }

  html += `
    <div class="action-row">
      <button class="back-btn" onclick="backToMenu()">Zurück zum Menü</button>
    </div>
  `;

  box.innerHTML = html;
  solutionVisible = true;
}

function loadQuestion() {
  const q = getRandomQuestion(currentLevel);
  if (!q) return;

  currentQuestion = q;
  questionLocked = false;
  solutionVisible = false;

  const questionEl = document.getElementById("question");
  const hintEl = document.getElementById("questionHint");
  const answersEl = document.getElementById("answers");
  const solutionEl = document.getElementById("solution");
  const resultEl = document.getElementById("result");

  questionEl.innerText = q.frage;
  resultEl.innerText = "";
  resultEl.className = "result-box";
  answersEl.innerHTML = "";
  solutionEl.innerHTML = "";
  solutionEl.classList.add("hidden");

  if (q.type === "mc") {
    hintEl.innerText = "Wähle eine Antwort.";

    q.antworten.forEach((answer, i) => {
      const btn = document.createElement("button");
      btn.innerText = answer;
      btn.onclick = () => {
        if (questionLocked) return;
        ensureAudio();
        soundClick();
        checkMcAnswer(i);
      };
      answersEl.appendChild(btn);
    });
  } else {
    hintEl.innerText = "Erst entscheiden, dann Lösung einblenden.";

    const btn = document.createElement("button");
    btn.className = "menu-btn";
    btn.innerText = "Lösung einblenden";
    btn.onclick = () => {
      ensureAudio();
      soundClick();
      if (!solutionVisible) renderSolution(currentQuestion);
    };

    const row = document.createElement("div");
    row.className = "submit-row";
    row.appendChild(btn);
    answersEl.appendChild(row);
  }
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

  document.getElementById("levelPill").innerText = displayName(currentLevel);
  updateProgressPill();

  loadQuestion();
}

function finishRound(message, success) {
  const resultEl = document.getElementById("result");
  resultEl.className = success ? "result-box success" : "result-box fail";
  resultEl.innerText = message;

  document.querySelectorAll("#answers button").forEach(btn => btn.disabled = true);

  if (success) soundCorrect();
  else soundWrong();

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

function isTextQuestionCorrect(userInput, question) {
  const user = normalize(userInput);
  const candidates = [];

  if (question.answer) candidates.push(question.answer);
  if (Array.isArray(question.accepted)) candidates.push(...question.accepted);

  for (const candidate of candidates) {
    const cand = normalize(candidate);
    if (!cand) continue;

    if (user === cand) return true;
    if (similarity(user, cand) >= 0.78) return true;
  }

  return false;
}

function checkTextAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  const inputEl = document.getElementById("textAnswer");
  const userValue = inputEl ? inputEl.value : "";

  if (isTextQuestionCorrect(userValue, currentQuestion)) {
    finishRound("Richtig!", true);
  } else {
    finishRound("Falsch! Richtige Antwort: " + (currentQuestion.answer || "Lösung anzeigen."), false);
  }
}

document.addEventListener("pointerdown", ensureAudio, { once: true });

fetch("questions.json")
  .then(r => r.json())
  .then(data => {
    questions = data;
    updateMenuCounts();
    showStatus("Fragen geladen.");
  })
  .catch(() => showStatus("Fragen konnten nicht geladen werden.", false));
