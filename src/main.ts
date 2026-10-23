// Entry point: the landing page. The game (Phaser, the scenes, the App) is a separate chunk
// (src/game.ts) loaded when the visitor chooses to enter.
import './engine/ui/tokens.css';
import { initLanding } from './landing/landing';

initLanding();
