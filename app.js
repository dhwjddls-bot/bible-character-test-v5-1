(function(){
  const app=document.getElementById("app");
  const dims=["courage","empathy","planning","duty","emotion","leadership","faith","adapt","calm","justice","service","reflection"];
  const dimNames={courage:"용기",empathy:"공감",planning:"계획",duty:"책임",emotion:"감정 표현",leadership:"리더십",faith:"신념",adapt:"변화 수용",calm:"평정",justice:"정의감",service:"섬김",reflection:"성찰"};
  let state={mode:"self",name:"",relation:"",count:32,questions:[],index:0,scores:Object.fromEntries(dims.map(d=>[d,0])),answers:[]};
  let accountState={configured:false,initialized:false,user:null};
  let currentView="boot";
  let pendingResultSave=null;
  let failedResultSave=null;
  const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const hasFinalConsonant=word=>{
    const text=String(word||""),code=text.charCodeAt(text.length-1);
    return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0;
  };
  const traitSubject=traits=>{
    const selected=traits.slice(0,3),last=selected.pop()||"";
    return `${selected.length?`${selected.join(", ")}, `:""}${last}${hasFinalConsonant(last)?"이":"가"}`;
  };
  const buttonSound=(tone=440)=>{
    try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=tone;o.type="sine";g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.1);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.1)}catch(e){}
  };
  const characterById=id=>CHARACTERS.find(c=>c.id===id);
  const makeClientResultId=()=>window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const authProviderMeta={
    google:{mark:"G",label:"Google로 계속하기"},
    naver:{mark:"N",label:"Naver로 계속하기"},
    kakao:{mark:"K",label:"Kakao로 계속하기"}
  };
  function accountPanel(){
    if(!accountState.configured) return "";
    if(!accountState.initialized) return `<div class="account-panel"><div><strong>내 기록 연결 확인 중</strong><span>테스트는 바로 시작할 수 있습니다.</span></div></div>`;
    if(accountState.user){
      const name=esc(AccountService.getDisplayName());
      return `<div class="account-panel signed-in">
        <div><small>로그인됨</small><strong>${name}</strong><span>검사 결과가 내 기록에 안전하게 쌓입니다.</span></div>
        <div class="account-actions"><button class="secondary" id="history">내 변화 기록</button><button class="text-button" id="logout">로그아웃</button></div>
      </div>`;
    }
    return `<div class="account-panel">
      <div><strong>시간이 지난 뒤의 나도 함께 살펴보세요</strong><span>로그인하면 ‘나를 위한 테스트’ 결과만 자동으로 기록됩니다.</span></div>
      <button class="secondary" id="login">로그인하고 기록하기</button>
    </div>`;
  }
  function wireAccountPanel(){
    const login=app.querySelector("#login"),history=app.querySelector("#history"),logout=app.querySelector("#logout");
    if(login) login.onclick=()=>{buttonSound();showLogin()};
    if(history) history.onclick=()=>{buttonSound();showHistory()};
    if(logout) logout.onclick=async()=>{
      try{await AccountService.signOut();accountState.user=null;toast("로그아웃했습니다.");home()}catch(e){toast("로그아웃하지 못했습니다. 다시 시도해 주세요.")}
    };
  }
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
    currentView="home";
    app.innerHTML=`<section class="screen hero"><div class="intro">
      <div class="eyebrow">BIBLE CHARACTER TEST</div>
      <h1>당신의 선택은<br>누구를 닮았을까요?</h1>
      <p class="lead">일상에서 마주치는 선택을 따라가다 보면, 당신과 비슷한 방식으로 고민하고 움직였던 성경인물을 만나게 됩니다.</p>
      <div class="mode-grid">
        <button class="choice-card" data-mode="self"><strong>나를 위한 테스트</strong><span>지금의 내 선택과 마음을 떠올리며 답합니다.</span></button>
        <button class="choice-card" data-mode="other"><strong>다른 사람을 떠올리며</strong><span>가까이에서 지켜본 한 사람을 생각하며 답합니다.</span></button>
      </div>
      ${accountPanel()}
    </div></section>`;
    app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{buttonSound();state.mode=b.dataset.mode;setup()});
    wireAccountPanel();
  }
  function showLogin(){
    currentView="login";
    const enabledProviders=AccountService.getEnabledProviders();
    app.innerHTML=`<section class="screen setup"><div class="panel login-panel">
      <button class="back" id="back">← 돌아가기</button>
      <div class="eyebrow">MY TIMELINE</div>
      <h1 style="font-size:clamp(35px,6vw,56px)">내 변화 기록 시작하기</h1>
      <p>로그인하면 이후의 ‘나를 위한 테스트’ 결과가 시간순으로 쌓입니다. 원문 답변과 타인 테스트의 이름은 저장하지 않습니다.</p>
      <div class="social-login-list">
        ${enabledProviders.map(provider=>{const meta=authProviderMeta[provider];return `<button class="social-login ${provider}" data-provider="${provider}"><b>${meta.mark}</b><span>${meta.label}</span></button>`}).join("")}
      </div>
      ${enabledProviders.length?"":`<p class="record-status">현재 사용할 수 있는 로그인 방식이 없습니다. 잠시 후 다시 확인해 주세요.</p>`}
      <p class="note">로그인 제공자는 본인 확인에만 사용합니다. 소셜 서비스의 게시물이나 연락처에는 접근하지 않습니다.</p>
    </div></section>`;
    app.querySelector("#back").onclick=home;
    app.querySelectorAll("[data-provider]").forEach(button=>button.onclick=async()=>{
      buttonSound(560);
      const buttons=[...app.querySelectorAll("[data-provider]")];
      buttons.forEach(item=>item.disabled=true);
      const original=button.querySelector("span").textContent;
      button.querySelector("span").textContent="로그인 화면 여는 중…";
      try{
        await AccountService.signIn(button.dataset.provider);
      }catch(e){
        buttons.forEach(item=>item.disabled=false);
        button.querySelector("span").textContent=original;
        toast(e&&e.message?e.message:"로그인 화면을 열지 못했습니다.");
      }
    });
  }
  function setup(){
    currentView="setup";
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
    currentView="question";
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
  function showResult(sharedResult){
    const result=sharedResult||calculate(), ranked=result.ranked.slice(0,3), normalized=result.normalized||null, top=ranked[0],c=top.c;
    currentView="result";
    state.result={
      ranked,
      normalized,
      createdAt:result.createdAt||new Date().toISOString(),
      shared:Boolean(result.shared),
      history:Boolean(result.history),
      storedId:result.storedId||null,
      mode:result.shared?"shared":result.history?"self":state.mode,
      questionCount:result.questionCount||state.count,
      scoringVersion:result.scoringVersion||"v5.1",
      questionBankVersion:result.questionBankVersion||"v5.1",
      clientResultId:result.clientResultId||makeClientResultId()
    };
    const answerLabel=state.result.shared?"공유된 결과":state.result.history?"이 기록의 답":state.mode==="other"?`${esc(state.name)}님의 답`:"당신의 답";
    app.innerHTML=`<section class="screen result">
      ${state.result.shared?`<div class="shared-badge">공유된 결과</div>`:""}
      <div class="scene" style="background-image:url('assets/characters-${c.atlas}.png');background-position:${c.pos}">
        <div class="scene-title"><small>${top.score}% 닮은 흐름</small><h1>${c.name}</h1><strong>${c.subtitle}</strong></div>
      </div>
      <p class="result-intro">${answerLabel}에서는 ${traitSubject(c.traits)} 함께 나타났습니다. ${c.intro}</p>
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
        <button class="primary" id="save">전체 결과 이미지 저장</button>
        <button class="secondary" id="share">공유하기</button>
        ${accountState.user?`<button class="secondary" id="result-history">내 변화 기록</button>`:""}
        <button class="secondary" id="restart">처음으로</button>
        <button class="secondary" id="email">이메일 문의</button>
      </div>
      ${resultRecordStatus()}
      <p class="note">이 테스트는 자기이해를 돕는 참여형 콘텐츠이며 심리검사나 신앙 평가가 아닙니다.</p>
    </section>`;
    app.querySelector("#restart").onclick=()=>{buttonSound();clearSharedResult();home()};
    app.querySelector("#share").onclick=()=>shareResult();
    app.querySelector("#save").onclick=saveImage;
    app.querySelector("#email").onclick=()=>emailResult(c,top.score);
    const resultHistory=app.querySelector("#result-history");
    if(resultHistory) resultHistory.onclick=showHistory;
    persistResultIfNeeded();
    scrollTo({top:0,behavior:"smooth"});
  }
  function resultRecordStatus(){
    if(!accountState.configured||!state.result||state.result.shared) return "";
    if(state.result.history) return `<p class="record-status">내 변화 기록에서 불러온 결과입니다.</p>`;
    if(state.mode==="other") return `<p class="record-status">타인 테스트의 이름과 결과는 개인정보 보호를 위해 내 기록에 저장하지 않았습니다.</p>`;
    if(!accountState.user) return `<p class="record-status">로그인 상태에서 진행한 ‘나를 위한 테스트’는 내 변화 기록에 자동 저장됩니다.</p>`;
    return `<p class="record-status" id="record-status">검사 결과를 내 기록에 저장하는 중입니다…</p>`;
  }
  function persistResultIfNeeded(){
    if(!accountState.configured||!accountState.user||!state.result||state.result.shared||state.result.history||state.mode!=="self") return Promise.resolve();
    const status=app.querySelector("#record-status");
    const resultToSave=state.result;
    pendingResultSave=(async()=>{
      try{
        const response=await AccountService.saveResult(resultToSave);
        if(!response.saved) throw new Error("로그인 상태가 종료되었습니다.");
        failedResultSave=null;
        if(response.saved&&status&&status.isConnected) status.textContent="이 결과를 내 변화 기록에 저장했습니다.";
        if(response.data&&response.data.id) resultToSave.storedId=response.data.id;
      }catch(e){
        failedResultSave=resultToSave;
        if(status&&status.isConnected){
          status.innerHTML=`기록을 저장하지 못했습니다. <button class="text-button" id="retry-save">다시 저장</button>`;
          const retry=status.querySelector("#retry-save");
          if(retry) retry.onclick=()=>{status.textContent="검사 결과를 내 기록에 다시 저장하는 중입니다…";persistResultIfNeeded()};
        }
      }finally{
        if(pendingResultSave) pendingResultSave=null;
      }
    })();
    return pendingResultSave;
  }
  const formatDate=value=>{
    const date=new Date(value);
    return Number.isNaN(date.getTime())?"날짜 없음":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric"}).format(date);
  };
  async function showHistory(){
    clearSharedResult();
    if(!accountState.user){showLogin();return}
    currentView="history";
    app.innerHTML=`<section class="screen history-screen"><div class="history-loading"><div class="eyebrow">MY TIMELINE</div><h1>내 변화 기록을 불러오는 중…</h1></div></section>`;
    try{
      if(pendingResultSave) await pendingResultSave;
      if(failedResultSave){
        const response=await AccountService.saveResult(failedResultSave);
        if(!response.saved) throw new Error("기록을 다시 저장하지 못했습니다.");
        failedResultSave=null;
      }
      const rows=(await AccountService.listResults()).filter(row=>characterById(row.primary_character));
      renderHistory(rows);
    }catch(e){
      app.innerHTML=`<section class="screen setup"><div class="panel"><button class="back" id="back">← 처음으로</button><h1 style="font-size:clamp(34px,6vw,54px)">기록을 불러오지 못했습니다</h1><p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p><button class="primary" id="retry">다시 불러오기</button></div></section>`;
      app.querySelector("#back").onclick=home;
      app.querySelector("#retry").onclick=showHistory;
    }
  }
  function renderHistory(rows){
    currentView="history";
    const analysis=HistoryInsights.analyze(rows,dims,dimNames);
    if(!analysis.count){
      app.innerHTML=`<section class="screen history-screen">
        <button class="back" id="back">← 처음으로</button>
        <div class="panel empty-history"><div class="eyebrow">MY TIMELINE</div><h1 style="font-size:clamp(38px,6vw,58px)">첫 기록을 남겨 보세요</h1><p>로그인한 상태에서 ‘나를 위한 테스트’를 마치면 이곳에 결과가 쌓입니다.</p><button class="primary" id="new-test">테스트 시작</button></div>
      </section>`;
      app.querySelector("#back").onclick=home;
      app.querySelector("#new-test").onclick=()=>{state.mode="self";setup()};
      return;
    }

    const latest=analysis.latest,latestCharacter=characterById(latest.primary_character);
    const frequent=analysis.characters[0],frequentCharacter=frequent&&characterById(frequent[0]);
    const strongest=analysis.averages[0];
    const stable=analysis.stable[0];
    const changed=analysis.changes[0];
    const trendLabel=analysis.count<3?"최근 관찰":"응답 흐름";
    const changeText=analysis.count<2
      ?"다음 검사부터 차이를 비교할 수 있습니다."
      :`${changed.name} ${changed.change>=0?"+":""}${Math.round(changed.change)}점`;

    app.innerHTML=`<section class="screen history-screen">
      <div class="history-header">
        <button class="back" id="back">← 처음으로</button>
        <div class="eyebrow">MY TIMELINE</div>
        <h1>시간에 따라<br>달라진 나의 선택</h1>
        <p class="lead">${esc(AccountService.getDisplayName())}님의 검사 ${analysis.count}회를 성격의 판정이 아닌, 시기별 응답 경향으로 살펴봅니다.</p>
      </div>
      <div class="history-summary">
        <article><small>최근 닮은 인물</small><strong>${latestCharacter.name}</strong><span>${formatDate(latest.tested_at)} · ${latest.primary_score}%</span></article>
        <article><small>꾸준히 높게 나타난 성향</small><strong>${strongest.name}</strong><span>평균 ${Math.round(strongest.average)}점</span></article>
        <article><small>${trendLabel}에서 가장 큰 차이</small><strong>${analysis.count<2?"비교 준비 중":changed.name}</strong><span>${changeText}</span></article>
        <article><small>가장 자주 닮은 인물</small><strong>${frequentCharacter?frequentCharacter.name:"—"}</strong><span>${frequent?`${frequent[1]}회`:"기록 없음"}${analysis.count>1?` · 안정적 성향 ${stable.name}`:""}</span></article>
      </div>
      ${analysis.count>1?`<article class="panel trend-panel"><div class="section-heading"><div><small>성향 점수의 흐름</small><h2>높고 낮음보다 움직임을 보세요</h2></div><span>${formatDate(analysis.first.tested_at)} — ${formatDate(analysis.latest.tested_at)}</span></div>${HistoryInsights.chartSvg(analysis,dimNames)}</article>`:""}
      <div class="history-grid">
        <article class="report-card"><h2>이번 흐름에서 살펴볼 점</h2><ul>${analysis.suggestions.map(text=>`<li>${text}</li>`).join("")}</ul></article>
        <article class="report-card"><h2>해석할 때 기억할 점</h2><p>점수 차이는 생활 환경, 최근 경험, 문항 수와 답할 때의 마음에 따라 달라질 수 있습니다. 한 번의 오르내림을 성장이나 퇴보로 단정하지 말고, 실제 생활에서 반복되는 장면과 함께 살펴보세요.</p></article>
      </div>
      <div class="timeline-heading"><div><small>검사 기록</small><h2>최근 결과부터 보기</h2></div><button class="text-button danger" id="delete-all">전체 기록 삭제</button></div>
      <div class="timeline-list">${[...analysis.rows].reverse().map(row=>{
        const character=characterById(row.primary_character);
        return `<article class="timeline-item">
          <div class="timeline-date"><strong>${formatDate(row.tested_at)}</strong><span>${row.question_count}문항</span></div>
          <div class="timeline-character"><small>${row.primary_score}% 닮은 흐름</small><strong>${character.name}</strong><span>${character.traits.slice(0,3).join(" · ")}</span></div>
          <div class="timeline-actions"><button class="secondary" data-view="${esc(row.id)}">결과 보기</button><button class="text-button danger" data-delete="${esc(row.id)}">삭제</button></div>
        </article>`;
      }).join("")}</div>
      <div class="actions"><button class="primary" id="new-test">다시 테스트하기</button><button class="secondary" id="logout-history">로그아웃</button></div>
      <p class="note">서버에는 원문 답변이 아니라 결과 인물, 문항 수와 성향 점수만 저장됩니다.</p>
    </section>`;

    app.querySelector("#back").onclick=home;
    app.querySelector("#new-test").onclick=()=>{state.mode="self";setup()};
    app.querySelector("#logout-history").onclick=async()=>{await AccountService.signOut();accountState.user=null;home()};
    app.querySelectorAll("[data-view]").forEach(button=>button.onclick=()=>{
      const row=analysis.rows.find(item=>item.id===button.dataset.view);
      if(!row) return;
      const ranked=[
        [row.primary_character,row.primary_score],
        [row.second_character,row.second_score],
        [row.third_character,row.third_score]
      ].map(([id,score])=>({c:characterById(id),score:Number(score)})).filter(item=>item.c&&Number.isFinite(item.score));
      if(ranked.length!==3){toast("이 기록의 상세 결과를 불러올 수 없습니다.");return}
      showResult({
        ranked,
        normalized:row.trait_scores,
        createdAt:row.tested_at,
        questionCount:row.question_count,
        scoringVersion:row.scoring_version,
        questionBankVersion:row.question_bank_version,
        storedId:row.id,
        history:true
      });
    });
    app.querySelectorAll("[data-delete]").forEach(button=>button.onclick=async()=>{
      if(!confirm("이 검사 기록 한 건을 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;
      button.disabled=true;
      try{await AccountService.deleteResult(button.dataset.delete);toast("검사 기록을 삭제했습니다.");showHistory()}catch(e){button.disabled=false;toast("기록을 삭제하지 못했습니다.")}
    });
    app.querySelector("#delete-all").onclick=async()=>{
      if(!confirm("내 검사 기록을 모두 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;
      try{await AccountService.deleteAllResults();toast("모든 검사 기록을 삭제했습니다.");showHistory()}catch(e){toast("기록을 삭제하지 못했습니다.")}
    };
    scrollTo({top:0,behavior:"smooth"});
  }
  const card=(title,body,cls="")=>`<article class="report-card ${cls}"><h2>${title}</h2>${body.startsWith("<")?body:`<p>${body}</p>`}</article>`;
  function encodeResultPayload(){
    if(!state.result||!Array.isArray(state.result.ranked)) return "";
    const payload={v:1,r:state.result.ranked.slice(0,3).map(({c,score})=>[c.id,Math.round(score)])};
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    let binary="";
    bytes.forEach(byte=>binary+=String.fromCharCode(byte));
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  function decodeResultPayload(raw){
    try{
      if(!raw||raw.length>1200) return null;
      const normalizedRaw=raw.replace(/-/g,"+").replace(/_/g,"/");
      const padded=normalizedRaw+"=".repeat((4-normalizedRaw.length%4)%4);
      const binary=atob(padded),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
      const payload=JSON.parse(new TextDecoder().decode(bytes));
      if(!payload||payload.v!==1||!Array.isArray(payload.r)||payload.r.length!==3) return null;
      const known=new Map(CHARACTERS.map(c=>[c.id,c])), seen=new Set(), ranked=[];
      for(const row of payload.r){
        if(!Array.isArray(row)||row.length!==2||typeof row[0]!=="string"||!Number.isInteger(row[1])||row[1]<0||row[1]>100||seen.has(row[0])||!known.has(row[0])) return null;
        seen.add(row[0]);ranked.push({c:known.get(row[0]),score:row[1]});
      }
      if(ranked.some((item,index)=>index>0&&item.score>ranked[index-1].score)) return null;
      return {ranked,normalized:null,createdAt:null,shared:true};
    }catch(e){return null}
  }
  function resultShareUrl(){
    const encoded=encodeResultPayload(),url=new URL(location.href);
    url.hash=encoded?`result=${encoded}`:"";
    return url.href;
  }
  function clearSharedResult(){
    if(location.hash.startsWith("#result=")) history.replaceState(null,"",`${location.pathname}${location.search}`);
  }
  async function shareResult(){
    if(!state.result) return;
    const {c,score}=state.result.ranked[0];
    const who=state.result.shared?"공유된":state.mode==="other"?"떠올린 사람의":"나의";
    const text=`${who} 성경인물 성향 테스트 결과는 ${c.name} (${score}%)입니다. — ${c.subtitle}`;
    const url=resultShareUrl();
    try{
      if(navigator.share) await navigator.share({title:"성경인물 성향 테스트",text,url});
      else {await copyText(`${text}\n${url}`);toast("같은 결과가 열리는 주소를 복사했습니다.");}
    }catch(e){if(e&&e.name!=="AbortError"){await copyText(`${text}\n${url}`);toast("같은 결과가 열리는 주소를 복사했습니다.");}}
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
  const imagePalette={ink:"#17221d",paper:"#f4efe4",card:"#fffaf0",gold:"#c28c43",rust:"#8f4b32",sage:"#5c725f",muted:"#6f746f",body:"#485149"};
  function imageFont(size,weight=500,serif=false){return `${weight} ${size}px ${serif?'"Noto Serif KR",Georgia,serif':'"Pretendard","Noto Sans KR",system-ui,sans-serif'}`}
  function wrapCanvasText(ctx,text,maxWidth){
    const lines=[];
    String(text||"").split(/\n/).forEach(paragraph=>{
      const words=paragraph.trim().split(/\s+/).filter(Boolean);
      if(!words.length){lines.push("");return}
      let line="";
      words.forEach(word=>{
        const candidate=line?`${line} ${word}`:word;
        if(ctx.measureText(candidate).width<=maxWidth){line=candidate;return}
        if(line) lines.push(line);
        if(ctx.measureText(word).width<=maxWidth){line=word;return}
        let part="";
        [...word].forEach(ch=>{
          if(part&&ctx.measureText(part+ch).width>maxWidth){lines.push(part);part=ch}else part+=ch;
        });
        line=part;
      });
      if(line) lines.push(line);
    });
    return lines;
  }
  function roundedRect(ctx,x,y,w,h,r=22){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function reportBlocks(c,ranked){
    return [
      {title:"이 인물의 이야기",paragraphs:[c.story]},
      {title:"관계에서 보이는 모습",paragraphs:[c.relation]},
      {title:"당신이 가진 힘",paragraphs:[c.strength]},
      {title:"강점이 지나칠 때",paragraphs:[c.shadow]},
      {title:"압박받을 때",paragraphs:[c.pressure]},
      {title:"공동체에서 맡기 쉬운 역할",bullets:c.role},
      {title:"성장을 위한 균형",paragraphs:[c.growth]},
      {title:"함께 읽어 볼 장면",bullets:c.scenes},
      {title:"비슷하게 느껴질 수 있는 유형",paragraphs:[`MBTI 참고: ${c.mbti}`,`애니어그램 참고: ${c.enneagram}`,"성경인물에게 현대 성격유형을 공식적으로 부여한 것이 아니라, 결과를 이해하기 위한 비교입니다."]},
      {title:"두 번째와 세 번째로 닮은 인물",paragraphs:ranked.slice(1,3).map((r,i)=>`${i+2}번째 · ${r.score}%  ${r.c.name} — ${r.c.traits.slice(0,3).join(" · ")}`)}
    ];
  }
  function measureReportCard(ctx,block,width){
    const inner=width-56;let height=34;
    ctx.font=imageFont(30,700,true);height+=wrapCanvasText(ctx,block.title,inner).length*42+16;
    ctx.font=imageFont(24,500);
    (block.paragraphs||[]).forEach(text=>{height+=wrapCanvasText(ctx,text,inner).length*38+12});
    (block.bullets||[]).forEach(text=>{height+=wrapCanvasText(ctx,`• ${text}`,inner).length*38+8});
    return Math.ceil(height+24);
  }
  function drawReportCard(ctx,block,x,y,width,height){
    ctx.save();roundedRect(ctx,x,y,width,height);ctx.fillStyle=imagePalette.card;ctx.fill();ctx.strokeStyle="#ded2bd";ctx.lineWidth=1.5;ctx.stroke();
    const inner=width-56;let cursor=y+34;
    ctx.fillStyle=imagePalette.ink;ctx.font=imageFont(30,700,true);
    wrapCanvasText(ctx,block.title,inner).forEach(line=>{ctx.fillText(line,x+28,cursor+28);cursor+=42});
    cursor+=10;ctx.font=imageFont(24,500);ctx.fillStyle=imagePalette.body;
    (block.paragraphs||[]).forEach(text=>{
      wrapCanvasText(ctx,text,inner).forEach(line=>{ctx.fillText(line,x+28,cursor+25);cursor+=38});
      cursor+=12;
    });
    (block.bullets||[]).forEach(text=>{
      wrapCanvasText(ctx,`• ${text}`,inner).forEach(line=>{ctx.fillText(line,x+28,cursor+25);cursor+=38});
      cursor+=8;
    });
    ctx.restore();
  }
  function loadImage(src){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
  }
  async function saveImage(){
    if(!state.result) return;
    const button=app.querySelector("#save"),original=button?button.textContent:"결과 이미지 저장";
    if(button){button.disabled=true;button.textContent="전체 결과 만드는 중…"}
    try{
      if(document.fonts&&document.fonts.ready) await document.fonts.ready;
      const ranked=state.result.ranked,{c,score}=ranked[0],canvasWidth=1200,margin=60,contentWidth=canvasWidth-margin*2,gap=18,columnWidth=(contentWidth-gap)/2;
      const measureCanvas=document.createElement("canvas"),measure=measureCanvas.getContext("2d");
      const answerLabel=state.result.shared?"공유된 결과":state.result.history?"이 기록의 답":state.mode==="other"?`${state.name}님의 답`:"당신의 답";
      const intro=`${answerLabel}에서는 ${traitSubject(c.traits)} 함께 나타났습니다. ${c.intro}`;
      measure.font=imageFont(31,500,true);const introLines=wrapCanvasText(measure,intro,contentWidth-80),introHeight=introLines.length*50+72;
      const blocks=reportBlocks(c,ranked);
      const rows=[[blocks[0]],[blocks[1],blocks[2]],[blocks[3],blocks[4]],[blocks[5],blocks[6]],[blocks[7]],[blocks[8]],[blocks[9]]];
      const rowMetrics=rows.map(row=>{
        const width=row.length===1?contentWidth:columnWidth;
        return {row,width,height:Math.max(...row.map(block=>measureReportCard(measure,block,width)))};
      });
      const heroHeight=675,matchHeight=184,footerHeight=130;
      const reportHeight=rowMetrics.reduce((sum,row)=>sum+row.height,0)+gap*(rowMetrics.length-1);
      const canvasHeight=Math.ceil(heroHeight+42+introHeight+matchHeight+28+reportHeight+footerHeight);
      const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=canvasWidth;canvas.height=canvasHeight;
      const bg=ctx.createLinearGradient(0,0,canvasWidth,canvasHeight);bg.addColorStop(0,"#fff8e8");bg.addColorStop(.45,imagePalette.paper);bg.addColorStop(1,"#e9dfcd");ctx.fillStyle=bg;ctx.fillRect(0,0,canvasWidth,canvasHeight);
      const img=await loadImage(`assets/characters-${c.atlas}.png`);
      const sourceWidth=img.naturalWidth/2,sourceHeight=img.naturalHeight/2,sx=c.pos.startsWith("100")?sourceWidth:0,sy=c.pos.endsWith("100%")?sourceHeight:0;
      ctx.drawImage(img,sx,sy,sourceWidth,sourceHeight,0,0,canvasWidth,heroHeight);
      const shade=ctx.createLinearGradient(0,260,0,heroHeight);shade.addColorStop(0,"rgba(0,0,0,0)");shade.addColorStop(1,"rgba(8,14,11,.91)");ctx.fillStyle=shade;ctx.fillRect(0,0,canvasWidth,heroHeight);
      ctx.fillStyle="#f2d29c";ctx.font=imageFont(27,750);ctx.fillText(`${score}% 닮은 흐름`,62,510);
      ctx.fillStyle="#fff";ctx.font=imageFont(72,700,true);ctx.fillText(c.name,62,590);ctx.font=imageFont(27,600);ctx.fillText(c.subtitle,62,635);
      let y=heroHeight+42;
      ctx.fillStyle=imagePalette.ink;ctx.font=imageFont(31,500,true);ctx.textAlign="center";
      introLines.forEach(line=>{ctx.fillText(line,canvasWidth/2,y+31);y+=50});ctx.textAlign="left";y+=30;
      roundedRect(ctx,margin,y,contentWidth,matchHeight);ctx.fillStyle=imagePalette.card;ctx.fill();ctx.strokeStyle="#ded2bd";ctx.stroke();
      ctx.fillStyle=imagePalette.ink;ctx.font=imageFont(23,700);ctx.fillText("결과 일치도",margin+30,y+43);ctx.textAlign="right";ctx.fillText(`${score}%`,canvasWidth-margin-30,y+43);ctx.textAlign="left";
      roundedRect(ctx,margin+30,y+64,contentWidth-60,12,6);ctx.fillStyle="#dfd4c2";ctx.fill();
      roundedRect(ctx,margin+30,y+64,(contentWidth-60)*(score/100),12,6);const bar=ctx.createLinearGradient(margin,y,canvasWidth-margin,y);bar.addColorStop(0,imagePalette.sage);bar.addColorStop(1,imagePalette.gold);ctx.fillStyle=bar;ctx.fill();
      let pillX=margin+30,pillY=y+104;ctx.font=imageFont(20,700);
      c.traits.forEach(trait=>{const pillWidth=ctx.measureText(trait).width+36;if(pillX+pillWidth>canvasWidth-margin-30){pillX=margin+30;pillY+=44}roundedRect(ctx,pillX,pillY,pillWidth,36,18);ctx.fillStyle="#e5dac5";ctx.fill();ctx.fillStyle=imagePalette.ink;ctx.fillText(trait,pillX+18,pillY+25);pillX+=pillWidth+10});
      y+=matchHeight+28;
      rowMetrics.forEach(({row,width,height},rowIndex)=>{
        row.forEach((block,column)=>drawReportCard(ctx,block,margin+column*(width+gap),y,width,height));
        y+=height+(rowIndex===rowMetrics.length-1?0:gap);
      });
      y+=54;ctx.textAlign="center";ctx.fillStyle=imagePalette.muted;ctx.font=imageFont(19,500);
      wrapCanvasText(ctx,"이 테스트는 자기이해를 돕는 참여형 콘텐츠이며 심리검사나 신앙 평가가 아닙니다.",contentWidth).forEach(line=>{ctx.fillText(line,canvasWidth/2,y);y+=30});
      ctx.font=imageFont(16,700);ctx.fillText("BIBLE CHARACTER TEST",canvasWidth/2,y+20);ctx.textAlign="left";
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!blob) throw new Error("이미지 변환 실패");
      const href=URL.createObjectURL(blob),a=document.createElement("a");a.download=`성경인물-성향테스트-전체결과-${c.name}.png`;a.href=href;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
      toast("전체 결과를 한 장의 이미지로 저장했습니다.");
    }catch(e){
      console.error(e);toast("이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }finally{
      if(button){button.disabled=false;button.textContent=original}
    }
  }
  function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
  async function startApp(){
    const authParams=new URLSearchParams(location.search);
    const authError=authParams.get("error_description")||authParams.get("error");
    if(window.AccountService){
      AccountService.subscribe(snapshot=>{
        const previousUserId=accountState.user&&accountState.user.id;
        const nextUserId=snapshot.user&&snapshot.user.id;
        const initializationChanged=accountState.initialized!==snapshot.initialized;
        accountState=snapshot;
        if(currentView==="login"&&nextUserId){toast("로그인했습니다.");home()}
        else if(currentView==="home"&&(previousUserId!==nextUserId||initializationChanged)) home();
        else if(snapshot.event==="SIGNED_OUT"&&!["boot","home","login","question"].includes(currentView)){
          toast("로그인 상태가 종료되었습니다.");home();
        }
      });
    }
    const sharedMatch=location.hash.match(/^#result=([^&]+)$/),sharedResult=sharedMatch?decodeResultPayload(sharedMatch[1]):null;
    if(sharedResult) showResult(sharedResult);
    else {
      if(sharedMatch) clearSharedResult();
      home();
      if(sharedMatch) setTimeout(()=>toast("공유 주소가 올바르지 않아 시작 화면을 열었습니다."),50);
    }
    if(authError){
      history.replaceState(null,"",`${location.pathname}${location.hash}`);
      setTimeout(()=>toast("로그인이 취소되었거나 완료되지 않았습니다."),50);
    }
    if(window.AccountService){
      AccountService.initialize().catch(()=>{
        accountState={...accountState,initialized:true,user:null};
      });
    }
  }
  startApp();
})();
