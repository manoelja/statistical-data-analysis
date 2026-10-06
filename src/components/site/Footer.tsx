/**
 * Footer — cubo CSS 3D animado + efeitos de perspectiva nos textos.
 *
 * O cubo pequeno rotaciona continuamente e exibe faces com símbolo P&I,
 * datas e informações de confiança. Os textos ao redor têm entrada 3D.
 */

import { motion } from 'framer-motion';

/* ---- Cubo CSS 3D ---- */
function Cube3D() {
  const faces = ['P&I', '95%', '2024', 'α=5%', 'n=200', 'R4.6'];
  return (
    <div className="cube3d" aria-hidden="true">
      <motion.div
        className="cube3d__inner"
        animate={{ rotateY: 360, rotateX: 20 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {faces.map((text, i) => (
          <div key={i} className={`cube3d__face cube3d__face--${i + 1}`}>
            <span>{text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer footer--3d">
      <div className="container">
        <div className="footer__grid footer__grid--3d">
          {/* Texto esquerdo com entrada 3D */}
          <motion.div
            initial={{ opacity: 0, rotateX: -14, y: 20 }}
            whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: '500px' }}
          >
            <h3>Probabilidade &amp; Inferência Estatística</h3>
            <p>
              Conteúdo baseado na base de nascidos vivos de 2024 do SINASC
              (DataSUS), com resultados reproduzidos e conferidos no R 4.6.0.
            </p>
          </motion.div>

          {/* Cubo 3D central */}
          <motion.div
            className="footer__cube-wrap"
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <Cube3D />
          </motion.div>

          {/* Meta com entrada 3D */}
          <motion.div
            className="footer__meta"
            initial={{ opacity: 0, rotateX: 14, y: 20 }}
            whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: '500px' }}
          >
            <span>SINASC / DataSUS · 2024</span>
            <span>Nível de confiança 95% · α = 5%</span>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
