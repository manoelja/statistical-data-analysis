/**
 * Navbar — barra de navegação com micro-interações 3D:
 * - Logo com rotateY no hover
 * - Links com translateZ + glow no hover
 * - Barra de progresso
 * - Drawer mobile animado em 3D
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
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
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const goTo = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

          {/* Toggle tema */}
          <motion.button
            className="icon-btn"
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            whileHover={{ rotateY: 20, scale: 1.1 }}
            whileTap={{ scale: 0.9, rotateZ: -15 }}
            style={{ transformStyle: 'preserve-3d', perspective: '200px' }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>

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

      {/* Drawer mobile com animação 3D */}
      <AnimatePresence>
        {open && (
          <motion.nav
            className="drawer"
            initial={{ opacity: 0, rotateX: -12, y: -16 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, rotateX: -12, y: -16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: '600px', transformOrigin: 'top center' }}
            aria-label="Seções"
          >
            {LINKS.map((link, i) => (
              <motion.a
                key={link.id}
                href={`#${link.id}`}
                onClick={e => { e.preventDefault(); goTo(link.id); }}
                initial={{ opacity: 0, x: -20, rotateY: -10 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileTap={{ scale: 0.97, translateX: 4 }}
                style={{ perspective: '400px' }}
              >
                {link.label}
              </motion.a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
