# Probabilidade & Inferência Estatística

Landing page interativa de **Probabilidade e Inferência Estatística**, construída sobre dados de
nascidos vivos do SINASC/DataSUS (2024).

## O que tem aqui

- **Parte 1 — Probabilidade**: laboratórios de Binomial, Poisson e Normal com sliders que recalculam
  tudo ao vivo e mostram a distribuição.
- **Parte 2 — Inferência**: laboratórios de média (APGAR1) e proporção (peso ≥ 2.500 g) com
  intervalo de confiança, teste de hipóteses e verificação de requisitos.
- **Resultados**: comparação entre estimativa amostral e o verdadeiro parâmetro populacional.
- **Formulário**: a “cola” com as fórmulas usadas.

## Interação

Em vez de um dashboard de filtros, a página usa uma **trilha de estudo** fixa à esquerda que
acompanha a questão em foco, **sliders de parâmetros** com resultado em tempo real e um botão
**“ver resolução passo a passo”** em cada questão.

## Precisão dos números

Toda a matemática vive em `src/lib/stats.ts` (TypeScript puro, sem dependências): binomial, Poisson,
normal, quantis, t de Student, beta incompleta etc. Os valores foram validados contra o **R 4.6.0**
com os dados reais da atividade — veja `src/lib/stats.test.ts`.

> Referência de base: os dados e os resultados conferidos estão em
> `public/statistical-data-analysis.Rmd` (material de origem em R).

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

## Stack

Vite · React 19 · TypeScript · CSS puro · framer-motion · lucide-react · Vitest.
