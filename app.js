(function(){
  const app=document.getElementById("app");
  const dims=["courage","empathy","planning","duty","emotion","leadership","faith","adapt","calm","justice","service","reflection"];
  const dimNames={courage:"용기",empathy:"공감",planning:"계획",duty:"책임",emotion:"감정 표현",leadership:"리더십",faith:"신념",adapt:"변화 수용",calm:"평정",justice:"정의감",service:"섬김",reflection:"성찰"};
  let state={mode:"self",name:"",relation:"",count:32,questions:[],index:0,scores:Object.fromEntries(dims.map(d=>[d,0])),answers:[]};
  const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const buttonSound=(tone=440)=>{
    try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=tone;o.type="sine";g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.1);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.1)}catch(e){}
  };
  function selectQuestions(count){
    const cats=[...new Set(QUESTIONS.map(q=>q.category))], triTarget=Math.round(count*.1);
    const byCat=Object.fromEntries(cats.map(c=>[c,shuffle(QUESTIONS.filter(q=>q.category===c))]));
    const chosen=[], triCats=shuffle(cats).slice(0,triTarget);
    triCats.forEach(c=>{const i=byCat[c].findIndex(q=>q.options.length===3);if(i>=0)chosen.push(byCat[c].splice(i,1)[0])});
    let cursor=0;
    while(chosen.length<count){
      const c=cats[cursor%cats.length], pool=byCat[c];
      const i=pool.findIndex(q=>q.options.length===2);
      if(i>=0) chosen.push(pool.splice(i,1)[0]);
      else if(pool.length) chosen.push(pool.shift());
      cursor++;
      if(cursor>1000)break;
    }
    return shuffle(chosen);
  }
  function home(){
    app.innerHTML=`<section class="screen hero"><div class="intro">
      <div class="eyebrow">BIBLE CHARACTER TEST</div>
      <h1>당신의 선택은<br>누구를 닮았을까요?</h1>
      <p class="lead">일상에서 마주치는 선택을 따라가다 보면, 당신과 비슷한 방식으로 고민하고 움직였던 성경인물을 만나게 됩니다.</p>
      <div class="mode-grid">
        <button class="choice-card" data-mode="self"><strong>나를 위한 테스트</strong><span>지금의 내 선택과 마음을 떠올리며 답합니다.</span></button>
        <button class="choice-card" data-mode="other"><strong>다른 사람을 떠올리며</strong><span>가까이에서 지켜본 한 사람을 생각하며 답합니다.</span></button>
      </div>
    </div></section>`;
    app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{buttonSound();state.mode=b.dataset.mode;setup()});
  }
  function setup(){
    app.innerHTML=`<section class="screen setup"><div class="panel">
      <button class="back" id="back">← 처음으로</button>
      <div class="eyebrow">${state.mode==="self"?"나의 이야기":"한 사람을 떠올리며"}</div>
      <h1 style="font-size:clamp(35px,6vw,56px)">${state.mode==="self"?"얼마나 깊이 살펴볼까요?":"누구를 떠올리고 있나요?"}</h1>
      ${state.mode==="other"?`<div class="field"><label for="person">이름 또는 별칭</label><input id="person" maxlength="20" placeholder="예: 민수, 우리 팀장"></div><div class="field"><label for="relation">나와의 관계</label><input id="relation" maxlength="20" placeholder="예: 친구, 가족, 동료"></div>`:""}
      <p>문항 수가 많을수록 여러 상황에서의 선택을 폭넓게 살펴봅니다.</p>
      <div class="length-grid">${[16,32,48,64].map(n=>`<button class="length-card ${n===state.count?"selected":""}" data-count="${n}">${n}문항</button>`).join("")}</div>
      <button class="primary wide" id="start">테스트 시작</button>
      ${state.mode==="other"?`<p class="note">이 결과는 그 사람의 자기보고가 아니라, 관찰자의 경험을 바탕으로 한 참고용 결과입니다.</p>`:""}
    </div></section>`;
    app.querySelector("#back").onclick=home;
    app.querySelectorAll("[data-count]").forEach(b=>b.onclick=()=>{buttonSound(520);state.count=+b.dataset.count;setup()});
    app.querySelector("#start").onclick=()=>{
      if(state.mode==="other"){
        state.name=app.querySelector("#person").value.trim();state.relation=app.querySelector("#relation").value.trim();
        if(!state.name){toast("이름이나 별칭을 입력해 주세요.");return}
      }
      buttonSound(620);state.questions=selectQuestions(state.count);state.index=0;state.scores=Object.fromEntries(dims.map(d=>[d,0]));state.answers=[];question();
    };
  }
  function question(){
    const q=state.questions[state.index], subject=state.mode==="other"?`${esc(state.name)}님을 떠올리며`:"지금의 나를 떠올리며";
    app.innerHTML=`<section class="screen">
      <div class="test-head"><div class="progress-row"><span>${subject}</span><span>${state.index+1} / ${state.count}</span></div><div class="progress"><i style="width:${(state.index/state.count)*100}%"></i></div></div>
      <div class="question-wrap"><div class="category">${esc(q.category)}</div><h1 class="question">${esc(q.text)}</h1>
      <div class="options">${q.options.map((o,i)=>`<button class="option" data-i="${i}"><b>${String.fromCharCode(65+i)}</b><span>${esc(o.text)}</span></button>`).join("")}</div></div>
    </section>`;
    app.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{
      buttonSound(460+(+b.dataset.i*80));const o=q.options[+b.dataset.i];
      Object.entries(o.scores).forEach(([k,v])=>state.scores[k]+=v);
      state.answers.push({question:q.text,answer:o.text});state.index++;
      state.index<state.count?question():showResult();
    });
  }
  function calculate(){
    const vals=dims.map(d=>state.scores[d]), min=Math.min(...vals), max=Math.max(...vals);
    const normalized=Object.fromEntries(dims.map(d=>[d, max===min?65:35+((state.scores[d]-min)/(max-min))*60]));
    const ranked=CHARACTERS.map(c=>{
      const distance=Math.sqrt(dims.reduce((s,d)=>s+Math.pow(normalized[d]-c.profile[d],2),0)/dims.length);
      return {c,score:Math.max(55,Math.min(97,Math.round(100-distance*.72)))};
    }).sort((a,b)=>b.score-a.score);
    return {ranked,normalized};
  }
  function showResult(){
    const {ranked,normalized}=calculate(), top=ranked[0],c=top.c;
    state.result={ranked:ranked.slice(0,3),normalized,createdAt:new Date().toISOString()};
    const target=state.mode==="other"?`${esc(state.name)}님`:"당신";
    app.innerHTML=`<section class="screen result">
      <div class="scene" style="background-image:url('assets/characters-${c.atlas}.png');background-position:${c.pos}">
        <div class="scene-title"><small>${top.score}% 닮은 흐름</small><h1>${c.name}</h1><strong>${c.subtitle}</strong></div>
      </div>
      <p class="result-intro">${target}의 답에서는 ${c.traits.slice(0,3).join(", ")}이 함께 나타났습니다. ${c.intro}</p>
      <div class="panel" style="margin-bottom:15px"><div class="progress-row"><span>결과 일치도</span><b>${top.score}%</b></div><div class="match-bar"><i style="width:${top.score}%"></i></div><div class="traits">${c.traits.map(t=>`<span class="pill">${t}</span>`).join("")}</div></div>
      <div class="report-grid">
        ${card("이 인물의 이야기",c.story,"full")}
        ${card("관계에서 보이는 모습",c.relation)}
        ${card("당신이 가진 힘",c.strength)}
        ${card("강점이 지나칠 때",c.shadow)}
        ${card("압박받을 때",c.pressure)}
        ${card("공동체에서 맡기 쉬운 역할",`<ul>${c.role.map(x=>`<li>${x}</li>`).join("")}</ul>`)}
        ${card("성장을 위한 균형",c.growth)}
        ${card("함께 읽어 볼 장면",`<ul>${c.scenes.map(x=>`<li>${x}</li>`).join("")}</ul>`,"full")}
        <article class="report-card full"><h2>비슷하게 느껴질 수 있는 유형</h2><p><b>MBTI 참고:</b> ${c.mbti}</p><p><b>애니어그램 참고:</b> ${c.enneagram}</p><p class="note">성경인물에게 현대 성격유형을 공식적으로 부여한 것이 아니라, 결과를 이해하기 위한 비교입니다.</p></article>
        <article class="report-card full"><h2>두 번째와 세 번째로 닮은 인물</h2><div class="runners">${ranked.slice(1,3).map((r,i)=>`<div class="runner"><small>${i+2}번째 · ${r.score}%</small><strong>${r.c.name}</strong><span>${r.c.traits.slice(0,3).join(" · ")}</span></div>`).join("")}</div></article>
      </div>
      <div class="actions">
        <button class="primary" id="save">결과 이미지 저장</button>
        <button class="secondary" id="share">공유하기</button>
        <button class="secondary" id="restart">처음으로</button>
        <button class="secondary" id="email">이메일 문의</button>
      </div>
      <p class="note">이 테스트는 자기이해를 돕는 참여형 콘텐츠이며 심리검사나 신앙 평가가 아닙니다.</p>
    </section>`;
    app.querySelector("#restart").onclick=()=>{buttonSound();home()};
    app.querySelector("#share").onclick=()=>shareResult(c,top.score);
    app.querySelector("#save").onclick=()=>saveImage(c,top.score);
    app.querySelector("#email").onclick=()=>emailResult(c,top.score);
    scrollTo({top:0,behavior:"smooth"});
  }
  const card=(title,body,cls="")=>`<article class="report-card ${cls}"><h2>${title}</h2>${body.startsWith("<")?body:`<p>${body}</p>`}</article>`;
  async function shareResult(c,score){
    const who=state.mode==="other"?`${state.name}님의`:"나의", text=`${who} 성경인물 성향 테스트 결과는 ${c.name} (${score}%)입니다. — ${c.subtitle}`;
    const url=location.origin&&location.origin!=="null"?location.origin+location.pathname.replace(/\/app\/index\.html$/,"/"):location.href;
    try{
      if(navigator.share) await navigator.share({title:"성경인물 성향 테스트",text,url});
      else {await copyText(`${text}\n${url}`);toast("결과와 접속 주소를 복사했습니다.");}
    }catch(e){if(e&&e.name!=="AbortError"){await copyText(`${text}\n${url}`);toast("공유 내용을 복사했습니다.");}}
  }
  async function copyText(text){
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return}
    const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();
  }
  function emailResult(c,score){
    const who=state.mode==="other"?`${state.name}님의`:"나의";
    const subject=encodeURIComponent("성경인물 성향 테스트 문의");
    const body=encodeURIComponent(`안녕하세요.\n\n${who} 테스트 결과는 ${c.name} (${score}%)입니다.\n문의 내용: \n\n`);
    location.href=`mailto:?subject=${subject}&body=${body}`;
  }
  function saveImage(c,score){
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=1200;canvas.height=675;
    const img=new Image();img.onload=()=>{
      const sx=c.pos.startsWith("100")?img.width/2:0,sy=c.pos.endsWith("100%")?img.height/2:0;
      ctx.drawImage(img,sx,sy,img.width/2,img.height/2,0,0,1200,675);
      const g=ctx.createLinearGradient(0,300,0,675);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.9)");ctx.fillStyle=g;ctx.fillRect(0,0,1200,675);
      ctx.fillStyle="#f5d39d";ctx.font="700 26px sans-serif";ctx.fillText(`${score}% 닮은 흐름`,62,520);
      ctx.fillStyle="white";ctx.font="700 68px serif";ctx.fillText(c.name,62,592);ctx.font="500 25px sans-serif";ctx.fillText(c.subtitle,62,632);
      const a=document.createElement("a");a.download=`성경인물-성향테스트-${c.name}.png`;a.href=canvas.toDataURL("image/png");a.click();toast("결과 이미지를 저장했습니다.");
    };img.src=`assets/characters-${c.atlas}.png`;
  }
  function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
  home();
})();
