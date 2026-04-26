diff --git a/script.js b/script.js
index 21a0e9eb160759789d778e33e67849209a36e411..85e6f91f61eb2f9683d539be08262cc3ffb68c8e 100644
--- a/script.js
+++ b/script.js
@@ -1,40 +1,40 @@
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
-    .replace(/[.,;:!?'"“”„()[]{}\-_/\\]/g, " ")
+    .replace(/[.,;:!?'"“”„()[\]{}\-_/\\]/g, " ")
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
@@ -142,89 +142,114 @@ function loadQuestion() {
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
+  } else if (q.type === "free" || q.type === "manual") {
+    const input = document.createElement("textarea");
+    input.id = "textAnswer";
+    input.rows = 4;
+    input.cols = 40;
+    input.placeholder = "Deine Antwort";
+    answersEl.appendChild(input);
+
+    const btn = document.createElement("button");
+    btn.innerText = q.type === "manual" ? "Lösung anzeigen" : "Antwort speichern";
+    btn.onclick = checkOpenAnswer;
+    answersEl.appendChild(btn);
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
 
+function checkOpenAnswer() {
+  if (questionLocked) return;
+  questionLocked = true;
+
+  disableAllInputs();
+
+  const resultEl = document.getElementById("result");
+  const model = currentQuestion.modelAnswer ? `\nHinweis: ${currentQuestion.modelAnswer}` : "";
+  resultEl.innerText = `Antwort übernommen.${model}`;
+
+  returnTimer = setTimeout(backToMenu, 3500);
+}
+
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
