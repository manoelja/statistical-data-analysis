/**
 * Navbar — barra de navegação com micro-interações 3D:
 * - Logo com rotateY no hover
 * - Links com translateZ + glow no hover
 * - Barra de progresso
 * - Drawer mobile animado em 3D
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useActiveSection } from '../../hooks/useActiveSection';
import { useScrollProgress } from '../../hooks/useScrollProgress';

const LINKS = [
  { id: 'visao',         label: 'Visão geral' },
  { id: 'probabilidade', label: 'Parte 1' },
  { id: 'inferencia',    label: 'Parte 2' },
  { id: 'resultados',    label: 'Resultados' },
  { id: 'formulario',    label: 'Formulário' },
  { id: 'contato',       label: 'Contato' },
];

const SECTION_IDS = LINKS.map(l => l.id);

export function Navbar() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection(SECTION_IDS);
  const progress = useScrollProgress();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ---------- gaveta aberta trava a página ----------
  /* Sem isto a página **continua rolando por baixo** da gaveta, e aqui isso não
     é um detalhe: o que rola embaixo é a jornada. O palco é `sticky` e a câmera
     é movida pelo `scrollY` a cada quadro, então a nebulosa e os cards andavam por baixo de um menu que parecia parado — a gaveta parecia quebrada, e
     não era ela.

     O truque é o de `data-base-analysis/src/components/Navbar/Navbar.tsx`:
     segurar `touchmove` e `wheel` no `document` com `passive: false`, e só
     cancelar o gesto que **não** começa dentro da gaveta. `passive: false` é o
     que dá o direito de chamar `preventDefault` — com `passive: true` (o padrão
     do `wheel`) o navegador rola antes de o listener ver o evento. */
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const drawer = document.querySelector<HTMLElement>('.drawer');
    const preventScroll = (event: Event) => {
      /* A gaveta é o único canto que pode rolar. A primeira versão deste
         código liberava qualquer gesto que começasse dentro dela, copiado da
         referência — e aqui isso desligava o lock inteiro: a gaveta deste
         projeto ocupa a tela toda (`inset: var(--nav-h) 0 0 0`), então **todo**
         gesto de toque nasce dentro dela e passava direto. A exceção só faz
         sentido onde o menu é uma painel lateral e sobra área ao lado, como no
         `data-base-analysis`.

         Então a exceção é condicionada ao que interessa: ela só vale quando a
         gaveta realmente tem o que rolar. */
      if (drawer && drawer.contains(event.target as Node) && drawer.scrollHeight > drawer.clientHeight) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventScroll);
      // A página não deveria ter se mexido — mas no iOS o elástico do
      // `touchmove` anda mesmo com o gesto cancelado. `'instant'` e não o
      // padrão porque o `html` tem `scroll-behavior: smooth`, e restaurar a
      // posição com animação apareceria como um salto ao fechar.
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    };
  }, [open]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goTo = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  /** Mesma coisa, mas **espera a gaveta sair**. O destravamento acima restaura a
      posição de rolagem no fim da animação: se o `scrollIntoView` começasse
      junto, ele seria desfeito de imediato e o link pareceria quebrado. O
      tempo é o da animação de saída da gaveta (0,28s abaixo). */
  const goToFromDrawer = (id: string) => {
    setOpen(false);
    window.setTimeout(() => scrollToSection(id), 280);
  };

  return (
    <>
      {/* Barra de progresso */}
      <motion.div
        className="progress-bar"
        style={{ width: `${progress}%` }}
        initial={{ scaleX: 0, originX: 0 }}
      />

      <header className={`navbar${stuck ? ' is-stuck' : ''}`}>
        <div className="container navbar__inner">
          {/* Logo com rotateY 3D */}
          <motion.a
            className="brand"
            href="#visao"
            onClick={e => { e.preventDefault(); goTo('visao'); }}
            whileHover={{
              rotateY: 8,
              scale: 1.04,
              transition: { duration: 0.25 },
            }}
            style={{ transformStyle: 'preserve-3d', perspective: '400px' }}
          >
            <motion.span
              className="brand__mark"
              aria-hidden="true"
              whileHover={{ rotateY: 180 }}
              transition={{ duration: 0.4 }}
            >
              <span>P&amp;I</span>
            </motion.span>
            Probabilidade &amp; Inferência
          </motion.a>

          {/* Links com translateZ */}
          <nav className="navbar__links" aria-label="Seções" style={{ perspective: '600px' }}>
            {LINKS.map(link => (
              <motion.a
                key={link.id}
                href={`#${link.id}`}
                className={active === link.id ? 'active' : ''}
                onClick={e => { e.preventDefault(); goTo(link.id); }}
                whileHover={{
                  translateZ: 6,
                  scale: 1.06,
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.95 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {link.label}
              </motion.a>
            ))}
          </nav>

          {/* Toggle menu mobile */}
          <motion.button
            className="icon-btn navbar__mobile-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            whileTap={{ scale: 0.9, rotateZ: open ? -90 : 90 }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </motion.button>
        </div>
      </header>

      {/* Gaveta mobile: painel lateral da direita, com fundo escurecido atrás.
          O desenho é o de `data-base-analysis/src/components/Navbar/Navbar.css`
          — lá a gaveta cobria a tela toda e o backdrop era decorativo; aqui ela
          é uma placa de 280px na borda, e o fundo é o que fecha o resto. */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="drawer__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.nav
              className="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              aria-label="Seções"
            >
              {/* Cabeçalho da gaveta: a marca e o X de fechar. O botão da navbar também
                  continua lá, e vira X quando o menu abre — mas a gaveta está
                  por cima dele, então o da navbar some da tela e o que se vê é
                  este. Um X só, como na referência. */}
              <div className="drawer__head">
                <span className="brand">
                  <span className="brand__mark" aria-hidden="true">
                    <span>P&amp;I</span>
                  </span>
                  <span className="drawer__brand-name">Probabilidade &amp; Inferência</span>
                </span>
                <button
                  type="button"
                  className="icon-btn drawer__close"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                >
                  <X size={18} />
                </button>
              </div>

              <ul className="drawer__list">
                {LINKS.map((link, i) => (
                  <motion.li
                    key={link.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <a
                      href={`#${link.id}`}
                      className={active === link.id ? 'active' : ''}
                      onClick={e => { e.preventDefault(); goToFromDrawer(link.id); }}
                    >
                      <span className="drawer__index" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{link.label}</span>
                    </a>
                  </motion.li>
                ))}
              </ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
