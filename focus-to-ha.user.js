// ==UserScript==
// @name         Focus → Home Assistant
// @namespace    home-assistant-focus
// @version      1.2
// @description  Rapporte le domaine de l'onglet au premier plan à Home Assistant
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      example.com
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // --- Config (la seule chose à changer par personne) ---------------------
  // NB: la valeur @connect ci-dessus doit correspondre à CONFIG.host.
  const CONFIG = {
    host: "example.com",
    webhookId: "someRandomWebhookId",
    token: "verysecuretoken",
    heartbeatMs: 25000,
  };

  const ENDPOINT = `https://${CONFIG.host}/api/webhook/${CONFIG.webhookId}`;

  // --- Lecture de l'état courant ------------------------------------------
  function readFocus() {
    const visible = document.visibilityState === "visible";
    return {
      domain: location.hostname,
      focused: visible && document.hasFocus(),
      visible: visible,
    };
  }

  // --- Envoi à Home Assistant ---------------------------------------------
  function post(focus) {
    GM_xmlhttpRequest({
      method: "POST",
      url: ENDPOINT,
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": CONFIG.token,
      },
      data: JSON.stringify({ domain: focus.domain, focused: focus.focused }),
      onload: (r) =>
        console.log("[focus→HA]", r.status, focus.domain, focus.focused),
      onerror: (e) => console.log("[focus→HA] ERREUR réseau", e),
    });
  }

  let lastSent = null;

  // Émet uniquement quand l'état réel change (focus, onglet, navigation)
  function reportIfChanged() {
    const focus = readFocus();
    const key = focus.domain + "|" + focus.focused;
    if (key === lastSent) return;
    lastSent = key;
    post(focus);
  }

  // Battement régulier, mais seulement depuis l'onglet visible
  // (un onglet caché n'écrase pas l'onglet au premier plan)
  function heartbeat() {
    const focus = readFocus();
    if (!focus.visible) return;
    lastSent = focus.domain + "|" + focus.focused;
    post(focus);
  }

  // --- Branchements --------------------------------------------------------
  window.addEventListener("focus", reportIfChanged, true);
  window.addEventListener("blur", reportIfChanged, true);
  window.addEventListener("pageshow", reportIfChanged, true);
  document.addEventListener("visibilitychange", reportIfChanged, true);

  setInterval(heartbeat, CONFIG.heartbeatMs);
  heartbeat();
})();
