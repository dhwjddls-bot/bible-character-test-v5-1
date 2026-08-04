"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Scoring = require("../data/scoring.js");

function loadData() {
  const context = { window:{} };
  vm.createContext(context);
  [
    "data/questions.js","data/characters.js","data/characters-existing-metadata.js",
    "data/characters-expanded-a.js","data/characters-expanded-b.js",
    "data/characters-expanded-c.js","data/characters-expanded-d.js"
  ].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context,{filename:file}));
  return context.window;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296);
}

const { QUESTIONS, CHARACTERS } = loadData();
const dims = Scoring.DIMENSIONS;
const profileStats = Object.fromEntries(dims.map((dimension) => {
  const values = CHARACTERS.map((character) => character.profile[dimension]);
  const mean = values.reduce((sum,value) => sum + value,0) / values.length;
  const variance = values.reduce((sum,value) => sum + Math.pow(value - mean,2),0) / values.length;
  return [dimension,{ mean,sd:Math.max(8,Math.sqrt(variance)) }];
}));

function targetTraits(character) {
  return Object.fromEntries(dims.map((dimension) => [dimension,50 + 14 * (character.profile[dimension] - profileStats[dimension].mean) / profileStats[dimension].sd]));
}

function chooseForTarget(question,target,rng) {
  const stats = Scoring.questionInformation(question,dims);
  const choices = question.options.map((option,index) => {
    const affinity = dims.reduce((sum,dimension) => sum + ((option.scores[dimension] || 0) - stats.means[dimension]) * (target[dimension] - 50),0);
    return { index,affinity:affinity + (rng() - .5) * 2.2 };
  });
  return choices.sort((a,b) => b.affinity - a.affinity)[0].index;
}

const runsPerCharacter = Number(process.argv[2]) || 12;
for (const count of [16,32,48,64]) {
  let top1 = 0,top3 = 0,top10 = 0,total = 0;
  const missed = new Map();
  CHARACTERS.forEach((character,characterIndex) => {
    const target = targetTraits(character);
    for (let run = 0; run < runsPerCharacter; run += 1) {
      const rng = seededRandom(20260804 + characterIndex * 101 + run * 17 + count);
      const selected = Scoring.selectQuestions(QUESTIONS,count,{ rng });
      const responses = selected.map((question) => ({ question,optionIndex:chooseForTarget(question,target,rng) }));
      const scored = Scoring.scoreResponses(responses);
      const ranked = Scoring.rankCharacters(scored.traits,CHARACTERS,{ reliability:scored.reliability });
      const rank = ranked.findIndex((item) => item.c.id === character.id) + 1;
      total += 1;
      if (rank === 1) top1 += 1;
      if (rank <= 3) top3 += 1;
      if (rank <= 10) top10 += 1;
      if (rank > 10) missed.set(character.id,(missed.get(character.id) || 0) + 1);
    }
  });
  const percent = (value) => `${(value / total * 100).toFixed(1)}%`;
  console.log(`${count}문항 · top1 ${percent(top1)} · top3 ${percent(top3)} · top10 ${percent(top10)} · top10 밖 인물 ${missed.size}명`);
  if (missed.size) console.log([...missed.entries()].sort((a,b) => b[1] - a[1]).slice(0,12));
}
