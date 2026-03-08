import { TetrisGame } from "./ui/tetris-game.js";
import { initTetrisFirebase } from "./infra/firebase-runtime.js";

initTetrisFirebase();

if (!customElements.get("tetris-game")) {
  customElements.define("tetris-game", TetrisGame);
}
