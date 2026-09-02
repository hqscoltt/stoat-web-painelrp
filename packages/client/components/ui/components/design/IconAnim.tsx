import { styled } from "styled-system/jsx";

/**
 * One-off keyframes for the small icon hover animations below — simplest
 * way to get real @keyframes without fighting the styled system's variant
 * API for something this tiny. Mount `<style>{ICON_ANIM_KEYFRAMES}</style>`
 * once near the root of wherever these are used.
 */
export const ICON_ANIM_KEYFRAMES = `
@keyframes icon-anim-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-12deg); }
  75% { transform: rotate(12deg); }
}
@keyframes icon-anim-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
@keyframes icon-anim-jump {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes icon-anim-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(90deg); }
}
@keyframes icon-anim-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}
`;

/**
 * Wraps an icon to give it a small, tasteful hover animation — matching
 * Discord's mic-wiggle/hangup-jump/etc. micro-interactions.
 */
export const IconAnim = styled("span", {
  base: {
    display: "inline-flex",
  },
  variants: {
    kind: {
      wiggle: {
        "&:hover": { animation: "icon-anim-wiggle 0.4s ease" },
      },
      pop: {
        "&:hover": { animation: "icon-anim-pop 0.3s ease" },
      },
      jump: {
        "&:hover": { animation: "icon-anim-jump 0.3s ease" },
      },
      spin: {
        "&:hover": { animation: "icon-anim-spin 0.3s ease" },
      },
      bounce: {
        "&:hover": { animation: "icon-anim-bounce 0.3s ease" },
      },
    },
  },
});
