<script lang="ts">
  import { renderMarkdown } from "$lib/markdownHtml";

  interface Props {
    text: string;
  }

  let { text }: Props = $props();

  const html = $derived(renderMarkdown(text));
</script>

<div class="preview">
  <div class="page">
    {@html html}
  </div>
</div>

<style>
  .preview {
    height: 100%;
    overflow: auto;
  }

  .page {
    max-width: 66ch;
    margin: 0 auto;
    padding: 4rem 1rem;
    font-family: var(--font-prose);
    font-weight: var(--font-prose-weight);
    font-size: 1.15rem;
    line-height: 1.75;
    color: var(--color-text);
  }

  .page :global(h1),
  .page :global(h2),
  .page :global(h3),
  .page :global(h4) {
    font-weight: 600;
    line-height: 1.3;
    margin: 1.5em 0 0.6em;
  }

  .page :global(h1) {
    font-size: 1.6em;
  }

  .page :global(h2) {
    font-size: 1.35em;
  }

  .page :global(h3) {
    font-size: 1.15em;
  }

  .page :global(p) {
    margin: 0 0 1.2em;
  }

  .page :global(strong) {
    font-weight: 700;
  }

  .page :global(em) {
    font-style: italic;
  }

  .page :global(blockquote) {
    margin: 1.5em 0;
    padding-left: 1em;
    border-left: 3px solid var(--color-border);
    color: var(--color-text-muted);
    font-style: italic;
  }

  .page :global(blockquote p:last-child) {
    margin-bottom: 0;
  }

  .page :global(a) {
    color: var(--color-accent);
    text-decoration: underline;
  }

  .page :global(ul),
  .page :global(ol) {
    margin: 0 0 1.2em;
    padding-left: 1.4em;
  }

  .page :global(li) {
    margin: 0.3em 0;
  }

  .page :global(hr) {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 2.5em auto;
    width: 4em;
  }

  .page :global(code) {
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
    background: var(--color-hover);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }

  .page :global(pre) {
    background: var(--color-hover);
    padding: 1em;
    border-radius: var(--radius);
    overflow-x: auto;
  }

  .page :global(pre code) {
    background: none;
    padding: 0;
  }

  .page :global(img) {
    max-width: 100%;
    border-radius: var(--radius);
  }
</style>
