/**
 * `isWorkspaceAudioPath`: true when a voice-note storage path sits inside the
 * given workspace's folder ("<workspaceId>/...") and has no "." or ".." step.
 * storagePath is member-written metadata, so removeErasedAudio checks it
 * before deleting, even though erase_contact already filters by the prefix.
 */

export function isWorkspaceAudioPath(workspaceId: string, path: string): boolean {
  const prefix = `${workspaceId}/`
  if (!path.startsWith(prefix)) return false
  const steps = path.slice(prefix.length).split('/')
  return steps.every((step) => step !== '' && step !== '.' && step !== '..')
}
