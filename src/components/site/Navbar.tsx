import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useActiveSection } from '../../hooks/useActiveSection';
import { useScrollProgress } from '../../hooks/useScrollProgress';

const LINKS = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'probabilidade', label: 'Parte 1' },
  { id: 'inferencia', label: 'Parte 2' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'formulario', label: 'Formulário' },
];

const SECTION_IDS = LINKS.map((l) => l.id);

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
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* ignora ambientes sem storage */
    }
  }, [dark]);

  const goTo = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="progress-bar" style={{ width: `${progress}%` }} />

      <header className={`navbar${stuck ? ' is-stuck' : ''}`}>
        <div className="container navbar__inner">
          <a className="brand" href="#hero" onClick={(e) => { e.preventDefault(); goTo('hero'); }}>
            <span className="brand__mark" aria-hidden="true">
              <span>P&amp;I</span>
            </span>
            Probabilidade &amp; Inferência
          </a>

          <nav className="navbar__links" aria-label="Seções">
            {LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={active === link.id ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(link.id);
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <button
            className="icon-btn"
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            className="icon-btn navbar__mobile-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="drawer"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            aria-label="Seções"
          >
            {LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(link.id);
                }}
              >
                {link.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
