(function () {
  const metadata = {
    david:{testament:"OT",books:["사무엘상","사무엘하","시편"],tier:"famous",archetype:"회복하는 개척자",evidenceLevel:"high"},
    moses:{testament:"OT",books:["출애굽기","민수기"],tier:"famous",archetype:"책임지는 중재자",evidenceLevel:"high"},
    joseph:{testament:"OT",books:["창세기"],tier:"famous",archetype:"위기를 준비하는 전략가",evidenceLevel:"high"},
    esther:{testament:"OT",books:["에스더"],tier:"famous",archetype:"때를 살피는 보호자",evidenceLevel:"high"},
    peter:{testament:"NT",books:["복음서","사도행전"],tier:"famous",archetype:"경험으로 배우는 현장 리더",evidenceLevel:"high"},
    paul:{testament:"NT",books:["사도행전","서신서"],tier:"famous",archetype:"확신을 확장하는 개척자",evidenceLevel:"high"},
    ruth:{testament:"OT",books:["룻기"],tier:"famous",archetype:"곁을 지키는 생활 동행자",evidenceLevel:"high"},
    nehemiah:{testament:"OT",books:["느헤미야"],tier:"famous",archetype:"무너진 구조를 세우는 운영자",evidenceLevel:"high"},
    daniel:{testament:"OT",books:["다니엘"],tier:"famous",archetype:"환경 속 중심을 지키는 사람",evidenceLevel:"high"},
    jeremiah:{testament:"OT",books:["예레미야","예레미야애가"],tier:"famous",archetype:"아픔을 말하는 진실의 증언자",evidenceLevel:"high"},
    mary:{name:"베다니의 마리아",testament:"NT",books:["누가복음","요한복음"],tier:"known",archetype:"깊이 듣고 표현하는 사람",evidenceLevel:"high"},
    martha:{testament:"NT",books:["누가복음","요한복음"],tier:"known",archetype:"생활을 움직이는 환대자",evidenceLevel:"high"}
  };

  const profiles = {
    david:{courage:88,empathy:66,planning:42,duty:60,emotion:86,leadership:82,faith:84,adapt:80,calm:38,justice:58,service:54,reflection:70},
    moses:{courage:70,empathy:62,planning:66,duty:88,emotion:50,leadership:78,faith:86,adapt:40,calm:44,justice:82,service:68,reflection:66},
    joseph:{courage:54,empathy:52,planning:90,duty:80,emotion:38,leadership:68,faith:72,adapt:86,calm:84,justice:60,service:56,reflection:74},
    esther:{courage:80,empathy:76,planning:74,duty:58,emotion:40,leadership:68,faith:62,adapt:76,calm:70,justice:82,service:64,reflection:50},
    peter:{courage:92,empathy:48,planning:32,duty:64,emotion:90,leadership:74,faith:66,adapt:86,calm:32,justice:72,service:64,reflection:42},
    paul:{courage:82,empathy:42,planning:72,duty:76,emotion:48,leadership:86,faith:84,adapt:70,calm:52,justice:68,service:66,reflection:62},
    ruth:{courage:60,empathy:86,planning:52,duty:84,emotion:62,leadership:38,faith:78,adapt:70,calm:72,justice:50,service:88,reflection:58},
    nehemiah:{courage:70,empathy:46,planning:88,duty:82,emotion:38,leadership:86,faith:76,adapt:58,calm:68,justice:80,service:62,reflection:54},
    daniel:{courage:70,empathy:46,planning:66,duty:80,emotion:34,leadership:56,faith:90,adapt:60,calm:88,justice:68,service:52,reflection:86},
    jeremiah:{courage:70,empathy:84,planning:44,duty:72,emotion:90,leadership:42,faith:86,adapt:36,calm:40,justice:88,service:62,reflection:92},
    mary:{courage:52,empathy:84,planning:38,duty:54,emotion:82,leadership:34,faith:86,adapt:56,calm:80,justice:46,service:64,reflection:92},
    martha:{courage:58,empathy:72,planning:82,duty:88,emotion:64,leadership:68,faith:70,adapt:56,calm:44,justice:52,service:92,reflection:38}
  };

  (window.CHARACTERS || []).forEach((character) => {
    if (metadata[character.id]) Object.assign(character, metadata[character.id], { profile:{...profiles[character.id]},primaryEligible:true });
  });
  window.CHARACTER_CATALOG_VERSION = "v5.2-100";
})();
