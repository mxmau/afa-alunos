import { VirtualCheckEntry, VirtualCheckConfig } from "../types";

export function calculateStudentVistoMetrics(vistos: VirtualCheckEntry[], config: VirtualCheckConfig) {
  const balanceAll = vistos.reduce((sum, v) => sum + v.value, 0);
  
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const balanceMonth = vistos.filter(v => v.date.startsWith(currentMonthStr)).reduce((sum, v) => sum + v.value, 0);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const bimesterVistos = vistos.filter(v => new Date(v.date) >= sixtyDaysAgo);
  const balanceBimester = bimesterVistos.reduce((sum, v) => sum + v.value, 0);
  
  const calculatedPoints = Math.min(
    config.maxPointsPerBimester,
    Math.max(0, Number((balanceBimester * config.pointsPerCheck).toFixed(2)))
  );

  return {
    balanceAll,
    balanceMonth,
    balanceBimester,
    calculatedPoints,
  };
}

export function generateVistoIndicators(vistos: VirtualCheckEntry[]): string[] {
  const total = vistos.length;
  const positive = vistos.filter(v => v.value > 0).length;
  const ratio = total > 0 ? positive / total : 0;
  const naoFez = vistos.filter(v => v.status === "não fez").length;
  const ausente = vistos.filter(v => v.status === "ausente").length;

  // Determine evolution over past 15 vs 30 days
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const last15 = vistos.filter(v => new Date(v.date) >= fifteenDaysAgo);
  const prev15 = vistos.filter(v => {
    const d = new Date(v.date);
    return d >= thirtyDaysAgo && d < fifteenDaysAgo;
  });
  
  const last15Ratio = last15.length > 0 ? last15.filter(v => v.value > 0).length / last15.length : 0;
  const prev15Ratio = prev15.length > 0 ? prev15.filter(v => v.value > 0).length / prev15.length : 0;
  const isImproving = last15.length >= 3 && prev15.length >= 3 && (last15Ratio - prev15Ratio) >= 0.15;

  const indicators: string[] = [];
  if (ratio >= 0.8 && positive >= 6) {
    indicators.push("Excelente Participação");
  } else if (ratio >= 0.5) {
    indicators.push("Participação Regular");
  } else if (total > 0) {
    indicators.push("Baixa Participação");
  }
  
  if (naoFez >= 3) {
    indicators.push("Muitas Pendências");
  }
  if (ausente >= 3) {
    indicators.push("Alerta de Ausências");
  }
  if (isImproving) {
    indicators.push("Evolução Positiva");
  }

  return indicators;
}

export function generateVistoPedagogicalPhrase(vistos: VirtualCheckEntry[]): string {
  const total = vistos.length;
  if (total === 0) return "";
  
  const positive = vistos.filter(v => v.value > 0).length;
  const ratio = total > 0 ? positive / total : 0;
  const naoFez = vistos.filter(v => v.status === "não fez").length;

  const indicators = generateVistoIndicators(vistos);

  if (ratio >= 0.8 && positive >= 6) {
    return "O aluno tem apresentado excelente participação nas atividades propostas, com registros frequentes de vistos positivos.";
  } else if (naoFez >= 3 || ratio < 0.5) {
    return "O aluno acumula registros de atividades não realizadas, sendo necessário acompanhamento mais próximo.";
  } else if (indicators.includes("Evolução Positiva")) {
    return "O aluno apresentou melhora na entrega das atividades ao longo do período.";
  } else {
    return "O aluno apresenta participação regular nas atividades propostas, com boa entrega na maioria das tarefas de sala e de casa.";
  }
}
