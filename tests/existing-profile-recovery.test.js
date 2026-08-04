"use strict";

const assert = require("node:assert/strict");
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
  ].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context,{ filename:file }));
  return context.window;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296);
}

const existingIds = ["david","moses","joseph","esther","peter","paul","ruth","nehemiah","daniel","jeremiah","mary","martha"];
const focusIds = new Set(["moses","joseph","esther","paul","nehemiah","daniel"]);
const { QUESTIONS,CHARACTERS } = loadData();
const dimensions = Scoring.DIMENSIONS;
const profileStats = Object.fromEntries(dimensions.map((dimension) => {
  const values = CHARACTERS.map((character) => character.profile[dimension]);
  const mean = values.reduce((sum,value) => sum + value,0) / values.length;
  const variance = values.reduce((sum,value) => sum + Math.pow(value - mean,2),0) / values.length;
  return [dimension,{ mean,sd:Math.max(8,Math.sqrt(variance)) }];
}));

function targetTraits(character) {
  return Object.fromEntries(dimensions.map((dimension) => [
    dimension,50 + 14 * (character.profile[dimension] - profileStats[dimension].mean) / profileStats[dimension].sd
  ]));
}

function chooseForTarget(question,target,rng) {
  const stats = Scoring.questionInformation(question,dimensions);
  return question.options.map((option,index) => ({
    index,
    affinity:dimensions.reduce((sum,dimension) => {
      return sum + ((option.scores[dimension] || 0) - stats.means[dimension]) * (target[dimension] - 50);
    },0) + (rng() - .5) * 2.2
  })).sort((left,right) => right.affinity - left.affinity)[0].index;
}

const runs = Number(process.argv[2]) || 32;
const report = {};
for (const count of [16,32,48,64]) {
  report[count] = {};
  existingIds.forEach((id,idIndex) => {
    const character = CHARACTERS.find((item) => item.id === id);
    assert.ok(character,`missing existing character: ${id}`);
    const target = targetTraits(character);
    let top1 = 0,top3 = 0,top10 = 0,rankSum = 0;
    const winners = new Map();
    for (let run = 0; run < runs; run += 1) {
      const rng = seededRandom(20260804 + idIndex * 101 + run * 17 + count);
      const selected = Scoring.selectQuestions(QUESTIONS,count,{ rng });
      const responses = selected.map((question) => ({ question,optionIndex:chooseForTarget(question,target,rng) }));
      const scored = Scoring.scoreResponses(responses);
      const ranked = Scoring.rankCharacters(scored.traits,CHARACTERS,{ reliability:scored.reliability });
      const rank = ranked.findIndex((item) => item.c.id === id) + 1;
      rankSum += rank;
      winners.set(ranked[0].c.id,(winners.get(ranked[0].c.id) || 0) + 1);
      if (rank === 1) top1 += 1;
      if (rank <= 3) top3 += 1;
      if (rank <= 10) top10 += 1;
    }
    report[count][id] = {
      top1:top1 / runs,top3:top3 / runs,top10:top10 / runs,averageRank:rankSum / runs,
      alternateWinner:[...winners.entries()].filter(([winner]) => winner !== id).sort((a,b) => b[1] - a[1])[0] || null
    };
  });
}

for (const count of [32,48,64]) {
  focusIds.forEach((id) => {
    assert.ok(report[count][id].top10 >= .85,`${id}: ${count}-question top10 recovery regressed`);
  });
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;
existingIds.forEach((id) => {
  console.log(`${id}: ` + [16,32,48,64].map((count) => {
    const result = report[count][id];
    const alternate = result.alternateWinner ? ` / alt ${result.alternateWinner[0]} ${result.alternateWinner[1]}` : "";
    return `${count}Q top1 ${percent(result.top1)} / top10 ${percent(result.top10)} / avg ${result.averageRank.toFixed(1)}${alternate}`;
  }).join(" | "));
});
