(() => {
  const skins = ['hadoop', 'classroom', 'focus', 'topology'];
  let selected = 'hadoop';
  try {
    const saved = localStorage.getItem('hadoopSim.skin');
    if (skins.includes(saved)) selected = saved;
  } catch {
    // Storage may be unavailable; the default still renders every page.
  }
  document.documentElement.dataset.skin = selected;
  if (document.documentElement.dataset.page !== 'home') return;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('[data-skin-select]');
    if (!select) return;
    for (const skin of skins) {
      select.add(new Option(skin[0].toUpperCase() + skin.slice(1), skin));
    }
    select.value = selected;
    select.addEventListener('change', () => {
      if (!skins.includes(select.value)) return;
      document.documentElement.dataset.skin = select.value;
      try {
        localStorage.setItem('hadoopSim.skin', select.value);
      } catch {
        // Without storage this choice lasts for the current homepage only.
      }
    });
  });
})();
