/**
 * Copying text to the clipboard, with the old way as a fallback.
 *
 * Some webviews — WebKitGTK on Linux among them — refuse the clipboard API
 * outside a few narrow conditions. Falling back to a hidden textarea and
 * `execCommand` keeps copying working there rather than failing silently.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Falls through to the older approach below.
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  // Off-screen rather than hidden: a display:none element can't be selected.
  scratch.style.position = "fixed";
  scratch.style.top = "-9999px";
  scratch.style.opacity = "0";
  scratch.setAttribute("readonly", "");
  document.body.appendChild(scratch);
  scratch.select();
  try {
    document.execCommand("copy");
  } finally {
    scratch.remove();
  }
}
