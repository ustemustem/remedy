"use client";

import { createContext, useContext } from "react";

export interface Softness {
  /** Corner radius in px — same value driving the global --radius CSS variable. */
  radius: number;
  /** 0-1 — how far the corner curve leans from a plain circular arc toward an Apple-style continuous squircle. */
  smoothing: number;
}

const SoftnessContext = createContext<Softness>({ radius: 4, smoothing: 0 });

export const SoftnessProvider = SoftnessContext.Provider;

/** Read the current corner radius/smoothing — see rx-node.tsx for applying it as a squircle clip-path. */
export function useSoftness() {
  return useContext(SoftnessContext);
}
