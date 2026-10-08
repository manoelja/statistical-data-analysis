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

/** Opções de {@link createAdditivePhoto}. */
export interface PhotoSpriteOptions {
  /** Lado do sprite, em unidades de cena. */
  plane: number;
  /**
   * Chave de cache do programa. Precisa ser **única por shader**: o Three
   * reutiliza o programa compilado entre materiais com a mesma chave, e a
   * injeção de `onBeforeCompile` não aconteceria no segundo.
   */
  cacheKey: string;
  /**
   * `false` para um fundo que nada pode cortar (a nebulosa, no fim do
   * corredor); `true` para uma peça no meio da cena, que as peças à frente
   * precisam ocluir.
   */
  depthTest?: boolean;
  renderOrder?: number;
  /** Deslocamento em z dentro do grupo. */
  z?: number;
  /**
   * Luminância abaixo da qual a foto é tratada como céu. O céu de um JPEG não é
   * preto — somado pelo blending aditivo, esse valor residual desenharia um
   * retângulo visível em volta da peça.
   */
  skyFloor?: number;
  /** Largura da transição suave no piso. */
  skyKnee?: number;
  /** Vinheta radial: `[começa, termina]`, em `length(uv - 0.5) * 2`. */
  vignette?: [number, number];
}

/**
 * Uma **foto** virada em luz.
 *
 * É o truque que permite usar JPEG no lugar de uma imagem com alpha: o arquivo
 * carrega o céu junto com a arte, e o que o descarta é o próprio
 * `AdditiveBlending` — preto não acrescenta nada. O que sobra é o céu *não
 * exatamente* preto, e é para ele que existem o `skyFloor` (corta a luminância
 * residual) e a vinheta (leva a borda a zero por distância).
 *
 * `Sprite` e não `Plane`: sprite olha sempre para a câmera, e nenhuma das duas
 * peças que usam isto é vista de lado o bastante para que o tracking valha o
 * código do vertex shader.
 */
export function createAdditivePhoto(
  url: string,
  options: PhotoSpriteOptions,
): { sprite: THREE.Sprite; material: THREE.SpriteMaterial } {
  const {
    plane,
    cacheKey,
    depthTest = false,
    renderOrder = 0,
    z = 0,
    skyFloor = 0.035,
    skyKnee = 0.07,
    vignette = [0.6, 1.0],
  } = options;

  const material = new THREE.SpriteMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest,
    // o preto do céu da foto desaparece com o aditivo: é ele que dá a
    // "transparência" sem recorte alpha
    blending: THREE.AdditiveBlending,
  });

  /**
   * Piso de preto + vinheta, injetados no fragment shader do sprite.
   *
   * `onBeforeCompile` em vez de um `ShaderMaterial` próprio: o sprite precisa do
   * *billboard* que o Three já implementa, e reescrever esse vertex shader à mão
   * seria jogar fora a parte que funciona.
   */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkyFloor = { value: skyFloor };
    shader.uniforms.uSkyKnee = { value: skyKnee };
    shader.uniforms.uVignette = { value: new THREE.Vector2(vignette[0], vignette[1]) };
    shader.fragmentShader =
      'uniform float uSkyFloor;\nuniform float uSkyKnee;\nuniform vec2 uVignette;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>

        // o céu da foto não é preto: somado pelo aditivo, ele desenha um
        // retângulo em volta da peça. o piso o joga a zero
        float sky = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb *= smoothstep(uSkyFloor, uSkyFloor + uSkyKnee, sky);

        // e a vinheta leva a borda a zero por distância do centro: o recorte
        // some, e a névoa se dissolve no espaço como ela já se dissolve na foto
        float edge = length(vMapUv - 0.5) * 2.0;
        diffuseColor.rgb *= 1.0 - smoothstep(uVignette.x, uVignette.y, edge);
        `,
      );
  };
  material.customProgramCacheKey = () => cacheKey;

  // em jsdom (e num navegador sem a foto) a textura fica vazia, e a peça
  // continua valendo pelo brilho e pelas partículas
  new THREE.TextureLoader().load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 4;
    material.map = texture;
    material.needsUpdate = true;
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(plane);
  sprite.position.z = z;
  sprite.renderOrder = renderOrder;
  return { sprite, material };
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
