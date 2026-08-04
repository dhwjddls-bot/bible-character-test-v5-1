"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Scoring=require("../data/scoring.js");

const characters=[
  {id:"alpha",tier:"famous"},
  {id:"beta",tier:"known"},
  {id:"gamma",tier:"discovery"},
  {id:"delta",tier:"discovery"}
];
let shortResultFetchCalls=0;
const context={
  console,TextEncoder,TextDecoder,URL,btoa,atob,
  document:{getElementById:()=>null},
  location:{href:"https://example.test/",search:"",hash:"",pathname:"/"},
  APP_CONFIG:{siteUrl:"https://example.test/",shortResultEndpoint:"https://api.example.test/functions/v1/shared-result"},
  fetch:async()=>{shortResultFetchCalls++;throw new Error("기존 짧은 주소에서는 API를 다시 호출하면 안 됩니다.")},
  CHARACTERS:characters,
  __BIBLE_APP_TEST__:true,
  BibleScoring:Scoring
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),context,{filename:"app.js"});

const {decodeResultPayload,decodeResultObject,normalizeShortCode,ensureResultShareTarget,setResultForTest,escapeHtml,characterSceneStyle,textCard,listCard,saveAnswerAt,previousQuestionIndex}=context.__BIBLE_APP_TEST_HOOKS__;
const encode=value=>Buffer.from(JSON.stringify(value),"utf8").toString("base64url");

const v1=decodeResultPayload(encode({v:1,r:[["alpha",90],["beta",86],["gamma",82]]}));
assert.ok(v1&&v1.shared,"v1 결과 링크를 계속 읽음");
assert.equal(v1.scoringVersion,"v5.1");
assert.deepEqual(Array.from(v1.ranked,item=>item.c.id),["alpha","beta","gamma"]);

const v2=decodeResultPayload(encode({v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["delta",86]}));
assert.ok(v2&&v2.shared,"v2 결과 링크를 읽음");
assert.equal(v2.questionCount,16);
assert.equal(v2.discoveryMatch.c.id,"delta");
assert.equal(v2.questionBankVersion,"v5.2-100","기존 v2 링크는 채점 버전을 문항 버전 fallback으로 사용");

const edgePayload=decodeResultObject({v:2,s:"v5.2-100",b:"v5.1",q:32,r:[["alpha",88],["beta",86],["gamma",84]],d:["delta",84]});
assert.ok(edgePayload&&edgePayload.shared,"Edge Function payload 객체를 읽음");
assert.equal(edgePayload.questionBankVersion,"v5.1");
assert.equal(normalizeShortCode("7k3p2a"),"7K3P2A","짧은 코드를 대문자로 정규화");
assert.equal(normalizeShortCode("O1I0AA"),"","혼동 문자가 든 코드를 거부");

setResultForTest({shareCode:"7K3P2A"});
const reusedShortTarget=ensureResultShareTarget();
assert.equal(shortResultFetchCalls,0,"짧은 공유 결과를 화면에서 준비할 때 POST를 만들지 않음");
reusedShortTarget.then(target=>assert.equal(target.url,"https://example.test/?r=7K3P2A","기존 6자리 주소를 그대로 재사용")).catch(error=>setImmediate(()=>{throw error}));

const invalidPayloads=[
  {v:2,s:"v5.2-100",r:[["alpha",90],["beta",87],["gamma",86]],d:null},
  {v:2,s:"<script>",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:null},
  {v:2,s:"v5.2-100",q:12,r:[["alpha",90],["beta",87],["gamma",86]],d:null},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["alpha",87],["gamma",86]],d:null},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",80],["beta",87],["gamma",76]],d:null},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["alpha",86]},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["beta",86]},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",84],["gamma",82]],d:["delta",86]},
  {v:2,s:"v5.2-100",q:16,r:[["gamma",90],["alpha",87],["beta",86]],d:["delta",86]},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["delta",101]},
  {v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["delta",85]}
];
invalidPayloads.forEach((payload,index)=>assert.equal(decodeResultPayload(encode(payload)),null,`변조된 v2 payload ${index+1} 거부`));
assert.equal(decodeResultPayload("not+base64"),null,"base64url 이외 문자를 거부");

const escaped=escapeHtml(`<img src=x onerror="alert('x')">&`);
assert.ok(!escaped.includes("<")&&!escaped.includes(">"),"HTML 태그를 escape");
assert.ok(escaped.includes("&lt;img")&&escaped.includes("&amp;"),"HTML 특수문자를 보존 가능한 엔티티로 변환");
assert.ok(!textCard("제목",`<img src=x onerror="alert(1)">`).includes("<img"),"결과 본문 카드의 데이터 escape");
assert.ok(!listCard("목록",[`<svg onload="alert(1)">`]).includes("<svg"),"결과 목록 카드의 데이터 escape");
assert.equal(characterSceneStyle({atlas:"1');color:red;/*",pos:"0% 0%;color:red"}),"background-image:url('assets/characters-1.png');background-position:0% 0%","장면 style 값 allowlist 적용");

const answerQuestion={text:"약속 시간이 다가오는데 준비가 덜 됐습니다.",options:[{text:"정해진 시간에 맞춘다."},{text:"완성도를 높인 뒤 알린다."}]};
const answerResponses=[],answerSummaries=[];
saveAnswerAt(0,answerQuestion,0,answerResponses,answerSummaries);
saveAnswerAt(0,answerQuestion,1,answerResponses,answerSummaries);
assert.equal(answerResponses.length,1,"이전 문항의 답을 바꿔도 응답이 중복되지 않음");
assert.equal(answerResponses[0].optionIndex,1,"이전 문항에서 고른 새 답으로 교체됨");
assert.equal(answerSummaries[0].answer,answerQuestion.options[1].text,"결과용 답변 요약도 함께 교체됨");
assert.equal(previousQuestionIndex(5),4,"이전 문항 번호로 이동");
assert.equal(previousQuestionIndex(0),0,"첫 문항보다 앞으로 이동하지 않음");

console.log("app-contract.test.js: 공유 역호환·payload 검증·escape 검사를 통과했습니다.");
