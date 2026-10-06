import { useEffect } from "react";
import { Navbar } from "./components/site/Navbar";
import { Journey3D } from "./components/site/Journey3D";
import "./styles/global.css";
import "./styles/journey.css";

/**
 * A página **é** a jornada: o canvas 3D fica fixo como fundo e as seis etapas
 * de conteúdo (visão geral, parte 1, parte 2, resultados, formulário e contato)
 * rolam por cima dele, cada uma com o seu elemento 3D ao lado.
 */
function App() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="App app--3d">
      <Navbar />
      <main>
        <Journey3D />
      </main>
    </div>
  );
}

export default App;
