import profile from "./profile.json";

/** Brand and sizes from the organization profile (written by lib/apply-profile.mjs). */
export const ACCENT: string = profile.colors.accent;
/** The accent as "r,g,b" for rgba() strings. */
export const ACCENT_RGB: string = profile.colors.accentRgb;
export const DARK: string = profile.colors.dark;
export const LIGHT: string = profile.colors.light;
export const STAGE: string = profile.colors.stage;
export const PRODUCT_NAME: string = profile.product.name;
export const TAGLINE: string = profile.product.tagline ?? "";
export const WINDOW_TITLE: string = profile.product.windowTitle;
export const LOGO: { src: string; aspect: number } | null = profile.logo;
export const PHONE_ASPECT: number = profile.phoneScreen.width / profile.phoneScreen.height;
export const STILL_ASPECT: number = profile.stillViewport.width / profile.stillViewport.height;
export const BPM: number = profile.bpm;

/** Every layout is designed for 1920x1080 at 30 fps. */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** 5% title-safe margins at 1080p. */
export const SAFE_X = 96;
export const SAFE_Y = 54;
