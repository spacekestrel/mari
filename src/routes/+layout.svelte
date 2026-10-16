<script lang="ts">
  // Self-hosted so the editor looks the same regardless of what's installed on
  // the OS (Georgia, for instance, isn't present on most Linux systems). All
  // five options users can pick from Settings are loaded upfront so switching
  // is instant — see src/lib/fonts.ts for the catalog.
  import "@fontsource/literata/300.css";
  import "@fontsource/literata/300-italic.css";
  import "@fontsource/literata/600.css";
  import "@fontsource/literata/700.css";
  import "@fontsource/lora/400.css";
  import "@fontsource/lora/400-italic.css";
  import "@fontsource/lora/600.css";
  import "@fontsource/lora/700.css";
  import "@fontsource/merriweather/300.css";
  import "@fontsource/merriweather/300-italic.css";
  import "@fontsource/merriweather/600.css";
  import "@fontsource/merriweather/700.css";
  import "@fontsource/eb-garamond/400.css";
  import "@fontsource/eb-garamond/400-italic.css";
  import "@fontsource/eb-garamond/600.css";
  import "@fontsource/eb-garamond/700.css";
  import "@fontsource/source-serif-4/300.css";
  import "@fontsource/source-serif-4/300-italic.css";
  import "@fontsource/source-serif-4/600.css";
  import "@fontsource/source-serif-4/700.css";
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
