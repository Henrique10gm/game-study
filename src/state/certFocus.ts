// The certification (the room) the visitor chose to train. It is picked on the landing page,
// before there is any account, so it lives in this browser; the hall marks that room's door.
const KEY = 'qh.focusRoom.v1';
const ROOM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | null;

export function readFocusRoom(storage: StorageLike): string | null {
  try {
    const value = storage?.getItem(KEY);
    return value && ROOM_ID.test(value) && value.length <= 40 ? value : null;
  } catch {
    return null;
  }
}

export function saveFocusRoom(storage: StorageLike, roomId: string): boolean {
  if (!ROOM_ID.test(roomId) || roomId.length > 40) return false;
  try {
    storage?.setItem(KEY, roomId);
    return true;
  } catch {
    return false;
  }
}
