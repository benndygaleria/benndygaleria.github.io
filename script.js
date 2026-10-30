/* ============================================================
   BenndyGaleria · script
   Lê o conteudo.json (português) e o traducoes.json (inglês e
   espanhol) e monta o site: 4 abas (Galeria, Preços, Pedido e
   Sobre), o mural com filtros, o quadro de preços e o pedido
   passo a passo. Para trocar textos, preços ou imagens, edite
   os JSON; aqui não precisa mexer.
   ============================================================ */

(() => {
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  const esc = (texto) =>
    String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linkSeguro = (url) => (/^https?:\/\//i.test(String(url ?? "").trim()) ? String(url).trim() : "#");
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

  const ICONES = {
    telegram: '<path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6 0 1.9l4.6 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.6.1 1.8-.7L22.9 4.9c.2-1-.6-1.8-1.4-1.4Z"/><path d="m7.4 14.2 10-7.2-7.6 8.4"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".6" fill="currentColor"/>',
    bluesky: '<path d="M12 11.2C10.6 8.4 6.8 4 4.3 4 2.9 4 3 6 3.3 8.3c.4 2.4 2.1 3.8 5.3 3.6-3.7.9-3.4 3.9-1 5.7 2.7 2 3.9-1.8 4.4-3.7.5 1.9 1.7 5.7 4.4 3.7 2.4-1.8 2.7-4.8-1-5.7 3.2.2 4.9-1.2 5.3-3.6C21 6 21.1 4 19.7 4 17.2 4 13.4 8.4 12 11.2Z"/>',
    x: '<path d="M4 4h4.6L20 20h-4.6Z"/><path d="m19.6 4-6.7 7.3M4.4 20l6.7-7.3"/>',
    padrao: '<path d="M10 14 21 3M15 3h6v6"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>'
  };
  const icone = (r) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[normalizar(r.icone || r.nome)] || ICONES.padrao}</svg>`;

  // cor de cada estilo no quadro de preços (na ordem da tabela)
  const CORES = ["var(--laranja)", "var(--roxo)", "var(--verde)", "var(--amarelo)", "var(--azul)"];

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
    if (Object.hasOwn(MOEDAS, daUrl ?? "")) { moedaEscolhida = true; return daUrl; }
    try {
      const salva = localStorage.getItem("moeda");
      if (Object.hasOwn(MOEDAS, salva ?? "")) { moedaEscolhida = true; return salva; }
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

  // nome de um estilo ou serviço (escrito em português no conteudo.json) no idioma atual
  function nomeServico(nomeBase, d) {
    const p = BASE.precos || {};
    const i = (p.estilos || []).findIndex((e) => normalizar(e.nome) === normalizar(nomeBase));
    if (i >= 0) return d.precos.estilos[i].nome;
    const j = (p.outros || []).findIndex((o) => normalizar(o.nome) === normalizar(nomeBase));
    if (j >= 0) return d.precos.outros[j].nome;
    return nomeBase;
  }

  // texto do preço de uma obra: "≈ R$ 15", "a partir de R$ 50" (preço manual) ou "sob consulta"
  function textoPreco(est, t) {
    if (est?.manual) {
      const numero = String(est.manual).trim();
      return /^\d+([.,]\d+)?$/.test(numero) ? `${t.a_partir_de} ${dinheiro(numero)}` : est.manual;
    }
    return est ? `≈ ${dinheiro(est.total)}` : t.sob_consulta;
  }

  /* ---------------- logo em letras recortadas ---------------- */

  // a parte depois da 2ª maiúscula ("Galeria") vira a fita embaixo das letras
  function montarLogo(nome) {
    const corte = nome.slice(1).search(/[A-ZÀ-Ý]/) + 1;
    const letras = corte > 0 ? nome.slice(0, corte) : nome;
    const resto = corte > 0 ? nome.slice(corte) : "";
    $("#logo").innerHTML =
      `<span class="so-leitor">${esc(nome)}</span>` +
      [...letras].map((l) => `<span class="letra" aria-hidden="true">${esc(l)}</span>`).join("") +
      (resto ? `<span class="logo-fita" aria-hidden="true">${esc(resto)}</span>` : "");
  }

  /* ---------------- galeria: mural com filtros ---------------- */

  let filtro = "todos";
  let itensGaleria = [];   // dados de cada obra para o visor

  function montarGaleria(d, t) {
    const obras = d.galeria?.obras || [];
    const categorias = [];
    itensGaleria = obras.map((o, i) => {
      const base = BASE.galeria.obras[i] || o;
      const cat = normalizar(base.estilo);
      if (cat && !categorias.some((c) => c.id === cat)) categorias.push({ id: cat, nome: nomeServico(base.estilo, d), qtd: 0 });
      const c = categorias.find((x) => x.id === cat);
      if (c) c.qtd++;
      // "Sketch · Full body" ou "Pack de stickers · 6 stickers"
      const q = Number(base.quantidade) || 0;
      const outro = (BASE.precos?.outros || []).find((x) => normalizar(x.nome) === cat);
      const iOutro = (BASE.precos?.outros || []).indexOf(outro);
      const unidade = iOutro >= 0 ? d.precos.outros[iOutro].unidade : "";
      const detalhe = q && unidade ? `${q} ${unidade}${q > 1 ? "s" : ""}` : o.tamanho;
      const tipo = [base.estilo ? nomeServico(base.estilo, d) : "", detalhe].filter(Boolean).join(" · ");
      return { cat, src: o.imagem, titulo: o.titulo, alt: o.descricao || o.titulo, tipo, preco: textoPreco(estimar(base, d), t), adulto: !!base.adulto, obra: base, pedivel: !!acharServico(base) };
    });
    if (filtro !== "todos" && !categorias.some((c) => c.id === filtro)) filtro = "todos";

    // filtros só aparecem quando há mais de um estilo na galeria
    $("#filtros").hidden = categorias.length < 2;
    $("#filtros").innerHTML = [{ id: "todos", nome: t.filtro_todos, qtd: obras.length }, ...categorias]
      .map((c) => `<button type="button" data-filtro="${esc(c.id)}" aria-pressed="${c.id === filtro}">${esc(c.nome)} <small>${c.qtd}</small></button>`)
      .join("");

    const a = d.artista || {};
    const capa = `
      <article class="capa" data-cat="todos">
        <div class="capa-arte">
          <img src="${esc(a.imagem)}" alt="${esc(a.imagemDescricao)}" fetchpriority="high">
          <span class="capa-adesivo" aria-hidden="true">${esc(t.adesivo)}</span>
        </div>
        <div class="capa-texto">
          <p class="capa-descricao">${esc(a.descricao)}</p>
          <p class="capa-detalhe">${esc(a.detalhe)}</p>
          <div class="capa-botoes">
            <a class="botao" href="#precos">${esc(t.ver_precos)}</a>
            <a class="botao botao-contorno" href="#pedido">${esc(t.fazer_pedido)}</a>
          </div>
        </div>
      </article>`;

    $("#mural").innerHTML = capa + itensGaleria
      .map((it, i) => `
      <figure class="peca${it.adulto ? " peca-adulta" : ""}" data-cat="${esc(it.cat)}">
        <button class="peca-botao" type="button" data-grupo="galeria" data-indice="${i}" aria-label="${esc(preencher(it.adulto ? t.adulto_aria : t.ampliar_aria, { titulo: it.titulo }))}">
          <img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async">
          ${it.adulto ? `<span class="selo-adulto" aria-hidden="true"><b>${esc(t.adulto_selo)}</b><small>${esc(t.adulto_toque)}</small></span>` : ""}
          <span class="peca-legenda">
            <span class="peca-titulo">${esc(it.titulo)}</span>
            <span class="peca-meta">${it.tipo ? `<span class="peca-estilo">${esc(it.tipo)}</span>` : ""}<b>${esc(it.preco)}</b></span>
          </span>
        </button>
        ${it.pedivel ? `<a class="peca-pedir" href="#pedido" data-pedir="${i}" aria-label="${esc(preencher(t.pedir_igual_aria, { titulo: it.titulo }))}">${esc(t.pedir_igual)}</a>` : ""}
      </figure>`)
      .join("");
    aplicarFiltro();
  }

  function aplicarFiltro() {
    $$("#filtros button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filtro === filtro)));
    $$("#mural > [data-cat]").forEach((el) => {
      el.hidden = filtro !== "todos" && el.dataset.cat !== filtro;
    });
  }

  /* ---------------- preços: quadro de cardápio ---------------- */

  // bonequinho que mostra quanto do corpo entra em cada tamanho (Icon, Half body, Full body)
  let cortes = 0;
  function corteDoTamanho(tipo) {
    const id = normalizar(tipo);
    if (id.includes("icon")) return { altura: 31, dica: "tam_icon" };
    if (id.includes("half")) return { altura: 52, dica: "tam_half" };
    if (id.includes("full")) return { altura: 84, dica: "tam_full" };
    return null;
  }
  function boneco(tipo) {
    const c = corteDoTamanho(tipo);
    if (!c) return "";
    const id = `corte-${++cortes}`;
    return `<svg class="boneco" viewBox="0 0 40 84" aria-hidden="true">
      <clipPath id="${id}"><rect width="40" height="${c.altura}"/></clipPath>
      <use href="#boneco" class="boneco-fora"/>
      <use href="#boneco" clip-path="url(#${id})"/>
      <rect class="boneco-corte" x="1" y="1" width="38" height="${c.altura - 2}"/>
    </svg>`;
  }

  let itensPrecos = [];   // fotos de exemplo dos estilos e serviços, para o visor

  function montarPrecos(d, t) {
    const estilos = BASE.precos?.estilos || [];
    const nomes = d.precos?.estilos || [];
    itensPrecos = [];
    const foto = (img, nome, cor) => {
      if (!img) return "";
      itensPrecos.push({ src: img, titulo: nome, alt: preencher(t.tabela_alt, { nome }), tipo: "", preco: "" });
      return `<button class="estilo-foto" type="button" data-grupo="precos" data-indice="${itensPrecos.length - 1}" aria-label="${esc(preencher(t.ver_tabela_aria, { nome }))}"${cor ? ` style="--cor:${cor}"` : ""}><img src="${esc(img)}" alt="" loading="lazy"></button>`;
    };

    // cabeçalho: um estilo por coluna
    const cabeca = estilos
      .map((e, i) => {
        const menor = Math.min(...(e.itens || []).map(preco));
        const cor = CORES[i % CORES.length];
        return `<th scope="col" style="--cor:${cor}"><div class="estilo-cabeca">
          ${foto(e.imagem, nomes[i].nome, cor)}
          <span class="estilo-nome">${esc(nomes[i].nome)}</span>
          ${isFinite(menor) ? `<span class="estilo-desde">${esc(t.a_partir_de)} ${esc(dinheiro(menor))}</span>` : ""}
          <span class="estilo-desc">${esc(nomes[i].descricao)}</span>
        </div></th>`;
      })
      .join("");

    // linhas: os tamanhos de todos os estilos, na ordem em que aparecem
    const tamanhos = [];
    estilos.forEach((e, i) => (e.itens || []).forEach((it, j) => {
      if (!tamanhos.some((x) => x.id === normalizar(it.tipo))) tamanhos.push({ id: normalizar(it.tipo), nome: nomes[i].itens[j].tipo });
    }));
    const BASE_TIPO = (id) => estilos.flatMap((e) => e.itens || []).find((it) => normalizar(it.tipo) === id)?.tipo || id;
    const celula = (item, extra = "") => (item ? `<td><small>${esc(MOEDAS[moeda])}</small>${esc(preco(item))}${extra}</td>` : `<td class="vazio">—</td>`);
    $("#tabela-precos").innerHTML = `
      <thead><tr><th scope="col"><span class="so-leitor">${esc(t.pedido_tamanho)}</span></th>${cabeca}</tr></thead>
      <tbody>${tamanhos
        .map((tam) => `<tr><th scope="row"><span class="tamanho-linha">${boneco(BASE_TIPO(tam.id))}<span>${esc(tam.nome)}${corteDoTamanho(BASE_TIPO(tam.id)) ? `<small>${esc(t[corteDoTamanho(BASE_TIPO(tam.id)).dica] || "")}</small>` : ""}</span></span></th>${estilos.map((e) => celula((e.itens || []).find((it) => normalizar(it.tipo) === tam.id))).join("")}</tr>`)
        .join("")}</tbody>`;

    // adicionais: uma linha por adicional, com o preço em cada estilo
    const extras = [];
    estilos.forEach((e, i) => (e.adicionais || []).forEach((a, j) => {
      if (!extras.some((x) => x.id === normalizar(a.nome))) extras.push({ id: normalizar(a.nome), nome: nomes[i].adicionais?.[j]?.nome ?? a.nome });
    }));
    const caixaExtras = $("#tabela-extras").closest(".rolagem");
    caixaExtras.hidden = !extras.length;
    caixaExtras.previousElementSibling.hidden = !extras.length;
    $("#nota-personagens").hidden = !estilos.some((e) => (e.adicionais || []).some((a) => a.porUnidade));
    $("#tabela-extras").innerHTML = `
      <thead><tr><th scope="col"><span class="so-leitor">${esc(t.adicionais)}</span></th>${estilos.map((e, i) => `<th scope="col" style="--cor:${CORES[i % CORES.length]}"><span class="estilo-nome">${esc(nomes[i].nome)}</span></th>`).join("")}</tr></thead>
      <tbody>${extras
        .map((ex) => `<tr><th scope="row">+ ${esc(ex.nome)}</th>${estilos.map((e) => {
          const a = (e.adicionais || []).find((x) => normalizar(x.nome) === ex.id);
          return celula(a, a?.porUnidade ? `<em>${esc(t.cada)}</em>` : "");
        }).join("")}</tr>`)
        .join("")}</tbody>`;

    // mais serviços: etiquetas de preço
    const outros = BASE.precos?.outros || [];
    $("#outros").hidden = !outros.length;
    $("#outros-lista").innerHTML = outros
      .map((o, i) => {
        const nome = d.precos.outros[i].nome;
        return `<article class="etiqueta-preco">
          ${o.imagem ? foto(o.imagem, nome).replace("estilo-foto", "etiqueta-foto") : ""}
          <div><h4 class="etiqueta-nome">${esc(nome)}</h4><p class="etiqueta-desc">${esc(d.precos.outros[i].descricao)}</p></div>
          <p class="etiqueta-valor"><small>${esc(MOEDAS[moeda])}</small>${esc(preco(o))}${o.porUnidade ? `<em>${esc(preencher(t.por_unidade, { unidade: d.precos.outros[i].unidade }))}</em>` : ""}</p>
        </article>`;
      })
      .join("");

    // avisos (só aparecem quando o artista preencher)
    const regras = d.avisos?.lista || [];
    const naoFaco = d.avisos?.naoFaco || [];
    $("#avisos").hidden = !regras.length && !naoFaco.length;
    $("#regras").hidden = !regras.length;
    $("#regras").innerHTML = regras.map((r) => `<div${r.destaque ? ' class="regra-destaque"' : ""}><dt>${esc(r.titulo)}</dt><dd>${esc(r.texto)}</dd></div>`).join("");
    $("#nao-faco-quadro").hidden = !naoFaco.length;
    $("#nao-faco").innerHTML = naoFaco.map((n) => `<li>${esc(n)}</li>`).join("");
    $("#pedido-nao-faco").hidden = !naoFaco.length;
    $("#pedido-nao-faco-lista").innerHTML = naoFaco.map((n) => `<li>${esc(n)}</li>`).join("");
  }

  /* ---------------- sobre ---------------- */

  function montarSobre(d, t) {
    const sobre = d.sobre || {};
    const paragrafos = Array.isArray(sobre.texto) ? sobre.texto : [sobre.texto].filter(Boolean);
    $("#sobre-paragrafos").innerHTML = paragrafos.map((p) => `<p>${esc(p)}</p>`).join("");
    $("#sobre-destaques").innerHTML = (sobre.destaques || []).map((x) => `<li>${esc(x)}</li>`).join("");

    // a imagem do "Sobre" é a do campo sobre.imagem; sem ela, entra o recorte do casal
    const casal = d.casal || {};
    const img = sobre.imagem || casal.imagem;
    const fotoSobre = $("#sobre-imagem");
    $("#sobre-foto").hidden = !img;
    if (img && fotoSobre.getAttribute("src") !== img) fotoSobre.src = img;
    fotoSobre.alt = sobre.imagem ? sobre.imagemDescricao || "" : casal.descricao || "";
    $("#sobre-legenda").textContent = sobre.imagem ? "" : casal.legenda || "";

    // o casal também fica colado no pé da lombada
    $("#lombada-casal").hidden = !casal.imagem;
    const imgCasal = $("#lombada-casal-imagem");
    if (casal.imagem && imgCasal.getAttribute("src") !== casal.imagem) imgCasal.src = casal.imagem;
    imgCasal.alt = casal.descricao || "";

    const video = $("#video");
    $("#processo").hidden = !d.processo?.video;
    if (d.processo?.video && !video.getAttribute("src")) video.src = d.processo.video;

    const perguntas = d.faq?.perguntas || [];
    $("#faq").hidden = !perguntas.length;
    $("#faq-lista").innerHTML = perguntas.map((p) => `<div><dt>${esc(p.pergunta)}</dt><dd>${esc(p.resposta)}</dd></div>`).join("");

    const redes = d.contato?.redes || [];
    $("#redes").innerHTML = redes
      .map((r) => `<li><a href="${esc(linkSeguro(r.url))}" target="_blank" rel="noopener">
          <span class="rede-icone">${icone(r)}</span>
          <span><span class="rede-nome">${esc(r.nome)}</span><span class="rede-usuario">${esc(r.usuario)}</span></span>
        </a></li>`)
      .join("");
    $("#lombada-redes").innerHTML = redes
      .map((r) => `<li><a href="${esc(linkSeguro(r.url))}" target="_blank" rel="noopener" aria-label="${esc(`${r.nome} ${r.usuario}`)}" title="${esc(r.nome)}">${icone(r)}</a></li>`)
      .join("");
  }

  /* ---------------- pedido passo a passo ---------------- */

  // servico: "e0", "e1"... (estilos) ou "o0", "o1"... (mais serviços)
  // adicionais: { nome normalizado: quantidade } (vale entre estilos, então "Background" continua marcado ao trocar de estilo)
  const pedido = { servico: null, tamanho: 0, adicionais: {}, quantidade: 1 };
  let passoAtual = 0;
  let contextoPedido = null;   // { d, t } do idioma atual
  const ROTULOS_PASSO = { servico: "passo_servico", tamanho: "passo_tamanho", extras: "passo_extras", ideia: "passo_ideia", revisao: "passo_revisao" };

  function servicos(d) {
    return [
      ...(d.precos?.estilos || []).map((e, i) => ({ chave: `e${i}`, estilo: true, base: BASE.precos.estilos[i], d: e })),
      ...(d.precos?.outros || []).map((o, i) => ({ chave: `o${i}`, estilo: false, base: BASE.precos.outros[i], d: o }))
    ];
  }
  const servicoAtual = () => servicos(contextoPedido.d).find((s) => s.chave === pedido.servico);

  // acha o serviço (estilo ou "mais serviços") de uma arte da galeria
  function acharServico(obra) {
    const cat = normalizar(obra.estilo);
    if (!cat) return null;
    const e = (BASE.precos?.estilos || []).findIndex((x) => normalizar(x.nome) === cat);
    if (e >= 0) return { chave: `e${e}`, base: BASE.precos.estilos[e] };
    const o = (BASE.precos?.outros || []).findIndex((x) => normalizar(x.nome) === cat);
    return o >= 0 ? { chave: `o${o}`, base: BASE.precos.outros[o] } : null;
  }

  // "Quero um assim": abre o pedido já com o estilo, o tamanho e os extras da arte escolhida
  let ideiaAutomatica = "";
  function pedirIgual(obra, titulo) {
    const achado = acharServico(obra);
    if (!achado) return;
    const { base } = achado;
    pedido.servico = achado.chave;
    const radio = $(`#servico-${achado.chave}`);
    if (radio) radio.checked = true;
    const iTamanho = (base.itens || []).findIndex((x) => normalizar(x.tipo) === normalizar(obra.tamanho));
    pedido.tamanho = Math.max(0, iTamanho);
    pedido.adicionais = {};
    const marcados = (obra.adicionais || []).map(normalizar);
    (base.adicionais || []).forEach((a) => {
      const id = normalizar(a.nome);
      if (a.porUnidade) pedido.adicionais[id] = Math.max(0, Math.min(maxExtras(), Number(obra.ocsExtras) || 0));
      else if (marcados.includes(id)) pedido.adicionais[id] = 1;
    });
    pedido.quantidade = Math.max(1, Number(obra.quantidade) || 1);
    const ideia = $("#pedido-ideia");
    // só preenche se a pessoa ainda não escreveu nada dela
    if (!ideia.value.trim() || ideia.value === ideiaAutomatica) {
      ideiaAutomatica = preencher(contextoPedido.t.pedir_igual_ideia, { titulo });
      ideia.value = ideiaAutomatica;
    }
    atualizarOpcoesPedido();
    passoAtual = passosDoPedido().indexOf("ideia");
    if (location.hash !== "#pedido") history.pushState(null, "", "#pedido");
    irPara("pedido", true);
    mostrarPasso(true);
  }

  // as etapas mudam conforme o serviço: ref sheet não tem tamanho nem extras; stickers têm quantidade
  function passosDoPedido() {
    const s = servicoAtual();
    const lista = ["servico"];
    if (s?.estilo && (s.base.itens || []).length) lista.push("tamanho");
    if (s && (s.estilo ? (s.base.adicionais || []).length : s.base.porUnidade)) lista.push("extras");
    return [...lista, "ideia", "revisao"];
  }

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

  function contador(id, rotulo, dica, valor, min, max) {
    const { t } = contextoPedido;
    return `<div class="contador-linha" data-contador-caixa="${id}" data-min="${min}" data-max="${max}">
      <span class="contador-rotulo">${esc(rotulo)} <small>${esc(dica)}</small></span>
      <div class="contador">
        <button type="button" class="contador-botao" data-contador="${id}" data-delta="-1" aria-label="${esc(`${t.pedido_menos}: ${rotulo}`)}"${valor <= min ? " disabled" : ""}>−</button>
        <output aria-live="polite">${valor}</output>
        <button type="button" class="contador-botao" data-contador="${id}" data-delta="1" aria-label="${esc(`${t.pedido_mais}: ${rotulo}`)}"${valor >= max ? " disabled" : ""}>+</button>
      </div>
    </div>`;
  }

  // máximo de personagens extras; 0 ou vazio = sem limite
  function maxExtras() {
    const max = Number(BASE.pedido?.maxExtras);
    return max > 0 ? max : Infinity;
  }

  function montarPedido(d, t) {
    contextoPedido = { d, t };
    const lista = servicos(d);
    if (!lista.some((s) => s.chave === pedido.servico)) pedido.servico = lista[0]?.chave;

    $("#opcoes-estilo").innerHTML = lista
      .map((s, i) => {
        let valor;
        if (s.estilo) {
          const menor = Math.min(...(s.base.itens || []).map(preco));
          valor = isFinite(menor) ? `${t.a_partir_de} ${dinheiro(menor)}` : "";
        } else {
          valor = s.base.porUnidade ? `${dinheiro(preco(s.base))} ${preencher(t.por_unidade, { unidade: s.d.unidade })}` : dinheiro(preco(s.base));
        }
        const img = s.base.imagem
          ? `<img src="${esc(s.base.imagem)}" alt="" loading="lazy" decoding="async">`
          : `<span class="opcao-estilo-vazio" aria-hidden="true">${esc(s.d.nome.slice(0, 1))}</span>`;
        return `<label class="opcao-estilo" for="servico-${s.chave}">
          <input type="radio" name="servico" id="servico-${s.chave}" value="${s.chave}"${s.chave === pedido.servico ? " checked" : ""}>
          <span class="opcao-estilo-img" style="--tom:${CORES[i % CORES.length]}">${img}</span>
          <span class="opcao-estilo-nome">${esc(s.d.nome)}</span>
          ${valor ? `<span class="opcao-estilo-preco">${esc(valor)}</span>` : ""}
        </label>`;
      })
      .join("");
    $("#pedido-ideia").placeholder = t.pedido_ideia_exemplo || "";
    const dicas = d.pedido?.referenciaDicas || [];
    $("#dicas-ref").hidden = !dicas.length;
    $("#dicas-ref-titulo").textContent = d.pedido?.referenciaTitulo || "";
    $("#dicas-ref-lista").innerHTML = dicas.map((x) => `<li>${esc(x)}</li>`).join("");
    atualizarOpcoesPedido();
  }

  // tamanhos e adicionais mudam conforme o estilo; "mais serviços" têm só a quantidade
  function atualizarOpcoesPedido() {
    const { t } = contextoPedido;
    const s = servicoAtual();
    if (!s) return;
    const itens = s.estilo ? s.base.itens || [] : [];
    const adicionais = s.estilo ? s.base.adicionais || [] : [];
    if (itens.length && pedido.tamanho >= itens.length) pedido.tamanho = 0;

    $("#opcoes-tamanho").innerHTML = itens
      .map((it, i) => `<label class="pilula" for="tamanho-${i}">
          <input type="radio" name="tamanho" id="tamanho-${i}" value="${i}"${i === pedido.tamanho ? " checked" : ""}>
          ${boneco(it.tipo)}<span>${esc(s.d.itens[i].tipo)}</span><small>${esc(dinheiro(preco(it)))}</small>
        </label>`)
      .join("");

    $("#opcoes-adicionais").innerHTML = adicionais
      .map((a, j) => (a.porUnidade ? "" : `<label class="pilula" for="adicional-${j}">
          <input type="checkbox" name="adicional" id="adicional-${j}" value="${esc(normalizar(a.nome))}"${pedido.adicionais[normalizar(a.nome)] ? " checked" : ""}>
          <span>${esc(s.d.adicionais[j].nome)}</span><small>+ ${esc(dinheiro(preco(a)))}</small>
        </label>`))
      .join("");
    $("#dica-personagens").hidden = !adicionais.some((a) => a.porUnidade);
    $("#contadores-adicionais").innerHTML = adicionais
      .map((a, j) => (a.porUnidade ? contador(`a:${normalizar(a.nome)}`, s.d.adicionais[j].nome, `+ ${dinheiro(preco(a))} ${t.cada}`, pedido.adicionais[normalizar(a.nome)] || 0, 0, maxExtras()) : ""))
      .join("");

    const porUnidade = !s.estilo && s.base.porUnidade;
    if (!porUnidade) pedido.quantidade = 1;
    $("#contador-quantidade").innerHTML = porUnidade
      ? contador("quantidade", preencher(t.pedido_qtd_rotulo, { unidade: s.d.unidade }), `${dinheiro(preco(s.base))} ${t.cada}`, pedido.quantidade, 1, Infinity)
      : "";

    atualizarResumo();
    mostrarPasso(false);
  }

  function mostrarPasso(focar) {
    const { t } = contextoPedido;
    const lista = passosDoPedido();
    passoAtual = Math.max(0, Math.min(passoAtual, lista.length - 1));
    const atual = lista[passoAtual];
    $$("#pedido-form [data-passo]").forEach((p) => (p.hidden = p.dataset.passo !== atual));
    $('[data-passo="extras"] .passo-pergunta').textContent = servicoAtual()?.estilo ? t.pergunta_extras : t.pergunta_quantidade;

    $("#passos").innerHTML = lista
      .map((p, i) => {
        const feito = i < passoAtual;
        const rotulo = p === "extras" && !servicoAtual()?.estilo ? t.pedido_quantidade : t[ROTULOS_PASSO[p]];
        return `<li><button type="button" data-ir-passo="${i}"${feito ? ' class="feito"' : ""}${i === passoAtual ? ' aria-current="step"' : ""}><span aria-hidden="true">${feito ? "✓" : i + 1}</span>${esc(rotulo)}</button></li>`;
      })
      .join("");
    $("#passo-voltar").disabled = passoAtual === 0;
    $("#passo-proximo").hidden = passoAtual === lista.length - 1;

    if (focar) {
      $(`#pedido-form [data-passo="${atual}"] .passo-pergunta`)?.focus({ preventScroll: true });
      // no celular a pergunta pode ficar fora da tela: traz o assistente de volta
      const caixa = $(".assistente").getBoundingClientRect();
      if (caixa.top < 0) window.scrollBy({ top: caixa.top - 70, behavior: "smooth" });
    }
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
    const { d } = contextoPedido;
    const est = estimar(pedidoComoObra(), d);
    const total = `≈ ${dinheiro(est?.total ?? 0)}`;

    $("#resumo-linhas").innerHTML = (est?.partes || [])
      .map((p) => `<li><span>${esc(p.rotulo)}</span><b>${esc(dinheiro(p.valor))}</b></li>`)
      .join("");
    $("#resumo-total").textContent = total;
    $("#total-parcial").textContent = total;

    // mensagem pronta + link do Telegram
    const msg = mensagemPedido(est);
    $("#pedido-mensagem").textContent = msg;
    const achado = BASE.pedido?.telegram || (BASE.contato?.redes || []).find((r) => normalizar(r.icone || r.nome) === "telegram")?.url;
    const telegram = achado && linkSeguro(achado) !== "#" ? linkSeguro(achado) : "";
    const botaoTelegram = $("#pedido-telegram");
    botaoTelegram.hidden = !telegram;
    if (telegram) botaoTelegram.href = `${telegram}${telegram.includes("?") ? "&" : "?"}text=${encodeURIComponent(msg)}`;

    $("#resumo-fechado").hidden = !!d.comissoes?.abertas;
    $("#resumo-pagamento").hidden = !d.pedido?.pagamento;
  }

  // atualiza os números e os botões +/− sem redesenhar (assim o foco do teclado não se perde)
  function atualizarContadores() {
    $$("[data-contador-caixa]").forEach((caixa) => {
      const id = caixa.dataset.contadorCaixa;
      const valor = id === "quantidade" ? pedido.quantidade : pedido.adicionais[id.slice(2)] || 0;
      $("output", caixa).textContent = valor;
      $('[data-delta="-1"]', caixa).disabled = valor <= Number(caixa.dataset.min);
      $('[data-delta="1"]', caixa).disabled = valor >= Number(caixa.dataset.max);
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
      // plano B: abre a mensagem e seleciona o texto para a pessoa copiar
      if (silencioso) return;
      $(".resumo-mensagem").open = true;
      const faixa = document.createRange();
      faixa.selectNodeContents($("#pedido-mensagem"));
      getSelection().removeAllRanges();
      getSelection().addRange(faixa);
      aviso.textContent = document.execCommand?.("copy") ? t.pedido_copiado : t.pedido_copiar_erro;
    }
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
      const novo = Math.min(Number(caixa.dataset.max), Math.max(Number(caixa.dataset.min), atual + Number(botao.dataset.delta)));
      if (id === "quantidade") pedido.quantidade = novo;
      else pedido.adicionais[id.slice(2)] = novo;
      atualizarContadores();
      atualizarResumo();
    });
    $("#pedido-ideia").addEventListener("input", () => atualizarResumo());
    $("#passo-proximo").addEventListener("click", () => { passoAtual++; mostrarPasso(true); });
    $("#passo-voltar").addEventListener("click", () => { passoAtual--; mostrarPasso(true); });
    $("#passos").addEventListener("click", (ev) => {
      const botao = ev.target.closest("[data-ir-passo]");
      if (botao) { passoAtual = Number(botao.dataset.irPasso); mostrarPasso(true); }
    });
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
    if (botao && botao.dataset.moeda !== moeda) {
      moeda = botao.dataset.moeda;
      moedaEscolhida = true;
      try { localStorage.setItem("moeda", moeda); } catch {}
      montar();
    }
    const pedir = ev.target.closest("[data-pedir]");
    if (pedir) {
      ev.preventDefault();
      const it = itensGaleria[Number(pedir.dataset.pedir)];
      if (it) pedirIgual(it.obra, it.titulo);
    }
    const filtroBotao = ev.target.closest("[data-filtro]");
    if (filtroBotao) { filtro = filtroBotao.dataset.filtro; aplicarFiltro(); }
  });

  /* ---------------- abas ---------------- */

  const PAGINAS = ["galeria", "precos", "pedido", "sobre"];

  // mostra uma aba e esconde as outras; o endereço (#precos, #pedido...) diz qual está aberta
  function irPara(id, focar) {
    if (!PAGINAS.includes(id)) return false;
    $$("[data-pagina]").forEach((p) => (p.hidden = p.id !== id));
    $$(".abas a").forEach((a) => (a.dataset.aba === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    if (focar) {
      window.scrollTo({ top: 0, behavior: "instant" });
      const titulo = $(`#${id} .pagina-titulo`);
      titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    }
    return true;
  }

  addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (!irPara(id, true) && id === "principal") $("#principal").focus();
  });
  // clicar na aba que já está aberta volta para o topo dela
  $$(".abas a, .logo a").forEach((a) => a.addEventListener("click", () => {
    if (location.hash === a.getAttribute("href")) window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  /* ---------------- montagem ---------------- */

  let jaMontou = false;

  function montar() {
    const d = mesclar(BASE, idioma === "pt" ? null : TRAD.conteudo?.[idioma]);
    const t = { ...(TRAD.interface?.pt || {}), ...(TRAD.interface?.[idioma] || {}) };

    document.documentElement.lang = idioma === "pt" ? "pt-BR" : idioma;

    // textos fixos da interface
    $$("[data-i18n]").forEach((el) => { if (t[el.dataset.i18n] != null) el.textContent = t[el.dataset.i18n]; });
    $$("[data-i18n-aria]").forEach((el) => { if (t[el.dataset.i18nAria]) el.setAttribute("aria-label", t[el.dataset.i18nAria]); });
    $$("[data-i18n-alt]").forEach((el) => { if (t[el.dataset.i18nAlt]) el.alt = t[el.dataset.i18nAlt]; });

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

    montarLogo(d.artista?.nome || "");
    montarGaleria(d, t);
    montarPrecos(d, t);
    montarSobre(d, t);
    montarPedido(d, t);
    $("#ano").textContent = new Date().getFullYear();

    if (!jaMontou) {
      jaMontou = true;
      ativarVisor();
      ativarPedido();
    }
  }

  /* ---------------- visor de imagens ---------------- */

  // artes +18 ficam borradas até o visitante confirmar a idade (a resposta fica guardada neste navegador)
  let maior18 = false;
  try { maior18 = localStorage.getItem("maior18") === "sim"; } catch {}
  document.documentElement.classList.toggle("maior18", maior18);

  function confirmarIdade() {
    if (maior18) return Promise.resolve(true);
    const aviso = $("#aviso-adulto");
    if (!aviso.showModal) return Promise.resolve(false);
    aviso.returnValue = "";
    aviso.showModal();
    return new Promise((ok) => aviso.addEventListener("close", () => {
      maior18 = aviso.returnValue === "sim";
      if (maior18) {
        document.documentElement.classList.add("maior18");
        try { localStorage.setItem("maior18", "sim"); } catch {}
      }
      ok(maior18);
    }, { once: true }));
  }

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
      $("#visor-legenda").textContent = [item.tipo, item.preco].filter(Boolean).join(" · ");
      $("#visor-contador").textContent = grupo.length > 1 ? `${atual + 1} / ${grupo.length}` : "";
      $("#visor-pedir").hidden = !item.pedivel;
      $$(".visor-seta", visor).forEach((b) => (b.hidden = grupo.length < 2));
    };

    document.addEventListener("click", async (ev) => {
      const alvo = ev.target.closest("[data-grupo]");
      if (!alvo || !visor.showModal) return;
      if (alvo.closest(".peca-adulta") && !(await confirmarIdade())) return alvo.focus();
      let inicio = Number(alvo.dataset.indice);
      if (alvo.dataset.grupo === "galeria") {
        // na galeria, o visor passa só pelas artes do filtro escolhido (e as +18 só depois de confirmar a idade)
        const visiveis = $$(`#mural .peca:not([hidden])${maior18 ? "" : ":not(.peca-adulta)"} [data-indice]`).map((b) => Number(b.dataset.indice));
        grupo = visiveis.map((i) => itensGaleria[i]);
        inicio = visiveis.indexOf(inicio);
      } else {
        grupo = itensPrecos;
      }
      if (!grupo.length) return;
      origem = alvo;
      mostrar(inicio);
      visor.showModal();
    });

    visor.addEventListener("click", (ev) => {
      const acao = ev.target.closest("[data-visor]")?.dataset.visor;
      if (acao === "fechar" || ev.target === visor || ev.target.tagName === "FIGURE") visor.close();
      if (acao === "anterior") mostrar(atual - 1);
      if (acao === "proxima") mostrar(atual + 1);
      if (acao === "pedir") { const item = grupo[atual]; visor.close(); pedirIgual(item.obra, item.titulo); }
    });
    visor.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") mostrar(atual - 1);
      if (ev.key === "ArrowRight") mostrar(atual + 1);
    });
    visor.addEventListener("close", () => origem?.focus());

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

  const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouseFino = matchMedia("(pointer: fine)").matches;


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
    const pintarLata = () => lata.style.setProperty("--tinta-spray", `rgb(${CORES_SPRAY[corSpray]})`);
    pintarLata();

    addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      // janelas abertas (visor, aviso +18) ficam por cima de tudo, então a lata vai junto para dentro delas
      const casa = $("dialog[open]") || document.body;
      if (lata.parentElement !== casa) casa.append($("#rastro-cursor"), lata);
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

  // a aba certa aparece antes mesmo do conteúdo carregar
  irPara(location.hash.slice(1), false) || irPara("galeria", false);

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
