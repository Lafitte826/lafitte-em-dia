// Datas das tarefas e situação de cada uma. Usado pela página e pelo service worker.
// Regras:
//   { tipo: "dia", dia: 29 }        todo mês nesse dia; sábado ou domingo → dia útil anterior
//   { tipo: "util1", meses: [1,7] } 1º dia útil do mês (meses opcional: 0 = janeiro ... 11 = dezembro)
//   { tipo: "semana", dias: [0,2] } dias da semana (0 = segunda ... 6 = domingo); só vale o próprio dia
//   { tipo: "datas", datas: [...], desloc: -1 }  datas avulsas (ex.: festas), com deslocamento em dias
// validade (opcional): quantos dias depois da data a tarefa ainda aparece como pendente
// Feriados não são considerados.

const Agenda = (() => {
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = s => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
  const semHora = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fimDeSemana = d => d.getDay() === 0 || d.getDay() === 6;
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const DIA = 86400000;

  function vencimento(regra, ano, mes) {
    if (regra.tipo === "dia") {
      const ultimo = new Date(ano, mes + 1, 0).getDate();
      const d = new Date(ano, mes, Math.min(regra.dia, ultimo));
      while (fimDeSemana(d)) d.setDate(d.getDate() - 1);
      return d;
    }
    if (regra.tipo === "util1") {
      const d = new Date(ano, mes, 1);
      while (fimDeSemana(d)) d.setDate(d.getDate() + 1);
      return d;
    }
    return null;
  }

  // Lista de ocorrências { chave, venc } relevantes para hoje
  function periodos(regra, inicio, hoje) {
    if (regra.tipo === "semana") {
      const lista = [];
      for (let i = regra.acumula ? -6 : 0; i < 15; i++) {
        const d = somaDias(hoje, i);
        if (d >= inicio && regra.dias.includes((d.getDay() + 6) % 7)) lista.push({ chave: iso(d), venc: d });
      }
      return lista;
    }
    if (regra.tipo === "datas") {
      return regra.datas.map(s => somaDias(deIso(s), regra.desloc || 0))
        .filter(d => d >= inicio).map(d => ({ chave: iso(d), venc: d }));
    }
    const lista = [];
    let a = inicio.getFullYear(), m = inicio.getMonth();
    const fimA = hoje.getFullYear(), fimM = hoje.getMonth() + 1;
    const noMes = mes => !regra.meses || regra.meses.includes(mes);
    while (a < fimA || (a === fimA && m <= fimM)) {
      const venc = vencimento(regra, a, m);
      if (venc >= inicio && noMes(m)) lista.push({ chave: `${a}-${pad(m + 1)}`, venc });
      m++; if (m > 11) { m = 0; a++; }
    }
    // Garante uma próxima ocorrência depois de hoje (até 12 meses à frente)
    for (let k = 0; k < 12 && (!lista.length || lista[lista.length - 1].venc <= hoje); k++) {
      if (noMes(m)) lista.push({ chave: `${a}-${pad(m + 1)}`, venc: vencimento(regra, a, m) });
      m++; if (m > 11) { m = 0; a++; }
    }
    return lista;
  }

  // feitas: { chave: "AAAA-MM-DD" (data em que foi concluída) }
  function situacao(tarefa, feitas, inicioIso, agora) {
    if (!tarefa.regra) return null;
    const hoje = semHora(agora || new Date());
    const ps = periodos(tarefa.regra, deIso(inicioIso), hoje);
    const soHoje = tarefa.regra.tipo === "semana" && !tarefa.regra.acumula;
    const val = tarefa.regra.validade;
    const vale = p => val == null || (hoje - p.venc) / DIA <= val;
    const pendentes = ps.filter(p => (soHoje ? +p.venc === +hoje : p.venc <= hoje) && vale(p) && !feitas[p.chave]);
    const proxima = ps.find(p => p.venc > hoje && !feitas[p.chave]);
    const dias = proxima ? Math.round((proxima.venc - hoje) / DIA) : null;
    const ultimaFeita = ps.filter(p => feitas[p.chave] && p.venc <= hoje).pop();
    return { pendentes, proxima, dias, ultimaFeita };
  }

  // Ocorrência à qual uma conclusão de hoje se refere: a mais antiga em aberto que vence até 10 dias à frente
  function periodoAtual(tarefa, feitas, inicioIso, agora) {
    if (!tarefa.regra) return null;
    const hoje = semHora(agora || new Date());
    if (tarefa.regra.tipo === "semana" && !tarefa.regra.acumula) return { chave: iso(hoje), venc: hoje };
    const limite = new Date(hoje.getTime() + 10 * DIA);
    const ps = periodos(tarefa.regra, deIso(inicioIso), hoje);
    const val = tarefa.regra.validade;
    return ps.find(p => p.venc <= limite && !feitas[p.chave] && (val == null || (hoje - p.venc) / DIA <= val)) || ps.filter(p => p.venc <= limite).pop() || ps[0] || { chave: iso(hoje), venc: hoje };
  }

  function pendentesTodas(tarefas, estado, agora) {
    const lista = [];
    for (const t of tarefas) {
      const s = situacao(t, (estado.feitas || {})[t.id] || {}, estado.inicio, agora);
      if (s && s.pendentes.length) lista.push(t);
    }
    return lista;
  }

  return { iso, deIso, semHora, somaDias, vencimento, situacao, periodoAtual, pendentesTodas };
})();
