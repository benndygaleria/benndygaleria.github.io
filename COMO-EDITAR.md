# Site BenndyGaleria: como publicar e editar

## O que tem nesta pasta

| Arquivo | Para que serve | Precisa mexer? |
|---|---|---|
| `conteudo.json` | **Todos os textos (em português), preços em R$ e US$, imagens, links e o status das comissões** | Sim, é aqui que você edita |
| `traducoes.json` | Textos em inglês e espanhol | Só quando mudar um texto e quiser traduzir |
| `imagens/` | Artes (e vídeo, se tiver) | Só para adicionar ou trocar arquivos |
| `compartilhar.jpg` | Imagem que aparece quando o link é enviado no WhatsApp, Telegram, Discord... | Não |
| `.pages.yml` | Configura o painel de edição visual (Pages CMS) | Não |
| `index.html`, `estilo.css`, `script.js` | Estrutura, visual e animações | Não (as cores ficam no topo do `estilo.css`) |

---

## 1. Colocar o site no ar (uma vez só, grátis)

1. Crie uma conta em **github.com** (pode ser a do Benndy).
2. Clique em **New repository**, dê o nome `benndygaleria`, deixe **Public** e crie.
3. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo desta pasta** (incluindo a pasta `imagens`). Clique em **Commit changes**.
   - O arquivo `.pages.yml` começa com ponto e pode ficar oculto no Windows. Se ele não subir, crie no GitHub com **Add file → Create new file**, nome `.pages.yml`, e cole o conteúdo.
4. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
5. Em 1 ou 2 minutos o site estará em `https://SEU-USUARIO.github.io/benndygaleria/`.

**Prévia do link:** o `index.html` está configurado para o endereço `https://benndygaleria.github.io/`. Se o endereço final for outro, troque esse endereço nas linhas `og:url`, `og:image` e `twitter:image` do `index.html`.

---

## 2. Editar o site

### Jeito mais fácil: painel visual (Pages CMS)

1. Entre em **app.pagescms.org** e faça login com a conta do GitHub.
2. Escolha o repositório `benndygaleria`.
3. Abra **Conteúdo do site**. Tem formulários para tudo: status das comissões, galeria, preços, avisos, redes.
4. Para trocar ou adicionar uma arte, use o campo de imagem. Ele envia o arquivo para a pasta `imagens`.
5. Clique em **Save**. O site atualiza sozinho em 1 ou 2 minutos.

### Jeito direto: pelo próprio GitHub

Abra `conteudo.json` no GitHub, clique no lápis (✏️), edite e clique em **Commit changes**.

---

## Edições comuns

**Abrir ou fechar comissões:** troque `"abertas": true` por `"abertas": false`. O selo no topo fica vermelho e aparece o aviso de "fechadas".

**Mudar um preço:** cada preço tem dois valores, `"brl"` (real) e `"usd"` (dólar). Eles não são convertidos um no outro: são tabelas diferentes. Não use aspas nem "R$" no número.

```json
{ "tipo": "Half body", "brl": 20, "usd": 35 }
```

**Adicionais:** ficam dentro de cada estilo, em `"adicionais"`. Com `"porUnidade": true` o site mostra um contador (ex.: 2× Personagem extra). Com `false` é só marcar ou desmarcar (ex.: Background, Sombra).

**Colocar a arte de exemplo de cada estilo:** envie a imagem para `imagens/` e preencha `"imagem"` no estilo (ex.: `"imagens/exemplo-sketch.jpg"`). Enquanto estiver vazio, aparece o nome do estilo em letras grandes.

**Adicionar uma arte na galeria:** a seção "Trabalhos" só aparece quando tiver pelo menos uma arte. Envie a imagem para `imagens/` e adicione um bloco dentro de `"obras"`:

```json
{
  "imagem": "imagens/minha-arte.jpg",
  "titulo": "Nome da arte",
  "descricao": "O que aparece na imagem, para quem usa leitor de tela",
  "estilo": "Flat Color",
  "tamanho": "Full body",
  "ocsExtras": 1,
  "adicionais": ["Sombra", "Background"]
}
```

- O site calcula o preço estimado sozinho com a tabela, na moeda que o visitante escolheu.
- Para escrever o valor na mão, use `"precoManualBRL"` e `"precoManualUSD"` (só o número, ex.: `"50"`, aparece como "a partir de R$ 50").
- Para ref sheet ou stickers, use `"estilo": "Ref sheet"` ou `"estilo": "Pack de stickers"` (com `"quantidade": 6`, por exemplo).

**Vídeo do processo:** coloque um `.mp4` em `imagens/` e preencha `"video"` em `"processo"`. Sem vídeo, a seção não aparece.

**Avisos e "Não faço":** preencha `"lista"` (regras como pagamento e prazo) e `"naoFaco"` em `"avisos"`. Enquanto estiverem vazios, a seção não aparece no site.

**Formas de pagamento:** preencha `"pagamento"` em `"pedido"`. Aparece no resumo do pedido.

---

## Idiomas e moeda

O site abre no idioma do navegador do visitante (português, inglês ou espanhol), e ele pode trocar no seletor **PT / EN / ES**. Quem vê em português começa com preços em **R$**, e nos outros idiomas começa em **US$**. O visitante pode trocar no seletor **R$ / US$**.

- O **português** fica no `conteudo.json`.
- O **inglês e o espanhol** ficam no `traducoes.json`, em `"conteudo" → "en"` e `"es"`. Cada lista segue a mesma ordem do português.
- Se algo não estiver traduzido, o site mostra em português.
- Preços, imagens e links vêm sempre do `conteudo.json`.
- Para testar: `?lang=en`, `?lang=es`, `?moeda=usd` ou `?moeda=brl` no fim do endereço.

**Cuidados com o JSON:** cada item de uma lista é separado por vírgula, mas o último não leva vírgula. Textos ficam sempre entre aspas `" "`. Se o site mostrar "Não consegui carregar o conteúdo", quase sempre é uma vírgula ou aspas sobrando ou faltando. Cole o arquivo em **jsonlint.com** para achar o erro.

**Dica para imagens:** salve em JPG ou WEBP com no máximo ~2000 px no lado maior.

---

## Ver o site no computador antes de publicar

O site precisa de um servidor local para ler o `conteudo.json` (abrir o `index.html` com dois cliques não funciona). Com Python instalado, abra o terminal nesta pasta e rode:

```
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

---

## Como o site está organizado

O site funciona como um app com 4 abas: **Galeria** (abre primeiro), **Preços**, **Pedido** (passo a passo) e **Sobre**. No computador as abas ficam na coluna da esquerda; no celular, numa barra embaixo.

- **Galeria:** as artes de `"galeria" → "obras"`. Os botões de filtro aparecem sozinhos, um para cada estilo que tiver arte.
- **Preços:** o quadro é montado com a tabela de `"precos"`. A `"imagem"` de cada estilo vira a fotinho redonda no topo da coluna.
- **Casal (Benndy e Mivie):** coloque o recorte sem fundo (PNG) em `imagens/` e preencha `"casal" → "imagem"`. Ele aparece no pé da coluna da esquerda e na aba Sobre.
