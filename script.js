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
    .replace(/[.,;:!?'"“”„()\[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

function splitUserList(value) {
  return String(value || "")
    .split(/[\n,;/]+/)
    .map(s => normalize(s))
    .filter(Boolean);
}

fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questions = data;
  })
  .catch(err => {
    console.error("Fehler beim Laden von questions.json:", err);
    document.getElementById("menuText").innerText = "Fragen konnten nicht geladen werden.";
  });

function startGame(level) {
  currentLevel = String(level);

  if (!questions[currentLevel]) {
    document.getElementById("menuText").innerText = "Fragen werden noch geladen. Bitte kurz warten.";
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
  } else {
    const input = document.createElement("input");
    input.id = "textAnswer";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = q.type === "multi" ? "Mehrere Antworten mit Komma trennen" : "Antwort eingeben";
    answersEl.appendChild(input);

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = checkTextLikeAnswer;
    answersEl.appendChild(btn);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        checkTextLikeAnswer();
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

function checkTextLikeAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  disableAllInputs();

  const resultEl = document.getElementById("result");
  const inputEl = document.getElementById("textAnswer");
  const userValue = inputEl ? inputEl.value : "";

  if (currentQuestion.type === "free" || currentQuestion.type === "manual") {
    const model = currentQuestion.modelAnswer || "Freie Antwort.";
    resultEl.innerText = "Antwort übernommen. Beispiel: " + model;
    returnTimer = setTimeout(backToMenu, 3000);
    return;
  }

  if (currentQuestion.type === "multi") {
    const userAnswers = splitUserList(userValue);
    const accepted = (currentQuestion.accepted || []).map(normalize);

    const uniqueAccepted = new Set();
    for (const item of userAnswers) {
      if (accepted.includes(item)) {
        uniqueAccepted.add(item);
      }
    }

    if (uniqueAccepted.size >= currentQuestion.minCorrect) {
      resultEl.innerText = "Richtig!";
    } else {
      resultEl.innerText = "Falsch! Beispielantwort: " + currentQuestion.modelAnswer;
    }

    returnTimer = setTimeout(backToMenu, 3000);
    return;
  }

  const user = normalize(userValue);
  const acceptedAnswers = [
    currentQuestion.answer,
    ...(currentQuestion.accepted || [])
  ].map(normalize);

  if (acceptedAnswers.includes(user)) {
    resultEl.innerText = "Richtig!";
  } else {
    resultEl.innerText = "Falsch! Richtige Antwort: " + currentQuestion.answer;
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
}
