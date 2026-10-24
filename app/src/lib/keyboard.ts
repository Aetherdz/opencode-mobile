import { Keyboard, Platform } from 'react-native';

/**
 * Best-effort IME teardown before an overlay closes or a route changes.
 *
 * Android keeps the IME (and the window insets it drives) attached when the
 * focused input unmounts inside a lingering Modal, which leaves taps dead and
 * the layout pushed up. Dismissing explicitly first — before the sheet starts
 * its exit animation — avoids that residue. iOS tolerates the same call, and
 * `blurOnSubmit`-style focus races disappear because the keyboard is already
 * down when the overlay unmounts. Safe to call when nothing is focused.
 */
export function dismissKeyboard(): void {
  if (Platform.OS === 'web') return;
  Keyboard.dismiss();
}
