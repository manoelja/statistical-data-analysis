export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <h3>Probabilidade &amp; Inferência Estatística</h3>
          <p>
            Conteúdo baseado na base de nascidos vivos de 2024 do SINASC (DataSUS), com
            resultados reproduzidos e conferidos no R 4.6.0.
          </p>
        </div>
        <div className="footer__meta">
          <span>SINASC / DataSUS · 2024</span>
          <span>Nível de confiança 95% · α = 5%</span>
        </div>
      </div>
    </footer>
  );
}
