// Runs before the first paint so the window doesn't flash the wrong colours.
//
// A separate file rather than an inline script because the app's content
// policy refuses inline scripts: that refusal is the point, and this is the
// one piece of Mari's own code that would otherwise need an exception.
(function () {
  var stored = localStorage.getItem("mari-theme");
  var theme =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
})();
