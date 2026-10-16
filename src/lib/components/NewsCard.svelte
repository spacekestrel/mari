<script lang="ts">
  /**
   * Mari's news, at the foot of the sidebar.
   *
   * Deliberately the quietest thing on screen: a card the size of two lines,
   * no colour fighting the prose, and an X that puts it away for good. Nobody
   * opened a writing app to be sold to, and a message that can't be dismissed
   * is one more reason to stop opening it.
   *
   * The words come from a file on the website, so they have never been read by
   * anyone here. They are drawn as text and nothing else — no markup, and a
   * link only if it was plain https.
   */
  import Icon from "./Icon.svelte";
  import { appNews } from "$lib/appNews.svelte";
  import { i18n } from "$lib/i18n.svelte";
  import { isTauriDesktop } from "$lib/platform/os";

  const message = $derived(appNews.current);
  const link = $derived(message?.link ?? null);

  /** Out to the system browser: a link should never replace the editor. */
  async function follow(url: string) {
    try {
      if (isTauriDesktop()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (reason) {
      console.error(`Couldn't open ${url}`, reason);
    }
  }
</script>

{#if message}
  <aside class="news">
    <button
      class="hide"
      onclick={() => appNews.close(message.id)}
      title={i18n.t.news.close}
      aria-label={i18n.t.news.close}
    >
      <Icon name="x" size={11} />
    </button>
    <p class="title">{message.title}</p>
    <p class="body">{message.body}</p>
    {#if link}
      <button class="link" onclick={() => follow(link.url)}>{link.label}</button>
    {/if}
  </aside>
{/if}

<style>
  /* Sticks to the bottom of the sidebar rather than sitting below the last
     chapter, so a long book doesn't hide it and a short one doesn't leave it
     floating in the middle. */
  .news {
    position: sticky;
    bottom: 0;
    flex-shrink: 0;
    margin: var(--space-2);
    margin-bottom: 0;
    padding: var(--space-2);
    padding-right: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
  }

  .title {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
  }

  .body {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .link {
    margin-top: var(--space-1);
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.75rem;
    color: var(--color-accent);
    cursor: pointer;
    text-align: left;
  }

  .link:hover {
    text-decoration: underline;
  }

  /* Faint until wanted: present enough that the card is obviously closable,
     quiet enough that it isn't the brightest thing in the sidebar. */
  .hide {
    position: absolute;
    top: 3px;
    right: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    opacity: 0.6;
    cursor: pointer;
  }

  .hide:hover {
    background: var(--color-hover);
    opacity: 1;
  }
</style>
