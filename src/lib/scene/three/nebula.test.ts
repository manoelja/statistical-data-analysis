import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_SCENE_PARAMS, resetSceneParams } from '../store';
import { CHALK } from '../chalk';
import { WHITE_HOLE_STOP } from './whitehole';
import { createNebula, NEBULA_PLANE } from './nebula';

/**
 * A nebulosa é montada em jsdom, sem WebGL e **sem carregar a foto** (o
 * `TextureLoader` não resolve em jsdom). O que dá para conferir aqui é a
 * estrutura e a coreografia: quem é sprite, quem é `Points`, o blending de cada
 * um, e o fato de a peça só acender quando o epílogo manda.
 */

const ctx = { palette: CHALK, plates: [], params: { ...DEFAULT_SCENE_PARAMS } };

/**
 * A largura do quadro quando a câmera está parada na frente da nebulosa: a
 * distância é `WHITE_HOLE_STOP` e o FOV está no valor do epílogo (55° de base +
 * 12° do estouro = 67°). É contra isto que o tamanho da foto é justificado.
 */
const FRAME_WIDTH =
  2 *
  WHITE_HOLE_STOP *
  Math.tan(((55 + 12) / 2) * (Math.PI / 180)) *
  1.78;

describe('three/nebula', () => {
  it('é a foto mais três camadas de partículas, todas aditivas', () => {
    resetSceneParams();
    const nebula = createNebula(ctx);

    const sprites = nebula.group.children.filter(
      (child) => child instanceof THREE.Sprite,
    ) as THREE.Sprite[];
    const photo = sprites.find((sprite) => sprite.userData.nebulaPhoto === true);
    expect(photo).toBeDefined();
    expect(photo?.scale.x).toBeCloseTo(NEBULA_PLANE, 5);

    // o additive é o que descarta o preto do céu da foto: sem ele, a peça
    // leria como um retângulo colado no corredor
    nebula.group.traverse((node) => {
      const material = (node as THREE.Sprite | THREE.Points).material as
        | THREE.SpriteMaterial
        | THREE.ShaderMaterial
        | undefined;
      if (!material) return;
      expect(material.blending).toBe(THREE.AdditiveBlending);
      // é luz: nada escreve profundidade e nada é cortado por outra peça
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(false);
    });

    // duas nuvens de `Points`: a poeira radial e o campo de estrelas
    let dust = 0;
    let stars = 0;
    nebula.group.traverse((node) => {
      if (!(node instanceof THREE.Points)) return;
      const uniforms = (node.material as THREE.ShaderMaterial).uniforms;
      if (uniforms?.uIris) dust += 1;
      else if (uniforms?.uSpiked) stars += 1;
    });
    expect(dust).toBe(1);
    expect(stars).toBe(1);

    nebula.dispose();
    resetSceneParams();
  });

  it('nenhum recorte reto da foto pode aparecer: a vinheta leva a borda a zero', () => {
    resetSceneParams();
    const nebula = createNebula(ctx);

    const photo = nebula.group.children.find(
      (child) => child instanceof THREE.Sprite && child.userData.nebulaPhoto === true,
    ) as THREE.Sprite;
    expect(photo).toBeDefined();

    // A foto cabe dentro do quadro (meia-largura 95 contra ~118), então quem
    // garante que o retângulo da imagem não apareça **não** é o estouro pela
    // borda: é a vinheta e o piso de preto aplicados no shader.
    expect(photo.scale.x / 2).toBeLessThan(FRAME_WIDTH / 2);

    const material = photo.material as THREE.SpriteMaterial;
    expect(typeof material.onBeforeCompile).toBe('function');
    expect(material.customProgramCacheKey?.()).toBe('nebula-photo');

    // `onBeforeCompile` reescreve o `fragmentShader` que recebe: alimentando um
    // fragmento mínimo com o include do Three, dá para ver o que foi injetado
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: '',
      fragmentShader: '#include <map_fragment>',
    };
    material.onBeforeCompile?.(shader as never, {} as never);
    expect(shader.fragmentShader).toContain('uSkyFloor');
    expect(shader.fragmentShader).toContain('uVignette');
    // e os dois uniformes existem com o valor do piso e da vinheta
    expect(shader.uniforms.uSkyFloor?.value).toBeGreaterThan(0);
    expect(shader.uniforms.uVignette?.value).toBeDefined();

    nebula.dispose();
    resetSceneParams();
  });

  it('nasce apagada e acende com o afterglow do epílogo', () => {
    resetSceneParams();
    const nebula = createNebula(ctx);
    const sprites = nebula.group.children.filter(
      (child) => child instanceof THREE.Sprite,
    ) as THREE.Sprite[];
    const photo = sprites.find((sprite) => sprite.userData.nebulaPhoto === true) as
      | THREE.Sprite
      | undefined;
    const material = photo?.material as THREE.SpriteMaterial;

    // nada aceso antes: o quadro do epílogo é só o buraco branco
    nebula.update(0, 1 / 60, 1, 0);
    expect(material.opacity).toBe(0);

    // e depois tudo junto — a foto é o que carrega a forma, então é ela que
    // define o "ligar"
    nebula.update(3, 1 / 60, 1, 1);
    expect(material.opacity).toBe(1);
    sprites.forEach((sprite) => {
      expect((sprite.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0);
    });

    nebula.dispose();
    resetSceneParams();
  });

  it('a poeira e as estrelas andam com o tempo (a foto é estática)', () => {
    resetSceneParams();
    const nebula = createNebula(ctx);
    const points: THREE.Points[] = [];
    nebula.group.traverse((node) => {
      if (node instanceof THREE.Points) points.push(node);
    });

    const timeOf = (node: THREE.Points) => {
      const uniforms = (node.material as THREE.ShaderMaterial).uniforms;
      return uniforms?.uTime?.value as number;
    };
    nebula.update(0, 1 / 60, 1, 1);
    nebula.update(5, 1 / 60, 1, 1);
    points.forEach((node) => expect(timeOf(node)).toBe(5));

    nebula.dispose();
    resetSceneParams();
  });
});
