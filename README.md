<div align="center">

# Probabilidade & Inferência Estatística

### Jornada 3D interativa — Nascidos Vivos (SINASC / DataSUS, 2024)

</div>

---

## Sobre o projeto

O **Probabilidade & Inferência Estatística** é uma página interativa que percorre, do começo ao fim, uma atividade de **Probabilidade e Inferência Estatística** feita sobre dados reais de nascidos vivos.

A atividade tem duas metades. A **Parte 1** é de probabilidade — três distribuições (Binomial, Poisson e Normal) resolvevas em cima de enunciados clássicos. A **Parte 2** é de inferência — e é aqui que os dados entram de verdade: uma amostra aleatória de 200 recém-nascidos é confrontada com a base completa do ano, com **2.389.325 nascimentos**.

O projeto nasceu como trabalho avaliativo, mas foi pensado para ir além do relatório em PDF que a atividade normalmente pede. A ideia era transformar cada resultado numa coisa que se mexe: os números não ficam em tabelas estáticas, e sim em sliders que recalculam a distribuição enquanto o dedo arrasta, e em cenas 3D onde a resposta tem forma — o disco de acreção do prólogo é a mesma conta que a Poisson, invertida.

---

## A base de dados

Os dados vêm do **SINASC (Sistema de Informação sobre Nascidos Vivos)**, no portal de dados abertos do SUS ([DataSUS](https://dadosabertos.saude.gov.br/dataset/sistema-de-informacao-sobre-nascidos-vivos-sinasc)), com acesso em 14/08/2026.

| | |
| --- | --- |
| Base completa | **2.389.325** nascidos vivos |
| Com APGAR1 válido | 2.363.658 |
| Com PESO válido | 2.389.104 |
| Amostra aleatória simples | **200** nascidos vivos |

Só duas variáveis entraram na atividade:

| Variável | Descrição |
| --- | --- |
| `APGAR1` | Apgar no primeiro minuto, de 0 a 10 (7 a 10 é considerado normal) |
| `PESO` | Peso ao nascer, em gramas |

**A limpeza não é um detalhe, é parte do exercício.** O SINASC usa o código `99` em `APGAR1` para "ignorado" — um valor incompatível com a escala de 0 a 10. Ele foi tratado como dado faltante e excluído, junto com os ausentes, o que derrubou a amostra de **200 para 198** observações válidas. Em `PESO` só os ausentes foram excluídos, e os 200 registros seguiram válidos.

---

## O percurso

A página inteira é uma **jornada 3D**: um palco `sticky` de uma tela segura o canvas enquanto a seção de 428vh rola, e a câmera atravessa um buraco negro antes de chegar ao corredor de laboratórios. Seis salas, cada uma com o conteúdo real daquela parte e a peça 3D correspondente ao lado:

| Etapa | Sala | Peça 3D |
| --- | --- | --- |
| 0 | prólogo — o buraco negro | disco de acreção + poeira capturada |
| 1 | **Visão geral** — os cards da base | tabela de frequências |
| 2 | **Parte 1 — Probabilidade** | dados 3D |
| 3 | **Parte 2 — Inferência** | histograma + curva normal |
| 4 | **Resultados** — o IC cobriu o parâmetro? | nuvem de dispersão |
| 5 | **Formulário** — a "cola" | cubo de fórmulas |
| 6 | **Contato** — os quatro botões de saída | **nebulosa** (o olho) |

O epílogo fecha o ciclo: o buraco branco é a mesma conta do buraco negro, ao contrário.

Dentro dos laboratórios, a trilha de estudo funciona como abas — uma questão por vez, com **sliders de resultado ao vivo** e um botão "ver resolução passo a passo".

---

## Parte 1 — Probabilidade

Três enunciados clássicos, resolvidos com as distribuições que cada um pede.

### Questão 1 — Binomial (fábrica com 2% de defeito)

| Item | Resultado |
| --- | --- |
| (a) P(X = 3), com n = 3 e p = 0,02 | **0,000008** (0,0008%) |
| (c) P(X ≥ 1), com n = 20 e p = 0,02 | **0,3324** (33,24%) |

A (b) pede para avaliar um gestor que diz que três equipamentos defeituosos se explicam só pela variabilidade aleatória. A resposta é **não**: 0,000008 é praticamente zero, evento que não se atribui a acaso quando se acredita em p = 0,02. Já o item (c) inverte a intuição — em **um terço** dos lotes de 20 unidades haveria defeito, bem acima do que se espera de uma taxa de 2%.

### Questão 2 — Poisson (maternidade, média de 4 admissões/hora)

| Item | Resultado |
| --- | --- |
| (a) P(X = 4), com λ = 4 | **0,1954** (19,54%) — o valor modal |
| (b) P(X = 14) | 5,64 × 10⁻⁵ |
| (b) P(X ≥ 14) | **7,63 × 10⁻⁵** — 1 em 13.101 horas |

A (b) é a mais interessante da atividade. A coordenadora do plantão diz que 14 admissões numa hora "é tão improvável que provavelmente houve erro de registro". A resposta é **não concordar integralmente**: o evento é raríssimo, mas em 8.760 horas de um ano o esperado é **0,67** ocorrências — ou seja, cerca de uma vez a cada ano e meio. Raro não é impossível, e um caso isolado não é *padrão sistemático*.

### Questão 3 — Normal (peso ao nascer, μ = 3.250 g e σ = 500 g)

| Item | Cálculo | Resultado |
| --- | --- | --- |
| (a) P(X < 2.500 g) | z = −1,5 | **0,0668** (6,68%) |
| (b) P(3.000 < X < 4.000 g) | z₁ = −0,5 · z₂ = 1,5 | **0,6247** (62,47%) |
| (c) Em 8.000 nascimentos/ano | 8.000 × 0,0668 | **≈ 534** recém-nascidos |

---

## Parte 2 — Inferência

Aqui a amostra de 200 é confrontada com a verdade populacional. Nível de confiança de 95% e significância de 5% em toda a parte.

### Questão 4 — Inferência para a média (APGAR1)

**(a) Estimativa pontual.** A média amostral, com n = **198** válidos:

$$\bar{x} = 8{,}2778$$

**(b) Intervalo de confiança de 95%.** Como σ é desconhecida, usa-se a *t* de Student com 197 gl. O IC de 95% sai de:

$$8{,}2778 \pm 1{,}9721 \times 0{,}1032 \;\Longrightarrow\; [8{,}0742;\; 8{,}4814]$$

Os três requisitos foram verificados e estão satisfeitos: a amostra é aleatória simples (independência), n = 198 ≥ 30 (o TCL garante normalidade da média mesmo com a distribuição de APGAR1 discreta, assimétrica à esquerda — assimetria ≈ −2,474 — e com valores extremos de 1 a 5), e σ populacional é desconhecida, o que justifica a *t*.

**(c) Teste de hipóteses.** H₀: μ = 7 vs H₁: μ ≠ 7.

$$t = \frac{8{,}2778 - 7}{0{,}1032} = 12{,}3771 \quad|\quad p \approx 2{,}10 \times 10^{-26}$$

Muito abaixo de α = 0,05: **rejeita-se H₀**. A média do APGAR1 difere de 7 — e é superior. O IC da (b) não contém o 7, então as duas abordagens chegam à mesma conclusão.

**(d) O parâmetro pertence ao intervalo?** Esta é a pergunta que dá sentido ao "95% de confiança":

| Quantidade | Valor |
| --- | --- |
| Estimativa pontual (x̄) | 8,2778 |
| Média populacional (μ) | **8,3075** |
| Erro amostral | −0,0297 (≈ 0,36%) |
| IC 95% amostral | [8,0742; 8,4814] |
| **μ pertence ao IC?** | **Sim** |

### Questão 5 — Inferência para a proporção (peso ≥ 2.500 g)

**(a)** Variável indicadora: Y = 1 se PESO ≥ 2.500 g, 0 caso contrário. Na amostra, **186 sucessos** e **14 fracassos**.

**(b) Estimativa e intervalo.** $\hat{p} = 186/200 = 0{,}93$, e o IC de 95% sai de:

$$0{,}93 \pm 1{,}96 \times 0{,}01804 \;\Longrightarrow\; [0{,}8946;\; 0{,}9654]$$

Requisitos verificados: n·p̂ = 186 e n(1−p̂) = 14, ambos ≥ 10; e a amostra é menos de 10% da população (~2,39 milhões), o que também assegura a independência.

**(c) Teste de hipóteses.** H₀: p = 0,90 vs H₁: p ≠ 0,90.

$$z = \frac{0{,}93 - 0{,}90}{\sqrt{0{,}90 \times 0{,}10 / 200}} = 1{,}4142 \quad|\quad p = 0{,}1573$$

Acima de α = 0,05: **não se rejeita H₀**. A diferença entre 93% e 90% cabe na variabilidade amostral — e o IC da (b) contém 0,90, de novo com a mesma conclusão.

**(d) O parâmetro pertence ao intervalo?**

| Quantidade | Valor |
| --- | --- |
| Estimativa pontual (p̂) | 0,9300 |
| Proporção populacional (p) | **0,9052** |
| Erro amostral | 0,0248 (≈ 2,5 p.p.) |
| IC 95% amostral | [0,8946; 0,9654] |
| **p pertence ao IC?** | **Sim** |

Na população, **9,48%** dos recém-nascidos nascem com baixo peso — valor coerente com a prevalência conhecida no Brasil.

---

## Precisão dos números

Toda a matemática vive em `src/lib/stats.ts`: binomial, Poisson, normal, quantis, t de Student e beta incompleta. **Todos os valores do site foram validados contra o R 4.6.0** rodando sobre os dados reais da atividade — `src/lib/stats.test.ts` funciona como contrato: se algum número mudar, os testes quebram.

O material de origem é o [`public/statistical-data-analysis.Rmd`](public/statistical-data-analysis.Rmd), que é o R Markdown onde a atividade foi resolvida e de onde saíram os valores de `src/data/results.ts`.

> **Atenção:** o `.gitignore` ignora `nascidos_vivos_2024.csv` (35 MB) **e também** `amostra_200.csv` (3 KB), apesar de o comentário mandar versionar a amostra. Quem clonar não consegue reproduzir os números do R sem os dois arquivos.

---

## Como rodar

Precisa ter o [Node.js](https://nodejs.org/) versão **20.19+** ou **22.12+** instalado (é o que o Vite 8 exige).

```bash
git clone https://github.com/manoelja/statistical-data-analysis.git
cd statistical-data-analysis
npm install
npm run dev
```

Depois é só abrir `http://localhost:5173` no navegador.

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck (`tsc -b`) + build de produção |
| `npm run preview` | serve o build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest em watch |
| `npm run test:run` | Vitest numa execução só |

---

## Tecnologias

**React 19 + TypeScript**, com **Vite** como build e **CSS puro** — sem framework de estilo. A cena 3D usa **Three.js**, as animações de interface **Framer Motion** e os ícones **lucide-react**. Os testes são **Vitest** com Testing Library.

O ponto incomum do projeto: **a análise estatística roda offline**. O R processa a base uma vez, e o navegador consome os resultados já prontos em `src/data/results.ts` — não há backend, não há API e a página funciona inteira no cliente.

```
src/
  lib/stats.ts          toda a matemática (puro, sem dependências)
  data/results.ts       números conferidos no R
  lib/scene/
    journey.ts          monta a cena + a coreografia (nada ali desenha)
    store.ts            estado compartilhado entre os labs e a cena
    three/viewer.ts     a única parte que fala com a GPU
  hooks/useRafLoop.ts   o loop único (teto de FPS, pausa com a aba oculta)
  components/site/Journey3D.tsx   a página
```

A separação é a mesma do `lib/stats.ts`: **cálculo fora da geometria**. `journey.ts` tem funções puras e testadas (`depthAt`, `cardPose`, `chapterAnchor`, `holePhase`…), e `Journey3D` só mede a seção, chama essas funções dentro do loop e publica o resultado na DOM, **sem re-render a 60 fps**.

Sem WebGL o componente cai num aviso e a página continua funcionando em HTML.

### Para quem for mexer no código

- **A câmera nunca atravessa uma peça sólida** ao longo do percurso. A única exceção é o buraco negro, marcado com `userData.letCameraPass` — a travessia é de propósito.
- **A transição é a mesma em qualquer tela.** O retrato não tem coreografia própria: só a *base* do FOV se adapta, com teto (`MAX_FOV = 78°`).
- **`prefers-reduced-motion`** recebe o mesmo roteiro — só congela o tempo. A câmera continua respondendo ao scroll, que é movimento dirigido pelo usuário.
- **`perspective` nunca na raiz.** Um ancestral com perspectiva vira o *containing block* dos filhos `position: fixed` — a navbar deixaria de ficar presa à tela. Cada efeito 3D abre a sua própria.
- **Código não montado:** `components/site/DataScienceBackdrop.tsx` (1.065 linhas) é um quadro SVG animado, com teste, mas **não é importado por nada**. Junto dele ficaram `scene/pointer.ts` e `scene/projection.ts`, que só ele consome.

---

<div align="center">

**Feito com Three.js, dados do SINASC/DataSUS e uma base de 200 recém-nascidos**

</div>