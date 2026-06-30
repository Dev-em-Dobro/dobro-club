# Codédex — Design System

> Documento de referência visual baseado na landing page do Codédex (codedex.io).
> Estilo: **pixel art / fantasia retrô 16-bits**, com ar de RPG de fliperama e gamificação (XP, badges, regiões desbloqueáveis).

---

## 1. Princípios visuais

- **Retrô gamificado.** Tudo remete a videogame antigo: sprites em pixel art, mapas de "mundo", caixas de diálogo, XP e badges colecionáveis.
- **Fundo escuro como base.** O site vive sobre um azul-quase-preto. As cores saturadas e os sprites saltam por cima desse fundo.
- **Acentos pastel saturados.** Ciano, amarelo, magenta, verde-limão — usados com parcimônia, sempre como destaque sobre o escuro.
- **Pixel onde diverte, legível onde importa.** Fonte pixelada nos títulos e elementos de jogo; sans-serif limpa no texto longo pra não cansar a leitura.

---

## 2. Paleta de cores

Cores extraídas diretamente da landing page.

### Base / fundo
| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#030617` | Fundo principal (azul-quase-preto) |
| `--bg-elevated` | `#0a1020` | Cards, seções elevadas |
| `--bg-card` | `#121920` | Cartões de curso, blocos internos |
| `--border` | `#262f3f` | Bordas sutis de cards e inputs |

### Acentos da marca
| Token | Hex | Uso |
|---|---|---|
| `--yellow` | `#facc16` | **Cor primária de ação** — botões "Get started", logo, XP, destaques |
| `--yellow-shadow` | `#b77807` | Sombra/borda inferior dos botões amarelos (efeito pixel 3D) |
| `--blue` | `#147dd0` | Botões secundários ("Explore All Courses"), links de ação |
| `--cyan` | `#9decf3` | Céu do hero, detalhes claros, brilhos |
| `--magenta` | `#b46cb8` | Acentos roxo/rosa, balões de comunidade, regiões do mapa |
| `--purple-deep` | `#983a92` | Roxo profundo do gradiente "Join the Club" |
| `--lime` | `#bffc87` | Verde-limão do bloco Minesweepers / portfolio |

### Cores de estatística (stats / XP)
Usadas nos números grandes ("1.8m+ Learners", etc.), cada um numa cor:
| Token | Hex | Uso |
|---|---|---|
| `--stat-yellow` | `#facc16` | Learners |
| `--stat-green` | `#4caf50` | Countries |
| `--stat-cyan` | `#22c3d6` | Exercises |
| `--stat-pink` | `#e0457a` | Builds |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--text` | `#eef8fa` | Texto principal (branco levemente azulado) |
| `--text-muted` | `#9aa6b8` | Texto secundário, descrições, legendas |

### Gradiente "Join the Club"
Faixa que vai de **azul → roxo → magenta** horizontalmente:
```css
background: linear-gradient(90deg, #1e3a8a 0%, #6d28d9 50%, #b04bb0 100%);
```

---

## 3. Tipografia

Três famílias, cada uma com um papel claro.

### Press Start 2P — *display pixel / fliperama*
- **Fonte:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (Google Fonts, gratuita)
- **Uso:** títulos de seção, headings de jogo, números de XP, labels de badge, botões de destaque.
- **Cuidado:** é pesadíssima de ler em texto corrido — usar **só em frases curtas**. Caixa alta ou title case, com `letter-spacing` levemente reduzido e `line-height` generoso (≥1.5) porque a fonte é alta.

```css
font-family: "Press Start 2P", monospace;
line-height: 1.6;
```

### Pixelgrid — *display pixel secundária / decorativa*
- **Fonte:** Pixelgrid (comercial — **não** está no Google Fonts; requer licença).
- **Uso:** títulos e detalhes decorativos onde se quer variação ao Press Start 2P. Boa pra logotipos de seção e elementos de "tela de jogo" sem a rigidez quadrada da Press Start.
- **Fallback sugerido:** `"Press Start 2P", monospace` caso a Pixelgrid não esteja disponível.

### Mulish — *corpo de texto*
- **Fonte:** [Mulish](https://fonts.google.com/specimen/Mulish) (Google Fonts, gratuita)
- **Uso:** todo o texto longo — parágrafos, descrições de curso, depoimentos, conteúdo de lição. Sans-serif arredondada e altamente legível.

```css
font-family: "Mulish", -apple-system, system-ui, sans-serif;
line-height: 1.6;
```

### Hierarquia recomendada
| Elemento | Fonte | Peso | Tamanho (desktop) |
|---|---|---|---|
| Hero / título de seção | Press Start 2P | 400 | 28–40px |
| Subtítulo decorativo | Pixelgrid | 400 | 20–28px |
| Heading de card | Press Start 2P | 400 | 14–16px |
| Body / parágrafo | Mulish | 400 | 16–18px |
| Texto secundário | Mulish | 400 | 13–14px |
| Botão | Press Start 2P | 400 | 12–14px |

### Import (Google Fonts — Press Start 2P + Mulish)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700;800&family=Press+Start+2P&display=swap" rel="stylesheet">
```
(Pixelgrid precisa ser hospedada/licenciada à parte com `@font-face`.)

---

## 4. Componentes

### Botões
- **Primário (amarelo):** fundo `--yellow`, texto escuro `--bg`, fonte Press Start 2P. Estilo "pixel 3D" com borda/sombra inferior em `--yellow-shadow`, sem cantos arredondados (ou bem mínimos).
- **Secundário (azul):** fundo `--blue`, texto branco. Mesmo tratamento pixel.
- **Hover:** "afundar" o botão (remover a sombra inferior e empurrar 2px pra baixo), imitando botão de fliperama sendo pressionado.

```css
.btn-primary {
  font-family: "Press Start 2P", monospace;
  background: var(--yellow);
  color: var(--bg);
  border: none;
  border-radius: 4px;
  box-shadow: 0 4px 0 var(--yellow-shadow);
  padding: 14px 22px;
  transition: transform .05s, box-shadow .05s;
}
.btn-primary:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 var(--yellow-shadow);
}
```

### Pills / filtros de categoria
Botões-pílula de filtro ("Popular", "Web Development", "Data Science"...). Selecionado = contorno/preenchimento azul `--blue`; demais = contorno sutil `--border` sobre o fundo escuro. Cantos arredondados (pill, ao contrário dos botões pixel).

### Cards de curso
- Fundo `--bg-card`, borda `--border`, cantos levemente arredondados.
- Topo: thumbnail em pixel art da "região" do curso.
- Label `COURSE` pequena em maiúsculas + título (Press Start 2P) + descrição (Mulish, `--text-muted`).
- Badge de nível no rodapé: `BEGINNER` / `INTERMEDIATE` com ícone.

### Badges de nível
Pílulas pequenas com ícone pixel: `BEGINNER` (verde), `INTERMEDIATE` (roxo/azul). Fonte pequena, caixa alta.

### Mapa de mundo
Elemento-assinatura: ilha/mapa em pixel art com as regiões nomeadas (CSS, JS, AI, Python, SQL, HTML, GAME DEV) conectadas por caminhos — metáfora central da "jornada". Use como peça visual hero secundária.

### Caixa de diálogo / editor
Blocos estilo "janela de jogo" e mock de editor de código (tema escuro) com sprites de personagens ao redor reagindo — reforça o tom lúdico.

### Balões de comunidade
Balões de chat arredondados (estilo bolha de mensagem) em magenta/verde sobrepostos a sprites, na seção de comunidade.

---

## 5. Sprites & ornamentos
- Personagens em pixel art (mascotes) espalhados reagindo aos blocos.
- Estrelinhas e detalhes `⋆˙⟡ ✨` ao redor de títulos (faz parte da identidade — aparece até no `<title>`).
- Foguete pixel, flores, criaturas — decorações que preenchem espaços vazios sem poluir.
- Selos/láureas de prêmio (estilo "Product Hunt", reviews) em pixel perto do rodapé.

---

## 6. Layout & espaçamento
- Coluna central de conteúdo, larga e respirada, sobre fundo escuro contínuo.
- Seções alternam texto-à-esquerda / imagem-à-direita (e vice-versa).
- Bastante respiro vertical entre seções (o ritmo é calmo, tipo rolar por um mapa).
- A faixa "Join the Club" quebra o fundo escuro com o gradiente azul→roxo→magenta, criando destaque pro bloco de conversão.

---

## 7. Resumo de tokens (CSS custom properties)

```css
:root {
  /* base */
  --bg: #030617;
  --bg-elevated: #0a1020;
  --bg-card: #121920;
  --border: #262f3f;

  /* marca */
  --yellow: #facc16;
  --yellow-shadow: #b77807;
  --blue: #147dd0;
  --cyan: #9decf3;
  --magenta: #b46cb8;
  --purple-deep: #983a92;
  --lime: #bffc87;

  /* stats */
  --stat-yellow: #facc16;
  --stat-green: #4caf50;
  --stat-cyan: #22c3d6;
  --stat-pink: #e0457a;

  /* texto */
  --text: #eef8fa;
  --text-muted: #9aa6b8;

  /* fontes */
  --font-display: "Press Start 2P", monospace;
  --font-display-alt: "Pixelgrid", "Press Start 2P", monospace;
  --font-body: "Mulish", system-ui, sans-serif;
}
```