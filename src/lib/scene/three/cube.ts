/**
 * 1. **Cubo das fórmulas** — o miolo do quadro.
 *
 * Seis faces, seis fórmulas (Normal, regressão, R², Z, Binomial e teste de
 * hipótese). Gira sozinho; ao clicar numa face o cubo *para*, gira até mostrar
 * essa face de frente e a câmera aproxima — exatamente o "zoom com explicação"
 * pedido para a cena.
 *
 * Cada face é um plano transparente (só o giz) sobre um cubo opaco: assim a
 * fórmula do fundo não aparece por transparência.
 */

import * as THREE from 'three';
import { damp, nearestAngle } from './math';
import { createFixedPlate } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { chalkEdges, disposeObject } from './shared';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const SIDE = 3;
const SIZE = SIDE * 0.98;

interface FaceSpec {
  /** nome curto para o painel */
  name: string;
  /** fórmula desenhada na face */
  formula: string;
  /** explicação em português (botão "Explicar" e clique na face) */
  explanation: string;
  /** cor do giz (chave da paleta) */
  tone: 'cyan' | 'yellow' | 'pink' | 'orange' | 'green' | 'blue';
  /** posição da face em relação ao centro */
  position: [number, number, number];
  /** rotação da face (para o texto olhar para fora) */
  rotation: [number, number, number];
  /** rotação do cubo que traz esta face para frente da câmera */
  orient: { yaw?: number; pitch?: number };
}

const FACES: FaceSpec[] = [
  {
    name: 'Distribuição Normal',
    formula: 'f(x) = 1/(σ√2π)·e^{−(x−μ)²/(2σ²)}',
    explanation:
      'A Normal fica definida por dois parâmetros: μ (o centro) e σ (a largura). O pico vale 1/(σ√2π) — quanto maior o σ, mais baixa e espalhada a curva. A área sob ela é sempre 1.',
    tone: 'cyan',
    position: [SIDE / 2, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    orient: { yaw: -Math.PI / 2 },
  },
  {
    name: 'Regressão linear',
    formula: 'ŷ = β_{0} + β_{1}x',
    explanation:
      'É a reta de mínimos quadrados: minimiza a soma dos quadrados dos resíduos. β₁ mede quanto y muda, em média, a cada unidade de x; β₀ é o valor previsto quando x = 0.',
    tone: 'yellow',
    position: [-SIDE / 2, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    orient: { yaw: Math.PI / 2 },
  },
  {
    name: 'Coeficiente de determinação',
    formula: 'R² = 1 − Σ(y_{i} − ŷ_{i})² / Σ(y_{i} − \\bar{y})²',
    explanation:
      'R² diz que fração da variação de y a reta explica. Vai de 0 a 1: R² = 0,83 significa 83% explicados e 17% de resíduo. No numerador está o que a reta *não* pega.',
    tone: 'pink',
    position: [0, SIDE / 2, 0],
    rotation: [-Math.PI / 2, 0, 0],
    orient: { pitch: Math.PI / 2 },
  },
  {
    name: 'Escore padronizado',
    formula: 'Z = (X − μ)/σ',
    explanation:
      'Padronizar transforma qualquer Normal em Normal(0;1). Z conta quantos desvios padrão x está acima (Z > 0) ou abaixo (Z < 0) da média. Z = −1,5 é um valor 1,5 σ abaixo de μ.',
    tone: 'orange',
    position: [0, -SIDE / 2, 0],
    rotation: [Math.PI / 2, 0, 0],
    orient: { pitch: -Math.PI / 2 },
  },
  {
    name: 'Binomial',
    formula: 'P(X = k) = C(n,k)·p^{k}(1−p)^{n−k}',
    explanation:
      'Conta as sequências com exatamente k sucessos em n tentativas independentes: C(n,k) escolhe *quais* tentativas acertam e pᵏ(1−p)ⁿ⁻ᵏ é a probabilidade de cada sequência.',
    tone: 'green',
    position: [0, 0, SIDE / 2],
    rotation: [0, 0, 0],
    orient: {},
  },
  {
    name: 'Teste de hipóteses',
    formula: 'H_{0}: μ = μ_{0}',
    explanation:
      'O teste começa supondo que a hipótese nula é verdadeira (H₀: μ = μ₀). Calculamos t = (x̄ − μ₀)/(s/√n) e perguntamos: um valor tão extremo é raro sob H₀? Se for, rejeitamos.',
    tone: 'blue',
    position: [0, 0, -SIDE / 2],
    rotation: [0, Math.PI, 0],
    orient: { yaw: Math.PI },
  },
];

export function createCubeExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  // ---- corpo opaco (esconde as faces de trás) ----
  const bodyGeometry = new THREE.BoxGeometry(SIDE, SIDE, SIDE);
  const body = new THREE.Mesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({
      color: palette.board1,
      roughness: 0.82,
      metalness: 0.12,
      emissive: new THREE.Color(palette.board1),
      emissiveIntensity: 0.35,
    }),
  );
  body.castShadow = true;
  group.add(body);
  group.add(chalkEdges(bodyGeometry, palette.chalk));

  // ---- faces com as fórmulas ----
  const faceGroup = new THREE.Group();
  const faces: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; spec: FaceSpec }> = [];
  FACES.forEach((spec) => {
    const plate = createFixedPlate(
      [
        { text: spec.name.toUpperCase(), size: 34, color: palette[spec.tone], weight: 500 },
        { text: spec.formula, size: 62, color: palette.chalk, gap: 0.5 },
      ],
      512,
      54,
    );
    ctx.plates.push(plate);

    const material = new THREE.MeshBasicMaterial({
      map: plate.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), material);
    const [x, y, z] = spec.position;
    mesh.position.set(x * 1.005, y * 1.005, z * 1.005);
    mesh.rotation.set(...spec.rotation);
    mesh.userData.face = spec.name;
    mesh.userData.explanation = spec.explanation;
    mesh.userData.formula = spec.formula;
    faceGroup.add(mesh);
    faces.push({ mesh, material, spec });
  });
  group.add(faceGroup);

  // ---- halo em volta (o brilho do objeto em foco) ----
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.9, 96),
    new THREE.MeshBasicMaterial({
      color: palette.cyan,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.z = -2.6;
  group.add(halo);

  // ---- fórmulas soltas em volta do cubo ----
  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: 'f(x) = 1/(σ√2π)·e^{−(x−μ)²/(2σ²)}',
      color: palette.cyan,
      position: [-3.4, 2.5, 0.4],
      height: 0.42,
      seed: 3,
    }),
    createFloatingFormula(ctx, {
      text: 'Z = (X − μ)/σ',
      color: palette.orange,
      position: [3.5, 2.2, 0.6],
      height: 0.46,
      seed: 11,
    }),
    createFloatingFormula(ctx, {
      text: 'R² = 1 − Σ(y_{i} − ŷ_{i})²/Σ(y_{i} − \\bar{y})²',
      color: palette.pink,
      position: [-3.6, -2.3, 0.3],
      height: 0.38,
      seed: 23,
    }),
    createFloatingFormula(ctx, {
      text: 'H_{0}: μ = μ_{0}',
      color: palette.blue,
      position: [3.6, -2.4, 0.5],
      height: 0.44,
      seed: 37,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let spinY = 0.6;
  let spinX = -0.18;
  let targetYaw = 0.6;
  let targetPitch = -0.18;
  let selected = -1;
  let sincePick = 0;
  let hoverFace = -1;
  const camera: [number, number, number] = [0, 1.4, 9.4];

  const clearSelection = () => {
    selected = -1;
    faces.forEach((face) => {
      face.material.opacity = 0.92;
    });
    targetPitch = -0.18;
  };

  const applySelection = (index: number) => {
    selected = index;
    sincePick = 0;
    const spec = FACES[index];
    targetYaw =
      spec.orient.yaw === undefined ? Math.round(spinY / (Math.PI * 2)) * Math.PI * 2 : nearestAngle(spinY, spec.orient.yaw);
    targetPitch = spec.orient.pitch ?? 0;
  };

  const update = (frame: Frame) => {
    const free = selected < 0;
    if (frame.playing) {
      // girar sozinho só enquanto ninguém escolheu uma face
      if (free) spinY += frame.dt * 0.34 * (0.35 + 0.65 * frame.focus);
      sincePick += frame.dt;
      if (!free && sincePick > 9) clearSelection(); // volta ao giro depois de um tempo
    }
    spinY = damp(spinY, targetYaw, 2.4, frame.dt);
    spinX = damp(spinX, targetPitch, 2.4, frame.dt);

    // paralaxe do ponteiro dá vida ao giro
    group.rotation.y = spinY + frame.pointer.x * 0.16;
    group.rotation.x = spinX - frame.pointer.y * 0.12;

    const target = selected >= 0 ? 6.4 : 9.4;
    camera[2] = damp(camera[2], target, 2.2, frame.dt);

    faces.forEach((face, index) => {
      const lit = index === selected || index === hoverFace;
      face.material.opacity = damp(face.material.opacity, lit ? 1 : 0.88, 6, frame.dt);
      const scale = lit ? 1.045 : 1;
      face.mesh.scale.setScalar(damp(face.mesh.scale.x, scale, 8, frame.dt));
    });

    halo.material.opacity = 0.1 + 0.14 * frame.focus + 0.05 * Math.sin(frame.t * 1.6);
    body.material.emissiveIntensity = 0.3 + 0.2 * frame.focus;
    formulas.forEach((f) => f.update(frame.t));
  };

  const readout = (): Readout[] => [
    { label: 'Face', value: selected >= 0 ? FACES[selected].name : 'nenhuma (clique)' },
    { label: 'Giro', value: selected >= 0 ? 'pausado' : 'automático' },
    { label: 'Faces', value: '6 fórmulas' },
  ];

  return {
    id: 'cubo',
    title: 'Cubo de fórmulas',
    tagline: 'Clique numa face: o cubo para, gira e a câmera aproxima',
    formula: 'P(X = k) = C(n,k)·p^{k}(1−p)^{n−k}',
    explanation:
      'O cubo guarda as seis fórmulas que sustentam o resto da cena. Cada face é um atalho: Normal, regressão, R², Z, Binomial e teste de hipótese. Clique numa face para ler a explicação dela.',
    camera,
    lookAtY: 0,
    drag: 'orbit',
    group,
    selectables: faces.map((f) => f.mesh),
    // a face clicada passa a mandar no painel "Explicar"
    focusInfo() {
      if (selected < 0) return null;
      const spec = FACES[selected];
      return { title: spec.name, formula: spec.formula, explanation: spec.explanation };
    },
    onPick(hit) {
      const index = faces.findIndex((f) => f.mesh === hit.object);
      if (index < 0) return null;
      applySelection(index);
      return `${FACES[index].name} — ${FACES[index].formula}`;
    },
    onHover(hit) {
      hoverFace = hit ? faces.findIndex((f) => f.mesh === hit.object) : -1;
    },
    update,
    readout,
    reset() {
      clearSelection();
      spinY = 0.6;
      spinX = -0.18;
      targetYaw = 0.6;
      camera[2] = 9.4;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
