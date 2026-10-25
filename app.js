// App do zelador: tarefas do mês, leituras, inspeção e envio pelo WhatsApp.

const $app = document.getElementById("app");

// Data de hoje. Na versão de teste (CONFIG.teste), dá para simular outro dia.
let dataTeste = null;
try { if (CONFIG.teste) dataTeste = localStorage.getItem("dataTeste"); } catch {}
function agora() {
  const real = new Date();
  if (!dataTeste) return real;
  const d = Agenda.deIso(dataTeste);
  d.setHours(real.getHours(), real.getMinutes());
  return d;
}
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const tarefa = id => TAREFAS.find(t => t.id === id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dataBr = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const diaMes = d => `${SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const refMes = chave => { const [a, m] = chave.split("-").map(Number); return `${MESES[m - 1]}/${a}`; };

// Números: aceita vírgula ou ponto como decimal
function lerNumero(txt) {
  let s = String(txt || "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
// Leituras: o zelador digita só os dígitos; o app separa as casas decimais (vírgula, como na planilha)
function lerLeitura(txt, casas) {
  const d = String(txt || "").replace(/\D/g, "");
  return d ? Number(d) / 10 ** casas : null;
}
const fmt = (n, casas) => n == null ? "—" : n.toFixed(casas).replace(".", ",");

// Leitura fora do esperado: pede para conferir no relógio antes de seguir
let perguntando = false;
function conferirLeitura(t, r, it, prev) {
  const valor = lerLeitura((r.valores || {})[it.id], it.casas);
  if (valor == null || perguntando) return Promise.resolve(true);
  const a = avaliar(t, it, prev, valor);
  r.conferidas = r.conferidas || {};
  if (!a.alerta || r.conferidas[it.id] === r.valores[it.id]) return Promise.resolve(true);
  perguntando = true;
  return new Promise(ok => {
    const d = document.createElement("div");
    d.className = "modal";
    d.innerHTML = `<div class="caixa"><b>⚠️ Confira no relógio</b>
      <p><span class="nome">${esc(it.nome)}</span><br>Você digitou <b class="num">${fmt(valor, it.casas)}</b><br>
      A leitura anterior foi ${fmt(prev.ant, it.casas)}.</p><p class="alerta">${esc(a.txt)}</p>
      <button class="btn" data-r="corrigir">Corrigir</button>
      <button class="btn sec" data-r="ok">Conferi, está certo</button></div>`;
    document.body.appendChild(d);
    d.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      d.remove(); perguntando = false;
      if (b.dataset.r === "ok") { r.conferidas[it.id] = r.valores[it.id]; salvarRascunho(t.id, r); ok(true); }
      else { const inp = document.getElementById("c" + t.itens.indexOf(it)); inp.focus(); inp.select(); ok(false); }
    }));
  });
}
const notaConferida = (r, it) => (r.conferidas || {})[it.id] === (r.valores || {})[it.id] ? ", o zelador reconferiu" : "";
const real = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- estado ----------
async function estado() {
  const e = (await DB.ler("estado")) || {};
  e.inicio = e.inicio || CONFIG.inicio;
  e.feitas = e.feitas || {};
  return e;
}
async function rascunho(id) { return (await DB.ler("rascunho:" + id)) || {}; }
const salvarRascunho = (id, r) => DB.gravar("rascunho:" + id, r);

// Última leitura conhecida: a enviada por este celular, se for mais nova que a da planilha
async function anteriores(t) {
  const u = await DB.ler("ultimas:" + t.id);
  return t.itens.map(it => {
    if (u && u.data > t.antData && u.valores[it.id] != null)
      return { ant: u.valores[it.id], ant2: u.anteriores?.[it.id] ?? null, antData: u.data };
    return { ant: it.ant, ant2: it.ant2, antData: t.antData };
  });
}

function avaliar(t, it, prev, valor) {
  if (valor == null) return { txt: "", alerta: false };
  if (Number.isNaN(valor)) return { txt: "Número inválido.", alerta: true };
  if (prev.ant == null) return { txt: "Primeira leitura", alerta: false };
  const cons = valor - prev.ant;
  const un = it.medida || t.medida;
  if (cons < 0) return { txt: `Menor que a anterior (${fmt(prev.ant, it.casas)}). Confira.`, alerta: true, motivo: "menor que a anterior" };
  const consAnt = prev.ant2 != null ? prev.ant - prev.ant2 : null;
  const minimo = un === "kWh" ? 300 : 15;
  if (consAnt != null && cons > Math.max(consAnt * 3, minimo))
    return { txt: `Consumo de ${fmt(cons, it.casas)} ${un}, bem acima do mês anterior (${fmt(consAnt, it.casas)}). Confira.`, alerta: true, motivo: "consumo muito acima do normal" };
  return { txt: `Consumo: ${fmt(cons, it.casas)} ${un}`, alerta: false };
}

// ---------- telas ----------
const TELAS = {
  // Tela inicial: um botão grande para cada pessoa, com o número de tarefas pendentes
  async inicio() {
    const e = await estado();
    const hoje = agora();
    let total = 0;
    let h = `<h1>${tituloHoje(hoje)}</h1><div class="pessoas">`;
    for (const p of PESSOAS) {
      const n = Agenda.pendentesTodas(TAREFAS.filter(t => t.quem === p.id), e, hoje).length;
      total += n;
      h += `<a class="pessoa ${n ? "pend" : ""}" href="#/p/${p.id}"><span class="ic">${p.icone}</span><b>${p.nome}</b>
        <span class="q">${n ? (n === 1 ? "1 tarefa" : n + " tarefas") : "Em dia ✅"}</span></a>`;
    }
    h += `</div>`;
    for (const rel of await relatoriosDevidos(e, hoje))
      h += `<a class="card pend" href="#/relatorio/${rel.tipo}"><span class="ic">📤</span><span class="tx"><b>${rel.titulo}</b>
        <span class="q">Enviar para o síndico</span></span><span class="seta">›</span></a>`;
    if ("Notification" in window && Notification.permission !== "granted")
      h += `<button class="btn sec" id="avisos">🔔 Ativar avisos</button>`;
    h += `<div class="rodape"><a href="#/historico">Histórico</a> · versão ${CONFIG.versao}</div>`;
    $app.innerHTML = h;
    document.getElementById("avisos")?.addEventListener("click", ativarAvisos);
    atualizarSelo(total);
  },

  async pessoa(quem) {
    const pessoa = PESSOAS.find(p => p.id === quem);
    if (!pessoa) return (location.hash = "#/");
    const e = await estado();
    const hoje = agora();
    const pend = [], prox = [];
    for (const t of TAREFAS.filter(t => t.quem === quem && t.regra)) {
      const s = Agenda.situacao(t, e.feitas[t.id] || {}, e.inicio, hoje);
      if (s.pendentes.length) pend.push({ t, s });
      else if (s.proxima) prox.push({ t, s });
    }
    prox.sort((a, b) => a.s.proxima.venc - b.s.proxima.venc);
    let h = `<h1>${pessoa.icone} ${pessoa.nome}</h1><p class="sub">${tituloHoje(hoje)}</p>`;
    if (pend.length) {
      h += `<h2>Fazer agora</h2>`;
      for (const { t, s } of pend) {
        const p = s.pendentes[0];
        const atraso = Math.round((Agenda.semHora(hoje) - p.venc) / 86400000);
        h += cartao(t, "pend", atraso === 0 ? "Hoje" : `Atrasada: era ${diaMes(p.venc)}`);
      }
    } else h += `<div class="tudo-ok">✅ Tudo em dia.</div>`;
    const avulsas = TAREFAS.filter(t => t.quem === quem && !t.regra);
    if (avulsas.length) {
      h += `<h2>Quando acontecer</h2>`;
      for (const t of avulsas) h += cartao(t, "", t.resumo);
    }
    if (prox.length) h += `<h2>Próximas</h2>`;
    for (const { t, s } of prox) {
      const d = s.dias;
      h += cartao(t, d <= 2 ? "perto" : "", `${diaMes(s.proxima.venc)} (${d === 1 ? "amanhã" : `em ${d} dias`})`);
    }
    $app.innerHTML = h;
  },

  async tarefa(id) {
    const t = tarefa(id);
    if (!t) return (location.hash = "#/");
    const e = await estado();
    const r = await rascunho(id);
    let h = `<h1>${t.icone} ${esc(t.titulo)}</h1>`;
    if (t.regra) {
      const p = Agenda.periodoAtual(t, e.feitas[t.id] || {}, e.inicio, agora());
      h += `<p class="sub">📅 ${dataBr(p.venc)}</p>`;
    } else h += `<p class="sub">${esc(t.resumo)}</p>`;

    if (t.tipo === "leituras") {
      const prevs = await anteriores(t);
      r.valores = r.valores || {};
      h += `<div class="prog" id="prog"></div>`;
      t.itens.forEach((it, i) => {
        const v = r.valores[it.id] ?? "";
        h += `<div class="item" data-i="${i}">
          ${it.grupo && it.grupo !== (t.itens[i - 1] || {}).grupo ? `<h2 class="grupo">${esc(it.grupo)}</h2>` : ""}<div class="lin"><label for="c${i}">${esc(it.nome)}<small>${it.extra ? esc(it.extra) + " · " : ""}anterior: ${fmt(prevs[i].ant, it.casas)}</small></label>
          <input id="c${i}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next" value="${esc(v)}" placeholder="números"></div>
          <div class="res"></div>${it.dica ? `<div class="dica">📷 ${esc(it.dica)}</div>` : ""}</div>`;
      });
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      const atualiza = (i) => {
        const it = t.itens[i], box = $app.querySelector(`.item[data-i="${i}"]`);
        const valor = lerLeitura(r.valores[it.id], it.casas);
        const a = avaliar(t, it, prevs[i], valor);
        box.classList.toggle("lido", valor != null && !a.alerta);
        const res = box.querySelector(".res");
        res.textContent = a.txt; res.classList.toggle("alerta", a.alerta);
        const n = t.itens.filter(x => lerLeitura(r.valores[x.id], x.casas) != null).length;
        document.getElementById("prog").textContent = `${n} de ${t.itens.length} preenchidas`;
      };
      t.itens.forEach((_, i) => atualiza(i));
      $app.querySelectorAll(".item input").forEach(inp => {
        const i = Number(inp.closest(".item").dataset.i);
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); r.valores[t.itens[i].id] = inp.value; atualiza(i); salvarRascunho(id, r); });
        inp.addEventListener("keydown", async ev => {
          if (ev.key !== "Enter") return;
          ev.preventDefault();
          if (await conferirLeitura(t, r, t.itens[i], prevs[i])) (document.getElementById("c" + (i + 1)) || document.getElementById("obs")).focus();
        });
        inp.addEventListener("change", () => conferirLeitura(t, r, t.itens[i], prevs[i]));
      });
    } else if (t.tipo === "andares") {
      h += await telaAndares(t, r);
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      ligarAndares(t, r);
    } else if (t.tipo === "rega") {
      r.rega = r.rega || {};
      const grupos = gruposRega();
      if (!grupos.some(g => g.hoje)) h += `<p class="nota">Hoje não é dia de rega.</p>`;
      grupos.forEach(({ g, i, hoje }) => {
        if (!hoje) return;
        const v = r.rega[i];
        h += `<div class="item grupo-rega" data-g="${i}"><b>${esc(g.nome)}</b>
          <div class="plantas">${g.fotos.map(f => `<figure><img src="${f.src}" alt="">${f.litros ? `<figcaption><b>💧 ${esc(f.litros)}</b>${esc(f.legenda)}</figcaption>` : ""}</figure>`).join("")}</div>
          ${g.agua ? `<p class="dica">💧 ${esc(g.agua)}</p>` : ""}${g.alerta ? `<p class="res alerta">⚠️ ${esc(g.alerta)}</p>` : ""}
          <div class="opc"><button type="button" data-v="ok" class="${v === "ok" ? "sel-ok" : ""}">✅ Reguei</button>
          ${g.chuva ? `<button type="button" data-v="chuva" class="${v === "chuva" ? "sel-res" : ""}">🌧️ Choveu</button>` : ""}</div></div>`;
      });
      h += `<p class="nota">🌧️ Choveu ontem ou hoje? Não precisa regar.</p>`;
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      $app.querySelectorAll(".grupo-rega").forEach(box => box.querySelectorAll("[data-v]").forEach(b => b.addEventListener("click", () => {
        r.rega[box.dataset.g] = b.dataset.v;
        box.querySelectorAll("[data-v]").forEach(x => x.className = x === b ? (b.dataset.v === "ok" ? "sel-ok" : "sel-res") : "");
        salvarRascunho(id, r);
      })));
    } else if (t.tipo === "feito") {
      h += obsEFotos(r, t).replace("Revisar e concluir", "✅ Feito");
      $app.innerHTML = h;
    } else if (t.tipo === "checklist") {
      r.feitos = r.feitos || {};
      const itens = LIMPEZA[diaSemanaSeg(agora())] || [];
      const min = hm => { const [a, b] = hm.split(":"); return +a * 60 + +b; };
      const ag = agora().getHours() * 60 + agora().getMinutes();
      if (!itens.length) h += `<div class="tudo-ok">Domingo: folga.</div>`;
      h += `<div class="lista-check">${itens.map(([ini, fim, txt, tipo], i) => {
        const agoraCls = ag >= min(ini) && ag < min(fim) ? " agora" : "";
        if (tipo === "g") return `<div class="apoio${agoraCls}"><span class="hora">${ini}</span>${esc(txt)}</div>`;
        return `<button type="button" class="check${r.feitos[i] ? " feito" : ""}${agoraCls}" data-i="${i}">
          <span class="hora">${ini}<small>até ${fim}</small></span><span class="tx">${esc(txt)}</span><span class="box">${r.feitos[i] ? "✔" : ""}</span></button>`;
      }).join("")}</div>
      <p class="nota">Toque na atividade quando terminar.</p>`;
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      $app.querySelectorAll(".check").forEach(b => b.addEventListener("click", () => {
        const i = b.dataset.i;
        r.feitos[i] = !r.feitos[i];
        b.classList.toggle("feito", r.feitos[i]);
        b.querySelector(".box").textContent = r.feitos[i] ? "✔" : "";
        salvarRascunho(id, r);
      }));
      $app.querySelector(".agora")?.scrollIntoView({ block: "center" });
    } else if (t.tipo === "inspecao") {
      r.insp = r.insp || {};
      for (const it of t.itens) {
        const v = r.insp[it.id] || {};
        h += `<div class="item" data-id="${it.id}"><label>${esc(it.nome)}</label>
          <div class="opc"><button type="button" data-s="ok" class="${v.status === "ok" ? "sel-ok" : ""}">✅ Normal</button>
          <button type="button" data-s="prob" class="${v.status === "prob" ? "sel-prob" : ""}">⚠️ Problema</button></div>
          <textarea placeholder="O que viu?" ${v.status === "prob" ? "" : "hidden"}>${esc(v.texto)}</textarea></div>`;
      }
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      $app.querySelectorAll(".item[data-id]").forEach(box => {
        const v = r.insp[box.dataset.id] = r.insp[box.dataset.id] || {};
        box.querySelectorAll(".opc button").forEach(b => b.addEventListener("click", () => {
          v.status = b.dataset.s;
          box.querySelectorAll(".opc button").forEach(x => x.className = x === b ? (v.status === "ok" ? "sel-ok" : "sel-prob") : "");
          const tx = box.querySelector("textarea");
          tx.hidden = v.status !== "prob";
          if (!tx.hidden) tx.focus();
          salvarRascunho(id, r);
        }));
        box.querySelector("textarea").addEventListener("input", ev => { v.texto = ev.target.value; salvarRascunho(id, r); });
      });
    } else if (t.tipo === "abastecimento") {
      r.abast = r.abast || { data: Agenda.iso(agora()) };
      const a = r.abast;
      const hojeIso = Agenda.iso(agora()), ontemIso = Agenda.iso(Agenda.somaDias(agora(), -1));
      const outro = a.data !== hojeIso && a.data !== ontemIso;
      h += `<div class="campo"><label>Quando o caminhão veio?</label>
          <div class="opc" id="a-dia"><button type="button" data-d="${hojeIso}">Hoje</button><button type="button" data-d="${ontemIso}">Ontem</button><button type="button" data-d="outro">Outro dia</button></div>
          <input id="a-data" type="date" max="${hojeIso}" value="${esc(a.data)}" ${outro ? "" : "hidden"}></div>
        <div class="campo"><label for="a-kg">Quantos kg?</label><input id="a-kg" class="grande" inputmode="decimal" value="${esc(a.kg)}"></div>
        <div class="campo"><label for="a-valor">Preço do kg (R$)</label><input id="a-valor" class="grande" inputmode="decimal" value="${esc(a.valor)}"></div>
        <p class="nota">📷 Tire foto do canhoto.</p>`;
      h += obsEFotos(r, t);
      $app.innerHTML = h;
      for (const [campo, el] of [["data", "a-data"], ["kg", "a-kg"], ["valor", "a-valor"]])
        document.getElementById(el).addEventListener("input", ev => { a[campo] = ev.target.value; salvarRascunho(id, r); });
      const botoesDia = document.querySelectorAll("#a-dia button"), campoData = document.getElementById("a-data");
      const marcaDia = () => botoesDia.forEach(b => b.className =
        (campoData.hidden ? b.dataset.d === a.data : b.dataset.d === "outro") ? "sel-ok" : "");
      botoesDia.forEach(b => b.addEventListener("click", () => {
        if (b.dataset.d === "outro") { campoData.hidden = false; campoData.focus(); }
        else { a.data = b.dataset.d; campoData.value = a.data; campoData.hidden = true; }
        marcaDia(); salvarRascunho(id, r);
      }));
      marcaDia();
    }

    document.getElementById("obs").addEventListener("input", ev => { r.obs = ev.target.value; salvarRascunho(id, r); });
    await mostrarFotos(id);
    document.getElementById("foto").addEventListener("change", async ev => {
      for (const arq of ev.target.files) await DB.addFoto({ tarefa: id, blob: await reduzir(arq), criada: agora().getTime() });
      ev.target.value = "";
      mostrarFotos(id);
    });
    document.getElementById("revisar").addEventListener("click", () => (location.hash = "#/enviar/" + id));
  },

  async enviar(id) {
    const t = tarefa(id);
    const e = await estado();
    const r = await rascunho(id);
    const fotos = await DB.fotos(id);
    const { texto, falta } = await montarMensagem(t, e, r, fotos.length);
    const numero = String(CONFIG.whatsapp || "").replace(/\D/g, "");
    const link = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    // Leituras e caminhão de gás vão na hora. O resto vai no resumo da semana e no do mês, a não ser que tenha problema ou foto.
    const urgente = !naHora(t) && (fotos.length || temProblema(t, r));
    let h = `<h1>${t.icone} ${naHora(t) || urgente ? "Revisar e enviar" : "Revisar e concluir"}</h1>`;
    if (falta) h += `<p class="card pend"><b>Atenção</b><span class="q">${esc(falta)}</span></p>`;
    h += `<pre class="msg">${esc(texto)}</pre>`;
    if (!naHora(t) && !urgente) {
      h += `<button class="btn ok" id="concluir">✔ Concluir</button><p class="nota">Vai no resumo da semana para o síndico.</p>
        <a class="btn sec" href="#/tarefa/${id}">Voltar e corrigir</a>`;
      $app.innerHTML = h;
      document.getElementById("concluir").addEventListener("click", () => concluir(t, r, texto, fotos.length));
      return;
    }
    if (urgente) h += `<p class="nota">${temProblema(t, r) ? "⚠️ Tem problema: avise o síndico agora." : "📷 Tem foto: envie agora."}</p>`;
    h += `<p class="passo">1. Enviar a mensagem</p><a class="btn zap" id="zap" href="${link}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`;
    if (fotos.length) {
      h += `<p class="passo">2. Enviar as fotos (${fotos.length})</p>
        <button class="btn zap" id="enviar-fotos">Enviar fotos pelo WhatsApp</button>
        <p class="nota">Na tela que abrir, escolha o WhatsApp e depois o síndico.</p>`;
    }
    h += `<p class="passo">${fotos.length ? 3 : 2}. Depois de enviar</p>
      <button class="btn ok" id="concluir">✔ Já enviei: concluir tarefa</button>
      <a class="btn sec" href="#/tarefa/${id}">Voltar e corrigir</a>`;
    $app.innerHTML = h;
    document.getElementById("enviar-fotos")?.addEventListener("click", () => compartilharFotos(t, fotos));
    document.getElementById("concluir").addEventListener("click", () => concluir(t, r, texto, fotos.length, true));
  },

  async historico() {
    const regs = (await DB.ler("registros")) || [];
    let h = `<h1>Histórico</h1><p class="sub">Tudo o que foi feito neste celular.</p>`;
    if (!regs.length) h += `<p class="nota">Nada feito ainda.</p>`;
    else {
      const mes = Agenda.iso(agora()).slice(0, 7);
      const ant = Agenda.iso(new Date(agora().getFullYear(), agora().getMonth() - 1, 1)).slice(0, 7);
      h += `<button class="btn zap" data-mes="${mes}">📄 Enviar arquivo de ${refMes(mes)}</button>`;
      if (regs.some(x => x.dia.startsWith(ant))) h += `<button class="btn sec" data-mes="${ant}">📄 Enviar arquivo de ${refMes(ant)}</button>`;
    }
    let dia = "";
    regs.slice(0, 300).forEach((x, i) => {
      if (x.dia !== dia) { dia = x.dia; h += `<h2>${diaMes(Agenda.deIso(dia))}</h2>`; }
      h += `<details class="card"><summary><b style="display:inline">${x.icone} ${esc(x.titulo)}</b> <span class="q">· ${esc(x.hora)}</span></summary>
        <pre class="msg">${esc(x.texto)}</pre><a class="btn zap" href="${linkZap(x.texto)}" target="_blank" rel="noopener">Enviar de novo</a></details>`;
    });
    $app.innerHTML = h;
    $app.querySelectorAll("[data-mes]").forEach(b => b.addEventListener("click", () => enviarArquivo(regs, b.dataset.mes)));
  },

  // Resumo da semana (toda segunda) ou total do mês (no dia 1º)
  async relatorio(tipo) {
    const e = await estado();
    const rel = (await relatoriosDevidos(e, agora())).find(x => x.tipo === tipo);
    if (!rel) return (location.hash = "#/");
    const texto = await textoRelatorio(rel, e);
    let h = `<h1>📤 ${rel.titulo}</h1><pre class="msg">${esc(texto)}</pre>
      <p class="passo">1. Enviar a mensagem</p><a class="btn zap" href="${linkZap(texto)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
      <p class="passo">2. Depois de enviar</p><button class="btn ok" id="enviado">✔ Já enviei</button>`;
    $app.innerHTML = h;
    document.getElementById("enviado").addEventListener("click", async () => {
      const env = (await DB.ler("relatorios")) || {};
      env[tipo] = rel.fim;
      await DB.gravar("relatorios", env);
      location.hash = "#/";
      aviso("Resumo enviado ✔");
    });
  },
};

// ---------- leituras do dia 29: andar por andar, do 15º ao 1º ----------
const LUZ_ST = {
  ok: { txt: "OK", classe: "l-ok", rotulo: "✅ Tudo normal" },
  resolvido: { txt: "Resolvido", classe: "l-res", rotulo: "🔧 Tinha problema, resolvi" },
  manut: { txt: "Manutenção", classe: "l-man", rotulo: "📣 Avisar a manutenção" },
};

// Luz de emergência: lâmpada + escada
const ESCADA = `<svg class="escada" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h5v-5h5v-5h5V6h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
const iconeLuz = l => l.id === "emerg" ? "💡" + ESCADA : l.icone;

async function telaAndares(t, r) {
  r.valores = r.valores || {};
  r.luzes = r.luzes || {};
  const prevs = await anteriores(t);
  const idx = id => t.itens.findIndex(it => it.id === id);
  const campo = (id, rotulo) => {
    const i = idx(id), it = t.itens[i];
    return `<div class="med" data-i="${i}"><label for="c${i}">${rotulo}</label>
      <input id="c${i}" class="grande" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next" value="${esc(r.valores[id] ?? "")}">
      <div class="res">anterior ${fmt(prevs[i].ant, it.casas)}</div></div>`;
  };
  let h = `<div class="prog" id="prog"></div>
    <p class="nota">Digite só os números do relógio.</p>`;
  for (const a of t.andares) {
    const aptos = [a * 100 + 1, a * 100 + 2];
    h += `<section class="andar"><div class="andar-cab"><span class="num">${a}º andar</span>
      ${t.luzes.map(l => `<button type="button" class="luz" data-k="${a}:${l.id}">${iconeLuz(l)} ${l.curto}<small></small></button>`).join("")}</div>
      <div class="luz-painel" hidden></div>
      <div class="aptos">${aptos.map(u => `<div class="apto"><b>Apto ${u}</b>
        ${campo("agua:" + u, "💧 Água")}${campo("gas:" + u, "🔥 Gás")}</div>`).join("")}</div></section>`;
  }
  const e = t.itens.find(it => it.medidor === "entrada");
  h += `<section class="andar"><div class="andar-cab"><span class="num">Calçada</span></div>
    <div class="apto">${campo(e.id, "💧 " + e.nome)}<div class="dica">📷 Tire também uma foto deste medidor.</div></div></section>`;
  return h;
}

function ligarAndares(t, r) {
  const salvar = () => salvarRascunho(t.id, r);
  let prevs;
  // Ordem do Enter: água dos dois aptos, depois gás dos dois, andar por andar
  const ordem = [];
  for (const a of t.andares) for (const m of ["agua", "gas"]) for (const u of [a * 100 + 1, a * 100 + 2])
    ordem.push(t.itens.findIndex(it => it.id === `${m}:${u}`));
  ordem.push(t.itens.findIndex(it => it.medidor === "entrada"));

  const progresso = () => {
    const n = m => t.itens.filter(it => it.medidor === m && lerLeitura(r.valores[it.id], it.casas) != null).length;
    const luzes = Object.values(r.luzes).filter(v => v.st).length;
    document.getElementById("prog").textContent =
      `💧 ${n("agua")}/30 · 🔥 ${n("gas")}/30 · 💡 ${luzes}/${t.andares.length * t.luzes.length}`;
  };
  const atualiza = i => {
    const it = t.itens[i], box = $app.querySelector(`.med[data-i="${i}"]`);
    const valor = lerLeitura(r.valores[it.id], it.casas);
    const res = box.querySelector(".res");
    if (valor == null) { res.textContent = `anterior ${fmt(prevs[i].ant, it.casas)}`; res.classList.remove("alerta"); box.classList.remove("lido"); }
    else {
      const a = avaliar(t, it, prevs[i], valor);
      res.textContent = `= ${fmt(valor, it.casas)} · ${a.txt}`;
      res.classList.toggle("alerta", a.alerta);
      box.classList.toggle("lido", !a.alerta);
    }
    progresso();
  };
  const pintaLuz = btn => {
    const v = r.luzes[btn.dataset.k] || {};
    btn.className = "luz " + (v.st ? LUZ_ST[v.st].classe : "");
    btn.querySelector("small").textContent = v.st ? LUZ_ST[v.st].txt : "conferir";
  };

  anteriores(t).then(p => {
    prevs = p;
    $app.querySelectorAll(".med").forEach(box => {
      const i = Number(box.dataset.i), inp = box.querySelector("input");
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "");
        r.valores[t.itens[i].id] = inp.value; atualiza(i); salvar();
      });
      inp.addEventListener("keydown", async ev => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        if (!(await conferirLeitura(t, r, t.itens[i], prevs[i]))) return;
        const prox = ordem[ordem.indexOf(i) + 1];
        (prox != null ? document.getElementById("c" + prox) : document.getElementById("obs")).focus();
      });
      inp.addEventListener("change", () => conferirLeitura(t, r, t.itens[i], prevs[i]));
      atualiza(i);
    });
  });

  $app.querySelectorAll(".luz").forEach(btn => {
    pintaLuz(btn);
    btn.addEventListener("click", () => {
      const painel = btn.closest(".andar").querySelector(".luz-painel");
      const k = btn.dataset.k, l = t.luzes.find(x => x.id === k.split(":")[1]);
      if (!painel.hidden && painel.dataset.k === k) { painel.hidden = true; return; }
      const v = r.luzes[k] = r.luzes[k] || {};
      painel.dataset.k = k; painel.hidden = false;
      painel.innerHTML = `<b>${iconeLuz(l)} ${esc(l.nome)}</b>
        <div class="opc vert">${Object.entries(LUZ_ST).map(([st, o]) =>
          `<button type="button" data-st="${st}" class="${v.st === st ? "sel-" + st : ""}">${o.rotulo}</button>`).join("")}</div>
        <textarea placeholder="O que foi? (ex.: lâmpada queimada, sensor)" ${v.st && v.st !== "ok" ? "" : "hidden"}>${esc(v.texto)}</textarea>`;
      const txt = painel.querySelector("textarea");
      painel.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => {
        v.st = b.dataset.st;
        painel.querySelectorAll("[data-st]").forEach(x => x.className = x === b ? "sel-" + v.st : "");
        txt.hidden = v.st === "ok";
        if (v.st === "ok") painel.hidden = true; else txt.focus();
        pintaLuz(btn); progresso(); salvar();
      }));
      txt.addEventListener("input", () => { v.texto = txt.value; salvar(); });
    });
  });
}

async function mensagemAndares(t, r, linhas) {
  const prevs = await anteriores(t);
  const valores = r.valores || {}, luzes = r.luzes || {};
  const conferir = [], vazias = [];
  const bloco = (titulo, filtro, nomear) => {
    linhas.push("", titulo);
    t.itens.forEach((it, i) => {
      if (!filtro(it)) return;
      const v = lerLeitura(valores[it.id], it.casas);
      const nome = nomear(it);
      if (v == null) { linhas.push(`${nome}: (sem leitura)`); vazias.push(it.nome); return; }
      linhas.push(`${nome}: ${fmt(v, it.casas)}`);
      const a = avaliar(t, it, prevs[i], v);
      if (a.alerta) conferir.push(`• ${it.nome}: ${a.motivo} (anterior ${fmt(prevs[i].ant, it.casas)}${notaConferida(r, it)})`);
    });
  };
  bloco("*Água (m³)*", it => it.medidor === "agua", it => String(it.apto));
  bloco("*Medidor geral da Sanepar, na calçada (m³)*", it => it.medidor === "entrada", () => "Geral");
  bloco("*Gás (m³)*", it => it.medidor === "gas", it => String(it.apto));
  if (conferir.length) linhas.push("", "⚠️ Conferir:", ...conferir);

  linhas.push("", "*Iluminação*");
  const ocorr = [], semVer = [];
  for (const a of t.andares) for (const l of t.luzes) {
    const v = luzes[`${a}:${l.id}`] || {};
    if (!v.st) semVer.push(`${a}º ${l.curto.toLowerCase()}`);
    else if (v.st !== "ok") ocorr.push(`• ${a}º andar, ${l.nome.toLowerCase()}: ${v.st === "manut" ? "AVISAR MANUTENÇÃO" : "resolvido"}${v.texto ? " – " + v.texto.trim() : ""}`);
  }
  if (!ocorr.length && !semVer.length) linhas.push("Todos os andares OK.");
  else {
    if (ocorr.length) linhas.push(...ocorr);
    if (semVer.length) linhas.push(semVer.length === t.andares.length * t.luzes.length ? "Não conferida." : `Não conferida: ${semVer.join(", ")}.`);
    else linhas.push("Demais andares OK.");
  }
  const avisos = [];
  if (vazias.length > 6) avisos.push(`Faltam ${vazias.length} leituras.`);
  else if (vazias.length) avisos.push(`Sem leitura: ${vazias.join(", ")}. Se não foi possível ler, explique nas observações.`);
  if (semVer.length) avisos.push(`Iluminação não conferida em ${semVer.length} pontos.`);
  return avisos.join(" ");
}

// Grupos de rega do dia (se hoje não for dia de rega, nenhum)
const gruposRega = () => { const d = diaSemanaSeg(agora()); return REGA.map((g, i) => ({ g, i, hoje: g.dias.includes(d) })); };
const tituloHoje = d => `${SEMANA[d.getDay()][0].toUpperCase() + SEMANA[d.getDay()].slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
const diaSemanaSeg = d => (d.getDay() + 6) % 7;

function cartao(t, classe, q) {
  return `<a class="card ${classe}" href="#/tarefa/${t.id}"><span class="ic">${t.icone}</span>
    <span class="tx"><b>${esc(t.titulo)}</b><span class="q">${esc(q)}</span></span><span class="seta">›</span></a>`;
}

function obsEFotos(r, t) {
  return `<h2>Observações</h2><textarea id="obs" placeholder="Opcional">${esc(r.obs)}</textarea>
    <h2>Fotos</h2><div class="fotos" id="fotos"></div>
    <label class="btn sec">📷 Tirar ou escolher foto<input type="file" id="foto" accept="image/*" multiple></label>
    <button class="btn" id="revisar">${naHora(t) ? "Revisar e enviar" : "Revisar e concluir"}</button>`;
}

async function mostrarFotos(id) {
  const box = document.getElementById("fotos");
  if (!box) return;
  box.querySelectorAll("img").forEach(img => URL.revokeObjectURL(img.src));
  const fotos = await DB.fotos(id);
  box.innerHTML = fotos.length ? "" : `<span class="nota">Nenhuma foto.</span>`;
  for (const f of fotos) {
    const d = document.createElement("div");
    d.innerHTML = `<img alt="Foto" src="${URL.createObjectURL(f.blob)}"><button type="button" aria-label="Apagar foto">×</button>`;
    d.querySelector("button").addEventListener("click", async () => { await DB.apagarFoto(f.id); mostrarFotos(id); });
    box.appendChild(d);
  }
}

// Reduz a foto para no máximo 1600 px, para o envio ficar leve
async function reduzir(arq) {
  try {
    const bmp = await createImageBitmap(arq);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(b => ok(b || arq), "image/jpeg", 0.82));
  } catch { return arq; }
}

async function montarMensagem(t, e, r, nFotos) {
  const hoje = agora();
  const linhas = [`*Maison Lafitte · ${t.titulo}*`];
  let falta = "";
  if (t.regra) {
    const p = Agenda.periodoAtual(t, e.feitas[t.id] || {}, e.inicio, hoje);
    linhas.push(`Data: ${dataBr(hoje)}`);
  }
  if (t.tipo === "leituras") {
    const prevs = await anteriores(t);
    const conferir = [], vazias = [];
    linhas.push(`Unidade: ${t.medida}`, "");
    t.itens.forEach((it, i) => {
      const v = lerLeitura((r.valores || {})[it.id], it.casas);
      const nome = it.nome.replace(/^Apto |^Carregador apto /, "");
      if (v == null) { linhas.push(`${nome}: (sem leitura)`); vazias.push(nome); return; }
      linhas.push(`${nome}: ${fmt(v, it.casas)}`);
      const a = avaliar(t, it, prevs[i], v);
      if (a.alerta) conferir.push(`• ${it.nome}: ${a.motivo} (anterior ${fmt(prevs[i].ant, it.casas)}${notaConferida(r, it)})`);
    });
    if (conferir.length) linhas.push("", "⚠️ Conferir:", ...conferir);
    if (vazias.length) falta = `Sem leitura: ${vazias.join(", ")}. Se não foi possível ler, explique nas observações.`;
  } else if (t.tipo === "andares") {
    falta = await mensagemAndares(t, r, linhas);
  } else if (t.tipo === "rega") {
    linhas.push("");
    const sem = [];
    for (const { g, i, hoje: hj } of gruposRega()) {
      if (!hj) continue;
      const v = (r.rega || {})[i];
      linhas.push(`${g.nome}: ${v === "ok" ? "✅ regado" : v === "chuva" ? "🌧️ não regado (choveu)" : "❌ não regado"}`);
      if (!v) sem.push(g.nome);
    }
    if (sem.length) falta = `Falta marcar: ${sem.join(", ")}.`;
  } else if (t.tipo === "feito") {
    linhas.push("", "✅ Feita");
  } else if (t.tipo === "checklist") {
    const itens = (LIMPEZA[diaSemanaSeg(hoje)] || []).map(([ini, , txt, tipo], i) => ({ ini, txt, tipo, i })).filter(x => x.tipo !== "g");
    const nao = itens.filter(x => !(r.feitos || {})[x.i]);
    linhas.push("", `Feito: ${itens.length - nao.length} de ${itens.length}`);
    if (nao.length) { linhas.push("Não feito:", ...nao.map(x => `• ${x.ini} ${x.txt}`)); falta = `Faltam ${nao.length}. Se não deu, explique nas observações.`; }
  } else if (t.tipo === "inspecao") {
    linhas.push("");
    const sem = [];
    for (const it of t.itens) {
      const v = (r.insp || {})[it.id] || {};
      const st = v.status === "ok" ? "✅ normal" : v.status === "prob" ? "⚠️ COM PROBLEMA" : "(não verificado)";
      if (!v.status) sem.push(it.nome);
      linhas.push(`${it.nome}: ${st}${v.texto ? " – " + v.texto.trim() : ""}`);
    }
    if (sem.length) falta = `Não marcado: ${sem.join(", ")}.`;
  } else if (t.tipo === "abastecimento") {
    const a = r.abast || {};
    const kg = lerNumero(a.kg), valor = lerNumero(a.valor);
    linhas.push(`Data: ${a.data ? dataBr(Agenda.deIso(a.data)) : "(sem data)"}`);
    linhas.push(`Quantidade: ${kg != null && !Number.isNaN(kg) ? fmt(kg, kg % 1 ? 1 : 0) + " kg" : "(não informada)"}`);
    linhas.push(`Valor por kg: ${valor != null && !Number.isNaN(valor) ? real(valor) : "(não informado)"}`);
    if (kg && valor) linhas.push(`Total: ${real(kg * valor)}`);
    if (!a.data || !kg || !valor) falta = "Preencha data, quantidade e valor por kg.";
  }
  if (r.obs && r.obs.trim()) linhas.push("", `Obs.: ${r.obs.trim()}`);
  if (nFotos) linhas.push("", `Fotos: ${nFotos} (enviadas em seguida)`);
  return { texto: linhas.join("\n"), falta };
}

async function compartilharFotos(t, fotos) {
  const arquivos = fotos.map((f, i) => new File([f.blob], `${t.id}_${Agenda.iso(agora())}_${i + 1}.jpg`, { type: "image/jpeg" }));
  if (navigator.canShare && navigator.canShare({ files: arquivos })) {
    try { await navigator.share({ files: arquivos, text: `Fotos · ${t.titulo} · ${dataBr(agora())}` }); }
    catch (err) { if (err.name !== "AbortError") aviso("Não foi possível abrir o envio das fotos."); }
    return;
  }
  // Sem compartilhamento: baixa as fotos para a galeria, para anexar no WhatsApp
  for (const a of arquivos) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(a); link.download = a.name; link.click();
  }
  aviso("As fotos foram salvas no celular. Anexe-as na conversa do WhatsApp.");
}

async function concluir(t, r, texto, nFotos, enviado) {
  const e = await estado();
  const hoje = agora();
  let chave = null;
  if (t.regra) {
    const p = Agenda.periodoAtual(t, e.feitas[t.id] || {}, e.inicio, hoje);
    chave = p.chave;
    e.feitas[t.id] = { ...(e.feitas[t.id] || {}), [p.chave]: Agenda.iso(hoje) };
    await DB.gravar("estado", e);
  }
  if (t.tipo === "leituras") {
    const prevs = await anteriores(t);
    const valores = {}, ant = {};
    t.itens.forEach((it, i) => {
      const v = lerLeitura((r.valores || {})[it.id], it.casas);
      if (v != null) { valores[it.id] = v; ant[it.id] = prevs[i].ant; }
    });
    await DB.gravar("ultimas:" + t.id, { data: Agenda.iso(hoje), valores, anteriores: ant });
  }
  const regs = (await DB.ler("registros")) || [];
  regs.unshift({ quando: hoje.toISOString(), dia: Agenda.iso(hoje), hora: hoje.toTimeString().slice(0, 5), id: t.id, chave,
    titulo: t.titulo, icone: t.icone, texto, curto: resumoCurto(t, r, nFotos, enviado, hoje) });
  await DB.gravar("registros", regs.slice(0, 3000));
  await DB.gravar("rascunho:" + t.id, {});
  await DB.apagarFotos(t.id);
  location.hash = "#/p/" + t.quem;
  aviso(enviado ? "Tarefa concluída ✔" : "Tarefa concluída ✔");
}

// ---------- envio: na hora ou no resumo da semana ----------
const naHora = t => ["leituras", "andares", "abastecimento"].includes(t.tipo);
const temProblema = (t, r) => t.tipo === "inspecao" && t.itens.some(it => ((r.insp || {})[it.id] || {}).status === "prob");
const linkZap = texto => `https://wa.me/${String(CONFIG.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

// Linhas curtas de uma tarefa para os resumos
function resumoCurto(t, r, nFotos, enviado, hoje) {
  const L = [];
  if (t.tipo === "rega") {
    const gs = gruposRega().filter(g => g.hoje), v = r.rega || {};
    const ok = gs.filter(g => v[g.i] === "ok").length, chuva = gs.filter(g => v[g.i] === "chuva").length;
    L.push(`✅ ${ok} de ${gs.length} regados${chuva ? `, ${chuva} não (choveu)` : ""}`);
    const nao = gs.filter(g => !v[g.i]).map(g => g.g.nome);
    if (nao.length) L.push(`❌ Não regado: ${nao.join(", ")}`);
  } else if (t.tipo === "feito") {
    L.push("✅ Feita");
  } else if (t.tipo === "checklist") {
    const itens = (LIMPEZA[diaSemanaSeg(hoje)] || []).map(([ini, , txt, tipo], i) => ({ ini, txt, tipo, i })).filter(x => x.tipo !== "g");
    const nao = itens.filter(x => !(r.feitos || {})[x.i]);
    L.push(`${nao.length ? "⚠️" : "✅"} ${itens.length - nao.length} de ${itens.length} feitas`);
    if (nao.length) L.push(`❌ Não feito: ${nao.map(x => `${x.ini} ${x.txt}`).join("; ")}`);
  } else if (t.tipo === "inspecao") {
    const v = r.insp || {};
    const prob = t.itens.filter(it => (v[it.id] || {}).status === "prob");
    const sem = t.itens.filter(it => !(v[it.id] || {}).status);
    if (!prob.length && !sem.length) L.push("✅ Tudo normal");
    prob.forEach(it => L.push(`⚠️ ${it.nome}${v[it.id].texto ? ": " + v[it.id].texto.trim() : ""}`));
    if (sem.length) L.push(`❌ Não verificado: ${sem.map(it => it.nome).join(", ")}`);
  }
  if (enviado) L.push(`📤 Enviada na hora`);
  if (r.obs && r.obs.trim()) L.push(`Obs.: ${r.obs.trim()}`);
  if (nFotos) L.push(`📷 ${nFotos} ${nFotos === 1 ? "foto" : "fotos"}`);
  return L;
}

// Resumos para o síndico: da semana (seg a dom) toda segunda; do mês no dia 1º.
// Se não for enviado, o próximo cobre também o período que ficou para trás.
async function relatoriosDevidos(e, hoje) {
  const env = (await DB.ler("relatorios")) || {};
  const h = Agenda.semHora(hoje), lista = [];
  const desde = fimAnt => fimAnt ? Agenda.somaDias(Agenda.deIso(fimAnt), 1) : Agenda.deIso(e.inicio);
  const domingo = Agenda.somaDias(h, -(diaSemanaSeg(h) + 1));
  const iniS = desde(env.semana);
  if ((domingo - iniS) / 86400000 >= 6) lista.push({ tipo: "semana", titulo: "Resumo da semana", ini: Agenda.iso(iniS), fim: Agenda.iso(domingo) });
  const fimMes = new Date(h.getFullYear(), h.getMonth(), 0);
  const iniM = desde(env.mes);
  if (fimMes >= iniM) {
    const iniMes = new Date(fimMes.getFullYear(), fimMes.getMonth(), 1);
    lista.push({ tipo: "mes", titulo: `Total de ${MESES[fimMes.getMonth()]}`, ini: Agenda.iso(iniM > iniMes ? iniM : iniMes), fim: Agenda.iso(fimMes) });
  }
  return lista;
}

// Datas em que a tarefa devia ser feita entre ini e fim (Date), com a chave usada em estado.feitas
function ocorrencias(t, ini, fim) {
  const g = t.regra, lista = [];
  if (g.tipo === "semana") {
    for (let d = ini; d <= fim; d = Agenda.somaDias(d, 1)) if (g.dias.includes(diaSemanaSeg(d))) lista.push({ chave: Agenda.iso(d), venc: d });
  } else if (g.tipo === "datas") {
    for (const s of g.datas) { const d = Agenda.somaDias(Agenda.deIso(s), g.desloc || 0); if (d >= ini && d <= fim) lista.push({ chave: Agenda.iso(d), venc: d }); }
  } else {
    for (let a = ini.getFullYear(), m = ini.getMonth(); a < fim.getFullYear() || (a === fim.getFullYear() && m <= fim.getMonth()); m === 11 ? (a++, m = 0) : m++) {
      const d = Agenda.vencimento(g, a, m);
      if ((!g.meses || g.meses.includes(m)) && d >= ini && d <= fim) lista.push({ chave: `${a}-${String(m + 1).padStart(2, "0")}`, venc: d });
    }
  }
  return lista;
}

async function textoRelatorio(rel, e) {
  const ini = Agenda.deIso(rel.ini), fim = Agenda.deIso(rel.fim), mes = rel.tipo === "mes";
  const regs = ((await DB.ler("registros")) || []).filter(x => x.dia >= rel.ini && x.dia <= rel.fim).reverse();
  const dm = d => dataBr(d).slice(0, 5);
  const linhas = [`*Maison Lafitte · ${rel.titulo}*`, `${dataBr(ini)} a ${dataBr(fim)}`];
  for (const t of TAREFAS) {
    const oc = t.regra ? ocorrencias(t, ini, fim) : [];
    const feitos = regs.filter(x => x.id === t.id);
    if (!oc.length && !feitos.length) continue;
    const feitas = (e.feitas || {})[t.id] || {};
    const nao = oc.filter(o => !feitas[o.chave]);
    linhas.push("", `${t.icone} *${t.titulo}*`);
    if (mes) {
      linhas.push(oc.length ? `   ${nao.length ? "⚠️" : "✅"} ${oc.length - nao.length} de ${oc.length} feitas` : `   ${feitos.length} ${feitos.length === 1 ? "vez" : "vezes"}`);
      if (nao.length) linhas.push(`   ❌ Não feita: ${nao.map(o => dm(o.venc)).join(", ")}`);
      if (t.tipo === "checklist") {
        const inc = feitos.filter(x => /^⚠️/.test(x.curto[0] || "")).length;
        if (inc) linhas.push(`   ⚠️ Incompleta em ${inc} ${inc === 1 ? "dia" : "dias"}`);
      }
      for (const x of feitos) for (const l of x.curto)
        if (/^(⚠️ [^0-9]|Obs\.)/.test(l) || (t.tipo !== "checklist" && /^❌/.test(l))) linhas.push(`   ${dm(Agenda.deIso(x.dia))} ${l}`);
    } else {
      // Dias em que tudo foi feito ficam numa linha só; o resto, um por linha
      const ok = [], resto = [];
      for (const o of oc) {
        const x = feitos.find(x => x.chave === o.chave);
        const noDia = !x || x.dia === Agenda.iso(o.venc);
        if (feitas[o.chave] && noDia && (!x || (x.curto.length === 1 && /^✅/.test(x.curto[0])))) ok.push(dm(o.venc));
        else resto.push({ o, x });
      }
      if (ok.length) linhas.push(`   ✅ ${ok.join(", ")}`);
      for (const { o, x } of resto) {
        if (!x && !feitas[o.chave]) linhas.push(`   ${dm(o.venc)}: ❌ não feita`);
        else if (!x) linhas.push(`   ${dm(o.venc)}: ✅ feita em ${dm(Agenda.deIso(feitas[o.chave]))}`);
        else linhas.push(`   ${dm(o.venc)}: ${x.curto[0] || "✅ feita"}${x.dia !== Agenda.iso(o.venc) ? ` (em ${dm(Agenda.deIso(x.dia))})` : ""}`, ...x.curto.slice(1).map(l => "      " + l));
      }
      for (const x of oc.length ? [] : feitos) linhas.push(`   ${dm(Agenda.deIso(x.dia))}: ${x.curto[0] || "✅ feita"}`, ...x.curto.slice(1).map(l => "      " + l));
    }
  }
  if (linhas.length === 2) linhas.push("", "Nenhuma tarefa no período.");
  return linhas.join("\n");
}

// Arquivo de texto com tudo o que foi feito no mês, para guardar ou repassar
async function enviarArquivo(regs, mes) {
  const doMes = regs.filter(x => x.dia.startsWith(mes)).reverse();
  const corpo = [`Maison Lafitte · Lafitte em Dia · ${refMes(mes)}`, ""];
  for (const x of doMes) corpo.push(`===== ${dataBr(Agenda.deIso(x.dia))} ${x.hora} · ${x.titulo}`, x.texto, "");
  const arq = new File([corpo.join("\n")], `Lafitte_em_Dia_${mes}.txt`, { type: "text/plain" });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], text: `Lafitte em Dia · ${refMes(mes)}` }); }
    catch (err) { if (err.name !== "AbortError") aviso("Não foi possível abrir o envio do arquivo."); }
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(arq); link.download = arq.name; link.click();
  aviso("O arquivo foi salvo no celular.");
}

function aviso(txt) {
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function atualizarSelo(n) {
  try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch {}
}

async function ativarAvisos() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return aviso("Os avisos não foram permitidos.");
  await registrarVerificacao();
  aviso("Avisos ativados.");
}

// Pede ao Android para abrir o app em segundo plano periodicamente e avisar das tarefas pendentes
async function registrarVerificacao() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("periodicSync" in reg) {
      const st = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (st.state === "granted") await reg.periodicSync.register("tarefas", { minInterval: 4 * 3600 * 1000 });
    }
  } catch {}
}

// ---------- rotas e tamanho da letra ----------
async function rota() {
  const [, tela, id] = (location.hash || "#/").split("/");
  const voltar = document.querySelector(".voltar");
  voltar.classList.toggle("oculto", !tela);
  const t = tarefa(id);
  if (t && (tela === "tarefa" || tela === "enviar")) { voltar.href = "#/p/" + t.quem; voltar.textContent = "← Voltar"; }
  else { voltar.href = "#/"; voltar.textContent = "← Início"; }
  window.scrollTo(0, 0);
  if (tela === "tarefa") await TELAS.tarefa(id);
  else if (tela === "enviar") await TELAS.enviar(id);
  else if (tela === "historico") await TELAS.historico();
  else if (tela === "relatorio") await TELAS.relatorio(id);
  else if (tela === "p") await TELAS.pessoa(id);
  else await TELAS.inicio();
}
window.addEventListener("hashchange", rota);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !location.hash.startsWith("#/tarefa")) rota(); });

const NIVEIS = [0.85, 1, 1.15, 1.3, 1.5];
let nivel = 1;
try { nivel = Number(localStorage.getItem("zoom") ?? 1); } catch {}
const aplicaZoom = () => document.documentElement.style.setProperty("--z", NIVEIS[nivel]);
aplicaZoom();
document.querySelector(".zoom").addEventListener("click", ev => {
  const z = Number(ev.target.dataset.z || 0);
  if (!z) return;
  nivel = Math.max(0, Math.min(NIVEIS.length - 1, nivel + z));
  aplicaZoom();
  try { localStorage.setItem("zoom", nivel); } catch {}
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(() => {
    if ("Notification" in window && Notification.permission === "granted") registrarVerificacao();
  }).catch(() => {});
}
if (CONFIG.teste) {
  const barra = document.createElement("div");
  barra.className = "teste";
  barra.innerHTML = `<label for="data-teste">🧪 Teste: simular o dia</label>
    <input type="date" id="data-teste" value="${dataTeste || Agenda.iso(new Date())}"><button type="button" id="data-hoje">Hoje</button>`;
  document.querySelector("header").after(barra);
  const mudar = v => {
    dataTeste = v && v !== Agenda.iso(new Date()) ? v : null;
    try { dataTeste ? localStorage.setItem("dataTeste", dataTeste) : localStorage.removeItem("dataTeste"); } catch {}
    document.getElementById("data-teste").value = dataTeste || Agenda.iso(new Date());
    rota();
  };
  document.getElementById("data-teste").addEventListener("change", ev => mudar(ev.target.value));
  document.getElementById("data-hoje").addEventListener("click", () => mudar(null));
}
rota();
