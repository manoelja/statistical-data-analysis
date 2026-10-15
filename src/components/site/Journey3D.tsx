/**
 * Journey3D — a jornada em profundidade, com **cards** durante o percurso.
 *
 * Um palco `sticky` de uma tela segura o canvas enquanto a seção de 600vh rola:
 * a câmera avança no eixo Z e, a cada etapa, um **card** desliza para a tela
 * com o conteúdo daquela parte (visão geral, parte 1, parte 2, resultados,
 * formulário e contato) — e o seu elemento 3D aparece na cena ao lado. O palco
 * sai de cena sozinho quando a seção termina, por isso nada aqui usa
 * `position: fixed` nem `z-index` gigante.
 *
 * A viagem **começa antes do corredor**: os primeiros ~14% do scroll são o
 * prólogo do buraco negro (`depthAt` dá a profundidade, `holePhase` a fase). A
 * página abre no escuro, sem card nenhum — o primeiro entra quando o "outro
 * universo" dos dados já está formado.
 *
 * Toda a coreografia vive em `lib/scene/journey` (funções puras e testadas):
 * `cardPose` diz opacidade/deslocamento de cada card, `chapterAnchor` onde a
 * câmera chega. Aqui só medimos a seção, chamamos essas funções dentro do loop
 * único (`useRafLoop`) e publicamos o resultado — sem re-render a 60 fps.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { useRafLoop } from '../../hooks/useRafLoop';
import { Overview } from './Overview';
import { ProbabilityLab } from '../labs/ProbabilityLab';
import { InferenceLab } from '../labs/InferenceLab';
import { Results } from './Results';
import { FormulaSheet } from './FormulaSheet';
import { Contact } from './Contact';
import { CHALK } from '../../lib/scene/chalk';
import {
  EPILOGUE_START,
  JOURNEY_CHAPTERS,
  buildJourney,
  cardPose,
  chapterAnchor,
  chapterIndexAt,
  depthAt,
  epilogueOpacity,
  JOURNEY_PRESENTED_AT,
  prologueOpacity,
  type Journey,
} from '../../lib/scene/journey';
import { getSceneParams } from '../../lib/scene/store';
import { dataset } from '../../data/results';
import { clamp } from '../../lib/scene/three/math';
import { createViewer, hasWebGL, type Viewer } from '../../lib/scene/three/viewer';

const MAX_FPS = 60;
/** teto de FPS quando o usuário pediu menos movimento */
const REDUCED_FPS = 24;
/** teto de FPS no celular: 60 fps não fecha quadro nesta cena, e a queda
    aparecia na entrada, quando a animação ainda está acelerando */
const MODEST_FPS = 30;

/** o conteúdo real de cada etapa, dentro do card */
const CARD_CONTENT: ReactNode[] = [
  <Overview key="visao" />,
  <ProbabilityLab key="probabilidade" />,
  <InferenceLab key="inferencia" />,
  <Results key="resultados" />,
  <FormulaSheet key="formulario" />,
  <Contact key="contato" />,
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A máquina é fraca o bastante para não fechar 60 fps nesta cena?
 *
 * `pointer: coarse` separa celular/tablet de desktop — e é o sinal mais fiel
 * que existe, porque um notebook com touch tem mouse. O número de núcleos
 * entra como segunda rede de segurança, para o celular que reporta o ponteiro
 * fino. Os dois sãoMediaQueryList/`navigator`, lidos só na montagem.
 */
function isModestDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || cores <= 4;
}

export function Journey3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const prologueRef = useRef<HTMLDivElement>(null);
  const epilogueRef = useRef<HTMLDivElement>(null);

  const journeyRef = useRef<Journey | null>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const progressRef = useRef(0);
  const metricsRef = useRef({ top: 0, track: 1 });
  const pointerRef = useRef({ x: 0, y: 0 });

  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(0);
  const [atTop, setAtTop] = useState(true);
  // em que parte da viagem o quadro está: muda **uma vez por trecho**, então não
  // custa re-render (e é o que o canvas descreve para o leitor de tela)
  const [fase, setFase] = useState<'prologo' | 'corredor' | 'epilogo'>('prologo');

  const reduced = prefersReducedMotion();
  const modest = isModestDevice();

  // ---------- montagem da cena ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const journey = buildJourney(CHALK, getSceneParams());
    // reduced-motion: sem animação autônoma (o scroll continua movendo a câmera)
    journey.setPlaying(!reduced);
    const viewer = createViewer(canvas, journey.camera, journey.scene);
    journeyRef.current = journey;
    viewerRef.current = viewer;
    setSupported(hasWebGL());

    /** mede a seção: onde a jornada começa e quanto scroll ela consome */
    const measure = () => {
      const height = section.offsetHeight || window.innerHeight * 6;
      const width = window.innerWidth || 1024;
      const viewport = window.innerHeight || 720;
      metricsRef.current = {
        top: section.getBoundingClientRect().top + window.scrollY,
        track: Math.max(1, height - viewport),
      };
      journey.setAspect(width / Math.max(1, viewport));
      viewer?.setSize(width, viewport, window.devicePixelRatio || 1);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;
    observer?.observe(section);

    // fontes de mão: quando chegam, as placas de giz são redesenhadas
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready
      ?.then(() => {
        if (!cancelled) journeyRef.current?.refreshText();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', measure);
      observer?.disconnect();
      journey.dispose();
      viewer?.dispose();
      journeyRef.current = null;
      viewerRef.current = null;
    };
  }, [reduced]);

  // ---------- paralaxe: o ponteiro inclina a câmera ----------
  useEffect(() => {
    if (reduced) return;

    // `pointermove` e não `mousemove`: no toque o mouse não existe até o
    // navegador sintetizar um evento, e aí a câmera ficava com o paralaxe
    // travado no último ponto em que o dedo passou.
    const onMove = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    // ...e sem isto o valor ficaria travado depois que o dedo saísse da tela:
    // no desktop o mouse voltar ao centro já mandava zero, no toque não.
    const onRelease = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('blur', onRelease);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      window.removeEventListener('blur', onRelease);
    };
  }, [reduced]);

  // ---------- loop único: move a câmera, aplica os cards e desenha ----------
  // 60 fps é o teto do desktop. No celular a mesma cena a 60 fps não fecha
  // quadro — o navegador entrega 30 e ainda sobra CPU e bateria, e a queda
  // aparece justamente na entrada, onde a animação ainda está acelerando. 30
  // fps é o mesmo movimento com metade do trabalho por quadro.
  useRafLoop(
    (deltaMs) => {
      const journey = journeyRef.current;
      if (!journey) return;

      const dt = Math.min(0.05, deltaMs / 1000);
      const { top, track } = metricsRef.current;
      const scroll = window.scrollY;
      // A rolagem vai de 0 a `JOURNEY_PRESENTED_AT`, e não de 0 a 1. O progresso
      // da linha do tempo é comprimido nessa faixa porque é ela que tem
      // conteúdo: o resto do scroll — de `JOURNEY_PRESENTED_AT` até 1 — são 72vh
      // em que a câmera está travada, a nebulosa já acendeu e o card não se mexe.
      // Sem esta multiplicação, dava para arrastar a barra até o fim sem que
      // nada acontecesse.
      const raw = clamp((scroll - top) / track, 0, 1) * JOURNEY_PRESENTED_AT;

      // em reduced-motion não há inércia: o scroll manda direto
      progressRef.current = reduced
        ? raw
        : progressRef.current + (raw - progressRef.current) * Math.min(1, dt * 6);
      const progress = progressRef.current;

      journey.advance(dt, depthAt(progress), pointerRef.current);

      // placa-título do prólogo: some antes do cruzamento do horizonte
      const prologueEl = prologueRef.current;
      if (prologueEl) {
        prologueEl.style.opacity = String(Number(prologueOpacity(progress).toFixed(3)));
      }

      // placa do epílogo: entra com a convergência do buraco branco e sai com
      // o estouro (o branco fecha a página)
      const epilogueEl = epilogueRef.current;
      if (epilogueEl) {
        epilogueEl.style.opacity = String(Number(epilogueOpacity(progress).toFixed(3)));
      }

      for (let index = 0; index < JOURNEY_CHAPTERS.length; index += 1) {
        const element = cardRefs.current[index];
        if (!element) continue;
        const pose = cardPose(index, progress);
        element.style.opacity = String(Number(pose.opacity.toFixed(3)));
        element.style.setProperty('--journey-shift', `${pose.shift.toFixed(2)}%`);
        element.style.setProperty('--journey-scale', pose.scale.toFixed(3));
        element.style.pointerEvents = pose.opacity > 0.4 ? 'auto' : 'none';
        // `visibility: hidden` tira o card do foco do teclado e da árvore de a11y
        element.style.visibility = pose.opacity > 0.02 ? 'visible' : 'hidden';
      }

      viewerRef.current?.render();

      const next = chapterIndexAt(progress);
      setActive((current) => (current === next ? current : next));
      const onde: 'prologo' | 'corredor' | 'epilogo' =
        progress < JOURNEY_CHAPTERS[0].enter
          ? 'prologo'
          : progress >= EPILOGUE_START
            ? 'epilogo'
            : 'corredor';
      setFase((current) => (current === onde ? current : onde));
      setAtTop((current) => (current === (scroll < 40) ? current : scroll < 40));
    },
    { fps: reduced ? REDUCED_FPS : modest ? MODEST_FPS : MAX_FPS },
  );

  // ---------- navegação por etapa (régua, teclado e âncoras) ----------
  const goToChapter = useCallback(
    (index: number) => {
      const { top, track } = metricsRef.current;
      window.scrollTo({
        top: top + chapterAnchor(index) * track,
        behavior: reduced ? 'auto' : 'smooth',
      });
    },
    [reduced],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { top, track } = metricsRef.current;
      const scroll = window.scrollY;
      const back =
        event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' ||
        event.key === 'PageUp' ||
        (event.key === ' ' && event.shiftKey);
      const forward =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowRight' ||
        event.key === 'PageDown' ||
        event.key === ' ';
      const home = event.key === 'Home';
      const end = event.key === 'End';
      if (!back && !forward && !home && !end) return;

      // só responde quando a jornada está no comando da tela
      const inCharge =
        scroll >= top - window.innerHeight * 0.5 && scroll <= top + track + window.innerHeight * 0.5;
      if (!inCharge) return;

      const current = chapterIndexAt(clamp((scroll - top) / track, 0, 1));
      const next = end
        ? JOURNEY_CHAPTERS.length - 1
        : home
          ? 0
          : clamp(current + (back ? -1 : forward ? 1 : 0), 0, JOURNEY_CHAPTERS.length - 1);
      if (next === current) return;

      event.preventDefault();
      goToChapter(next);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToChapter]);

  return (
    <section
      className="journey"
      id="jornada"
      ref={sectionRef}
      aria-label="Jornada em profundidade pela Ciência de Dados"
    >
      {/* título da página: só para leitores de tela (o visual é a cena) */}
      <h1 className="journey__sr">Probabilidade &amp; Inferência Estatística</h1>

      <div className="journey__stage">
        <canvas
          ref={canvasRef}
          className="journey__canvas"
          role="img"
          aria-label={
            fase === 'prologo'
              ? 'Prólogo 3D: um disco de acreção gira em torno de um buraco negro; a câmera se aproxima do horizonte de eventos.'
              : fase === 'epilogo'
                ? 'Epílogo 3D: a poeira do corredor converge para um buraco branco, que se abre e devolve tudo em forma de luz.'
                : `Cena 3D da jornada, ${active + 1} de ${JOURNEY_CHAPTERS.length}: ${
                    JOURNEY_CHAPTERS[active]?.title ?? 'Visão Geral'
                  }`
          }
        />

        {/* placa-título do prólogo: a página abre no escuro, com esta frase */}
        <div ref={prologueRef} className="journey__prologue" aria-hidden="true">
          <p className="journey__prologue-eyebrow">SINASC · 2024 · {dataset.apgarValidos} APGAR válidos</p>
          <h2 className="journey__prologue-title">Do outro lado do horizonte</h2>
          <p className="journey__prologue-note">
            A tabela é a projeção da população: cada linha guarda o que caiu dentro dela, e o resto
            some sem deixar rastro.
          </p>
        </div>

        {/* placa do epílogo: o buraco branco fecha a viagem invertendo a conta do
            prólogo — projeção para um lado, problema inverso para o outro */}
        <div ref={epilogueRef} className="journey__prologue journey__epilogue" aria-hidden="true">
          <p className="journey__prologue-eyebrow">EPÍLOGO · A MESMA CONTA AO CONTRÁRIO</p>
          <h2 className="journey__prologue-title">O espaço nulo da conta</h2>
          <p className="journey__prologue-note">
            A conta de volta não tem unicidade: a mesma tabela cabe em infinitas populações. Quem
            escolhe entre elas é o prior — e ele é nosso, não dos dados.
          </p>
        </div>

        {/* cards: um por etapa, com o conteúdo real daquela parte. Não há
            moldura em volta: o que aparece é só a peça de conteúdo, que já
            traz o próprio papel. A caixa existe pela altura travada (é ela
            que segura a dobra do capítulo) e pelo halo do texto. Cada grupo de
            peças vira uma **pilha de cartões** (`CardDeck`): uma peça por vez,
            clicar avança. */}
        {JOURNEY_CHAPTERS.map((chapter, index) => (
          <article
            key={chapter.id}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className={`journey__card journey__card--${chapter.cardSide}`}
            aria-label={chapter.title}
          >
            <div className="journey__card-inner">
              <div className="journey__card-body">{CARD_CONTENT[index]}</div>
            </div>
          </article>
        ))}

        {!supported && (
          <p className="journey__fallback" role="status">
            Este navegador não liberou WebGL, então a viagem 3D não pôde ser montada. Os cards e
            o conteúdo continuam funcionando normalmente.
          </p>
        )}

        {/* régua de profundidade: mostra a etapa atual e permite saltar */}
        <nav className="journey__meter" aria-label="Etapas da jornada">
          {JOURNEY_CHAPTERS.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              className={`journey__meter-step${index === active ? ' is-active' : ''}`}
              aria-current={index === active ? 'step' : undefined}
              aria-label={`${index + 1}. ${chapter.title}`}
              title={chapter.title}
              onClick={() => goToChapter(index)}
            >
              <span className="journey__meter-dot" aria-hidden="true" />
              <span className="journey__meter-name" aria-hidden="true">
                {chapter.title}
              </span>
            </button>
          ))}
        </nav>

        {!atTop && (
          <button
            type="button"
            className="journey__top"
            onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          >
            <ArrowUp size={16} aria-hidden="true" />
            <span>Voltar ao início</span>
          </button>
        )}
      </div>

      {/* trilha de scroll: dá altura à seção e serve de âncora (navbar) */}
      <div className="journey__track" aria-hidden="true">
        {JOURNEY_CHAPTERS.map((chapter, index) => (
          <div
            key={chapter.id}
            id={chapter.id}
            className="journey__marker"
            style={{ top: `calc(var(--journey-track) * ${chapterAnchor(index).toFixed(4)})` }}
          />
        ))}
      </div>
    </section>
  );
}
