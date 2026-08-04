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
const context={
  console,TextEncoder,TextDecoder,URL,btoa,atob,
  document:{getElementById:()=>null},
  CHARACTERS:characters,
  __BIBLE_APP_TEST__:true,
  BibleScoring:Scoring
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),context,{filename:"app.js"});

const {decodeResultPayload,escapeHtml,characterSceneStyle,textCard,listCard}=context.__BIBLE_APP_TEST_HOOKS__;
const encode=value=>Buffer.from(JSON.stringify(value),"utf8").toString("base64url");

const v1=decodeResultPayload(encode({v:1,r:[["alpha",90],["beta",86],["gamma",82]]}));
assert.ok(v1&&v1.shared,"v1 결과 링크를 계속 읽음");
assert.equal(v1.scoringVersion,"v5.1");
assert.deepEqual(Array.from(v1.ranked,item=>item.c.id),["alpha","beta","gamma"]);

const v2=decodeResultPayload(encode({v:2,s:"v5.2-100",q:16,r:[["alpha",90],["beta",87],["gamma",86]],d:["delta",86]}));
assert.ok(v2&&v2.shared,"v2 결과 링크를 읽음");
assert.equal(v2.questionCount,16);
assert.equal(v2.discoveryMatch.c.id,"delta");

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

console.log("app-contract.test.js: 공유 역호환·payload 검증·escape 검사를 통과했습니다.");
