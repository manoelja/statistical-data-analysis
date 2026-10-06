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
import { ArrowUp, Gauge } from 'lucide-react';
import { useRafLoop } from '../../hooks/useRafLoop';
import { Overview } from './Overview';
import { ProbabilityLab } from '../labs/ProbabilityLab';
import { InferenceLab } from '../labs/InferenceLab';
import { Results } from './Results';
import { FormulaSheet } from './FormulaSheet';
import { Footer } from './Footer';
import { CHALK_DARK, CHALK_LIGHT } from '../../lib/scene/chalk';
import {
  JOURNEY_CHAPTERS,
  buildJourney,
  cardPose,
  chapterAnchor,
  chapterIndexAt,
  depthAt,
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

/** o conteúdo real de cada etapa, dentro do card */
const CARD_CONTENT: ReactNode[] = [
  <Overview key="visao" />,
  <ProbabilityLab key="probabilidade" />,
  <InferenceLab key="inferencia" />,
  <Results key="resultados" />,
  <FormulaSheet key="formulario" />,
  <Footer key="contato" />,
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function Journey3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const prologueRef = useRef<HTMLDivElement>(null);

  const journeyRef = useRef<Journey | null>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const progressRef = useRef(0);
  const metricsRef = useRef({ top: 0, track: 1 });
  const pointerRef = useRef({ x: 0, y: 0 });

  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(0);
  const [atTop, setAtTop] = useState(true);
  // enquanto o prólogo domina o quadro, o canvas se descreve como prólogo:
  // muda uma única vez no percurso, então não custa re-render
  const [inPrologue, setInPrologue] = useState(true);

  const reduced = prefersReducedMotion();

  // ---------- tema (o canvas e as luzes seguem claro/escuro) ----------
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ---------- montagem da cena (e remontagem na troca de tema) ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const journey = buildJourney(dark ? CHALK_DARK : CHALK_LIGHT, getSceneParams());
    // reduced-motion: sem animação autônoma (o scroll continua movendo a câmera)
    journey.setPlaying(!reduced);
    const viewer = createViewer(canvas, journey.camera, journey.scene, { dark });
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
  }, [dark, reduced]);

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
  useRafLoop(
    (deltaMs) => {
      const journey = journeyRef.current;
      if (!journey) return;

      const dt = Math.min(0.05, deltaMs / 1000);
      const { top, track } = metricsRef.current;
      const scroll = window.scrollY;
      const raw = clamp((scroll - top) / track, 0, 1);

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

      // O card rola por dentro. Só o card em foco interessa, então uma leitura
      // por quadro basta para dizer se há conteúdo abaixo (o degradê do rodapé)
      // ou se o fim já foi alcançado.
      const focused = cardRefs.current[chapterIndexAt(progress)];
      const inner = focused?.firstElementChild as HTMLElement | undefined;
      if (inner) {
        const overflowing = inner.scrollHeight - inner.clientHeight > 4;
        const atEnd = !overflowing || inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 4;
        inner.classList.toggle('is-overflowing', overflowing && !atEnd);
        inner.classList.toggle('is-at-end', atEnd);
      }

      viewerRef.current?.render();

      const next = chapterIndexAt(progress);
      setActive((current) => (current === next ? current : next));
      const inThePrologue = progress < JOURNEY_CHAPTERS[0].enter;
      setInPrologue((current) => (current === inThePrologue ? current : inThePrologue));
      setAtTop((current) => (current === (scroll < 40) ? current : scroll < 40));
    },
    { fps: reduced ? REDUCED_FPS : MAX_FPS },
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
            inPrologue
              ? 'Prólogo 3D: um disco de acreção gira em torno de um buraco negro; a câmera se aproxima do horizonte de eventos.'
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
            A população é o buraco: só vemos a luz que escapa, e ela chega enviesada.
          </p>
        </div>

        {/* cards: um por etapa, com o conteúdo real daquela parte */}
        {JOURNEY_CHAPTERS.map((chapter, index) => (
          <article
            key={chapter.id}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className={`journey__card journey__card--${chapter.cardSide}`}
            aria-labelledby={`${chapter.id}-titulo`}
          >
            <div className="journey__card-inner">
              <p className="journey__scene">
                <Gauge size={13} aria-hidden="true" />
                <span id={`${chapter.id}-titulo`}>
                  Cena {String(index + 1).padStart(2, '0')} · <strong>{chapter.title}</strong>
                </span>
                <em>{chapter.tagline}</em>
              </p>
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
              onClick={() => goToChapter(index)}
            >
              <span className="journey__meter-dot" aria-hidden="true" />
              <span className="journey__meter-name">{chapter.title}</span>
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
