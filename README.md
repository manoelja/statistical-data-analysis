# Probabilidade & Inferência Estatística

Landing page interativa sobre **probabilidade e inferência estatística**, construída sobre dados de
nascidos vivos do SINASC/DataSUS (2024). A página inteira é uma jornada 3D: o scroll vira o eixo Z
e a câmera atravessa um buraco negro antes de chegar ao corredor de laboratórios.

## Scripts

```bash
npm install      # dependências
npm run dev      # servidor de desenvolvimento
npm run build    # typecheck (tsc -b) + build de produção
npm run preview  # serve o build
npm run lint     # ESLint
npm run test     # Vitest (watch)
npm run test:run # Vitest (uma execução)
```

## O percurso

Um palco `sticky` de uma tela dentro de uma seção de 600vh segura o canvas enquanto a seção rola.
A cada etapa um **card** entra com o conteúdo real daquela parte, e o elemento 3D correspondente
aparece do outro lado do corredor.

| Etapa | Card | Elemento 3D |
| --- | --- | --- |
| 0 | prólogo: o buraco negro | disco de acreção + poeira capturada |
| 1 | Visão geral — os cards da base | tabela de frequências |
| 2 | Parte 1 — Probabilidade (Binomial, Poisson, Normal) | dados 3D |
| 3 | Parte 2 — Inferência (média, proporção) | histograma + curva normal |
| 4 | Resultados — o IC cobriu o parâmetro? | nuvem de dispersão |
| 5 | Formulário — a "cola" | cubo de fórmulas |
| 6 | epílogo: o buraco branco | disco de ejeção + núcleo + casca de choque |
| 7 | Contato — os quatro botões de saída | **nebulosa** (o olho) |

Dentro de cada laboratório a **trilha de estudo** funciona como abas: uma questão por vez, com
sliders de resultado ao vivo e um botão "ver resolução passo a passo".

### Prólogo: a queda

Os primeiros ~21% do scroll (`JOURNEY_LEAD`) acontecem antes do corredor, com o buraco na origem.

| Progresso | O que acontece |
| --- | --- |
| 0 – 0,138 | aproximação: o disco cresce, a câmera desce ao plano dele, o FOV abre |
| 0,138 | travessia do horizonte — o clarão no pico |
| 0,138 – 0,150 | **sustentação do branco**: a câmera volta ao enquadramento do corredor escondida atrás do clarão |
| 0,150 – 0,210 | **queda**: o branco cede, o disco se espalha virando poeira de dados, o título acende |
| ~0,20 | **o rebosininho**: a câmera recua 130 unidades para mostrar o buraco e desce de novo |
| 0,225 | **Cena 1** |

Duas decisões que sustentam a cena:

- **O mesmo buffer serve aos dois mundos.** As 3.200 partículas do disco giram com Kepler
  (ω ∝ r^-3/2) no vertex shader; o uniform `uReveal` as empurra para fora e as apaga. A nuvem que
  forma o buraco é a mesma que se condensa na poeira do corredor — não há corte nem fade.
- **O puxão é do relógio, não do scroll.** `pullAt(t)` é exponencial com **teto** (`PULL_MAX =
  0,62`): se fosse até 1, a poeira seria consumida em segundos e o buraco ficaria sem o que puxar.

## Mapa do código

```
src/
  lib/stats.ts              toda a matemática (puro, sem dependências)
  data/results.ts           números conferidos no R
  lib/scene/
    journey.ts               monta a cena + a coreografia (nada ali desenha)
    store.ts                 estado compartilhado entre os labs e a cena
    chalk.ts  noise.ts       paleta de giz e ruído orgânico
    three/                   as peças 3D, o black hole e o viewer
  hooks/useRafLoop.ts        o loop único (teto de FPS, pausa com a aba oculta)
  components/site/Journey3D.tsx   a página
```

A separação é a mesma do `lib/stats.ts`: **cálculo fora da geometria**. `journey.ts` tem funções
puras e testadas — `depthAt`/`progressAt` (scroll ↔ Z), `cardPose` (opacidade e deslocamento dos
cards), `chapterAnchor`, `holePhase`, `prologueOpacity`, `rewindEnvelope` — e `Journey3D` só mede a
seção, chama essas funções dentro do loop e publica o resultado na DOM, **sem re-render a 60 fps**.

`three/viewer.ts` é a única parte que fala com a GPU. Sem WebGL o componente cai num aviso e a
página continua funcionando em HTML.

### Invariantes

Coisas que um teste garante e que é fácil quebrar por acidente:

- **A câmera nunca atravessa uma peça sólida** ao longo do percurso. A única exceção é o buraco
  negro, marcado com `userData.letCameraPass` — a travessia é de propósito.
- **A transição é a mesma em qualquer tela.** O retrato não tem coreografia própria: só a *base*
  do FOV se adapta (72° no estreito, para o corredor caber) e há um teto (`MAX_FOV = 78°`).
- **O paralaxe do ponteiro sai de cena no prólogo**, multiplicado por `1 − approach`: a 3,5
  unidades do plano do disco, ±2,5 levariam a câmera de dentro da poeira para o vazio.
- **`prefers-reduced-motion`** recebe o mesmo roteiro — só congela o tempo. A câmera continua
  respondendo ao scroll, que é movimento dirigido pelo usuário.
- **`holePhase` é contínua**: o clarão não dá degrau na travessia nem oscila depois de começar a
  cair.

## Precisão dos números

Toda a matemática vive em `src/lib/stats.ts`: binomial, Poisson, normal, quantis, t de Student,
beta incompleta. Os valores foram validados contra o **R 4.6.0** com os dados reais da atividade
(veja `src/lib/stats.test.ts`). O material de origem está em
`public/statistical-data-analysis.Rmd` — é ele que lê os CSVs da raiz.

> Atenção: `.gitignore` ignora `nascidos_vivos_2024.csv` (35 MB) **e também** `amostra_200.csv`
> (3 KB), apesar de o comentário mandar versionar a amostra. Quem clonar não consegue reproduzir
> os números do R sem os dois arquivos.

## Conteúdo ↔ animação

Os sliders dos laboratórios publicam `μ`, `σ`, `λ`, `n` e `p` em `scene/store`, e a cena consome
a cada quadro. O estado fica **fora do React** de propósito, para a cena ler de dentro do loop sem
provocar re-render. `store.test.ts` e os testes dos labs garantem a ponte nos dois sentidos.

## Stack

Vite · React 19 · TypeScript · CSS puro · Three.js · framer-motion · lucide-react · Vitest.

## Código não montado

`components/site/DataScienceBackdrop.tsx` (1.065 linhas) é um quadro SVG animado que consome o
mesmo estado e tem teste, mas **não é importado por nada** — ficou no repositório junto com
`scene/pointer.ts` e `scene/projection.ts`, que só ele consome. A página de hoje não usa nada disso.