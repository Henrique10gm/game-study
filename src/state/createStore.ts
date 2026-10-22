// Picks the store for where the game is running:
//  1. built with Supabase settings and a signed-in player -> the cloud store;
//  2. otherwise the local (offline) store that keeps progress in this browser.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameStore } from './GameStore';
import { LocalGameStore } from './LocalGameStore';
import { SupabaseGameStore } from './SupabaseGameStore';

export function createStore(client: SupabaseClient | null, userId: string | null): GameStore {
  return client && userId ? new SupabaseGameStore(client, userId) : new LocalGameStore();
}
