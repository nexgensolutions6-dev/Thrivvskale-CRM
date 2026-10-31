/**
 * The glass tokens the menu bar's text sits on. Over the live-blur L1 surface the
 * dark theme falls below 4.5:1 on bright wallpaper regions, so every label lives
 * on an opaque chip (the L2 solid fill) with the primary text token. Named here so
 * tests/unit/menu-bar-contrast.test.ts checks the same tokens MenuBar.tsx uses.
 */
export const MENU_BAR_TEXT_TOKEN = '--glass-text'
export const MENU_BAR_CHIP_FILL_TOKEN = '--glass-l2-solid'
