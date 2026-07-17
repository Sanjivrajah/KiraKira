"use client";

import { AudioLines } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { VoicePhase } from "./use-voice-agent";

interface VoiceOrbProps {
  phase: VoicePhase;
  getInputVolume: () => number;
  getOutputVolume: () => number;
}

// The raw SDK volume sits low (~0–0.3 in normal speech); lift it so the orb
// visibly breathes with the voice, then clamp so a loud burst can't overshoot.
const LEVEL_GAIN = 3.2;

/**
 * The expressive, audio-reactive orb. A single rAF loop writes a smoothed
 * `--voice-level` (0–1) onto the element so CSS — not React — drives the
 * per-frame visuals. It reacts to the mic while the user talks (`listening`)
 * and to the assistant's output while it talks (`speaking`); every other phase
 * rests at level 0 and relies on its own CSS animation.
 */
export function VoiceOrb({ phase, getInputVolume, getOutputVolume }: VoiceOrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reactive = phase === "listening" || phase === "speaking";
    if (reducedMotion || !reactive) {
      element.style.setProperty("--voice-level", "0");
      return;
    }

    const read = phase === "speaking" ? getOutputVolume : getInputVolume;
    let frame = 0;
    let smoothed = 0;
    const tick = () => {
      const target = Math.min(1, Math.max(0, read() * LEVEL_GAIN));
      // Fast attack, slower release keeps the motion lively but never jittery.
      const rate = target > smoothed ? 0.35 : 0.12;
      smoothed += (target - smoothed) * rate;
      element.style.setProperty("--voice-level", smoothed.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, reducedMotion, getInputVolume, getOutputVolume]);

  return (
    <div ref={ref} className="voice-orb" data-phase={phase} aria-hidden="true">
      <AudioLines className="voice-orb-icon" size={40} />
    </div>
  );
}
