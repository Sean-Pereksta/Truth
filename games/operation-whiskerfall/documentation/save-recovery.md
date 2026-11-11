# Saving and recovering a campaign · 1.7.1

Open Camp and choose **Save campaign**. The status below the campaign report shows the saved time and one of these outcomes:

- **Saved in this browser:** the game wrote the current campaign and read the same data back successfully.
- **Only in this tab:** permanent browser storage rejected the write. Continue and Export still use the newer session copy. Open **Settings → Export campaign** before closing the game. Session storage provides additional same-tab reload recovery when the browser permits it, but an exported file is the independent backup.
- **Save failed:** the current snapshot could not be saved safely. The previous valid save remains intact. Keep the current game open and retry; the game will not report success or leave for the title after this failure.
- **Recovered previous save:** the newest stored copy could not be read, so the game found an older valid backup. The displayed time identifies that recovered copy.

Save & return to title saves first. Continue restores the selected slot; a failed Continue never creates a replacement campaign. A new campaign still requires the existing overwrite confirmation when the selected slot is occupied.

During play, **Settings → Export campaign** captures the current progress. From the title it exports the selected slot's newest valid copy. **Settings → Import campaign** accepts both existing raw backups and wrapped campaign backups. It checks the file before writing the selected slot. A backup is portable; the game's asset folder is not a backup of browser-stored campaign progress.

## An older game is still open

Files installed on disk do not change JavaScript already running in an open page. If that old page contains progress you need to keep, its old Settings export may suffer from the stale-save bug. The existing game's direct export method captures its current live campaign instead: open the browser's developer console and enter `OW.game.exportSave()`. Save the downloaded JSON, then reload the updated game and import that backup. This method does not change your campaign or clear browser storage. If the old page has already closed, progress that existed only in its memory cannot be recovered from that page.

## What changed

Before 1.7.1, storage write errors were caught and the new save was retained only in memory, but reads always preferred an older disk copy. Continue, slot details, and Export could therefore disagree with the progress just saved. Two UI handlers also appended a success message without checking the save result, and failed Continue could fall through to new-game creation.

Version 1.7.1 compares timestamps across validated primary, previous, session and memory copies; checks serialization and read-back before declaring permanent success; keeps per-slot status; and preserves campaign state on failed Continue. It retains the original `whiskerfall.save.v1.*` keys and version-1 backup format. It cannot force a browser to allow permanent storage when the browser rejects it.
