let questions = {};
let usedQuestions = { "1": [], "2": [], "3": [] };

let currentLevel = null;
let currentQuestion = null;
let questionLocked = false;
let returnTimer = null;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?'"“”„()[]{}\-_/\\]/g, " ")
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

  const candidates = [correctAnswer, ...acceptedAnswers]
    .filter(Boolean)
    .map(a => normalize(a));

  for (const candidate of candidates) {
    if (user === candidate) return true;
    if (similarity(user, candidate) >= 0.78) return true;
  }

  return false;
}

function showStatus(message) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;

  statusEl.innerText = message;
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusEl.innerText = "";
  }, 2500);
}

fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questions = data;
    showStatus("Fragen geladen.");
  })
  .catch(err => {
    console.error("Fehler beim Laden von questions.json:", err);
    showStatus("Fragen konnten nicht geladen werden.");
  });

function startGame(level) {
  currentLevel = String(level);

  if (!questions[currentLevel]) {
    showStatus("Fragen werden noch geladen. Bitte kurz warten.");
    return;
  }

  clearTimeout(returnTimer);
  returnTimer = null;
  questionLocked = false;

  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("result").innerText = "";

  loadQuestion();
}

function getRandomQuestion(level) {
  const all = questions[level] || [];
  const available = all.filter((_, i) => !usedQuestions[level].includes(i));

  if (available.length === 0) {
    document.getElementById("result").innerText = "Alle Fragen in diesem Level wurden benutzt.";
    setTimeout(backToMenu, 2000);
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
  const answersEl = document.getElementById("answers");
  const resultEl = document.getElementById("result");

  questionEl.innerText = q.frage;
  answersEl.innerHTML = "";
  resultEl.innerText = "";

  if (q.type === "mc") {
    q.antworten.forEach((answer, i) => {
      const btn = document.createElement("button");
      btn.innerText = answer;
      btn.onclick = () => checkMcAnswer(i);
      answersEl.appendChild(btn);
    });
  } else if (q.type === "multi") {
    const input = document.createElement("textarea");
    input.id = "textAnswer";
    input.rows = 4;
    input.cols = 40;
    input.placeholder = "Mehrere Antworten mit Komma oder Zeilenumbruch trennen";
    answersEl.appendChild(input);

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = checkMultiAnswer;
    answersEl.appendChild(btn);
  } else {
    const input = document.createElement("input");
    input.id = "textAnswer";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Antwort eingeben";
    answersEl.appendChild(input);

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = checkTextAnswer;
    answersEl.appendChild(btn);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        checkTextAnswer();
      }
    });
  }
}

function checkMcAnswer(index) {
  if (questionLocked) return;
  questionLocked = true;

  disableAllInputs();

  const correctIndex = currentQuestion.correct;
  const resultEl = document.getElementById("result");

  if (index === correctIndex) {
    resultEl.innerText = "Richtig!";
  } else {
    resultEl.innerText = "Falsch! Richtige Antwort: " + currentQuestion.antworten[correctIndex];
  }

  returnTimer = setTimeout(backToMenu, 3000);
}

function checkTextAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  disableAllInputs();

  const resultEl = document.getElementById("result");
  const inputEl = document.getElementById("textAnswer");
  const userValue = inputEl ? inputEl.value : "";

  const correctAnswer = currentQuestion.answer || "";
  const accepted = currentQuestion.accepted || [];

  if (matchesTextAnswer(userValue, correctAnswer, accepted)) {
    resultEl.innerText = "Richtig!";
  } else {
    resultEl.innerText = "Falsch! Richtige Antwort: " + correctAnswer;
  }

  returnTimer = setTimeout(backToMenu, 3000);
}

function checkMultiAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  disableAllInputs();

  const resultEl = document.getElementById("result");
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
    resultEl.innerText = "Richtig!";
  } else {
    resultEl.innerText = "Falsch! Beispielantwort: " + currentQuestion.modelAnswer;
  }

  returnTimer = setTimeout(backToMenu, 3000);
}

function disableAllInputs() {
  document.querySelectorAll("#answers button").forEach(btn => btn.disabled = true);
  const input = document.getElementById("textAnswer");
  if (input) input.disabled = true;
}

function backToMenu() {
  clearTimeout(returnTimer);
  returnTimer = null;
  questionLocked = false;

  document.getElementById("game").style.display = "none";
  document.getElementById("menu").style.display = "block";
  document.getElementById("question").innerText = "";
  document.getElementById("answers").innerHTML = "";
  document.getElementById("result").innerText = "";
  document.getElementById("menuText").innerText = "Wähle einen Stapel / ein Level.";
}

function resetGame() {
  usedQuestions = { "1": [], "2": [], "3": [] };
  questionLocked = false;

  clearTimeout(returnTimer);
  returnTimer = null;

  backToMenu();
  showStatus("Reset funktioniert.");
}
