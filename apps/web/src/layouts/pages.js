import './pages.css';
import { parentPages, mountParentPages } from './parent-pages.js';
import { createCameraButton } from '../views/camera.js';
import { createSamplePhoto } from './sample-photo.js';

const templates = import.meta.glob('./*.html', { query: '?raw', import: 'default', eager: true });
export const layoutPages = [
  ['sign-in', 'Sign in'], ['home', 'Student Home'], ['parent', 'Parent overview'], ['approvals', 'Approvals'],
  ['pay', 'Pay a seller'], ['purchase-status', 'Purchase status'], ['savings', 'Savings'],
  ['my-money', 'My Money'], ['recap', 'Week-end recap'], ['withdrawal', 'Withdrawal and payout'],
  ['parent-rules', 'Parent · Allowance rules'], ['parent-activity', 'Parent · Activity'],
  ['parent-savings', 'Parent · Savings'], ['parent-deposit', 'Parent · Deposit'],
];
const mobilePages = new Set(['sign-in', 'home', 'pay', 'purchase-status', 'savings', 'my-money', 'recap']);
const routes = { Home: 'home', Activity: 'purchase-status', Savings: 'savings', 'My Money': 'my-money', Overview: 'parent', Approvals: 'approvals' };

export function requestedLayout() {
  return new URLSearchParams(location.search).get('layout');
}

export function renderLayoutPage(root) {
  const requested = requestedLayout();
  if (requested === null) return false;
  const page = layoutPages.some(([key]) => key === requested) ? requested : 'parent';
  const title = layoutPages.find(([key]) => key === page)[1];
  document.title = `${title} · PadalaPocket layouts`;
  const gallery = document.createElement('div');
  gallery.className = 'layout-gallery';
  gallery.innerHTML = `<header class="layout-toolbar"><a href="/">Open app</a><label for="layout-selector">Layouts</label><select id="layout-selector"></select><span>Sample preview · no account data or transactions</span></header><main class="layout-canvas ${mobilePages.has(page) ? 'layout-mobile' : 'layout-desktop'}" aria-label="${title}"></main><p class="layout-feedback" role="status" aria-live="polite" hidden></p>`;
  const selector = gallery.querySelector('select');
  for (const [key, label] of layoutPages) selector.add(new Option(label, key, false, key === page));
  selector.addEventListener('change', () => { location.search = `?layout=${selector.value}`; });
  const canvas = gallery.querySelector('main');
  canvas.dataset.page = page;
  // Only trusted, committed HTML templates enter this boundary. User input uses DOM properties.
  canvas.innerHTML = templates[`./${page}.html`];
  if (page === 'purchase-status') {
    for (const summary of canvas.querySelectorAll('[data-name="Purchase summary"]')) {
      const title = summary.textContent.trim().replace(/\s+/g, ' ');
      const row = document.createElement('div'); row.className = 'student-activity-photo';
      const available = title.startsWith('Bookstore');
      const caption = document.createElement('p'); caption.textContent = available ? 'Item photo · illustrative sample. Tap to enlarge.' : 'No picture supplied for this sample entry.';
      row.append(createSamplePhoto({ title, available }), caption); summary.after(row);
    }
  }
  if (mobilePages.has(page) && page !== 'sign-in') {
    canvas.querySelector('[data-name="Student navigation"], .home-navigation')?.remove();
    const navigation = document.createElement('nav');
    navigation.className = 'layout-student-nav';
    navigation.setAttribute('aria-label', 'Student navigation');
    const brand = document.createElement('strong');
    brand.className = 'layout-student-brand'; brand.textContent = 'PadalaPocket'; navigation.append(brand);
    for (const [destination, label] of [['home', 'Home'], ['pay', 'Pay a seller'], ['purchase-status', 'Activity'], ['savings', 'Savings'], ['my-money', 'My Money'], ['recap', 'Week-end recap']]) {
      const link = document.createElement('a'); link.href = `?layout=${destination}`; link.textContent = label;
      if (destination === page) link.setAttribute('aria-current', 'page');
      navigation.append(link);
    }
    canvas.prepend(navigation);
  }
  const feedback = gallery.querySelector('.layout-feedback');
  const explain = (message) => { feedback.hidden = false; feedback.textContent = message; };
  mountParentPages(canvas, page, explain);
  const sampleAction = () => explain('This is a layout preview. This action is not connected; no request, payment or transfer was made.');
  const replaceControl = (node, tag) => {
    const control = document.createElement(tag);
    for (const attribute of node.attributes) control.setAttribute(attribute.name, attribute.value);
    control.innerHTML = node.innerHTML;
    node.replaceWith(control);
    return control;
  };
  for (const node of canvas.querySelectorAll('[data-name="Action"], [data-name="Navigation item"], [data-name="Student navigation"] > p')) {
    const label = node.textContent.trim().replace(/\s+/g, ' ');
    const destination = (parentPages.some(([key]) => key === page) && label === 'Deposit funds' ? 'parent-deposit' : null) || routes[label] || (label === 'Review' ? 'approvals' : label === 'Pay a seller from My Money' ? 'pay' : null);
    const control = replaceControl(node, destination ? 'a' : 'button');
    if (destination) control.href = `?layout=${destination}`;
    else {
      control.type = 'button';
      control.addEventListener('click', label === 'Sign in' ? () => { location.href = '/'; } : sampleAction);
    }
    control.classList.add('layout-control');
    control.querySelectorAll('p').forEach(p => replaceControl(p, 'span'));
  }
  for (const [index, node] of [...canvas.querySelectorAll('[data-name="Input"]')].entries()) {
    const text = node.textContent.trim();
    const input = document.createElement('input');
    input.className = 'layout-input';
    input.id = `layout-input-${index}`;
    const isEmail = node.parentElement.dataset.name === 'Email field';
    const isPassword = node.parentElement.dataset.name === 'Password field';
    input.type = isPassword ? 'password' : isEmail ? 'email' : 'text';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', isEmail ? 'Sample email' : isPassword ? 'Sample password' : page === 'savings' ? 'Sample release amount in pesos' : 'Sample price in pesos');
    if (!isEmail && !isPassword) input.inputMode = 'decimal';
    input.placeholder = text;
    node.replaceChildren(input);
  }
  const choose = [...canvas.querySelectorAll('button')].find(b => b.textContent.trim() === 'Take or choose');
  if (choose) {
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/png,image/jpeg'; file.hidden = true;
    choose.after(file);
    const pick = () => file.click();
    choose.replaceWith(choose.cloneNode(true));
    const newChoose = [...canvas.querySelectorAll('button')].find(b => b.textContent.trim() === 'Take or choose');
    newChoose.textContent = 'Choose a photo';
    newChoose.addEventListener('click', pick);
    const showPhoto = photo => {
      if (!photo) return;
      if (!['image/jpeg', 'image/png'].includes(photo.type) || photo.size > 2 * 1024 * 1024) { explain('Choose a PNG or JPEG up to 2 MiB.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const slot = canvas.querySelector('[data-photo-preview], [data-name="Product photo label"]') || [...canvas.querySelectorAll('p')].find(p => p.textContent.trim() === 'Product photo');
        if (slot) { slot.dataset.photoPreview = ''; const image = document.createElement('img'); image.src = reader.result; image.alt = 'Selected product preview'; image.className = 'layout-photo'; slot.replaceChildren(image); }
        explain('Photo selected locally for preview. It was not uploaded or sent to AI. The AI card still shows Figma sample content.');
      };
      reader.readAsDataURL(photo);
    };
    file.addEventListener('change', () => showPhoto(file.files[0]));
    newChoose.before(createCameraButton({ onPhoto: showPhoto, onError: explain }));
    const fallback = document.createElement('p'); fallback.className = 'photo-fallback-note';
    fallback.textContent = 'Take a photo of the item. If the camera does not work during the demo, choose a photo instead.';
    canvas.querySelector('[data-name="Product photo placeholder"]').append(fallback);
  }
  root.replaceChildren(gallery);
  return true;
}
