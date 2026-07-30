(function () {
  const advice = {
    courage: "망설였던 일을 크게 벌이기보다, 이번 주에 끝낼 수 있는 작은 행동 하나로 옮겨 보세요.",
    empathy: "상대의 마음을 짐작한 뒤 한 번 확인해 보세요. 공감과 추측을 구분하는 데 도움이 됩니다.",
    planning: "계획을 더 촘촘히 세우기보다, 꼭 지킬 기준 한 가지와 바꿔도 되는 부분을 나눠 보세요.",
    duty: "책임을 혼자 짊어지고 있지 않은지 살피고, 도움을 요청할 일을 한 가지 골라 보세요.",
    emotion: "감정을 바로 결론으로 만들지 말고, 지금 느끼는 감정과 원하는 행동을 따로 적어 보세요.",
    leadership: "방향을 제시한 뒤 다른 사람의 의견이 실제 결정에 반영될 자리를 남겨 보세요.",
    faith: "중요한 결정을 앞두고 내가 지키려는 가치가 무엇인지 한 문장으로 적어 보세요.",
    adapt: "변화에 빨리 맞추는 힘을 살리되, 바꾸지 않아야 할 기준도 함께 확인해 보세요.",
    calm: "침착함이 감정 회피가 되지 않도록, 진정된 뒤 꼭 전해야 할 말을 미루지 마세요.",
    justice: "옳고 그름을 말하기 전에 누가 어떤 영향을 받는지까지 함께 살펴보세요.",
    service: "도움을 주기 전 상대가 정말 원하는 방식인지 묻고, 내 회복 시간도 일정에 넣어 보세요.",
    reflection: "생각이 충분해졌다면 완벽한 확신을 기다리지 말고 작은 실험으로 확인해 보세요."
  };

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function deviation(values) {
    if (values.length < 2) return 0;
    const average = mean(values);
    return Math.sqrt(mean(values.map((value) => Math.pow(value - average, 2))));
  }

  function analyze(rows, dims, dimNames) {
    const valid = (Array.isArray(rows) ? rows : [])
      .filter((row) => row && row.trait_scores && row.tested_at)
      .sort((a, b) => new Date(a.tested_at) - new Date(b.tested_at));

    if (!valid.length) {
      return {
        count: 0,
        rows: [],
        averages: [],
        changes: [],
        stable: [],
        variable: [],
        characters: [],
        suggestions: []
      };
    }

    const first = valid[0].trait_scores;
    const latest = valid[valid.length - 1].trait_scores;
    const stats = dims.map((key) => {
      const values = valid
        .map((row) => Number(row.trait_scores[key]))
        .filter(Number.isFinite);
      return {
        key,
        name: dimNames[key] || key,
        values,
        average: mean(values),
        change: (Number(latest[key]) || 0) - (Number(first[key]) || 0),
        deviation: deviation(values)
      };
    });

    const characterCounts = new Map();
    valid.forEach((row) => {
      characterCounts.set(
        row.primary_character,
        (characterCounts.get(row.primary_character) || 0) + 1
      );
    });

    const changes = [...stats].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const topChange = changes[0];
    const topAverage = [...stats].sort((a, b) => b.average - a.average);
    const chartKeys = [...new Set([
      ...topAverage.slice(0, 2).map((item) => item.key),
      topChange && topChange.key
    ].filter(Boolean))];

    const suggestions = [];
    if (valid.length < 3) {
      suggestions.push("아직은 변화의 방향을 단정하기보다, 서로 다른 시기의 모습을 나란히 보는 단계입니다.");
    } else if (topChange) {
      const direction = topChange.change >= 0 ? "더 자주 드러났고" : "조금 덜 드러났고";
      suggestions.push(
        `처음 기록과 비교하면 ‘${topChange.name}’이 ${direction}, 이 차이가 생긴 생활 환경을 함께 떠올려 보면 좋습니다.`
      );
    }
    topAverage.slice(0, 2).forEach((item) => {
      if (advice[item.key]) suggestions.push(advice[item.key]);
    });

    return {
      count: valid.length,
      rows: valid,
      first: valid[0],
      latest: valid[valid.length - 1],
      averages: topAverage,
      changes,
      stable: [...stats].sort((a, b) => a.deviation - b.deviation),
      variable: [...stats].sort((a, b) => b.deviation - a.deviation),
      characters: [...characterCounts.entries()].sort((a, b) => b[1] - a[1]),
      suggestions,
      chartKeys
    };
  }

  function chartSvg(analysis, dimNames) {
    if (!analysis || analysis.rows.length < 2) return "";
    const width = 760;
    const height = 300;
    const left = 54;
    const right = 24;
    const top = 28;
    const bottom = 52;
    const colors = ["#8f4b32", "#5c725f", "#c28c43"];
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const rows = analysis.rows;
    const x = (index) => left + (rows.length === 1 ? 0 : (plotWidth * index) / (rows.length - 1));
    const y = (value) => top + plotHeight - ((Math.max(20, Math.min(100, value)) - 20) / 80) * plotHeight;

    const grid = [20, 40, 60, 80, 100].map((value) => (
      `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="trend-grid"/>` +
      `<text x="${left - 12}" y="${y(value) + 4}" text-anchor="end" class="trend-label">${value}</text>`
    )).join("");

    const paths = analysis.chartKeys.map((key, index) => {
      const points = rows.map((row, rowIndex) => {
        const value = Number(row.trait_scores[key]) || 0;
        return `${x(rowIndex)},${y(value)}`;
      }).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${colors[index]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join("");

    const dates = rows.map((row, index) => {
      if (rows.length > 6 && index % Math.ceil(rows.length / 6) !== 0 && index !== rows.length - 1) return "";
      const date = new Date(row.tested_at);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      return `<text x="${x(index)}" y="${height - 18}" text-anchor="middle" class="trend-label">${label}</text>`;
    }).join("");

    const legend = analysis.chartKeys.map((key, index) => (
      `<span><i style="background:${colors[index]}"></i>${dimNames[key] || key}</span>`
    )).join("");

    return `<div class="trend-legend">${legend}</div><svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="성향 점수 변화 그래프">${grid}${paths}${dates}</svg>`;
  }

  window.HistoryInsights = Object.freeze({ analyze, chartSvg });
})();
