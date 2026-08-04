(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BibleScoring=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DIMENSIONS=["courage","empathy","planning","duty","emotion","leadership","faith","adapt","calm","justice","service","reflection"];
  const SCORING_VERSION="v5.2-100";
  const DEFAULT_PRIOR_INFORMATION=2.5;
  const DEFAULT_TRAIT_SCALE=14;
  const DEFAULT_PROFILE_SPREAD=14;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const finiteNumber=value=>Number.isFinite(Number(value))?Number(value):0;

  function fisherYates(values,rng=Math.random){
    const shuffled=values.slice();
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(clamp(rng(),0,0.9999999999999999)*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    return shuffled;
  }

  function optionValue(option,dimension){
    return option&&option.scores?finiteNumber(option.scores[dimension]):0;
  }

  function questionInformation(question,dimensions=DIMENSIONS){
    const options=Array.isArray(question&&question.options)?question.options:[];
    const means={},variances={};
    dimensions.forEach(dimension=>{
      if(!options.length){means[dimension]=0;variances[dimension]=0;return}
      const values=options.map(option=>optionValue(option,dimension));
      const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
      means[dimension]=mean;
      variances[dimension]=values.reduce((sum,value)=>sum+Math.pow(value-mean,2),0)/values.length;
    });
    return {means,variances,total:dimensions.reduce((sum,dimension)=>sum+variances[dimension],0)};
  }

  function normalizedText(value){
    return String(value||"").trim().replace(/\s+/g," ");
  }

  function selectQuestions(questions,count,options={}){
    const dimensions=options.dimensions||DIMENSIONS,rng=options.rng||Math.random;
    if(!Number.isInteger(count)||count<=0) throw new Error("문항 수가 올바르지 않습니다.");
    const bank=(Array.isArray(questions)?questions:[]).filter(question=>question&&question.id&&question.category&&[2,3].includes(question.options&&question.options.length));
    if(bank.length<count) throw new Error("요청한 문항 수보다 질문은행이 작습니다.");

    const categories=[...new Set(bank.map(question=>question.category))];
    if(!categories.length) throw new Error("질문 카테고리가 없습니다.");
    const orderedCategories=fisherYates(categories,rng);
    const base=Math.floor(count/categories.length),extra=count%categories.length;
    const quotas=Object.fromEntries(categories.map(category=>[category,base]));
    orderedCategories.slice(0,extra).forEach(category=>quotas[category]++);

    const triTarget=Math.round(count*.1);
    const selected=[],selectedCount=Object.fromEntries(categories.map(category=>[category,0]));
    const selectedTri=Object.fromEntries(categories.map(category=>[category,0]));
    const information=Object.fromEntries(dimensions.map(dimension=>[dimension,0]));
    const usedGroups=new Set(),usedOptionTexts=new Set();
    const stats=new Map(bank.map(question=>[question,questionInformation(question,dimensions)]));

    const isAvailable=question=>{
      const group=String(question.group||question.id);
      if(usedGroups.has(group)||selectedCount[question.category]>=quotas[question.category]) return false;
      return question.options.every(option=>!usedOptionTexts.has(normalizedText(option.text)));
    };
    const balanceValue=question=>{
      const info=stats.get(question).variances;
      return dimensions.reduce((sum,dimension)=>sum+info[dimension]/Math.sqrt(information[dimension]+.35),0);
    };
    const chooseBest=candidates=>{
      const shuffled=fisherYates(candidates,rng);
      let best=null,bestValue=-Infinity;
      shuffled.forEach(question=>{
        const value=balanceValue(question);
        if(value>bestValue+1e-12){best=question;bestValue=value}
      });
      return best;
    };
    const addQuestion=question=>{
      selected.push(question);selectedCount[question.category]++;
      if(question.options.length===3) selectedTri[question.category]++;
      usedGroups.add(String(question.group||question.id));
      question.options.forEach(option=>usedOptionTexts.add(normalizedText(option.text)));
      const info=stats.get(question).variances;
      dimensions.forEach(dimension=>information[dimension]+=info[dimension]);
    };

    const binaryCapacity=Object.fromEntries(categories.map(category=>[
      category,new Set(bank.filter(question=>question.category===category&&question.options.length===2).map(question=>String(question.group||question.id))).size
    ]));
    const triCapacity=Object.fromEntries(categories.map(category=>[
      category,new Set(bank.filter(question=>question.category===category&&question.options.length===3).map(question=>String(question.group||question.id))).size
    ]));

    let triChosen=0;
    for(const category of categories){
      const required=Math.max(0,quotas[category]-binaryCapacity[category]);
      if(required>triCapacity[category]) throw new Error(`${category} 카테고리에 필요한 3지선다 문항이 부족합니다.`);
      for(let i=0;i<required;i++){
        const question=chooseBest(bank.filter(item=>item.category===category&&item.options.length===3&&isAvailable(item)));
        if(!question) throw new Error(`${category} 카테고리의 3지선다 문항을 선택할 수 없습니다.`);
        addQuestion(question);triChosen++;
      }
    }
    if(triChosen>triTarget) throw new Error("카테고리 균형을 지키기 위한 3지선다 수가 목표보다 많습니다.");

    while(triChosen<triTarget){
      const candidates=bank.filter(question=>question.options.length===3&&isAvailable(question));
      const question=chooseBest(candidates);
      if(!question) throw new Error("3지선다 문항이 부족합니다.");
      addQuestion(question);triChosen++;
    }

    while(selected.length<count){
      const candidates=bank.filter(question=>question.options.length===2&&isAvailable(question));
      const question=chooseBest(candidates);
      if(!question){
        const fallback=bank.filter(question=>question.options.length===2&&!usedGroups.has(String(question.group||question.id))&&selectedCount[question.category]<quotas[question.category]);
        if(!fallback.length) throw new Error("카테고리 균형을 지키며 문항을 선택할 수 없습니다.");
        throw new Error("서로 다른 선택지 문장을 유지하며 문항을 선택할 수 없습니다.");
      }
      addQuestion(question);
    }

    if(selected.filter(question=>question.options.length===3).length!==triTarget) throw new Error("3지선다 문항 수가 목표와 다릅니다.");
    if(new Set(selected.map(question=>String(question.group||question.id))).size!==selected.length) throw new Error("같은 상황군이 중복되었습니다.");
    return fisherYates(selected,rng);
  }

  function scoreResponses(responses,options={}){
    const dimensions=options.dimensions||DIMENSIONS;
    const priorInformation=Number.isFinite(options.priorInformation)?Math.max(0,options.priorInformation):DEFAULT_PRIOR_INFORMATION;
    const traitScale=Number.isFinite(options.traitScale)?Math.max(0,options.traitScale):DEFAULT_TRAIT_SCALE;
    const deltas=Object.fromEntries(dimensions.map(dimension=>[dimension,0]));
    const information=Object.fromEntries(dimensions.map(dimension=>[dimension,0]));

    (Array.isArray(responses)?responses:[]).forEach(response=>{
      const question=response&&response.question;
      const optionIndex=Number(response&&response.optionIndex);
      if(!question||!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=question.options.length) return;
      const stats=questionInformation(question,dimensions),chosen=question.options[optionIndex];
      dimensions.forEach(dimension=>{
        deltas[dimension]+=optionValue(chosen,dimension)-stats.means[dimension];
        information[dimension]+=stats.variances[dimension];
      });
    });

    const traits={},reliability={};
    dimensions.forEach(dimension=>{
      const info=information[dimension];
      const standardized=info<=0?0:deltas[dimension]/Math.sqrt(info+priorInformation);
      traits[dimension]=clamp(50+traitScale*standardized,15,85);
      reliability[dimension]=info<=0?0:info/(info+priorInformation);
    });
    return {traits,reliability,information,deltas,scoringVersion:SCORING_VERSION};
  }

  function characterProfileStats(characters,dimensions,minimumSd){
    const stats={};
    dimensions.forEach(dimension=>{
      const values=characters.map(character=>finiteNumber(character&&character.profile&&character.profile[dimension]));
      const mean=values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
      const variance=values.reduce((sum,value)=>sum+Math.pow(value-mean,2),0)/Math.max(1,values.length);
      stats[dimension]={mean,sd:Math.max(minimumSd,Math.sqrt(variance))};
    });
    return stats;
  }

  function rankCharacters(traits,characters,options={}){
    const dimensions=options.dimensions||DIMENSIONS,reliability=options.reliability||null;
    const profileSpread=Number.isFinite(options.profileSpread)?Math.max(1,options.profileSpread):DEFAULT_PROFILE_SPREAD;
    const minimumProfileSd=Number.isFinite(options.minimumProfileSd)?Math.max(1,options.minimumProfileSd):8;
    const list=(Array.isArray(characters)?characters:[]).filter(character=>character&&character.id&&character.profile);
    if(!list.length) return [];
    const profileStats=characterProfileStats(list,dimensions,minimumProfileSd);
    const ranked=list.map(character=>{
      let weightedDistance=0,totalWeight=0;
      dimensions.forEach(dimension=>{
        const weight=reliability?clamp(finiteNumber(reliability[dimension]),0,1):1;
        if(weight<=0) return;
        const stats=profileStats[dimension];
        const normalizedProfile=50+profileSpread*(finiteNumber(character.profile[dimension])-stats.mean)/stats.sd;
        const difference=finiteNumber(traits&&traits[dimension])-normalizedProfile;
        weightedDistance+=weight*difference*difference;totalWeight+=weight;
      });
      if(totalWeight<=0){
        dimensions.forEach(dimension=>{
          const stats=profileStats[dimension];
          const normalizedProfile=50+profileSpread*(finiteNumber(character.profile[dimension])-stats.mean)/stats.sd;
          weightedDistance+=Math.pow(finiteNumber(traits&&traits[dimension])-normalizedProfile,2);
        });
        totalWeight=dimensions.length;
      }
      return {c:character,distance:Math.sqrt(weightedDistance/totalWeight)};
    });
    ranked.sort((left,right)=>{
      const distanceDifference=left.distance-right.distance;
      if(Math.abs(distanceDifference)>1e-12) return distanceDifference;
      const leftId=String(left.c.id),rightId=String(right.c.id);
      return leftId<rightId?-1:leftId>rightId?1:0;
    });
    ranked.forEach(item=>{item.score=clamp(Math.round(98-item.distance*1.2),55,97)});
    return ranked;
  }

  return {
    DIMENSIONS,SCORING_VERSION,
    questionInformation,selectQuestions,scoreResponses,rankCharacters
  };
});
