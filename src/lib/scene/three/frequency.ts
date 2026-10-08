/**
 * 5. **Tabela de frequências como objeto 3D**.
 *
 * Uma grade flutuante onde a **altura de cada célula é a frequência**. Uma linha
 * percorre a tabela (como no quadro SVG), e clicar numa célula faz a coluna
 * pular com mola e passar para a próxima frequência. A média ponderada do painel
 * recalcula junto — a tabela é a conta, não uma figura.
 */

import * as THREE from 'three';
import { clamp } from './math';
import { createChalkSprite } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { chalkSegments, disposeObject } from './shared';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const ROWS = 5;
const COLS = 4;
const STEP = 1.15;
const HEIGHT_PER_FREQ = 0.26;
const FREQ_MIN = 1;
const FREQ_MAX = 9;

export function createFrequencyExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  const halfWidth = ((COLS - 1) * STEP) / 2;
  const halfDepth = ((ROWS - 1) * STEP) / 2;
  const xOf = (col: number) => col * STEP - halfWidth;
  const zOf = (row: number) => row * STEP - halfDepth;

  // ---- frequências iniciais (linhas = valores 1..5) ----
  const initial = [
    [4, 7, 5, 4],
    [6, 5, 8, 6],
    [3, 4, 5, 7],
    [7, 6, 4, 5],
    [5, 8, 6, 9],
  ];
  const freq = initial.map((row) => [...row]);

  // ---- grade flutuante ----
  const segments: Array<[[number, number, number], [number, number, number]]> = [];
  for (let row = 0; row <= ROWS; row += 1) {
    const z = -halfDepth - STEP / 2 + row * STEP;
    segments.push([
      [-halfWidth - STEP / 2, 0, z],
      [halfWidth + STEP / 2, 0, z],
    ]);
  }
  for (let col = 0; col <= COLS; col += 1) {
    const x = -halfWidth - STEP / 2 + col * STEP;
    segments.push([
      [x, 0, -halfDepth - STEP / 2],
      [x, 0, halfDepth + STEP / 2],
    ]);
  }
  group.add(chalkSegments(segments, palette.chalk, 0.42));

  // ---- colunas ----
  interface Cell {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    row: number;
    col: number;
    height: number;
    velocity: number;
    popAt: number;
    /** marca o pulo para o próximo quadro (o clique não conhece o tempo da cena) */
    pendingPop: boolean;
  }
  const cells: Cell[] = [];
  const columnGeometry = new THREE.BoxGeometry(STEP * 0.72, 1, STEP * 0.72);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const tone = [palette.orange, palette.blue, palette.cyan, palette.pink][row % 4];
      const material = new THREE.MeshStandardMaterial({
        color: tone,
        roughness: 0.5,
        metalness: 0.12,
        transparent: true,
        opacity: 0.88,
        emissive: new THREE.Color(tone),
        emissiveIntensity: 0.16,
      });
      const mesh = new THREE.Mesh(columnGeometry, material);
      mesh.position.set(xOf(col), 0.5, zOf(row));
      mesh.castShadow = true;
      group.add(mesh);
      cells.push({ mesh, material, row, col, height: 0.5, velocity: 0, popAt: -9, pendingPop: false });
    }
  }

  // ---- destaque da linha ativa ----
  const active = new THREE.Mesh(
    new THREE.BoxGeometry(COLS * STEP, 0.05, STEP - 0.2),
    new THREE.MeshBasicMaterial({ color: palette.yellow, transparent: true, opacity: 0.16 }),
  );
  group.add(active);

  // ---- rótulos ----
  const label = (text: string, color: string, height = 0.34) => {
    const made = createChalkSprite([{ text, size: 52, color }], { worldHeight: height });
    ctx.plates.push(made.plate);
    group.add(made.sprite);
    return made;
  };
  const rowLabels = Array.from({ length: ROWS }, (_, row) => {
    const made = label(String(row + 1), palette.cyan);
    made.sprite.translateX(-halfWidth - STEP * 0.95).translateY(0.28).translateZ(zOf(row));
    return made;
  });
  label('amostras', palette.chalk, 0.3).sprite.translateZ(halfDepth + STEP * 0.85);
  label('valores x_{i}', palette.yellow, 0.3)
    .sprite.translateX(-halfWidth - STEP * 1.5)
    .translateY(0.9)
    .translateZ(halfDepth + STEP * 0.85);

  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: '\\bar{x} = (1/n)·Σ x_{i}f_{i}',
      color: palette.cyan,
      position: [-2.6, 3.5, 0],
      height: 0.46,
      seed: 3,
    }),
    createFloatingFormula(ctx, {
      text: 's² = 1/(n−1)·Σ (x_{i} − \\bar{x})²',
      color: palette.orange,
      position: [2.6, 3.4, 0],
      height: 0.42,
      seed: 23,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let activeRow = 0;
  let nextShuffle = 2.4;
  let lastClicked: string | null = null;

  const pop = (cell: Cell, t: number) => {
    cell.popAt = t;
    cell.velocity = 3.4;
  };

  const update = (frame: Frame) => {
    // linha ativa percorrendo a tabela (só enquanto a animação roda)
    if (frame.playing) {
      activeRow = Math.floor(frame.t / 1.4) % ROWS;
      if (frame.focus > 0.5 && frame.t > nextShuffle) {
        nextShuffle = frame.t + 2.2 + Math.random() * 1.6;
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);
        freq[row][col] = clamp(freq[row][col] + (Math.random() < 0.5 ? -1 : 1), FREQ_MIN, FREQ_MAX);
        pop(cells[row * COLS + col], frame.t);
      }
    }
    active.position.set(0, 0.03, zOf(activeRow));

    for (const cell of cells) {
      if (cell.pendingPop) {
        cell.pendingPop = false;
        cell.popAt = frame.t;
        cell.velocity = 2.6;
      }
      const target = freq[cell.row][cell.col] * HEIGHT_PER_FREQ;
      // mola sub-amortecida: dá o "pulinho" do clique e volta a repousar
      cell.velocity += ((target - cell.height) * 60 - cell.velocity * 9) * frame.dt;
      cell.height = clamp(cell.height + cell.velocity * frame.dt, 0.06, 3.1);
      cell.mesh.scale.y = cell.height;
      cell.mesh.position.y = cell.height / 2;
      const since = frame.t - cell.popAt;
      const flash = clamp(1 - since / 0.5, 0, 1);
      cell.material.emissiveIntensity = 0.16 + 0.5 * flash;
      cell.material.opacity = 0.78 + 0.12 * frame.focus;
    }

    rowLabels.forEach(({ sprite, plate }, row) => {
      const target = row === activeRow ? 0.42 : 0.3;
      // a escala é **proporcional**: um dígito é bem mais alto que largo, e
      // `setScalar` esticava o número para um quadrado
      const next = clamp(sprite.scale.y + (target - sprite.scale.y) * 0.12, 0.2, 0.6);
      sprite.scale.set(next * plate.aspect, next, 1);
    });

    formulas.forEach((f) => f.update(frame.t));
  };

  const totals = () => {
    let sum = 0;
    let n = 0;
    freq.forEach((row, rowIndex) => {
      row.forEach((value) => {
        sum += value * (rowIndex + 1);
        n += value;
      });
    });
    return { sum, n, mean: n > 0 ? sum / n : 0 };
  };

  const readout = (): Readout[] => {
    const { n, mean } = totals();
    const rows: Readout[] = [
      { label: 'Média ponderada', value: `x̄ ≈ ${mean.toFixed(2)}` },
      { label: 'Total de dados', value: `n = ${n}` },
      { label: 'Linha ativa', value: `x = ${activeRow + 1}` },
      { label: 'Células', value: `${ROWS}×${COLS}` },
    ];
    if (lastClicked) rows.push({ label: 'Último clique', value: lastClicked });
    return rows;
  };

  return {
    id: 'tabela',
    title: 'Tabela de frequências 3D',
    tagline: 'Altura = frequência. Clique numa célula para ela pular',
    formula: '\\bar{x} = (1/n)·Σ x_{i}f_{i}',
    explanation:
      'Aqui a tabela virou objeto: cada coluna tem a altura da sua frequência, então a "forma" do conjunto de dados é visível de longe. A média ponderada do painel é Σxᵢfᵢ dividido por n — a coluna alta pesa mais na conta.',
    camera: [0, 3.6, 10.8],
    lookAtY: 1.1,
    drag: 'orbit',
    group,
    selectables: cells.map((cell) => cell.mesh),
    onPick(hit) {
      const cell = cells.find((c) => c.mesh === hit.object);
      if (!cell) return null;
      freq[cell.row][cell.col] = freq[cell.row][cell.col] >= FREQ_MAX ? FREQ_MIN : freq[cell.row][cell.col] + 1;
      cell.pendingPop = true;
      lastClicked = `x = ${cell.row + 1}, amostra ${cell.col + 1} → f = ${freq[cell.row][cell.col]}`;
      return lastClicked;
    },
    update,
    readout,
    reset() {
      freq.forEach((row, rowIndex) => {
        row.forEach((_, colIndex) => {
          freq[rowIndex][colIndex] = initial[rowIndex][colIndex];
        });
      });
      cells.forEach((cell) => {
        cell.height = freq[cell.row][cell.col] * HEIGHT_PER_FREQ;
        cell.velocity = 0;
        cell.popAt = -9;
        cell.pendingPop = false;
      });
      activeRow = 0;
      lastClicked = null;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
