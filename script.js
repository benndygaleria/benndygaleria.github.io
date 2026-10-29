/* ============================================================
   BenndyGaleria · script
   Lê o conteudo.json (português) e o traducoes.json (inglês e
   espanhol) e monta a página. Para trocar textos, preços ou
   imagens, edite os JSON; aqui não precisa mexer.
   ============================================================ */

(() => {
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
  const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouseFino = matchMedia("(pointer: fine)").matches;

  const esc = (texto) =>
    String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pegar = (obj, caminho) => caminho.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const normalizar = (t) => String(t ?? "").toLowerCase().replace(/[\s()-]/g, "");
  const preencher = (modelo, dados) => String(modelo ?? "").replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? "");

  // junta o conteúdo em português com a tradução; o que não foi traduzido fica em português
  const mesclar = (base, extra) => {
    if (extra == null || extra === "") return base;
    if (Array.isArray(base)) {
      if (!Array.isArray(extra)) return base;
      if (base.every((x) => typeof x !== "object")) return extra.length ? extra : base;
      return base.map((item, i) => mesclar(item, extra[i]));
    }
    if (base && typeof base === "object") {
      const saida = { ...base };
      for (const k of Object.keys(extra)) saida[k] = k in base ? mesclar(base[k], extra[k]) : extra[k];
      return saida;
    }
    return extra;
  };

  // pétala (a mesma do cabelo do personagem): usada como marcador em listas e na faixa
  const PETALA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1C18 5 20 13 12 23 4 13 6 5 12 1Z"/></svg>';

  const ICONES = {
    telegram: '<path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6 0 1.9l4.6 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.6.1 1.8-.7L22.9 4.9c.2-1-.6-1.8-1.4-1.4Z"/><path d="m7.4 14.2 10-7.2-7.6 8.4"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".6" fill="currentColor"/>',
    bluesky: '<path d="M12 11.2C10.6 8.4 6.8 4 4.3 4 2.9 4 3 6 3.3 8.3c.4 2.4 2.1 3.8 5.3 3.6-3.7.9-3.4 3.9-1 5.7 2.7 2 3.9-1.8 4.4-3.7.5 1.9 1.7 5.7 4.4 3.7 2.4-1.8 2.7-4.8-1-5.7 3.2.2 4.9-1.2 5.3-3.6C21 6 21.1 4 19.7 4 17.2 4 13.4 8.4 12 11.2Z"/>',
    x: '<path d="M4 4h4.6L20 20h-4.6Z"/><path d="m19.6 4-6.7 7.3M4.4 20l6.7-7.3"/>',
    padrao: '<path d="M10 14 21 3M15 3h6v6"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>'
  };

  // Quanto da figura cada tamanho mostra (em uma figura de 40 de altura)
  const CORTES = { icon: 15, headshot: 15, busto: 26, halfbody: 26, fullbody: 40 };
  const iconeCorte = (tipo) => {
    const altura = CORTES[normalizar(tipo)];
    if (!altura) return "";
    return `<svg class="icone-corte" viewBox="0 0 24 40" aria-hidden="true">
      <circle class="corpo" cx="12" cy="7" r="4.3"/>
      <path class="corpo" d="M5.5 26V17.5Q5.5 12.6 12 12.6T18.5 17.5V26Z"/>
      <path class="pernas" d="M9 26v12M15 26v12"/>
      <rect class="corte" x="1" y="1" width="22" height="${altura - 2}" rx="2.5"/>
    </svg>`;
  };

  /* ---------------- idioma e moeda ---------------- */

  let BASE = null;        // conteudo.json
  let TRAD = null;        // traducoes.json
  let idioma = "pt";

  // cada preço tem um valor em real (brl) e outro em dólar (usd); não é conversão, são tabelas diferentes
  const MOEDAS = { brl: "R$", usd: "US$" };
  let moeda = "brl";
  let moedaEscolhida = false;   // true quando o visitante clica no seletor de moeda

  const preco = (obj) => Number(obj?.[moeda]) || 0;
  const dinheiro = (v) => `${MOEDAS[moeda]} ${v}`;

  function escolherIdioma() {
    const disponiveis = (TRAD.idiomas || []).map((i) => i.codigo);
    const daUrl = new URLSearchParams(location.search).get("lang");
    if (disponiveis.includes(daUrl)) return daUrl;
    try {
      const salvo = localStorage.getItem("idioma");
      if (disponiveis.includes(salvo)) return salvo;
    } catch {}
    // idioma do navegador (português do Brasil ou de Portugal → pt, espanhol de qualquer país → es...)
    for (const l of navigator.languages || [navigator.language || ""]) {
      const codigo = String(l).toLowerCase().slice(0, 2);
      if (disponiveis.includes(codigo)) return codigo;
    }
    return disponiveis.includes(TRAD.padrao) ? TRAD.padrao : "pt";
  }

  // quem vê o site em português começa em real; nos outros idiomas, em dólar
  function escolherMoeda() {
    const daUrl = new URLSearchParams(location.search).get("moeda");
    if (daUrl in MOEDAS) { moedaEscolhida = true; return daUrl; }
    try {
      const salva = localStorage.getItem("moeda");
      if (salva in MOEDAS) { moedaEscolhida = true; return salva; }
    } catch {}
    return idioma === "pt" ? "brl" : "usd";
  }

  /* ---------------- estimativa de preço ---------------- */

  // obra (ou pedido): { estilo, tamanho, ocsExtras, adicionais: [nomes], quantidade, precoManualBRL, precoManualUSD }
  // os nomes são comparados com o conteudo.json em português; os rótulos saem no idioma atual (d)
  function estimar(obra, d) {
    const manual = obra[moeda === "brl" ? "precoManualBRL" : "precoManualUSD"];
    if (manual) return { manual };

    const p = BASE.precos || {};
    const iEstilo = (p.estilos || []).findIndex((e) => normalizar(e.nome) === normalizar(obra.estilo));
    if (iEstilo >= 0) {
      const base = p.estilos[iEstilo], rotulos = d.precos.estilos[iEstilo];
      const iItem = (base.itens || []).findIndex((i) => normalizar(i.tipo) === normalizar(obra.tamanho));
      if (iItem < 0) return null;
      const partes = [{ rotulo: `${rotulos.nome} ${rotulos.itens[iItem].tipo}`, valor: preco(base.itens[iItem]) }];
      const escolhidos = (obra.adicionais || []).map(normalizar);
      (base.adicionais || []).forEach((a, j) => {
        const nome = rotulos.adicionais?.[j]?.nome ?? a.nome;
        if (a.porUnidade) {
          const n = Number(obra.ocsExtras) || 0;
          if (n) partes.push({ rotulo: n > 1 ? `${n}× ${nome}` : nome, valor: preco(a) * n });
        } else if (escolhidos.includes(normalizar(a.nome))) {
          partes.push({ rotulo: nome, valor: preco(a) });
        }
      });
      return { total: partes.reduce((s, x) => s + x.valor, 0), partes };
    }

    const iOutro = (p.outros || []).findIndex((o) => normalizar(o.nome) === normalizar(obra.estilo));
    if (iOutro >= 0) {
      const base = p.outros[iOutro], nome = d.precos.outros[iOutro].nome;
      const q = base.porUnidade ? Math.max(1, Number(obra.quantidade) || 1) : 1;
      const valor = preco(base) * q;
      return { total: valor, partes: [{ rotulo: q > 1 ? `${q}× ${nome}` : nome, valor }] };
    }
    return null;
  }

  /* ---------------- monte seu pedido ---------------- */

  // servico: "e0", "e1"... (estilos) ou "o0", "o1"... (mais serviços)
  // adicionais: { nome normalizado: quantidade } (vale entre estilos, então "Background" continua marcado ao trocar de estilo)
  const pedido = { servico: null, tamanho: 0, adicionais: {}, quantidade: 1 };
  let contextoPedido = null;   // { d, t } do idioma atual
  let totalMostrado = null;

  function servicos(d) {
    return [
      ...(d.precos?.estilos || []).map((e, i) => ({ chave: `e${i}`, estilo: true, base: BASE.precos.estilos[i], d: e })),
      ...(d.precos?.outros || []).map((o, i) => ({ chave: `o${i}`, estilo: false, base: BASE.precos.outros[i], d: o }))
    ];
  }
  const servicoAtual = () => servicos(contextoPedido.d).find((s) => s.chave === pedido.servico);

  // o pedido vira uma "obra" para usar a mesma conta da galeria
  function pedidoComoObra() {
    const s = servicoAtual();
    if (!s) return {};
    if (!s.estilo) return { estilo: s.base.nome, quantidade: pedido.quantidade };
    const adicionais = s.base.adicionais || [];
    return {
      estilo: s.base.nome,
      tamanho: s.base.itens?.[pedido.tamanho]?.tipo,
      adicionais: adicionais.filter((a) => !a.porUnidade && pedido.adicionais[normalizar(a.nome)]).map((a) => a.nome),
      ocsExtras: adicionais.filter((a) => a.porUnidade).reduce((soma, a) => soma + (pedido.adicionais[normalizar(a.nome)] || 0), 0)
    };
  }

  const imagemOuVazio = (src, nome, classe) =>
    src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<span class="${classe}" aria-hidden="true">${esc(nome)}</span>`;

  function contador(id, rotulo, dica, valor, min, max) {
    const { t } = contextoPedido;
    return `<div class="contador-linha" data-contador-caixa="${id}" data-min="${min}" data-max="${max}">
      <span class="contador-rotulo">${esc(rotulo)} <small>${esc(dica)}</small></span>
      <div class="contador">
        <button type="button" class="contador-botao" data-contador="${id}" data-passo="-1" aria-label="${esc(`${t.pedido_menos}: ${rotulo}`)}"${valor <= min ? " disabled" : ""}>−</button>
        <output aria-live="polite">${valor}</output>
        <button type="button" class="contador-botao" data-contador="${id}" data-passo="1" aria-label="${esc(`${t.pedido_mais}: ${rotulo}`)}"${valor >= max ? " disabled" : ""}>+</button>
      </div>
    </div>`;
  }

  function montarPedido(d, t) {
    contextoPedido = { d, t };
    const lista = servicos(d);
    $("#pedido").hidden = !lista.length;
    if (!lista.length) return;
    if (!lista.some((s) => s.chave === pedido.servico)) pedido.servico = lista[0].chave;

    $("#opcoes-estilo").innerHTML = lista
      .map((s) => {
        let valor;
        if (s.estilo) {
          const menor = Math.min(...(s.base.itens || []).map(preco));
          valor = isFinite(menor) ? `${t.a_partir_de} ${dinheiro(menor)}` : "";
        } else {
          valor = s.base.porUnidade ? `${dinheiro(preco(s.base))} ${preencher(t.por_unidade, { unidade: s.d.unidade })}` : dinheiro(preco(s.base));
        }
        return `<label class="opcao-estilo" for="servico-${s.chave}">
          <input type="radio" name="servico" id="servico-${s.chave}" value="${s.chave}"${s.chave === pedido.servico ? " checked" : ""}>
          <span class="opcao-estilo-img">${imagemOuVazio(s.base.imagem, s.d.nome.slice(0, 1), "opcao-estilo-vazio")}</span>
          <span class="opcao-estilo-nome">${esc(s.d.nome)}</span>
          ${valor ? `<span class="opcao-estilo-preco">${esc(valor)}</span>` : ""}
        </label>`;
      })
      .join("");
    $("#pedido-ideia").placeholder = t.pedido_ideia_exemplo || "";
    atualizarOpcoesPedido();
  }

  // tamanhos e adicionais mudam conforme o estilo; "mais serviços" têm só a quantidade
  function atualizarOpcoesPedido() {
    const { t } = contextoPedido;
    const s = servicoAtual();
    const itens = s.estilo ? s.base.itens || [] : [];
    const adicionais = s.estilo ? s.base.adicionais || [] : [];
    // "mais serviços" não têm tamanho; o tamanho escolhido fica guardado para quando voltar a um estilo
    if (itens.length && pedido.tamanho >= itens.length) pedido.tamanho = 0;

    $("#grupo-tamanho").hidden = !itens.length;
    $("#opcoes-tamanho").innerHTML = itens
      .map((it, i) => `<label class="pilula" for="tamanho-${i}">
          <input type="radio" name="tamanho" id="tamanho-${i}" value="${i}"${i === pedido.tamanho ? " checked" : ""}>
          ${iconeCorte(it.tipo)}<span>${esc(s.d.itens[i].tipo)}</span><small>${esc(dinheiro(preco(it)))}</small>
        </label>`)
      .join("");

    $("#grupo-adicionais").hidden = !adicionais.length;
    $("#opcoes-adicionais").innerHTML = adicionais
      .map((a, j) => (a.porUnidade ? "" : `<label class="pilula" for="adicional-${j}">
          <input type="checkbox" name="adicional" id="adicional-${j}" value="${esc(normalizar(a.nome))}"${pedido.adicionais[normalizar(a.nome)] ? " checked" : ""}>
          <span>${esc(s.d.adicionais[j].nome)}</span><small>+ ${esc(dinheiro(preco(a)))}</small>
        </label>`))
      .join("");
    const max = maxExtras();
    $("#contadores-adicionais").innerHTML = adicionais
      .map((a, j) => (a.porUnidade ? contador(`a:${normalizar(a.nome)}`, s.d.adicionais[j].nome, `+ ${dinheiro(preco(a))} ${t.cada}`, pedido.adicionais[normalizar(a.nome)] || 0, 0, max) : ""))
      .join("");

    const porUnidade = !s.estilo && s.base.porUnidade;
    $("#grupo-quantidade").hidden = !porUnidade;
    if (!porUnidade) pedido.quantidade = 1;
    $("#contador-quantidade").innerHTML = porUnidade
      ? contador("quantidade", preencher(t.pedido_qtd_rotulo, { unidade: s.d.unidade }), `${dinheiro(preco(s.base))} ${t.cada}`, pedido.quantidade, 1, Infinity)
      : "";

    atualizarResumo();
  }

  function mensagemPedido(est) {
    const { t } = contextoPedido;
    const s = servicoAtual();
    const ideia = $("#pedido-ideia").value.trim();
    const extras = s.estilo ? (est?.partes || []).slice(1).map((p) => p.rotulo) : [];
    return [
      t.msg_oi,
      `• ${t.msg_estilo}: ${s.d.nome}`,
      ...(s.estilo ? [`• ${t.msg_tamanho}: ${s.d.itens[pedido.tamanho]?.tipo}`] : []),
      ...(extras.length ? [`• ${t.msg_adicionais}: ${extras.join(", ")}`] : []),
      ...(!s.estilo && s.base.porUnidade ? [`• ${t.msg_quantidade}: ${pedido.quantidade}`] : []),
      ...(ideia ? [`• ${t.msg_ideia}: ${ideia}`] : []),
      "",
      `${t.msg_estimativa}: ≈ ${dinheiro(est?.total ?? 0)}`
    ].join("\n");
  }

  function atualizarResumo() {
    const { d, t } = contextoPedido;
    const est = estimar(pedidoComoObra(), d);

    $("#resumo-linhas").innerHTML = (est?.partes || [])
      .map((p) => `<li><span>${esc(p.rotulo)}</span><b>${esc(dinheiro(p.valor))}</b></li>`)
      .join("");

    // o total "conta" até o valor novo ("≈" deixa claro que o valor é aproximado)
    const total = est?.total ?? 0;
    const caixa = $("#resumo-total");
    const primeiraVez = totalMostrado == null;
    const de = totalMostrado ?? total, inicio = performance.now();
    totalMostrado = total;
    const passo = (agora) => {
      // na primeira vez (ou com "menos movimento") o valor aparece direto, sem contar
      const p = semMovimento || primeiraVez ? 1 : Math.min((agora - inicio) / 380, 1);
      const valor = Math.round(de + (total - de) * (1 - Math.pow(1 - p, 3)));
      caixa.textContent = `≈ ${dinheiro(valor)}`;
      if (p < 1) requestAnimationFrame(passo);
    };
    passo(inicio);

    // mensagem pronta + link do Telegram
    const msg = mensagemPedido(est);
    $("#pedido-mensagem").textContent = msg;
    const telegram = BASE.pedido?.telegram || (BASE.contato?.redes || []).find((r) => normalizar(r.icone || r.nome) === "telegram")?.url;
    const botaoTelegram = $("#pedido-telegram");
    botaoTelegram.hidden = !telegram;
    if (telegram) botaoTelegram.href = `${telegram}${telegram.includes("?") ? "&" : "?"}text=${encodeURIComponent(msg)}`;

    $("#resumo-fechado").hidden = !!d.comissoes?.abertas;
  }

  // atualiza os números e os botões +/− sem redesenhar (assim o foco do teclado não se perde)
  function atualizarContadores() {
    $$("[data-contador-caixa]").forEach((caixa) => {
      const id = caixa.dataset.contadorCaixa;
      const valor = id === "quantidade" ? pedido.quantidade : pedido.adicionais[id.slice(2)] || 0;
      $("output", caixa).textContent = valor;
      $('[data-passo="-1"]', caixa).disabled = valor <= Number(caixa.dataset.min);
      $('[data-passo="1"]', caixa).disabled = valor >= Number(caixa.dataset.max);
    });
  }

  async function copiarPedido(silencioso = false) {
    const { t } = contextoPedido;
    const aviso = $("#pedido-aviso");
    const msg = $("#pedido-mensagem").textContent;
    try {
      await navigator.clipboard.writeText(msg);
      if (!silencioso) aviso.textContent = t.pedido_copiado;
    } catch {
      // plano B: seleciona o texto da mensagem para a pessoa copiar
      if (silencioso) return;
      const caixa = $(".resumo-mensagem");
      caixa.open = true;
      const faixa = document.createRange();
      faixa.selectNodeContents($("#pedido-mensagem"));
      getSelection().removeAllRanges();
      getSelection().addRange(faixa);
      aviso.textContent = document.execCommand?.("copy") ? t.pedido_copiado : t.pedido_copiar_erro;
    }
  }

  // máximo de personagens extras; 0 ou vazio = sem limite
  function maxExtras() {
    const max = Number(BASE.pedido?.maxExtras);
    return max > 0 ? max : Infinity;
  }

  function ativarPedido() {
    const form = $("#pedido-form");
    form.addEventListener("submit", (ev) => ev.preventDefault());
    form.addEventListener("change", (ev) => {
      const { name, value, checked } = ev.target;
      if (name === "servico") { pedido.servico = value; atualizarOpcoesPedido(); }
      if (name === "tamanho") { pedido.tamanho = Number(value); atualizarResumo(); }
      if (name === "adicional") { pedido.adicionais[value] = checked ? 1 : 0; atualizarResumo(); }
    });
    form.addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-contador]");
      if (!botao) return;
      const caixa = botao.closest("[data-contador-caixa]");
      const id = botao.dataset.contador;
      const atual = id === "quantidade" ? pedido.quantidade : pedido.adicionais[id.slice(2)] || 0;
      const novo = Math.min(Number(caixa.dataset.max), Math.max(Number(caixa.dataset.min), atual + Number(botao.dataset.passo)));
      if (id === "quantidade") pedido.quantidade = novo;
      else pedido.adicionais[id.slice(2)] = novo;
      atualizarContadores();
      atualizarResumo();
    });
    $("#pedido-ideia").addEventListener("input", () => atualizarResumo());
    $("#pedido-copiar").addEventListener("click", () => copiarPedido());
    // ao abrir o Telegram, também copia (caso o app não preencha a mensagem sozinho)
    $("#pedido-telegram").addEventListener("click", () => copiarPedido(true));
  }

  /* ---------------- seletor de moeda ---------------- */

  function montarMoedas(t) {
    $$("[data-moedas]").forEach((grupo) => {
      if (!grupo.children.length) {
        grupo.innerHTML = Object.keys(MOEDAS)
          .map((m) => `<button type="button" data-moeda="${m}"><b>${MOEDAS[m]}</b> <span data-nome-moeda="${m}"></span></button>`)
          .join("");
      }
      $$("[data-moeda]", grupo).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.moeda === moeda)));
      $$("[data-nome-moeda]", grupo).forEach((s) => (s.textContent = t[`moeda_${s.dataset.nomeMoeda}`] || ""));
    });
  }

  document.addEventListener("click", (ev) => {
    const botao = ev.target.closest("[data-moeda]");
    if (!botao || botao.dataset.moeda === moeda) return;
    moeda = botao.dataset.moeda;
    moedaEscolhida = true;
    try { localStorage.setItem("moeda", moeda); } catch {}
    montar();
  });

  /* ---------------- montagem ---------------- */

  let jaMontou = false;
  let observadorNome = null;
  let gruposVisor = { galeria: [], precos: [] };

  function montar() {
    const d = mesclar(BASE, idioma === "pt" ? null : TRAD.conteudo?.[idioma]);
    const t = { ...(TRAD.interface?.pt || {}), ...(TRAD.interface?.[idioma] || {}) };

    document.documentElement.lang = idioma === "pt" ? "pt-BR" : idioma;

    // textos fixos da interface
    $$("[data-i18n]").forEach((el) => { if (t[el.dataset.i18n] != null) el.textContent = t[el.dataset.i18n]; });
    $$("[data-i18n-aria]").forEach((el) => { if (t[el.dataset.i18nAria]) el.setAttribute("aria-label", t[el.dataset.i18nAria]); });
    $("#video-quadro").dataset.rotulo = t.timelapse || "";

    // textos do conteúdo
    $$("[data-campo]").forEach((el) => {
      const campo = el.dataset.campo;
      const valor = campo === "nome" ? d.artista?.nome : pegar(d, campo);
      if (valor != null) el.textContent = valor;
    });

    // seletores de idioma e moeda
    const seletor = $("#idioma");
    if (!seletor.options.length) {
      seletor.innerHTML = (TRAD.idiomas || []).map((i) => `<option value="${esc(i.codigo)}" lang="${esc(i.codigo)}" title="${esc(i.nome)}" aria-label="${esc(i.nome)}">${esc(i.sigla || i.codigo.toUpperCase())}</option>`).join("");
    }
    seletor.value = idioma;
    montarMoedas(t);

    // status das comissões
    const abertas = !!d.comissoes?.abertas;
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("aberto", abertas);
      $(".status-texto", el).textContent = abertas ? d.comissoes.textoAberto : d.comissoes.textoFechado;
    });
    $("#aviso-fechado").hidden = abertas;

    // nome com letras animadas; a parte depois da 2ª maiúscula fica em destaque
    const nome = d.artista?.nome || "";
    if ($("#hero-nome").getAttribute("aria-label") !== nome) {
      const corte = nome.slice(1).search(/[A-ZÀ-Ý]/) + 1;
      $("#hero-nome").setAttribute("aria-label", nome);
      $(".hero-nome-texto").innerHTML = [...nome]
        .map((letra, i) => `<span class="letra${corte > 0 && i >= corte ? " destaque" : ""}" style="--i:${i}" aria-hidden="true">${letra === " " ? "&nbsp;" : esc(letra)}</span>`)
        .join("");
      // mede a largura real do nome para ele sempre caber na coluna
      const medirNome = () => {
        const h1 = $("#hero-nome");
        const fonte = parseFloat(getComputedStyle(h1).fontSize);
        const largura = $(".hero-nome-texto").offsetWidth;
        if (fonte && largura) h1.style.setProperty("--razao", (largura / fonte).toFixed(3));
      };
      medirNome();
      // mede de novo quando a fonte do título termina de carregar (o nome muda de largura)
      if (!observadorNome && "ResizeObserver" in window) {
        observadorNome = new ResizeObserver(medirNome);
        observadorNome.observe($(".hero-nome-texto"));
      }
      document.fonts?.ready.then(medirNome);
    }

    const hero = $("#hero-imagem");
    if (!hero.getAttribute("src")) hero.src = d.artista.imagem;
    hero.alt = d.artista.imagemDescricao || "";

    // fitas rolantes: uma com estilos, tamanhos e serviços, a outra com os @ das redes
    const estilos = d.precos?.estilos || [];
    const outros = d.precos?.outros || [];
    const tipos = new Set();
    estilos.forEach((e) => (e.itens || []).forEach((i) => tipos.add(i.tipo)));
    const palavras = [...estilos.map((e) => e.nome), ...tipos, ...outros.map((o) => o.nome), t.faixa_mundo];
    const redes = (d.contato?.redes || []).map((r) => (String(r.usuario).startsWith("@") ? r.usuario : r.nome));
    const fita = (lista) => { const metade = Array(3).fill(lista).flat().map((p) => `<span>${esc(p)} ${PETALA}</span>`).join(""); return metade + metade; };
    const [fitaA, fitaB] = $$(".faixa-trilho");
    fitaA.innerHTML = fita(palavras);
    fitaB.innerHTML = fita([...redes, t.faixa_feito]);
    $("#cupom-data").textContent = new Date().toLocaleDateString(document.documentElement.lang);

    // sobre
    const sobre = d.sobre || {};
    $("#sobre").hidden = !sobre.titulo;
    const fotoSobre = $("#sobre-imagem");
    if (sobre.imagem && fotoSobre.getAttribute("src") !== sobre.imagem) fotoSobre.src = sobre.imagem;
    fotoSobre.alt = sobre.imagemDescricao || "";
    $(".sobre-foto").hidden = !sobre.imagem;
    const paragrafos = Array.isArray(sobre.texto) ? sobre.texto : [sobre.texto].filter(Boolean);
    $("#sobre-paragrafos").innerHTML = paragrafos.map((p) => `<p>${esc(p)}</p>`).join("");
    $("#sobre-destaques").innerHTML = (sobre.destaques || []).map((x) => `<li>${PETALA}${esc(x)}</li>`).join("");

    // galeria com preço estimado (some do site enquanto não tiver artes)
    const obras = d.galeria?.obras || [];
    $("#trabalhos").hidden = !obras.length;
    $("#galeria").innerHTML = obras
      .map((o, i) => {
        const est = estimar(BASE.galeria.obras[i] || o, d);
        const tipo = [o.estilo, o.tamanho].filter(Boolean).join(" · ");
        let etiqueta, conta = "";
        if (est?.manual) {
          // só o número (ex.: "50") vira "a partir de R$ 50"; um texto aparece do jeito que foi escrito
          const numero = String(est.manual).trim();
          const valor = /^\d+([.,]\d+)?$/.test(numero) ? `<small>${esc(t.a_partir_de)}</small> ${esc(dinheiro(numero))}` : esc(est.manual);
          etiqueta = `<span class="estimativa-rotulo">${esc(t.estimativa)}</span><strong>${valor}</strong>`;
        } else if (est) {
          etiqueta = `<span class="estimativa-rotulo">${esc(t.estimativa)}</span><strong>≈ ${esc(dinheiro(est.total))}</strong>`;
          conta = est.partes.map((p) => `<span>${esc(p.rotulo)} <b>${esc(dinheiro(p.valor))}</b></span>`).join('<i aria-hidden="true">+</i>');
        } else {
          etiqueta = `<span class="estimativa-rotulo">${esc(t.estimativa)}</span><strong>${esc(t.sob_consulta)}</strong>`;
        }
        // "o que foi feito" escrito na mão substitui a conta automática (sem valores separados)
        const itens = (o.itens || []).filter(Boolean);
        if (itens.length) conta = itens.map((it) => `<span>${esc(it)}</span>`).join('<i aria-hidden="true">+</i>');
        return `
      <figure class="obra revelar" style="transition-delay:${(i % 3) * 80}ms">
        <button class="obra-botao" type="button" data-grupo="galeria" data-indice="${i}" data-rotulo="${esc(t.ampliar)}" aria-label="${esc(preencher(t.ampliar_aria, { titulo: o.titulo }))}">
          <img src="${esc(o.imagem)}" alt="${esc(o.descricao || o.titulo)}" decoding="async">
          <span class="obra-preco">${etiqueta}</span>
        </button>
        <figcaption>
          <span class="obra-titulo">${esc(o.titulo)}</span>
          ${tipo ? `<span class="obra-tipo">${esc(tipo)}</span>` : ""}
          ${conta ? `<span class="obra-conta">${conta}</span>` : ""}
        </figcaption>
      </figure>`;
      })
      .join("");
    // cada arte recebe a proporção dela, para as linhas terem a mesma altura
    $$("#galeria img").forEach((img) => {
      const medir = () => img.naturalWidth && img.closest(".obra").style.setProperty("--r", (img.naturalWidth / img.naturalHeight).toFixed(3));
      img.complete ? medir() : img.addEventListener("load", medir, { once: true });
    });

    // vídeo do processo
    const video = $("#video");
    if (d.processo?.video) { $("#processo").hidden = false; if (!video.getAttribute("src")) video.src = d.processo.video; }
    else $("#processo").hidden = true;
    atualizarBotaoVideo = () => {
      const botao = $("#video-botao");
      botao.textContent = video.paused ? t.reproduzir_video : t.pausar_video;
      botao.setAttribute("aria-pressed", String(video.paused));
    };
    atualizarBotaoVideo();

    // legenda dos tamanhos
    $("#legenda").innerHTML = [...tipos].map((x) => `<span>${iconeCorte(x)}${esc(x)}</span>`).join("");

    // preços: cada estilo é um ingresso de show; só os que têm imagem abrem no visor
    const tabelasComImagem = estilos.filter((e) => e.imagem);
    $("#lista-precos").innerHTML = estilos
      .map((e, i) => {
        const base = BASE.precos.estilos[i];
        const menor = Math.min(...(base.itens || []).map(preco));
        const imagem = e.imagem
          ? `<button class="ingresso-img" type="button" data-grupo="precos" data-indice="${tabelasComImagem.indexOf(e)}" aria-label="${esc(preencher(t.ver_tabela_aria, { nome: e.nome }))}">
              <img src="${esc(e.imagem)}" alt="${esc(preencher(t.tabela_alt, { nome: e.nome }))}" loading="lazy" decoding="async">
            </button>`
          : "";
        const adicionais = (base.adicionais || [])
          .map((a, j) => `<li><span class="tipo">+ ${esc(e.adicionais[j].nome)}</span><span class="pontilhado"></span><span class="valor"><small>${esc(MOEDAS[moeda])}</small>${esc(preco(a))}${a.porUnidade ? `<em>${esc(t.cada)}</em>` : ""}</span></li>`)
          .join("");
        return `
      <article class="ingresso revelar" style="transition-delay:${i * 110}ms">
        <div class="ingresso-topo" aria-hidden="true"><span>${esc(t.ingresso)}</span><span>Nº ${String(i + 1).padStart(3, "0")}</span></div>
        ${imagem}
        <h3>${esc(e.nome)}</h3>
        <p class="ingresso-desc">${esc(e.descricao)}</p>
        <ul class="tabela">
          ${(base.itens || [])
            .map((it, j) => `<li>${iconeCorte(it.tipo)}<span class="tipo">${esc(e.itens[j].tipo)}</span><span class="pontilhado"></span><span class="valor"><small>${esc(MOEDAS[moeda])}</small>${esc(preco(it))}</span></li>`)
            .join("")}
        </ul>
        ${adicionais ? `<p class="tabela-titulo">${esc(t.adicionais)}</p><ul class="tabela tabela-adicionais">${adicionais}</ul>` : ""}
        ${isFinite(menor) ? `<div class="ingresso-canhoto"><span>${esc(t.a_partir_de)}</span><strong><small>${esc(MOEDAS[moeda])}</small>${esc(menor)}</strong></div>` : ""}
      </article>`;
      })
      .join("");

    // mais serviços (ref sheet, stickers...)
    $("#outros").hidden = !outros.length;
    $("#outros-lista").innerHTML = outros
      .map((o, i) => {
        const base = BASE.precos.outros[i];
        return `<article class="outro">
          <span class="outro-img">${imagemOuVazio(o.imagem, o.nome.slice(0, 1), "outro-vazio")}</span>
          <div class="outro-corpo">
            <h4>${esc(o.nome)}</h4>
            <p>${esc(o.descricao)}</p>
          </div>
          <p class="outro-preco"><small>${esc(MOEDAS[moeda])}</small>${esc(preco(base))}${base.porUnidade ? `<em>${esc(preencher(t.por_unidade, { unidade: o.unidade }))}</em>` : ""}</p>
        </article>`;
      })
      .join("");

    // avisos (a seção some enquanto não tiver regras nem "não faço")
    const regras = d.avisos?.lista || [];
    const naoFaco = (d.avisos?.naoFaco || []).map((n) => `<li>${esc(n)}</li>`).join("");
    $("#avisos").hidden = !regras.length && !naoFaco;
    $("#regras").innerHTML = regras
      .map((r) => `<div${r.destaque ? ' class="regra-destaque"' : ""}>${PETALA}<dt>${esc(r.titulo)}</dt><dd>${esc(r.texto)}</dd></div>`)
      .join("");
    $("#nao-faco").innerHTML = naoFaco;
    $("#nao-faco-quadro").hidden = !naoFaco;
    // o mesmo lembrete aparece dentro do "Monte seu pedido", antes do campo da ideia
    $("#pedido-nao-faco-lista").innerHTML = naoFaco;
    $("#pedido-nao-faco").hidden = !naoFaco;
    $("#resumo-pagamento").hidden = !d.pedido?.pagamento;

    // perguntas frequentes
    const perguntas = d.faq?.perguntas || [];
    $("#faq").hidden = !perguntas.length;
    $("#faq-lista").innerHTML = perguntas
      .map((p) => `<details class="faq-item"><summary>${esc(p.pergunta)}<span class="faq-icone" aria-hidden="true"></span></summary><p>${esc(p.resposta)}</p></details>`)
      .join("");

    // redes
    $("#redes").innerHTML = (d.contato?.redes || [])
      .map((r) => {
        const icone = ICONES[normalizar(r.icone || r.nome)] || ICONES.padrao;
        return `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">
          <span class="rede-icone"><svg viewBox="0 0 24 24" aria-hidden="true">${icone}</svg></span>
          <span><span class="rede-nome">${esc(r.nome)}</span><span class="rede-usuario">${esc(r.usuario)}</span></span>
          <span class="rede-seta" aria-hidden="true">↗</span>
        </a></li>`;
      })
      .join("");

    // o menu não mostra seções que estão escondidas
    $$(".menu a").forEach((a) => (a.hidden = !!$(a.getAttribute("href"))?.hidden));

    $("#ano").textContent = new Date().getFullYear();

    // imagens do visor (ampliar)
    gruposVisor = {
      galeria: obras.map((o) => ({ src: o.imagem, titulo: o.titulo, alt: o.descricao || o.titulo })),
      precos: tabelasComImagem.map((e) => ({ src: e.imagem, titulo: e.nome, alt: preencher(t.tabela_alt, { nome: e.nome }) }))
    };

    montarPedido(d, t);

    if (!jaMontou) {
      jaMontou = true;
      ativarVisor();
      ativarVideo();
      ativarPedido();
    }
    ativarRevelar();
  }

  /* ---------------- visor de imagens ---------------- */

  function ativarVisor() {
    const visor = $("#visor");
    let grupo = [];
    let atual = 0;
    let origem = null;

    const mostrar = (i) => {
      atual = (i + grupo.length) % grupo.length;
      const item = grupo[atual];
      $("#visor-imagem").src = item.src;
      $("#visor-imagem").alt = item.alt;
      $("#visor-titulo").textContent = item.titulo;
      $("#visor-contador").textContent = grupo.length > 1 ? `${atual + 1} / ${grupo.length}` : "";
      $$(".visor-seta", visor).forEach((b) => (b.hidden = grupo.length < 2));
    };

    document.addEventListener("click", (ev) => {
      const alvo = ev.target.closest("[data-grupo]");
      if (!alvo || !visor.showModal) return;
      grupo = gruposVisor[alvo.dataset.grupo] || [];
      if (!grupo.length) return;
      origem = alvo;
      mostrar(Number(alvo.dataset.indice));
      visor.showModal();
      // o spray e a lata vão junto para dentro do visor
      visor.append(...efeitosMouse());
    });

    const fechar = () => { visor.close(); devolverEfeitosMouse(); };
    visor.addEventListener("click", (ev) => {
      const acao = ev.target.closest("[data-visor]")?.dataset.visor;
      if (acao === "fechar" || ev.target === visor || ev.target.tagName === "FIGURE") fechar();
      if (acao === "anterior") mostrar(atual - 1);
      if (acao === "proxima") mostrar(atual + 1);
    });
    visor.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") mostrar(atual - 1);
      if (ev.key === "ArrowRight") mostrar(atual + 1);
    });
    visor.addEventListener("close", () => {
      devolverEfeitosMouse();
      origem?.focus();
    });

    // deslizar no celular
    let inicioX = null;
    visor.addEventListener("touchstart", (ev) => (inicioX = ev.touches[0].clientX), { passive: true });
    visor.addEventListener("touchend", (ev) => {
      if (inicioX == null) return;
      const dx = ev.changedTouches[0].clientX - inicioX;
      if (Math.abs(dx) > 50 && grupo.length > 1) mostrar(atual + (dx < 0 ? 1 : -1));
      inicioX = null;
    });
  }

  // traz o spray e a lata de volta para a página quando o visor fecha
  const efeitosMouse = () => [$("#rastro-cursor"), $("#lata-cursor")];
  function devolverEfeitosMouse() {
    if ($("#lata-cursor").parentElement !== document.body) document.body.append(...efeitosMouse());
  }

  /* ---------------- vídeo ---------------- */

  let atualizarBotaoVideo = () => {};

  function ativarVideo() {
    const video = $("#video");
    let pausadoPeloUsuario = semMovimento;
    video.addEventListener("play", () => atualizarBotaoVideo());
    video.addEventListener("pause", () => atualizarBotaoVideo());

    $("#video-botao").addEventListener("click", () => {
      if (video.paused) { pausadoPeloUsuario = false; video.play().catch(() => {}); }
      else { pausadoPeloUsuario = true; video.pause(); }
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !pausadoPeloUsuario && video.getAttribute("src")) video.play().catch(() => {});
          else if (!e.isIntersecting) video.pause();
        },
        { threshold: 0.3 }
      ).observe(video);
    }
  }

  /* ---------------- animações de entrada ---------------- */

  let observadorRevelar = null;

  function ativarRevelar() {
    if (semMovimento || !("IntersectionObserver" in window)) return;
    // ao trocar de idioma ou moeda, o que já apareceu não anima de novo
    if (observadorRevelar) {
      $$(".revelar:not(.visto)").forEach((el) => el.classList.add("visto"));
      return;
    }
    observadorRevelar = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("visto"); observadorRevelar.unobserve(e.target); }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    $$(".revelar").forEach((el) => observadorRevelar.observe(el));
    document.documentElement.classList.add("animar");
  }

  /* ---------------- topo, menu (setlist) e inclinação da arte ---------------- */

  const topo = $("#topo");
  let pendente = false;
  const aoRolar = () => {
    pendente = false;
    topo.classList.toggle("rolado", window.scrollY > 20);
  };
  addEventListener("scroll", () => { if (!pendente) { pendente = true; requestAnimationFrame(aoRolar); } }, { passive: true });
  // ao recarregar no meio da página o navegador volta para a posição antiga depois do carregamento
  addEventListener("load", aoRolar);
  aoRolar();

  // menu em tela cheia: abre e fecha a setlist
  const setlist = $("#setlist");
  const botaoMenu = $("#menu-botao");
  const abrirMenu = (abrir, devolverFoco = true) => {
    setlist.hidden = !abrir;
    botaoMenu.setAttribute("aria-expanded", String(abrir));
    document.documentElement.style.overflow = abrir ? "hidden" : "";
    if (abrir) $(".menu a:not([hidden])", setlist)?.focus();
    else if (devolverFoco) botaoMenu.focus({ preventScroll: true });
  };
  botaoMenu.addEventListener("click", () => abrirMenu(setlist.hidden));
  $("#setlist-fechar").addEventListener("click", () => abrirMenu(false));
  setlist.addEventListener("click", (ev) => {
    if (ev.target === setlist) abrirMenu(false);
    // ao escolher uma seção, fecha sem roubar o foco (assim a página rola até ela)
    if (ev.target.closest(".menu a")) abrirMenu(false, false);
  });
  addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !setlist.hidden) abrirMenu(false); });

  if ("IntersectionObserver" in window) {
    const links = $$(".menu a");
    const obsMenu = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`)));
        }),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    $$("main section[id]").forEach((s) => obsMenu.observe(s));
  }

  const arte = $(".hero-arte");
  const quadro = $("#quadro");
  if (!semMovimento && mouseFino) {
    arte.addEventListener("pointermove", (ev) => {
      const r = arte.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width;
      const y = (ev.clientY - r.top) / r.height;
      quadro.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
      quadro.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
      quadro.style.setProperty("--bx", `${x * 100}%`);
      quadro.style.setProperty("--by", `${y * 100}%`);
    });
    arte.addEventListener("pointerleave", () => {
      quadro.style.setProperty("--rx", "0deg");
      quadro.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------------- mouse: lata de spray ---------------- */

  // cada clique troca a cor da tinta: roxo, laranja, verde e vermelho
  const CORES_SPRAY = ["157, 107, 255", "255, 138, 31", "92, 170, 50", "229, 56, 59"];
  let corSpray = 0;
  const lata = $("#lata-cursor");

  const spray = (() => {
    const tela = $("#rastro-cursor");
    if (!mouseFino || semMovimento || !tela.getContext) return { ponto() {}, jato() {}, soltar() {} };
    const ctx = tela.getContext("2d");
    let gotas = [];                // {x, y, r, cor, vida, max, vy}
    let rodando = false, ultimo = 0, anterior = null;
    let leve = false;              // vira true se o computador não aguentar o efeito
    const lentidao = [];           // duração dos últimos quadros, para perceber travamento

    const ajustar = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      tela.width = innerWidth * dpr;
      tela.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    addEventListener("resize", ajustar);

    // pontinhos de tinta em volta de (x, y), mais juntos no centro, como um spray de verdade
    const borrifar = (x, y, quantos, raio, tam) => {
      const cor = CORES_SPRAY[corSpray];
      for (let i = 0; i < quantos; i++) {
        const ang = Math.random() * Math.PI * 2, dist = Math.pow(Math.random(), 1.8) * raio;
        gotas.push({ x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, r: Math.random() * tam + 0.5, cor, vida: 0, max: 650 + Math.random() * 450, vy: 0 });
      }
      if (gotas.length > 1500) gotas.splice(0, gotas.length - 1500);
    };

    // se a animação ficar abaixo de ~30 quadros por segundo, desliga o spray (fica só a lata)
    const vigiar = (bruto) => {
      lentidao.push(bruto);
      if (lentidao.length > 40) lentidao.shift();
      if (lentidao.length < 40) return;
      const media = lentidao.reduce((s, v) => s + v, 0) / lentidao.length;
      if (media > 34) {
        leve = true;
        gotas = [];
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        document.documentElement.classList.add("efeitos-leves");
      }
    };

    const desenhar = (agora) => {
      const bruto = agora - (ultimo || agora);
      const dt = Math.min(bruto, 50);
      if (ultimo && bruto < 500) vigiar(bruto);
      ultimo = agora;
      if (leve) { rodando = false; ultimo = 0; return; }
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      gotas = gotas.filter((g) => (g.vida += dt) < g.max);
      for (const g of gotas) {
        // as gotas grandes do clique escorrem devagar
        if (g.vy) { g.y += g.vy * dt * 0.06; g.vy *= 0.985; }
        const vida = 1 - g.vida / g.max;
        ctx.fillStyle = `rgba(${g.cor}, ${Math.min(1, vida * 1.4) * 0.85})`;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rodando = gotas.length > 0;
      if (rodando) requestAnimationFrame(desenhar);
      else { ultimo = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    const animar = () => { if (!rodando) { rodando = true; requestAnimationFrame(desenhar); } };

    return {
      ponto(x, y) {
        if (leve) return;
        if (anterior) {
          // preenche o caminho entre um movimento e outro, para o traço não sair falhado
          const passos = Math.min(8, Math.ceil(Math.hypot(x - anterior.x, y - anterior.y) / 7));
          for (let i = 1; i <= passos; i++) borrifar(anterior.x + ((x - anterior.x) * i) / passos, anterior.y + ((y - anterior.y) * i) / passos, 3, 8, 1.3);
        }
        anterior = { x, y };
        animar();
      },
      jato(x, y) {
        if (leve) return;
        borrifar(x, y, 70, 26, 2.4);
        const cor = CORES_SPRAY[corSpray];
        for (let i = 0; i < 4; i++) gotas.push({ x: x + (Math.random() - 0.5) * 30, y: y + Math.random() * 10, r: 2.2 + Math.random() * 2, cor, vida: 0, max: 1300 + Math.random() * 600, vy: 0.8 + Math.random() * 1.2 });
        animar();
      },
      soltar() { anterior = null; }
    };
  })();

  if (mouseFino) {
    const visor = $("#visor");
    const pintarLata = () => lata.style.setProperty("--tinta-spray", `rgb(${CORES_SPRAY[corSpray]})`);
    pintarLata();

    addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      // proteção: se o visor fechou, a lata nunca pode ficar presa dentro dele
      if (!visor.open) devolverEfeitosMouse();
      // a lata fica exatamente na ponta do mouse (sem atraso)
      lata.style.setProperty("--ax", `${ev.clientX}px`);
      lata.style.setProperty("--ay", `${ev.clientY}px`);
      spray.ponto(ev.clientX, ev.clientY);
      document.documentElement.classList.add("com-lata");
      lata.classList.add("ativa");
      // sobre links e botões a lata cresce e inclina um pouco
      lata.classList.toggle("sobre-link", !!ev.target.closest?.("a, button, select, label, [data-grupo]"));
    }, { passive: true });

    addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "mouse") return;
      corSpray = (corSpray + 1) % CORES_SPRAY.length;
      pintarLata();
      spray.jato(ev.clientX, ev.clientY);
      // a lata chacoalha (reinicia a animação a cada clique)
      lata.classList.remove("pintando");
      void lata.offsetWidth;
      lata.classList.add("pintando");
    });
    lata.addEventListener("animationend", () => lata.classList.remove("pintando"));
    document.documentElement.addEventListener("mouseleave", () => {
      lata.classList.remove("ativa");
      spray.soltar();
    });
  }

  /* ---------------- troca de idioma ---------------- */

  $("#idioma").addEventListener("change", (ev) => {
    idioma = ev.target.value;
    try { localStorage.setItem("idioma", idioma); } catch {}
    // se o visitante ainda não escolheu a moeda, ela acompanha o idioma
    if (!moedaEscolhida) moeda = idioma === "pt" ? "brl" : "usd";
    montar();
  });

  /* ---------------- carregar conteúdo ---------------- */

  const carregar = (arquivo) =>
    fetch(arquivo, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(`${arquivo}: HTTP ${r.status}`); return r.json(); });

  Promise.all([carregar("conteudo.json"), carregar("traducoes.json").catch((e) => { console.warn(e); return { idiomas: [{ codigo: "pt", nome: "Português", sigla: "PT" }], interface: {} }; })])
    .then(([conteudo, traducoes]) => {
      BASE = conteudo;
      TRAD = traducoes;
      idioma = escolherIdioma();
      moeda = escolherMoeda();
      montar();
    })
    .catch((erro) => {
      console.error("Erro ao carregar o conteúdo:", erro);
      $("#erro").hidden = false;
    });
})();
