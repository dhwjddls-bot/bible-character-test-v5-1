"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Scoring=require("../data/scoring.js");

function loadData(){
  const context={window:{}};
  vm.createContext(context);
  for(const file of [
    "data/questions.js",
    "data/characters.js",
    "data/characters-existing-metadata.js",
    "data/characters-expanded-a.js",
    "data/characters-expanded-b.js",
    "data/characters-expanded-c.js",
    "data/characters-expanded-d.js"
  ]){
    vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context,{filename:file});
  }
  return context.window;
}

function seededRandom(seed){
  let value=seed>>>0;
  return ()=>((value=(1664525*value+1013904223)>>>0)/4294967296);
}

const {QUESTIONS,CHARACTERS}=loadData();
const rng=seededRandom(20260804),runs=Number(process.argv[2])||1000;

for(const count of [16,32,48,64]){
  const sums=Object.fromEntries(Scoring.DIMENSIONS.map(dimension=>[dimension,0]));
  const wins=Object.fromEntries(CHARACTERS.map(character=>[character.id,0]));
  for(let run=0;run<runs;run++){
    const selected=Scoring.selectQuestions(QUESTIONS,count,{rng});
    const responses=selected.map(question=>({question,optionIndex:Math.floor(rng()*question.options.length)}));
    const result=Scoring.scoreResponses(responses);
    const ranked=Scoring.rankCharacters(result.traits,CHARACTERS,{reliability:result.reliability});
    Scoring.DIMENSIONS.forEach(dimension=>sums[dimension]+=result.traits[dimension]);
    wins[ranked[0].c.id]++;
  }
  const means=Object.fromEntries(Scoring.DIMENSIONS.map(dimension=>[dimension,Number((sums[dimension]/runs).toFixed(2))]));
  console.log(`\n${count}문항 / ${runs.toLocaleString()}회`);
  console.log("무작위 성향 평균:",means);
  const leaders=Object.entries(wins).filter(([,value])=>value).sort((a,b)=>b[1]-a[1]);
  const tierWins=leaders.reduce((summary,[id,value])=>{
    const character=CHARACTERS.find(item=>item.id===id);
    summary[character.tier]=(summary[character.tier]||0)+value;
    return summary;
  },{});
  console.log(`1위가 나온 인물: ${leaders.length}/${CHARACTERS.length}`);
  console.log("인지도 그룹별 1위 횟수:",tierWins);
  console.log("상위 분포:",leaders.slice(0,20).map(([id,value])=>`${CHARACTERS.find(item=>item.id===id).name} ${value}`).join(", "));
}
