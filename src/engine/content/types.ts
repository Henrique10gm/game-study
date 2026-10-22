// Content schema. The engine never hardcodes question text; every field here
// is populated from content/questions/*.json at runtime (contentRegistry.ts).
// No question text, choice text, feedback text or xpOnCorrect value should ever
// appear as a string or number literal inside src/engine/**.

export interface DialogueLine {
  speaker: string; // "Nome Sobrenome — Cargo"
  text: string;
}

export interface Choice {
  id: string;
  text: string;
  correct: boolean;
  feedback: string; // per-choice feedback — never a single question-level string
}

// Training categories a question can belong to (a question may be in several).
// Each room lists the categories it accepts in its room.json.
export type Category = string;

// A room is one theme of the game hall (content/rooms/<id>/room.json). The game
// loop is the same in every room; only the modes and the questions change.
export type ModeKind = 'exam' | 'category' | 'wrong' | 'all';

export interface RoomMode {
  id: string; // saved with every game, so never rename an id that already has history
  kind: ModeKind;
  title: string;
  description: string;
  category?: Category; // kind "category" filters by it
}

export interface RoomDef {
  id: string; // same as the folder name
  order: number; // position of the door in the hall
  title: string;
  tagline: string;
  accent: string; // "#RRGGBB", the color of the door
  kicker: string; // small caps line above the mission list
  menuTitle: string;
  blurb: string;
  emptyNote: string; // shown while the room has no questions
  examLabel?: string; // label for the "exam" line of the readiness card
  remoteBank?: boolean; // the question bank can be updated from the Google Sheet
  categories: Category[];
  modes: RoomMode[];
}

export interface QuestionContent {
  sceneId: string; // unique question id
  categories: Category[];
  exam?: boolean; // part of the "Prova ABT1" set
  topicTag: string;
  dialogue: DialogueLine[]; // short in-world setup shown above the question
  question: string;
  choices: Choice[];
  xpOnCorrect: number;
}

export interface QuestionBank {
  questions: QuestionContent[];
}

export interface ContentSource {
  listQuestions(): QuestionContent[];
  getQuestion(id: string): QuestionContent | undefined;
}
