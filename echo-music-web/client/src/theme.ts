export type ThemeMode = "dark" | "light" | "system";
export type ThemePresetId =
  | "echo-amoled"
  | "midnight-blue"
  | "pure-black"
  | "graphite"
  | "ocean"
  | "lavender"
  | "emerald"
  | "sunset"
  | "minimal-light";

export type PaletteKey =
  | "mainBackground"
  | "secondaryBackground"
  | "tertiaryBackground"
  | "elevatedBackground"
  | "cardBackground"
  | "elevatedCard"
  | "inputBackground"
  | "navigationBackground"
  | "miniPlayerBackground"
  | "accentPrimary"
  | "accentSecondary"
  | "accentHover"
  | "accentMuted"
  | "textPrimary"
  | "textSecondary"
  | "textMuted"
  | "textDisabled"
  | "textInverted"
  | "borderDefault"
  | "borderStrong"
  | "borderGlass"
  | "success"
  | "warning"
  | "error"
  | "information"
  | "buttonBackground"
  | "buttonText"
  | "iconColor"
  | "borderColor";

export type ThemePalette = Record<PaletteKey, string>;

export type AppearanceSettings = {
  schemaVersion: 1;
  mode: ThemeMode;
  presetId: ThemePresetId | "custom";
  palettes: {
    dark: ThemePalette;
    light: ThemePalette;
  };
  glass: {
    intensity: "off" | "low" | "medium" | "high";
    blur: number;
    transparency: number;
    borderOpacity: number;
    shadowIntensity: number;
  };
  interface: {
    cornerRadius: "sharp" | "rounded" | "extra-rounded";
    density: "compact" | "comfortable" | "spacious";
    fontSize: "small" | "medium" | "large";
    iconSize: "small" | "medium" | "large";
    animationIntensity: "off" | "low" | "medium" | "high";
    reducedMotion: boolean;
  };
  navigation: {
    appearance: "floating" | "solid" | "transparent";
    sidebarAppearance: "glass" | "solid" | "transparent";
    mobileAppearance: "floating" | "solid" | "transparent";
    compact: boolean;
  };
  player: {
    appearance: "glass" | "solid" | "transparent";
    artworkEffect: boolean;
    cornerRadius: number;
    height: number;
    showProgress: boolean;
    showDuration: boolean;
    showVolume: boolean;
  };
};

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  description: string;
  dark: ThemePalette;
  light: ThemePalette;
};

export const APPEARANCE_STORAGE_KEY = "echo-appearance-v1";
export const SAVED_THEMES_STORAGE_KEY = "echo-saved-themes-v1";

const BASE_DARK: ThemePalette = {
  mainBackground: "#0D0E12",
  secondaryBackground: "#111318",
  tertiaryBackground: "#16191E",
  elevatedBackground: "#1C2027",
  cardBackground: "#16191E",
  elevatedCard: "#202630",
  inputBackground: "#1C2027",
  navigationBackground: "#16191E",
  miniPlayerBackground: "#1C2027",
  accentPrimary: "#405572",
  accentSecondary: "#526B8F",
  accentHover: "#60799F",
  accentMuted: "#405572",
  textPrimary: "#DEE0EC",
  textSecondary: "#A5A9B5",
  textMuted: "#858A96",
  textDisabled: "#626875",
  textInverted: "#FFFFFF",
  borderDefault: "#D2DCF0",
  borderStrong: "#D2DCF0",
  borderGlass: "#DCE1F0",
  success: "#62B58A",
  warning: "#D9A65B",
  error: "#D66B7B",
  information: "#6B9BC9",
  buttonBackground: "#405572",
  buttonText: "#FFFFFF",
  iconColor: "#A5A9B5",
  borderColor: "#D2DCF0",
};

const BASE_LIGHT: ThemePalette = {
  mainBackground: "#F5F7FA",
  secondaryBackground: "#EDF0F5",
  tertiaryBackground: "#E5E9F0",
  elevatedBackground: "#FFFFFF",
  cardBackground: "#FFFFFF",
  elevatedCard: "#F7F9FC",
  inputBackground: "#EDF0F5",
  navigationBackground: "#E9EDF3",
  miniPlayerBackground: "#FFFFFF",
  accentPrimary: "#405572",
  accentSecondary: "#526B8F",
  accentHover: "#344761",
  accentMuted: "#405572",
  textPrimary: "#202633",
  textSecondary: "#444D5B",
  textMuted: "#626B79",
  textDisabled: "#929AA6",
  textInverted: "#FFFFFF",
  borderDefault: "#526079",
  borderStrong: "#3D4A60",
  borderGlass: "#526079",
  success: "#26714D",
  warning: "#81520F",
  error: "#A63246",
  information: "#285B8A",
  buttonBackground: "#405572",
  buttonText: "#FFFFFF",
  iconColor: "#444D5B",
  borderColor: "#526079",
};

const accentVariants: Record<string, [string, string, string]> = {
  "#405572": ["#526B8F", "#60799F", "#405572"],
  "#547DAE": ["#7097C7", "#8AAEDB", "#547DAE"],
  "#818C9C": ["#9AA6B5", "#B0BAC6", "#818C9C"],
  "#168C95": ["#26A9B0", "#49C0C4", "#168C95"],
  "#8D6BCC": ["#A384E0", "#BBA3EC", "#8D6BCC"],
  "#378A68": ["#4AA77E", "#68BE96", "#378A68"],
  "#C16B45": ["#D7895F", "#E6A17D", "#C16B45"],
  "#F05263": ["#F36D7A", "#F58994", "#F05263"],
  "#D36E38": ["#E78A53", "#F0A575", "#D36E38"],
};

function makePalette(
  overrides: Partial<ThemePalette> & Pick<ThemePalette, "mainBackground" | "secondaryBackground" | "tertiaryBackground" | "elevatedBackground" | "cardBackground" | "elevatedCard" | "inputBackground" | "navigationBackground" | "miniPlayerBackground" | "accentPrimary" | "textPrimary" | "textSecondary" | "textMuted">,
): ThemePalette {
  const [accentSecondary, accentHover, accentMuted] = accentVariants[overrides.accentPrimary.toUpperCase()] ?? [
    "#7389AA",
    "#8CA1C0",
    overrides.accentPrimary,
  ];
  return {
    ...BASE_DARK,
    accentSecondary,
    accentHover,
    accentMuted,
    buttonBackground: overrides.accentPrimary,
    ...overrides,
  };
}

function lightPalette(accent: string, accentSecondary: string, accentHover: string): ThemePalette {
  return { ...BASE_LIGHT, accentPrimary: accent, accentSecondary, accentHover, accentMuted: accent, buttonBackground: accent };
}

function preset(
  id: ThemePresetId,
  name: string,
  description: string,
  dark: ThemePalette,
): ThemePreset {
  return {
    id,
    name,
    description,
    dark,
    light: lightPalette(dark.accentPrimary, dark.accentSecondary, dark.accentHover),
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  preset("echo-amoled", "Echo AMOLED", "Steel blue on true AMOLED charcoal.", BASE_DARK),
  preset("midnight-blue", "Midnight Blue", "Deep navy surfaces with cool blue accents.", makePalette({
    mainBackground: "#080D16", secondaryBackground: "#0D1420", tertiaryBackground: "#121C2B",
    elevatedBackground: "#192538", cardBackground: "#121C2B", elevatedCard: "#202F45",
    inputBackground: "#192538", navigationBackground: "#111B2B", miniPlayerBackground: "#18263A",
    accentPrimary: "#547DAE", textPrimary: "#DFE9F7", textSecondary: "#AABAD0", textMuted: "#8294AC",
  })),
  preset("pure-black", "Pure Black", "OLED-black surfaces with crisp silver text.", makePalette({
    mainBackground: "#000000", secondaryBackground: "#050505", tertiaryBackground: "#0B0B0C",
    elevatedBackground: "#141516", cardBackground: "#08090A", elevatedCard: "#191A1C",
    inputBackground: "#141516", navigationBackground: "#090A0B", miniPlayerBackground: "#151617",
    accentPrimary: "#A0B8DE", textPrimary: "#F2F4F8", textSecondary: "#C2C7D0", textMuted: "#9096A1",
    borderDefault: "#AEB8C8", borderStrong: "#D0D7E1", borderGlass: "#C4CEDD", borderColor: "#AEB8C8",
    buttonBackground: "#536C91", buttonText: "#FFFFFF", iconColor: "#C2C7D0",
  })),
  preset("graphite", "Graphite", "Balanced graphite layers with restrained silver.", makePalette({
    mainBackground: "#101214", secondaryBackground: "#15181B", tertiaryBackground: "#1B1F23",
    elevatedBackground: "#24292F", cardBackground: "#1A1E22", elevatedCard: "#2A3037",
    inputBackground: "#23282E", navigationBackground: "#1A1E22", miniPlayerBackground: "#24292F",
    accentPrimary: "#818C9C", textPrimary: "#E2E5E9", textSecondary: "#B0B6BF", textMuted: "#8C939D",
  })),
  preset("ocean", "Ocean", "Blue-green accents over cool ocean depths.", makePalette({
    mainBackground: "#071114", secondaryBackground: "#0B191D", tertiaryBackground: "#102328",
    elevatedBackground: "#173039", cardBackground: "#102328", elevatedCard: "#1B3942",
    inputBackground: "#173039", navigationBackground: "#0E2025", miniPlayerBackground: "#173039",
    accentPrimary: "#168C95", textPrimary: "#DDF2F1", textSecondary: "#A6CFCE", textMuted: "#79AAA9",
  })),
  preset("lavender", "Lavender", "Soft violet accents with cool slate surfaces.", makePalette({
    mainBackground: "#100E18", secondaryBackground: "#171420", tertiaryBackground: "#1F1A2B",
    elevatedBackground: "#2A2339", cardBackground: "#1F1A2B", elevatedCard: "#332B45",
    inputBackground: "#2A2339", navigationBackground: "#201B2D", miniPlayerBackground: "#2A2339",
    accentPrimary: "#8D6BCC", textPrimary: "#EEE8F8", textSecondary: "#C6B9DC", textMuted: "#9E8EB8",
  })),
  preset("emerald", "Emerald", "Emerald highlights over forest-green charcoal.", makePalette({
    mainBackground: "#0A110E", secondaryBackground: "#101914", tertiaryBackground: "#16221B",
    elevatedBackground: "#202E25", cardBackground: "#16221B", elevatedCard: "#26372C",
    inputBackground: "#202E25", navigationBackground: "#152019", miniPlayerBackground: "#202E25",
    accentPrimary: "#378A68", textPrimary: "#E1F0E7", textSecondary: "#B4D1BE", textMuted: "#88A995",
  })),
  preset("sunset", "Sunset", "Warm coral and amber on dark plum.", makePalette({
    mainBackground: "#160D12", secondaryBackground: "#1D1218", tertiaryBackground: "#281820",
    elevatedBackground: "#35212A", cardBackground: "#281820", elevatedCard: "#402832",
    inputBackground: "#35212A", navigationBackground: "#24171E", miniPlayerBackground: "#35212A",
    accentPrimary: "#C16B45", textPrimary: "#F5E9E3", textSecondary: "#D5B9AC", textMuted: "#AC8D81",
  })),
  preset("minimal-light", "Minimal Light", "A clean, low-glare light interface.", makePalette({
    mainBackground: "#101419", secondaryBackground: "#171C22", tertiaryBackground: "#1F252D",
    elevatedBackground: "#292F37", cardBackground: "#1F252D", elevatedCard: "#303740",
    inputBackground: "#292F37", navigationBackground: "#1A2026", miniPlayerBackground: "#292F37",
    accentPrimary: "#D36E38", textPrimary: "#E7EAF0", textSecondary: "#BEC4CE", textMuted: "#979EAA",
  })),
].map(item => item.id === "minimal-light"
  ? { ...item, light: { ...BASE_LIGHT, accentPrimary: "#405572", accentSecondary: "#526B8F", accentHover: "#344761", buttonBackground: "#405572" } }
  : item);

export const COLOR_FIELDS: Array<{ key: PaletteKey; label: string }> = [
  { key: "mainBackground", label: "Main background" },
  { key: "secondaryBackground", label: "Secondary background" },
  { key: "cardBackground", label: "Card background" },
  { key: "elevatedCard", label: "Elevated surface" },
  { key: "textPrimary", label: "Primary text" },
  { key: "textSecondary", label: "Secondary text" },
  { key: "textMuted", label: "Muted text" },
  { key: "accentPrimary", label: "Accent colour" },
  { key: "buttonBackground", label: "Button background" },
  { key: "buttonText", label: "Button text" },
  { key: "iconColor", label: "Icon colour" },
  { key: "borderColor", label: "Border colour" },
  { key: "inputBackground", label: "Input background" },
  { key: "navigationBackground", label: "Navigation background" },
  { key: "miniPlayerBackground", label: "Mini-player background" },
];

export const ACCENT_CHOICES = [
  { id: "steel-blue", label: "Steel Blue", color: "#405572" },
  { id: "red", label: "Red", color: "#D94E5D" },
  { id: "purple", label: "Purple", color: "#8D6BCC" },
  { id: "emerald", label: "Emerald", color: "#378A68" },
  { id: "cyan", label: "Cyan", color: "#168C95" },
  { id: "orange", label: "Orange", color: "#D36E38" },
  { id: "pink", label: "Pink", color: "#C4518A" },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  schemaVersion: 1,
  mode: "dark",
  presetId: "echo-amoled",
  palettes: {
    dark: { ...BASE_DARK },
    light: { ...BASE_LIGHT },
  },
  glass: { intensity: "medium", blur: 24, transparency: 18, borderOpacity: 20, shadowIntensity: 30 },
  interface: {
    cornerRadius: "rounded",
    density: "comfortable",
    fontSize: "medium",
    iconSize: "medium",
    animationIntensity: "medium",
    reducedMotion: false,
  },
  navigation: { appearance: "floating", sidebarAppearance: "solid", mobileAppearance: "floating", compact: false },
  player: { appearance: "glass", artworkEffect: true, cornerRadius: 18, height: 74, showProgress: true, showDuration: true, showVolume: true },
};

const paletteKeys = Object.keys(BASE_DARK) as PaletteKey[];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}

function normalizePalette(value: unknown, fallback: ThemePalette): ThemePalette {
  const input = isRecord(value) ? value : {};
  return Object.fromEntries(paletteKeys.map(key => [
    key,
    typeof input[key] === "string" && isHexColor(input[key] as string) ? input[key] as string : fallback[key],
  ])) as ThemePalette;
}

export function validateAppearanceSettings(value: unknown): AppearanceSettings {
  const input = isRecord(value) ? value : {};
  const presetId = enumValue(input.presetId, THEME_PRESETS.map(item => item.id), DEFAULT_APPEARANCE.presetId as ThemePresetId);
  const selectedPreset = THEME_PRESETS.find(item => item.id === presetId) ?? THEME_PRESETS[0];
  const palettes = isRecord(input.palettes) ? input.palettes : {};
  const glass = isRecord(input.glass) ? input.glass : {};
  const appearance = isRecord(input.interface) ? input.interface : {};
  const navigation = isRecord(input.navigation) ? input.navigation : {};
  const player = isRecord(input.player) ? input.player : {};
  return {
    schemaVersion: 1,
    mode: enumValue(input.mode, ["dark", "light", "system"] as const, DEFAULT_APPEARANCE.mode),
    presetId: input.presetId === "custom" ? "custom" : presetId,
    palettes: {
      dark: normalizePalette(palettes.dark, selectedPreset.dark),
      light: normalizePalette(palettes.light, selectedPreset.light),
    },
    glass: {
      intensity: enumValue(glass.intensity, ["off", "low", "medium", "high"] as const, DEFAULT_APPEARANCE.glass.intensity),
      blur: numberInRange(glass.blur, DEFAULT_APPEARANCE.glass.blur, 0, 40),
      transparency: numberInRange(glass.transparency, DEFAULT_APPEARANCE.glass.transparency, 0, 80),
      borderOpacity: numberInRange(glass.borderOpacity, DEFAULT_APPEARANCE.glass.borderOpacity, 5, 50),
      shadowIntensity: numberInRange(glass.shadowIntensity, DEFAULT_APPEARANCE.glass.shadowIntensity, 0, 80),
    },
    interface: {
      cornerRadius: enumValue(appearance.cornerRadius, ["sharp", "rounded", "extra-rounded"] as const, DEFAULT_APPEARANCE.interface.cornerRadius),
      density: enumValue(appearance.density, ["compact", "comfortable", "spacious"] as const, DEFAULT_APPEARANCE.interface.density),
      fontSize: enumValue(appearance.fontSize, ["small", "medium", "large"] as const, DEFAULT_APPEARANCE.interface.fontSize),
      iconSize: enumValue(appearance.iconSize, ["small", "medium", "large"] as const, DEFAULT_APPEARANCE.interface.iconSize),
      animationIntensity: enumValue(appearance.animationIntensity, ["off", "low", "medium", "high"] as const, DEFAULT_APPEARANCE.interface.animationIntensity),
      reducedMotion: typeof appearance.reducedMotion === "boolean" ? appearance.reducedMotion : DEFAULT_APPEARANCE.interface.reducedMotion,
    },
    navigation: {
      appearance: enumValue(navigation.appearance, ["floating", "solid", "transparent"] as const, DEFAULT_APPEARANCE.navigation.appearance),
      sidebarAppearance: enumValue(navigation.sidebarAppearance, ["glass", "solid", "transparent"] as const, DEFAULT_APPEARANCE.navigation.sidebarAppearance),
      mobileAppearance: enumValue(navigation.mobileAppearance, ["floating", "solid", "transparent"] as const, DEFAULT_APPEARANCE.navigation.mobileAppearance),
      compact: typeof navigation.compact === "boolean" ? navigation.compact : DEFAULT_APPEARANCE.navigation.compact,
    },
    player: {
      appearance: enumValue(player.appearance, ["glass", "solid", "transparent"] as const, DEFAULT_APPEARANCE.player.appearance),
      artworkEffect: typeof player.artworkEffect === "boolean" ? player.artworkEffect : DEFAULT_APPEARANCE.player.artworkEffect,
      cornerRadius: numberInRange(player.cornerRadius, DEFAULT_APPEARANCE.player.cornerRadius, 0, 36),
      height: numberInRange(player.height, DEFAULT_APPEARANCE.player.height, 60, 110),
      showProgress: typeof player.showProgress === "boolean" ? player.showProgress : DEFAULT_APPEARANCE.player.showProgress,
      showDuration: typeof player.showDuration === "boolean" ? player.showDuration : DEFAULT_APPEARANCE.player.showDuration,
      showVolume: typeof player.showVolume === "boolean" ? player.showVolume : DEFAULT_APPEARANCE.player.showVolume,
    },
  };
}

export function loadAppearanceSettings(storage: Pick<Storage, "getItem"> = localStorage): AppearanceSettings {
  try {
    const stored = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored) return validateAppearanceSettings(JSON.parse(stored) as unknown);
    const legacyMode = storage.getItem("echo-theme");
    if (legacyMode === "light") return { ...DEFAULT_APPEARANCE, mode: "light" };
    return { ...DEFAULT_APPEARANCE, palettes: { dark: { ...BASE_DARK }, light: { ...BASE_LIGHT } } };
  } catch (error) {
    console.warn("Could not load Echo appearance settings; using defaults.", error);
    return { ...DEFAULT_APPEARANCE, palettes: { dark: { ...BASE_DARK }, light: { ...BASE_LIGHT } } };
  }
}

export function loadSavedThemes(storage: Pick<Storage, "getItem"> = localStorage): Array<{ name: string; settings: AppearanceSettings }> {
  try {
    const stored = storage.getItem(SAVED_THEMES_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(entry => {
      if (!isRecord(entry) || typeof entry.name !== "string" || !entry.name.trim() || !isRecord(entry.settings)) return [];
      return [{ name: entry.name.trim().slice(0, 48), settings: validateAppearanceSettings(entry.settings) }];
    }).slice(0, 12);
  } catch (error) {
    console.warn("Could not load saved Echo themes.", error);
    return [];
  }
}

function rgb(hex: string) {
  const value = hex.slice(1);
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16)).join(", ");
}

function radiusFor(value: AppearanceSettings["interface"]["cornerRadius"]) {
  return value === "sharp" ? 8 : value === "extra-rounded" ? 26 : 18;
}

function applyProperty(style: CSSStyleDeclaration, name: string, value: string) {
  style.setProperty(name, value);
}

export function applyAppearanceSettings(
  settings: AppearanceSettings,
  options: { systemDark: boolean; systemReducedMotion: boolean; root?: HTMLElement },
) {
  const root = options.root ?? document.documentElement;
  const resolvedMode = settings.mode === "system" ? options.systemDark ? "dark" : "light" : settings.mode;
  const colors = settings.palettes[resolvedMode];
  const style = root.style;
  const transparency = (100 - settings.glass.transparency) / 100;
  const borderOpacity = settings.glass.borderOpacity / 100;
  const blur = settings.glass.intensity === "off" ? 0 : settings.glass.blur;
  const radius = radiusFor(settings.interface.cornerRadius);
  const density = settings.interface.density === "compact" ? 8 : settings.interface.density === "spacious" ? 20 : 13;
  const fontSize = settings.interface.fontSize === "small" ? 14 : settings.interface.fontSize === "large" ? 17 : 15;
  const iconScale = settings.interface.iconSize === "small" ? 0.85 : settings.interface.iconSize === "large" ? 1.2 : 1;
  const motionDuration = settings.interface.animationIntensity === "off" || settings.interface.reducedMotion || options.systemReducedMotion
    ? 0
    : settings.interface.animationIntensity === "low" ? 100 : settings.interface.animationIntensity === "high" ? 260 : 180;
  const shadowOpacity = settings.glass.shadowIntensity / 100;
  const playerAlpha = settings.player.appearance === "transparent" ? 0.28 : transparency;
  const navigationAlpha = settings.navigation.appearance === "transparent" ? 0.3 : transparency;

  const cssColors: Record<string, string> = {
    "--app-bg": colors.mainBackground,
    "--app-bg-secondary": colors.secondaryBackground,
    "--app-bg-tertiary": colors.tertiaryBackground,
    "--app-bg-elevated": colors.elevatedBackground,
    "--surface": colors.cardBackground,
    "--surface-card": colors.cardBackground,
    "--surface-2": colors.elevatedCard,
    "--surface-input": colors.inputBackground,
    "--muted": colors.textMuted,
    "--text-primary": colors.textPrimary,
    "--text-secondary": colors.textSecondary,
    "--text-disabled": colors.textDisabled,
    "--text-inverted": colors.textInverted,
    "--accent": colors.accentPrimary,
    "--accent-secondary": colors.accentSecondary,
    "--accent-hover": colors.accentHover,
    "--accent-muted": `rgba(${rgb(colors.accentMuted)}, .25)`,
    "--button-background": colors.buttonBackground,
    "--button-text": colors.buttonText,
    "--icon-color": colors.iconColor,
    "--line": `rgba(${rgb(colors.borderDefault)}, ${borderOpacity})`,
    "--line-strong": `rgba(${rgb(colors.borderStrong)}, ${Math.min(1, borderOpacity + 0.12)})`,
    "--line-glass": `rgba(${rgb(colors.borderGlass)}, ${Math.min(1, borderOpacity + 0.08)})`,
    "--success": colors.success,
    "--warning": colors.warning,
    "--error": colors.error,
    "--information": colors.information,
    "--navigation-solid": colors.navigationBackground,
    "--player-solid": colors.miniPlayerBackground,
    "--navigation-glass": `rgba(${rgb(colors.navigationBackground)}, ${navigationAlpha})`,
    "--player-glass": `rgba(${rgb(colors.miniPlayerBackground)}, ${playerAlpha})`,
    "--glass-blur": `${blur}px`,
    "--shadow-opacity": `${shadowOpacity}`,
    "--card-radius": `${radius}px`,
    "--button-radius": `${radiusFor(settings.interface.cornerRadius) - 6}px`,
    "--player-radius": `${settings.player.cornerRadius}px`,
    "--player-height": `${settings.player.height}px`,
    "--density-gap": `${density}px`,
    "--density-padding": `${density}px`,
    "--font-size": `${fontSize}px`,
    "--icon-scale": `${iconScale}`,
    "--transition-duration": `${motionDuration}ms`,
    "--highlight-rgb": rgb(colors.textPrimary),
    "--overlay-background": `rgba(${rgb(colors.mainBackground)}, .72)`,
    "--warning-surface": `rgba(${rgb(colors.warning)}, .12)`,
    "--error-surface": `rgba(${rgb(colors.error)}, .14)`,
    "--success-surface": `rgba(${rgb(colors.success)}, .12)`,
  };
  for (const [name, value] of Object.entries(cssColors)) applyProperty(style, name, value);

  root.dataset.theme = resolvedMode;
  root.dataset.glass = settings.glass.intensity;
  root.dataset.density = settings.interface.density;
  root.dataset.corners = settings.interface.cornerRadius;
  root.dataset.motion = settings.interface.animationIntensity;
  root.dataset.reducedMotion = String(settings.interface.reducedMotion || options.systemReducedMotion);
  root.style.colorScheme = resolvedMode;
  return resolvedMode;
}

function channel(hex: string, index: number) {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(first: string, second: string) {
  if (!isHexColor(first) || !isHexColor(second)) return 1;
  const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function setPreset(settings: AppearanceSettings, presetId: ThemePresetId): AppearanceSettings {
  const selected = THEME_PRESETS.find(item => item.id === presetId) ?? THEME_PRESETS[0];
  return {
    ...settings,
    presetId,
    palettes: { dark: { ...selected.dark }, light: { ...selected.light } },
  };
}

export function setAccent(settings: AppearanceSettings, color: string): AppearanceSettings {
  if (!isHexColor(color)) return settings;
  const upper = color.toUpperCase();
  const [secondary, hover] = accentVariants[upper] ?? [color, color, color];
  const update = (palette: ThemePalette): ThemePalette => ({
    ...palette,
    accentPrimary: color,
    accentSecondary: secondary,
    accentHover: hover,
    accentMuted: color,
    buttonBackground: color,
  });
  return {
    ...settings,
    presetId: "custom",
    palettes: { dark: update(settings.palettes.dark), light: update(settings.palettes.light) },
  };
}
