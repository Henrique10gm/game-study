// Loads the rooms of the game hall at bundle time: content/rooms/<id>/room.json
// plus every content/rooms/<id>/questions/*.json. A new room is just a new folder;
// the hall draws its door by itself. No question text lives in src/.
import type { QuestionBank, QuestionContent, RoomDef } from './types';

const roomModules = import.meta.glob('/content/rooms/*/room.json', {
  eager: true,
  import: 'default',
}) as Record<string, RoomDef>;

const bankModules = import.meta.glob('/content/rooms/*/questions/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, QuestionBank>;

export interface RoomBundle {
  def: RoomDef;
  questions: QuestionContent[]; // the questions bundled with the game
}

function folderOf(path: string): string {
  return path.split('/')[3];
}

export const ROOMS: RoomBundle[] = Object.keys(roomModules)
  .map((path) => {
    const def = roomModules[path];
    const questions = Object.keys(bankModules)
      .filter((bank) => folderOf(bank) === folderOf(path))
      .sort()
      .flatMap((bank) => bankModules[bank].questions);
    return { def, questions };
  })
  .sort((a, b) => a.def.order - b.def.order);

export function getRoomBundle(id: string): RoomBundle | undefined {
  return ROOMS.find((room) => room.def.id === id);
}
