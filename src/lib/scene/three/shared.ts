/**
 * Pequenos utilitários de geometria compartilhados pelos elementos 3D:
 * linhas de giz, contornos de arame e limpeza de memória (GPU não tem GC).
 */

import * as THREE from 'three';

/** Linha de giz a partir de uma lista de pontos `[x, y, z]`. */
export function chalkLine(points: Array<[number, number, number]>, color: string, opacity = 1): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

/** Segmentos avulsos (grades, eixos tracejados) a partir de pares de pontos. */
export function chalkSegments(
  segments: Array<[[number, number, number], [number, number, number]]>,
  color: string,
  opacity = 1,
): THREE.LineSegments {
  const positions: number[] = [];
  for (const [from, to] of segments) positions.push(...from, ...to);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.LineSegments(geometry, material);
}

/** Contorno de giz em volta de um sólido (o "traço" que fecha a peça). */
export function chalkEdges(geometry: THREE.BufferGeometry, color: string, threshold = 15): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, threshold);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.LineSegments(edges, material);
}

/** Rosa de luz suave para o chão (troca a sombra dura por um halo barato). */
export function createHalo(color: string, radius = 1, opacity = 0.18): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 48);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Libera geometrias, materiais e texturas de uma subárvore inteira. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      for (const key of Object.keys(material) as Array<keyof THREE.Material>) {
        const value = material[key] as unknown;
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** Hex → THREE.Color (a paleta de giz é toda em CSS). */
export function color(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** Ciclo de cores da paleta, na ordem em que o quadro usa. */
export function cycle(palette: string[], index: number): string {
  return palette[((index % palette.length) + palette.length) % palette.length];
}
