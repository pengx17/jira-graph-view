import { GraphinData } from "@antv/graphin";
import { atom } from "jotai";
import { atomWithStorage, createJSONStorage, atomFamily } from "jotai/utils";

// Simply use jotai to hold application states globally

const storage = createJSONStorage<string>(() => sessionStorage);

export const seedAtom = atomWithStorage<string>("seed", "", storage);
export const peerAtom = atomWithStorage<string>("peer", "", storage);
type D = GraphinData | null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const graphDataAtomFamily = atomFamily((id: string) =>
  atom<D>(null as D)
);
