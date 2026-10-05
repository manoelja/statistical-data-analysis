import { useEffect } from "react";
import { Navbar } from "./components/site/Navbar";
import { ChalkDoodles } from "./components/site/ClalkDoodles";
import { Hero } from "./components/site/Hero";
import { Overview } from "./components/site/Overview";
import { ProbabilityLab } from "./components/labs/ProbabilityLab";
import { InferenceLab } from "./components/labs/InferenceLab";
import { Results } from "./components/site/Results";
import { FormulaSheet } from "./components/site/FormulaSheet";
import { Footer } from "./components/site/Footer";
import "./styles/global.css";

function App() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="App">
      <ChalkDoodles />
      <Navbar />
      <main>
        <Hero />
        <Overview />
        <ProbabilityLab />
        <InferenceLab />
        <Results />
        <FormulaSheet />
      </main>
      <Footer />
    </div>
  );
}

export default App;
