/* Shared site behavior: sidebar toggle, tabs, highlight.js init */
document.addEventListener("DOMContentLoaded", function () {
  if (window.hljs) {
    document.querySelectorAll("pre code").forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  const toggle = document.querySelector(".sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  document.querySelectorAll(".tabs").forEach((tabsEl) => {
    const buttons = tabsEl.querySelectorAll(".tab-btn");
    const panels = tabsEl.querySelectorAll(".tab-panel");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = tabsEl.querySelector('.tab-panel[data-tab="' + btn.dataset.tab + '"]');
        if (target) target.classList.add("active");
      });
    });
  });

  // Gate buttons wired to a Bloch sphere instance stored on window by id
  document.querySelectorAll("[data-bloch-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-bloch-target");
      const gate = btn.getAttribute("data-gate");
      const instance = window.__blochInstances && window.__blochInstances[targetId];
      if (!instance) return;
      if (gate === "RESET") instance.reset();
      else instance.applyGate(gate);
    });
  });
});
