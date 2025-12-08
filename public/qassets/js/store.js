 console.log('[Store.js loaded');
(function () {
  // runs only on store pages because we add it only for the store branch
  const CFG = (window.STORE_PAGE || {});
  console.log('[store] store.js loaded for', CFG.slug, CFG.store);

  // example: add a body class so you can target styles
  document.documentElement.classList.add('store-route');

  // example hook: if you render a hero title in StoreClient with id="store-title"
  const title = document.getElementById('store-title');
  if (title && CFG.store && CFG.store.name) {
    title.textContent = CFG.store.name;
  }
})();






