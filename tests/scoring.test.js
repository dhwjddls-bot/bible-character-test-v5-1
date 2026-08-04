"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Scoring=require("../data/scoring.js");

function loadBrowserData(file){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context,{filename:file});
  return context.window;
}

function seededRandom(seed){
  let value=seed>>>0;
  return ()=>((value=(1664525*value+1013904223)>>>0)/4294967296);
}

const {QUESTIONS}=loadBrowserData("data/questions.js");
const dimensions=Scoring.DIMENSIONS;

assert.equal(Scoring.SCORING_VERSION,"v5.2-100");

for(const count of [16,32,48,64]){
  const rng=seededRandom(1000+count);
  for(let run=0;run<100;run++){
    const selected=Scoring.selectQuestions(QUESTIONS,count,{rng});
    assert.equal(selected.length,count,`${count}문항 선택 수`);
    assert.equal(selected.filter(question=>question.options.length===3).length,Math.round(count*.1),`${count}문항 3지선다 수`);
    assert.equal(new Set(selected.map(question=>question.id)).size,count,`${count}문항 id 중복`);
    assert.equal(new Set(selected.map(question=>question.group||question.id)).size,count,`${count}문항 상황군 중복`);
    const optionTexts=selected.flatMap(question=>question.options.map(option=>option.text.trim().replace(/\s+/g," ")));
    assert.equal(new Set(optionTexts).size,optionTexts.length,`${count}문항 선택지 문장 중복`);
    const categoryCounts=new Map();
    selected.forEach(question=>categoryCounts.set(question.category,(categoryCounts.get(question.category)||0)+1));
    const counts=[...categoryCounts.values()];
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1,`${count}문항 카테고리 균형`);
    const information=Scoring.scoreResponses(selected.map(question=>({question,optionIndex:0}))).information;
    dimensions.forEach(dimension=>assert.ok(information[dimension]>0,`${count}문항 ${dimension} 정보량 확보`));
  }
}

{
  const rng=seededRandom(20260804),runs=900;
  for(const count of [16,32,48,64]){
    const sums=Object.fromEntries(dimensions.map(dimension=>[dimension,0]));
    for(let run=0;run<runs;run++){
      const selected=Scoring.selectQuestions(QUESTIONS,count,{rng});
      const responses=selected.map(question=>({question,optionIndex:Math.floor(rng()*question.options.length)}));
      const result=Scoring.scoreResponses(responses);
      dimensions.forEach(dimension=>sums[dimension]+=result.traits[dimension]);
    }
    dimensions.forEach(dimension=>{
      const mean=sums[dimension]/runs;
      assert.ok(Math.abs(mean-50)<1.25,`${count}문항 ${dimension} 무작위 평균 ${mean.toFixed(2)}`);
    });
  }
}

{
  const question=QUESTIONS[0];
  const response=[{question,optionIndex:0}];
  const withShrink=Scoring.scoreResponses(response);
  const withoutShrink=Scoring.scoreResponses(response,{priorInformation:0});
  dimensions.forEach(dimension=>{
    assert.ok(Math.abs(withShrink.traits[dimension]-50)<=Math.abs(withoutShrink.traits[dimension]-50)+1e-9,"정보가 적을 때 50으로 수축");
  });
}

{
  const profile=Object.fromEntries(dimensions.map(dimension=>[dimension,50]));
  const alpha={id:"alpha",profile:{...profile}},zeta={id:"zeta",profile:{...profile}};
  const traits={...profile},reliability=Object.fromEntries(dimensions.map(dimension=>[dimension,1]));
  const forward=Scoring.rankCharacters(traits,[zeta,alpha],{reliability}).map(item=>item.c.id);
  const reverse=Scoring.rankCharacters(traits,[alpha,zeta],{reliability}).map(item=>item.c.id);
  assert.deepEqual(forward,["alpha","zeta"],"동점은 id로 안정 정렬");
  assert.deepEqual(reverse,forward,"입력 배열 순서가 동점 결과를 바꾸지 않음");
}

console.log("scoring.test.js: 모든 검사를 통과했습니다.");
