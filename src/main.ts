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
import { createLiveContent } from './engine/content/remoteContent';
import { mountSignOut, requireSession } from './auth/AuthGate';
import { createSupabase } from './auth/supabaseClient';
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
import { hideLoader, showLoader } from './engine/ui/bootLoader';
import { createStore } from './state/createStore';
import { GroupService } from './state/GroupService';
import { captureInviteFromUrl, takePendingInvite } from './state/inviteLink';
import { SupabaseGameStore } from './state/SupabaseGameStore';

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
  throw new Error('main: #ui-root element not found in index.html');
}

// Browser storage for the small local marks (e.g. "already saw this update").
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = browserStorage();
// An invite link may be opened before signing in: keep the code until the player is in.
captureInviteFromUrl(storage);

// With Supabase settings the player signs in first (the game only loads after that);
// without them the game runs offline on this device.
async function boot(root: HTMLElement): Promise<void> {
  const client = createSupabase();
  let userId: string | null = null;
  if (client) {
    hideLoader();
    const session = await requireSession({
      client,
      uiRoot: root,
      turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    });
    userId = session.user.id;
    showLoader();
  }
  const store = createStore(client, userId);

  // Cloud play: the ranking is per group, so settle the active group (and any invite) first.
  let groups: GroupService | undefined;
  let initialNotice: string | undefined;
  if (client && userId && store instanceof SupabaseGameStore) {
    groups = new GroupService(client, store, userId);
    const invite = takePendingInvite(storage);
    if (invite) {
      try {
        await groups.join(invite);
        initialNotice = 'Você entrou no grupo pelo convite.';
      } catch (error) {
        initialNotice = error instanceof Error ? error.message : undefined;
      }
    }
    await groups.ensureActive();
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

  watchOrientation(root);
  bindFullscreenKey();

  // Questions: every room plays with its bundled bank (content/rooms/*).
  const rooms: RoomEntry[] = ROOMS.map(({ def, questions }) => ({ def, content: createLiveContent(questions, null) }));

  const app = new App({ game, uiRoot: root, store, rooms, storage, groups, initialNotice });
  void app.start();

  // Dev-only handle so browser automation can inspect/drive the scene.
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Phaser.Game }).__game = game;
  }

  console.log(...consoleGreeting());

  if (client) mountSignOut(client, root);
}

void boot(uiRoot);
