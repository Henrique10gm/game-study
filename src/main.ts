// Bootstrap: Phaser game (flight loop) + the App controller (hall of rooms,
// modes, saving). The game scenes are identical for every mode; questions are
// plugged in by RunFlow when a question is due.
import Phaser from 'phaser';
import './engine/ui/tokens.css';
import './engine/ui/boot-loader.css';
import { App } from './app/App';
import type { RoomEntry } from './app/App';
import { GAME_HEIGHT, GAME_WIDTH } from './engine/config';
import { ROOMS } from './engine/content/rooms';
import { createLiveContent, refreshQuestionBank } from './engine/content/remoteContent';
import { consoleGreeting } from './engine/easterEggs';
import { bindFullscreenKey } from './engine/ui/fullscreen';
import { watchOrientation } from './engine/ui/orientationHint';
import { BootScene } from './engine/scenes/BootScene';
import { FlappyScene } from './engine/scenes/FlappyScene';
import { PacmanScene } from './engine/scenes/PacmanScene';
import { HubScene } from './engine/scenes/HubScene';
import { MenuScene } from './engine/scenes/MenuScene';
import { RunnerScene } from './engine/scenes/RunnerScene';
import { TimeAttackScene } from './engine/scenes/TimeAttackScene';
import { createQuestionsFetcher, createStore } from './state/createStore';

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
  throw new Error('main: #ui-root element not found in index.html');
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1A1615',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Only the first scene boots; the App starts MenuScene (the walk in front of the
  // bank, and the inside of a room), HubScene (the hall) and the run scenes.
  scene: [BootScene, MenuScene, HubScene, FlappyScene, TimeAttackScene, RunnerScene, PacmanScene],
});

watchOrientation(uiRoot);
bindFullscreenKey();

// Questions: each room plays with its bundled bank. A room that opts in
// (remoteBank in room.json) uses the last bank downloaded from the Google Sheet
// when there is one; a newer published bank is fetched in the background and
// used the next time the game opens.
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = browserStorage();
const questionsFetcher = createQuestionsFetcher();
const rooms: RoomEntry[] = ROOMS.map(({ def, questions }) => {
  if (!def.remoteBank) return { def, content: createLiveContent(questions, null) };
  if (questionsFetcher) void refreshQuestionBank(questionsFetcher, storage, def.categories, questions);
  return { def, content: createLiveContent(questions, storage, def.categories) };
});

const app = new App({ game, uiRoot, store: createStore(), rooms, storage });
void app.start();

// Dev-only handle so browser automation can inspect/drive the scene.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

console.log(...consoleGreeting());
