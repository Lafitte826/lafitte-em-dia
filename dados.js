// Dados do app do zelador do Maison Lafitte.
// Leituras anteriores tiradas da planilha mestre (Condominio_Mestre_5.xlsx) em 25/10/2026.
// Para atualizar: troque os valores de "ant" (última leitura) e "ant2" (penúltima) e a data em "antData".

const CONFIG = {
  versao: "2026.10.25-11",
  // Número do síndico com DDI e DDD, só dígitos (ex.: 5541999999999).
  // Vazio: o WhatsApp abre e pergunta para quem enviar.
  whatsapp: "5541998767915",
  // Tarefas com data anterior a esta não aparecem como atrasadas.
  inicio: "2026-10-25",
  // Versão de teste: mostra a barra para simular outro dia. Na versão do celular fica false.
  teste: true,
};

const UNIDADES = [101, 102, 201, 202, 301, 302, 401, 402, 501, 502, 601, 602, 701, 702, 801, 802,
  901, 902, 1001, 1002, 1101, 1102, 1201, 1202, 1301, 1302, 1401, 1402, 1501, 1502];

// [penúltima, última] leitura de setembro/2026 (dia 29), em m³
const AGUA = {"101":[2103.31,2115.45],"102":[2036.539,2057.192],"201":[3371.9,3404.042],"202":[2267.078,2284.681],"301":[1724.837,1732.112],"302":[2081.849,2102.728],"401":[2480.514,2494.835],"402":[1093.867,1103.444],"501":[2063.605,2094.654],"502":[1723.769,1727.877],"601":[2706.661,2727.594],"602":[3345.919,3389.162],"701":[1901.559,1918.035],"702":[1320.565,1339.376],"801":[1231.933,1244.196],"802":[1862.173,1888.47],"901":[1006.153,1018.696],"902":[2960.049,2981.478],"1001":[762.38,769.639],"1002":[1547.442,1547.449],"1101":[934.343,944.475],"1102":[3552.105,3585.462],"1201":[718.604,720.532],"1202":[1310.985,1323.244],"1301":[1671.45,1684.857],"1302":[1795.96,1815.281],"1401":[1935.437,1949.984],"1402":[656.117,668.037],"1501":[1482.507,1483.359],"1502":[2867.154,2891.944]};

// [nº do relógio, penúltima, última] leitura de setembro/2026 (dia 29), em m³
const GAS = {"101":[20072487,698.446,709.685],"102":[20072486,766.818,777.986],"201":[15046343,1839.962,1866.2],"202":[20072481,622.717,640.037],"301":[20072491,332.593,337.435],"302":[20072504,597.181,607.142],"401":[20072496,797.324,804.744],"402":[20072492,206.502,209.302],"501":[20072508,803.79,820.247],"502":[20072493,726.739,729.799],"601":[20072502,949.82,962.137],"602":[16051976,2416.885,2443.965],"701":[20072501,110.108,113.895],"702":[20072507,233.826,240.376],"801":[20072503,571.902,581.607],"802":[20072510,562.393,573.986],"901":[20072494,392.375,399.138],"902":[20072497,1035.739,1051.407],"1001":[20072482,228.987,232.536],"1002":[20072484,570.074,570.074],"1101":[20052612,341.973,347.592],"1102":[20072488,1316.358,1339.993],"1201":[20072489,204.173,204.173],"1202":[20072485,495.259,502.462],"1301":[20072506,588.438,596.418],"1302":[20072509,627.929,638.335],"1401":[20072483,821.203,831.027],"1402":[20072490,205.82,209.003],"1501":[20072495,554.808,554.808],"1502":[20072505,1038.058,1055.802]};

// [penúltima, última] leitura dos carregadores, em kWh (setembro e outubro/2026)
const CARREGADOR = {"201":[222,308],"502":[292,292],"602":[419,549],"801":[0,0],"902":[447,614],"1001":[592,830],"1301":[0,0]};

// Rega: copiado de /mnt/project-files/regas/config.json em 25/10/2026 (dias: 0 = segunda ... 6 = domingo)
// Regra da chuva: se chover no dia anterior ou no dia, não rega, exceto a planta da escada.
const REGA = [
 {
  "nome": "Grupo 1",
  "dias": [
   2
  ],
  "quando": "Quartas-feiras",
  "fotos": [
   {
    "src": "plantas/c1_1.jpg",
    "litros": "1 litro",
    "legenda": "Em cada vaso, bem espalhado."
   },
   {
    "src": "plantas/c1_2.jpg",
    "litros": "2 litros",
    "legenda": "Bem espalhado."
   },
   {
    "src": "plantas/c1_3.jpg",
    "litros": "1 litro",
    "legenda": "Bem espalhado."
   }
  ],
  "agua": "",
  "chuva": false,
  "alerta": ""
 },
 {
  "nome": "Grupo 2",
  "dias": [
   0,
   4
  ],
  "quando": "Segunda e sexta",
  "fotos": [
   {
    "src": "plantas/c2_1.jpg",
    "litros": "3 litros",
    "legenda": "4 floreiras de liríope, bem espalhado."
   },
   {
    "src": "plantas/c2_2.jpg",
    "litros": "2 litros",
    "legenda": "Bem espalhado."
   }
  ],
  "agua": "",
  "chuva": true,
  "alerta": ""
 },
 {
  "nome": "Grupo 3",
  "dias": [
   0,
   2,
   4
  ],
  "quando": "Segunda, quarta e sexta",
  "fotos": [
   {
    "src": "plantas/c3_1.jpg",
    "litros": "1 litro",
    "legenda": "Em cada vaso, bem espalhado."
   },
   {
    "src": "plantas/c3_2.jpg",
    "litros": "2 litros",
    "legenda": "Bem espalhados."
   },
   {
    "src": "plantas/c3_3.jpg",
    "litros": "2 litros",
    "legenda": "Em cada vaso, bem espalhados."
   }
  ],
  "agua": "",
  "chuva": true,
  "alerta": "Exceto a da escada, que tem que manter a rega."
 },
 {
  "nome": "Grupo 4",
  "dias": [
   0,
   2,
   4
  ],
  "quando": "Segunda, quarta e sexta",
  "fotos": [
   {
    "src": "plantas/c4_1.jpg",
    "litros": "",
    "legenda": ""
   },
   {
    "src": "plantas/c4_2.jpg",
    "litros": "",
    "legenda": ""
   }
  ],
  "agua": "Bem molhado",
  "chuva": true,
  "alerta": ""
 },
 {
  "nome": "Grupo 5",
  "dias": [
   0,
   2,
   4
  ],
  "quando": "Segunda, quarta e sexta",
  "fotos": [
   {
    "src": "plantas/c5_1.jpg",
    "litros": "",
    "legenda": ""
   },
   {
    "src": "plantas/c5_2.jpg",
    "litros": "",
    "legenda": ""
   },
   {
    "src": "plantas/c5_3.jpg",
    "litros": "",
    "legenda": ""
   },
   {
    "src": "plantas/c5_4.jpg",
    "litros": "",
    "legenda": ""
   },
   {
    "src": "plantas/c5_5.jpg",
    "litros": "",
    "legenda": ""
   }
  ],
  "agua": "Bem molhado",
  "chuva": true,
  "alerta": ""
 }
];

// Limpeza diária: plano do site (portal-condominio), com horários. 0 = segunda.
// [início, fim, atividade, tipo]; tipo "g" = apoio (portaria, almoço), aparece mas não se marca.
const L_HALL = ["08:30", "09:30", "Hall térreo, escadas e clausura"];
const L_ALM = [["11:30", "12:00", "Atendimento da portaria", "g"], ["12:00", "12:30", "Almoço", "g"]];
const L_ELEV = [["14:30", "15:00", "Elevadores"], ["15:00", "15:30", "Banheiros"]];
const LIMPEZA = [
  [L_HALL, ["09:30", "11:30", "Muros de vidro"], ...L_ALM, ["12:30", "14:30", "Hall térreo (completa)"], ...L_ELEV, ["15:30", "16:00", "Escadas e clausura"], ["16:00", "16:30", "Limpeza geral"]],
  [L_HALL, ["09:30", "11:30", "Calçada externa, clausura e escadas (completa)"], ...L_ALM, ["12:30", "14:30", "Lixeiras, playground e quadra"], ...L_ELEV, ["15:30", "16:30", "Hall térreo, escadas e clausura"]],
  [L_HALL, ["09:30", "11:30", "Áreas externas comuns (acesso de serviço e pátios)"], ...L_ALM, ["12:30", "14:30", "Guarita, cozinha e escritório"], ...L_ELEV, ["15:30", "16:30", "Hall térreo, escadas e clausura"]],
  [L_HALL, ["09:30", "10:30", "Hall de serviço dos andares"], ["10:30", "11:30", "Escadas de incêndio"], ...L_ALM, ["12:30", "14:30", "Salão de festas e de jogos"], ...L_ELEV, ["15:30", "16:30", "Hall térreo, escadas e clausura"]],
  [L_HALL, ["09:30", "11:30", "Garagens (um piso a cada semana)"], ...L_ALM, ["12:30", "14:30", "Hall térreo (completa)"], ...L_ELEV, ["15:30", "16:00", "Escadas e clausura"], ["16:00", "16:30", "Limpeza geral"]],
  [L_HALL, ["09:30", "10:30", "Hall social dos andares"], ["10:30", "12:00", "Limpeza geral"]],
];

// Festas no salão: só as datas (o resto fica com o síndico). 24/12 e 31/12: reserva de fim de ano (sorteio).
const FESTAS = ["2026-11-28", "2026-12-04", "2026-12-12", "2026-12-13", "2026-12-17", "2026-12-24", "2026-12-31", "2027-01-30"];

const PESSOAS = [
  { id: "zelador", nome: "Zelador", icone: "🧰" },
  { id: "limpeza", nome: "Limpeza", icone: "🧽" },
  { id: "portaria", nome: "Portaria", icone: "🛎️" },
];

const TAREFAS = [
  {
    // Dia 29: o zelador sobe ao 15º e desce pela escada. Em cada andar lê água e gás dos dois aptos
    // e confere a iluminação do hall de serviço e a de emergência da escada. No fim, o medidor geral, na calçada.
    id: "leitura29", quem: "zelador", tipo: "andares", icone: "💧",
    titulo: "Leituras do dia 29",
    resumo: "Água, gás e luzes dos andares",
    regra: { tipo: "dia", dia: 29 }, antData: "2026-09-29",
    andares: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    luzes: [
      { id: "hall", nome: "Luz do hall de serviço", curto: "Hall", icone: "💡" },
      { id: "emerg", nome: "Luz de emergência da escada", curto: "Escada", icone: "💡" },
    ],
    itens: [
      ...UNIDADES.flatMap(u => [
        { id: "agua:" + u, apto: u, medidor: "agua", nome: "Água " + u, casas: 3, medida: "m³", ant: AGUA[u][1], ant2: AGUA[u][0] },
        { id: "gas:" + u, apto: u, medidor: "gas", nome: "Gás " + u, extra: "Relógio " + GAS[u][0], casas: 3, medida: "m³", ant: GAS[u][2], ant2: GAS[u][1] },
      ]),
      { id: "agua:entrada", medidor: "entrada", nome: "Medidor geral (Sanepar)", casas: 0, medida: "m³", ant: 517, ant2: 220 },
    ],
  },
  {
    // Medidores de energia: quadro geral, áreas comuns e carregadores (medidor e um por apto com carregador).
    id: "copel", quem: "zelador", tipo: "leituras", icone: "⚡",
    titulo: "Leitura de energia",
    resumo: "Medidores da Copel e carregadores",
    regra: { tipo: "dia", dia: 9 }, medida: "kWh", antData: "2026-10-09",
    itens: [
      // Contas da Copel de 10/2026 (leitura em 08/10/2026)
      { id: "geral", grupo: "Copel", nome: "Condomínio (S2)", extra: "Medidor 0222645101", casas: 0, ant: 6504, ant2: 4515 },
      { id: "comuns", grupo: "Copel", nome: "Zelador (S1)", extra: "Medidor 0240832114", casas: 0, ant: 21125, ant2: 21070 },
      { id: "copel", grupo: "Copel", nome: "Eletroposto (carregadores)", extra: "Medidor 0390169831", casas: 0, ant: 14388, ant2: 13748 },
      ...Object.keys(CARREGADOR).map(u => ({ id: u, grupo: "Carregador de cada apto", nome: "Apto " + u, casas: 0, ant: CARREGADOR[u][1], ant2: CARREGADOR[u][0] })),
    ],
  },
  {
    id: "inspecao", quem: "zelador", tipo: "inspecao", icone: "🚰",
    titulo: "Sistema de água",
    resumo: "Toda terça",
    regra: { tipo: "semana", dias: [1], acumula: true },
    itens: [
      { id: "bomba", nome: "Motores da caixa d'água" },
      { id: "comando", nome: "Comando das bombas" },
      { id: "cisternas", nome: "Nível da cisterna" },
      { id: "caixa", nome: "Caixa d'água" },
    ],
  },
  {
    id: "rega", quem: "zelador", tipo: "rega", icone: "🪴",
    titulo: "Rega das plantas", resumo: "Segunda, quarta e sexta",
    regra: { tipo: "semana", dias: [0, 2, 4] },
  },
  {
    id: "luzes", quem: "zelador", tipo: "inspecao", icone: "💡",
    titulo: "Luzes das áreas comuns", resumo: "Toda quinta, ao anoitecer",
    regra: { tipo: "semana", dias: [3], acumula: true },
    itens: [
      ...["Muros", "Calçada", "Jardim", "Salão de Festas", "Salão de Jogos", "Hall", "Garagem -1", "Garagem -2", "Área Coberta", "Deck"]
        .map((nome, i) => ({ id: "l" + i, nome })),
    ],
  },
  {
    id: "hidraulica", quem: "zelador", tipo: "inspecao", icone: "🚿",
    titulo: "Banheiros e torneiras", resumo: "Áreas comuns, toda terça",
    regra: { tipo: "semana", dias: [1], acumula: true },
    itens: [
      { id: "descargas", nome: "Descargas" },
      { id: "torneiras", nome: "Torneiras" },
      { id: "vazamentos", nome: "Vazamentos" },
      { id: "ralos", nome: "Ralos" },
    ],
  },
  // Limpezas grandes: aparecem no 1º dia útil do mês e ficam até alguém confirmar, mesmo virando o mês.
  // Meses tirados do calendário de limpezas grandes do site (0 = janeiro).
  ...[
    ["grande-externa", "Área externa, quadra e calçada", [0, 2, 4, 6, 8, 10]],
    ["grande-play", "Playground", [1, 3, 5, 7, 9, 11]],
    ["grande-garagens", "Garagens", [1, 7]],
  ].map(([id, nome, meses]) => ({
    id, quem: "zelador", tipo: "feito", icone: "🫧",
    titulo: "Limpeza grande: " + nome, resumo: "Lavagem completa",
    regra: { tipo: "util1", meses },
  })),
  {
    id: "limpeza", quem: "limpeza", tipo: "checklist", icone: "🧽",
    titulo: "Limpeza de hoje", resumo: "Segunda a sábado",
    regra: { tipo: "semana", dias: [0, 1, 2, 3, 4, 5] },
  },
  {
    id: "salao-antes", quem: "zelador", tipo: "inspecao", icone: "🎉",
    titulo: "Salão: festa amanhã", resumo: "Conferir na véspera",
    regra: { tipo: "datas", datas: FESTAS, desloc: -1, validade: 1 },
    itens: [
      { id: "limpo", nome: "Salão limpo" },
      { id: "ordem", nome: "Tudo em ordem" },
    ],
  },
  {
    id: "salao-depois", quem: "zelador", tipo: "inspecao", icone: "🧹",
    titulo: "Salão: depois da festa", resumo: "Conferir no dia seguinte",
    regra: { tipo: "datas", datas: FESTAS, desloc: 1, validade: 3 },
    itens: [
      { id: "limpo", nome: "Salão limpo" },
      { id: "ordem", nome: "Tudo em ordem" },
    ],
  },
  {
    id: "abastecimento", quem: "portaria", tipo: "abastecimento", icone: "🚚",
    titulo: "Caminhão de gás",
    resumo: "Quando o caminhão abastecer",
    regra: null,
  },
];
