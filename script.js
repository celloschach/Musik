let questions = {};
let usedQuestions = { "1": [], "2": [], "3": [] };
let currentLevel = null;
let currentQuestion = null;

fetch('questions.json')
  .then(res => res.json())
  .then(data => questions = data);

function startGame(level) {
  currentLevel = level;
  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";
  nextQuestion();
}

function getRandomQuestion(level) {
  let all = questions[level];
  let available = all.filter((_, i) => !usedQuestions[level].includes(i));

  if (available.length === 0) {
    alert("Alle Fragen wurden benutzt!");
    return null;
  }

  let random = available[Math.floor(Math.random() * available.length)];
  let index = all.indexOf(random);
  usedQuestions[level].push(index);

  return random;
}

function nextQuestion() {
  let q = getRandomQuestion(currentLevel);
  if (!q) return;

  currentQuestion = q;

  document.getElementById("question").innerText = q.frage;
  let answersDiv = document.getElementById("answers");
  answersDiv.innerHTML = "";

  if (q.type === "mc") {
    q.antworten.forEach((a, i) => {
      let btn = document.createElement("button");
      btn.innerText = a;
      btn.onclick = () => checkAnswer(i);
      answersDiv.appendChild(btn);
    });
  } else {
    let input = document.createElement("input");
    input.id = "textAnswer";
    answersDiv.appendChild(input);

    let btn = document.createElement("button");
    btn.innerText = "Antwort prüfen";
    btn.onclick = checkTextAnswer;
    answersDiv.appendChild(btn);
  }
}

function checkAnswer(index) {
  if (index === currentQuestion.correct) {
    alert("Richtig!");
  } else {
    alert("Falsch! Richtige Antwort: " + currentQuestion.antworten[currentQuestion.correct]);
  }
}

function checkTextAnswer() {
  let input = document.getElementById("textAnswer").value.toLowerCase();
  let correct = currentQuestion.answer.toLowerCase();

  if (input === correct) {
    alert("Richtig!");
  } else {
    alert("Falsch! Richtige Antwort: " + currentQuestion.answer);
  }
}

function resetGame() {
  usedQuestions = { "1": [], "2": [], "3": [] };
  alert("Zurückgesetzt!");
}
