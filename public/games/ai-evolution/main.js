import { AIEvolution2048 } from "./application/ai-evolution-game.js";
import { initAiEvolutionFirebase } from "./infra/firebase-runtime.js";

initAiEvolutionFirebase();

window.addEventListener("load", () => {
  setTimeout(() => {
    window.gameInstance = new AIEvolution2048();
  }, 100);
});
