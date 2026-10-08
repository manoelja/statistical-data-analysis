/**
 * Contato — a última sala da jornada.
 *
 * A peça 3D deste capítulo é a **nebulosa** (`three/nebula.ts`), que acende no
 * lugar onde o buraco branco estava quando o branco do epílogo baixa. O card é
 * uma faixa no rodapé (`journey__card--bottom`), então ele não disputa o centro
 * com a nuvem: a nebulosa fica em cima, os botões em baixo.
 *
 * Os quatro botões são a saída da página — o lugar onde a jornada vira endereço.
 * Três abrem link externo e o quarto abre a caixa "sobre". Todos com placeholder
 * (`href="#"`): os links reais entram aqui.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Github, Linkedin, User } from 'lucide-react';

/**
 * Os links de saída. **Placeholder** — trocar pelos URLs reais.
 * `portfolio` usa o ícone que já vive em `public/manoelja.svg` (o raio).
 */
const LINKS = {
  // TODO(url): colar o endereço do GitHub
  github: '#',
  // TODO(url): colar o endereço do LinkedIn
  linkedin: '#',
  // TODO(url): colar o endereço do portfólio
  portfolio: '#',
};

export function Contact() {
  const [about, setAbout] = useState(false);

  return (
    <div className="contact">
      <p className="contact__lead">
        A jornada acaba onde a nébulosa acende. Se quiser conferir a conta, seguir o
        código ou falar comigo, são quatro saídas:
      </p>

      <div className="contact__actions">
        <a
          className="contact__btn"
          href={LINKS.github}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Github size={17} aria-hidden="true" />
          <span>GitHub</span>
          <ArrowUpRight size={13} aria-hidden="true" className="contact__out" />
        </a>

        <a
          className="contact__btn"
          href={LINKS.linkedin}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Linkedin size={17} aria-hidden="true" />
          <span>LinkedIn</span>
          <ArrowUpRight size={13} aria-hidden="true" className="contact__out" />
        </a>

        <button
          type="button"
          className="contact__btn"
          aria-expanded={about}
          aria-controls="contact-sobre"
          onClick={() => setAbout((open) => !open)}
        >
          <User size={17} aria-hidden="true" />
          <span>Sobre o desenvolvedor</span>
        </button>

        <a
          className="contact__btn contact__btn--mark"
          href={LINKS.portfolio}
          target="_blank"
          rel="noreferrer noopener"
        >
          {/* o raio é o próprio `manoelja.svg` que já está em /public */}
          <img src="/manoelja.svg" alt="" width={17} height={17} aria-hidden="true" />
          <span>Portfólio</span>
          <ArrowUpRight size={13} aria-hidden="true" className="contact__out" />
        </a>
      </div>

      {/* a caixa de "sobre": abre **abaixo** do botão, e o botão vira o gatilho
          (aria-expanded + aria-controls), como o `Reveal` dos laboratórios */}
      <AnimatePresence initial={false}>
        {about && (
          <motion.div
            id="contact-sobre"
            className="contact__about"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <p>
              Esta jornada foi construída por <strong>Manoel</strong>, com o gerador de
              cena em Three.js escrito do zero: a poeira que o buraco negro puxa, o
              disco que vira o universo de dados e o buraco branco do fim são a mesma
              conta ao contrário.
            </p>
            <p className="contact__about-meta">
              Base: SINASC / DataSUS 2024 · análise conferida no R 4.6.0 ·
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
