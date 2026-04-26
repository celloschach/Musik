let questions = {};
let usedQuestions = { "1": [], "2": [], "3": [] };

let currentLevel = null;
let currentQuestion = null;
let questionLocked = false;
let returnTimer = null;

fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questions = data;
  })
  .catch(err => {
    console.error("Fehler beim Laden von questions.json:", err);
    alert("questions.json konnte nicht geladen werden.");
  });

function startGame(level) {
  currentLevel = String(level);
  questionLocked = false;

  clearTimeout(returnTimer);
  returnTimer = null;

  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("result").innerText = "";

  loadQuestion();
}

function getRandomQuestion(level) {
  const all = questions[level] || [];
  const available = all.filter((_, i) => !usedQuestions[level].includes(i));

  if (available.length === 0) {
    alert("Für dieses Level sind keine Fragen mehr übrig.");
    backToMenu();
    return null;
  }

  const randomQuestion = available[Math.floor(Math.random() * available.length)];
  const originalIndex = all.indexOf(randomQuestion);
  usedQuestions[level].push(originalIndex);

  return randomQuestion;
}

function loadQuestion() {
  const q = getRandomQuestion(currentLevel);
  if (!q) return;

  currentQuestion = q;
  questionLocked = false;

  document.getElementById("question").innerText = q.frage;

  const answersDiv = document.getElementById("answers");
  const resultDiv = document.getElementById("result");
  answersDiv.innerHTML = "";
  resultDiv.innerText = "";

  if (q.type === "mc") {
    q.antworten.forEach((answer, i) => {
      const btn = document.createElement("button");
      btn.innerText = answer;
      btn.onclick = () => checkAnswer(i);
      answersDiv.appendChild(btn);
      answersDiv.appendChild(document.createElement("br"));
    });
  } else {
    const input = document.createElement("input");
    input.id = "textAnswer";
    input.type = "text";
    input.autocomplete = "off";
    answersDiv.appendChild(input);

    answersDiv.appendChild(document.createElement("br"));

    const btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = checkTextAnswer;
    answersDiv.appendChild(btn);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        checkTextAnswer();
      }
    });
  }
}

function checkAnswer(index) {
  if (questionLocked) return;
  questionLocked = true;

  const buttons = document.querySelectorAll("#answers button");
  buttons.forEach(btn => btn.disabled = true);

  const resultDiv = document.getElementById("result");

  if (index === currentQuestion.correct) {
    resultDiv.innerText = "Richtig!";
  } else {
    resultDiv.innerText = "Falsch! Richtige Antwort: " + currentQuestion.antworten[currentQuestion.correct];
  }

  returnTimer = setTimeout(() => {
    backToMenu();
  }, 3000);
}

function checkTextAnswer() {
  if (questionLocked) return;
  questionLocked = true;

  const inputField = document.getElementById("textAnswer");
  const userAnswer = inputField.value.trim().toLowerCase();
  const correctAnswer = currentQuestion.answer.trim().toLowerCase();

  inputField.disabled = true;

  const buttons = document.querySelectorAll("#answers button");
  buttons.forEach(btn => btn.disabled = true);

  const resultDiv = document.getElementById("result");

  if (userAnswer === correctAnswer) {
    resultDiv.innerText = "Richtig!";
  } else {
    resultDiv.innerText = "Falsch! Richtige Antwort: " + currentQuestion.answer;
  }

  returnTimer = setTimeout(() => {
    backToMenu();
  }, 3000);
}

function backToMenu() {
  clearTimeout(returnTimer);
  returnTimer = null;

  document.getElementById("game").style.display = "none";
  document.getElementById("menu").style.display = "block";

  document.getElementById("question").innerText = "";
  document.getElementById("answers").innerHTML = "";
  document.getElementById("result").innerText = "";

  currentQuestion = null;
  questionLocked = false;
}

function resetGame() {
  usedQuestions = { "1": [], "2": [], "3": [] };
  clearTimeout(returnTimer);
  returnTimer = null;
  backToMenu();
  alert("Alle Fragen wurden zurückgesetzt.");
}
