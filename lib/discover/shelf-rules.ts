/**
 * Render rules a shelf must satisfy to appear on /discover.
 *
 * Extracted so the admin editor and the renderer read the same number. A
 * curator publishing a three-pick shelf and finding a blank space on /discover,
 * with nothing anywhere saying why, is the failure this constant exists to make
 * impossible — admin warns using the same threshold the renderer enforces.
 */

/** Below this many in-stock picks, PersonaShelf renders nothing at all. */
export const MIN_ITEMS = 4;
