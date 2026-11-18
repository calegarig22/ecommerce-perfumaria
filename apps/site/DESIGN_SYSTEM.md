# Perfumaria Exemplo — design system

Regra de ouro: **nunca hardcode um valor; use o token.** Fonte única: `src/app/globals.css`.

## Conceito

Chique, sofisticado e confortável. Branco dominante (não creme), caramelo da logo como
assinatura e tabaco no lugar do preto.

- **Fotos:** imagens de produto (no portfólio: placeholders genéricos), com fundo transparente, sobre um quadro com tom suave da
  família olfativa (`tileTint`). Assim frascos iguais de fragrâncias diferentes não parecem
  repetidos. Nunca usar imagens de frascos de outras marcas.
- **Notas olfativas:** marcadores de saída, coração e fundo nos tons da família (`strata`).

## Cor

| Token | Hex | Uso | Contraste no branco |
| --- | --- | --- | --- |
| `paper` | #FFFFFF | Fundo principal | — |
| `linen` | #FAF6F2 | Seções alternadas, tiles de produto | — |
| `nude` | #F3E9E0 | Painéis de destaque, chips ativos | — |
| `caramel` | #BE916D | Cor da logo. **Só decorativo** ou sobre `ink` | 2.8:1 ✗ texto |
| `accent` | #8A5D3B | Hover, destaques de texto | 5.7:1 ✓ |
| `ink` | #2E2420 | Texto, botão primário, rodapé | 15.1:1 ✓ |
| `muted` | #6B5D54 | Texto secundário | 6.3:1 ✓ |
| `line` / `line-strong` | ink 14% / 30% | Divisórias, bordas | — |

Tons de família (líquido do frasco, bolinhas de filtro) ficam em `src/lib/format.ts`.

## Tipografia

- **Gilda Display** (`font-display`): títulos e nomes de produto. Serifa de alto contraste,
  parente das letras da logo, com acentos do português bem desenhados. Tem **um peso só**:
  nunca usar `font-medium`/`font-light` com ela (`font-synthesis: none` evita negrito falso).
  O Cormorant foi testado e descartado, porque o circunflexo alto ficava estranho em "experiências".
- **Jost** (`font-sans`): texto e interface, geométrica da família Futura.
- `label-caps`: versalete espaçado (0.16em), **só** em menu, botões e rótulos de filtro.
- Texto base de 17px. Display com `clamp()`. Texto corrido limitado a ~62ch (`measure`).

## Componentes

- `btn-primary` / `btn-secondary`: retangulares (raio 2px), em versalete. Use uma ação principal por bloco.
- Chips de filtro e etiquetas removíveis: em pílula. Botões de ação: sempre retangulares.
- WhatsApp flutuante ("Fale conosco") fica fixo no canto inferior direito, em todas as páginas.
- `link-quiet`: links de texto (sublinhado discreto).
- Alvos de toque ≥ 44px; foco visível com `accent`; `prefers-reduced-motion` respeitado.
- Movimento: só em resposta ao usuário (troca de fragrância, abrir sacola, hover leve).

## Não fazer

- Rótulos em caixa-alta acima de títulos, numeração decorativa (só em sequências reais,
  como "Como comprar"), cards idênticos com sombra, gradientes decorativos, setas "→".
- Citar marcas de terceiros ou usar imagens de frascos de outras marcas.
