/** 차트 추이 색 — 상승(+) 빨강, 하락(-) 초록 (한국 주식 관행) */
export function chartTrendColors(up: boolean) {
  return {
    stroke: up ? "#b42318" : "#163300",
    fill: up ? "#fecdca" : "#9fe870",
  };
}

export function chartTrendPerfClass(up: boolean) {
  return up ? "delta-negative" : "delta-positive";
}
