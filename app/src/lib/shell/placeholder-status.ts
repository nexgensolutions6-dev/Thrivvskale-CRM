/**
 * What is still made up in the menu bar. Today's targets are real now (see
 * lib/scoreboard); only the sync chip is still a sample, because there is no
 * sync status source yet. While SYNC_IS_PLACEHOLDER is true the sync chip shows
 * a "sample" tag and a hollow dot. Set it to false when a real sync status
 * exists. Used by MenuBar only.
 */

/** True while the sync chip is a made-up value. */
export const SYNC_IS_PLACEHOLDER = true

export const PLACEHOLDER_NOTE = 'sample'

export const PLACEHOLDER_SYNC = { label: 'Synced' }
