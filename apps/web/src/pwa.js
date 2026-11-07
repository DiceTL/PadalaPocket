export function setupPwa() {
  const panel = document.createElement('aside');
  panel.className = 'pwa-tools';
  panel.setAttribute('aria-label', 'App installation and connection');
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  const install = document.createElement('button');
  install.type = 'button';
  install.className = 'button button-secondary';
  install.textContent = 'Install app';
  const help = document.createElement('p');
  help.hidden = true;
  const instructions = 'On iPhone or iPad: open in Safari, tap Share, then Add to Home Screen. On other browsers, look for Install app or Add to Home Screen in the browser menu.';
  help.textContent = instructions;
  const update = document.createElement('p');
  update.hidden = true;
  update.setAttribute('role', 'status');
  update.textContent = 'An app update is ready. Finish your current action, then close all PadalaPocket windows and reopen the app.';
  const displayMode = matchMedia('(display-mode: standalone)');
  const standalone = () => displayMode.matches || navigator.standalone === true;
  const syncPanel = () => { panel.hidden = [...panel.children].every(child => child.hidden); };
  let installed = false;
  let prompt;
  const refresh = () => {
    notice.hidden = navigator.onLine;
    notice.textContent = 'You’re offline. Balances may be outdated. Payments and approvals require a connection; check any interrupted action after reconnecting.';
    install.hidden = installed || standalone();
    if (installed || standalone()) help.hidden = true;
    syncPanel();
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  if (displayMode.addEventListener) displayMode.addEventListener('change', refresh);
  else displayMode.addListener(refresh);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
    help.hidden = true;
    refresh();
  });
  window.addEventListener('appinstalled', () => { installed = true; prompt = null; refresh(); });
  install.addEventListener('click', async () => {
    if (!prompt) { help.textContent = instructions; help.hidden = !help.hidden; syncPanel(); return; }
    const pending = prompt;
    prompt = null;
    install.disabled = true;
    try {
      await pending.prompt();
      await pending.userChoice;
    } catch {
      help.textContent = 'The installation prompt could not open. ' + instructions;
      help.hidden = false;
    } finally {
      install.disabled = false;
      syncPanel();
    }
  });
  panel.append(notice, install, help, update);
  document.body.prepend(panel);
  refresh();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      const showUpdate = () => {
        if (!registration.waiting || !navigator.serviceWorker.controller) return;
        update.hidden = false;
        syncPanel();
      };
      showUpdate();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', showUpdate);
      });
    }).catch(() => {
      // Online use remains available if installation/offline support is blocked.
      help.hidden = false;
      help.textContent = 'Offline support could not be enabled. You can continue using PadalaPocket online.';
      syncPanel();
    });
  }
}
