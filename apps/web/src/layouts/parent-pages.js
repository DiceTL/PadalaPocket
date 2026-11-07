import './parent-pages.css';
import { createSamplePhoto } from './sample-photo.js';

export const parentPages = [
  ['parent', 'Overview'], ['parent-rules', 'Allowance rules'], ['approvals', 'Approvals'],
  ['parent-activity', 'Activity'], ['parent-savings', 'Savings'], ['parent-deposit', 'Deposit'],
];

export function mountParentPages(canvas, page, explain) {
  if (!parentPages.some(([key]) => key === page)) return;
  canvas.classList.add('layout-parent');
  canvas.querySelector('[data-name="Parent sidebar"]')?.remove();
  const navigation = document.createElement('nav');
  navigation.className = 'parent-navigation'; navigation.setAttribute('aria-label', 'Parent navigation');
  navigation.innerHTML = '<strong>PadalaPocket</strong><div class="parent-child"><span>CHILD · SAMPLE PROFILE</span><b>Mia, 14</b></div>';
  for (const [key, label] of parentPages) {
    const link = document.createElement('a'); link.href = `?layout=${key}`; link.textContent = label;
    if (key === 'approvals') { const count = document.createElement('span'); count.className = 'parent-count'; count.textContent = '2'; link.append(count); }
    if (key === page) link.setAttribute('aria-current', 'page');
    navigation.append(link);
  }
  const note = document.createElement('p'); note.textContent = 'Sample preview. No account changes.'; navigation.append(note);
  canvas.prepend(navigation);

  const rules = canvas.querySelector('#parent-rules-form');
  const categoryGroups = canvas.querySelector('#parent-category-groups');
  const categories = ['Meals', 'Snacks and sweets', 'Drinks', 'School supplies', 'Books and learning materials', 'Toys and collectibles'];
  if (categoryGroups) for (const bucket of ['Needs', 'Wants']) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = `${bucket} · allowed categories`; group.append(legend);
    for (const [index, category] of categories.entries()) {
      const label = document.createElement('label'), checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.name = `${bucket.toLowerCase()}Categories`; checkbox.value = category;
      checkbox.defaultChecked = bucket === 'Needs' ? [0, 3, 4].includes(index) : [1, 2, 5].includes(index);
      label.append(checkbox, document.createTextNode(category)); group.append(label);
    }
    categoryGroups.append(group);
  }
  rules?.addEventListener('submit', event => {
    event.preventDefault();
    if (!rules.reportValidity()) return;
    const values = new FormData(rules);
    const weekly = Number(values.get('weekly')), needs = Number(values.get('needs'));
    const output = canvas.querySelector('#parent-rules-result');
    output.textContent = `Preview updated: ₱${(weekly * needs / 100).toFixed(2)} Needs, ₱${(weekly * (100 - needs) / 100).toFixed(2)} Wants. Purchase cap: ₱${Number(values.get('cap')).toFixed(2)}. Needs categories: ${values.getAll('needsCategories').join(', ') || 'None selected'}. Wants categories: ${values.getAll('wantsCategories').join(', ') || 'None selected'}. Changes apply to this preview only and reset when you leave.`;
    output.hidden = false;
  });
  canvas.querySelector('#parent-rules-reset')?.addEventListener('click', () => { canvas.querySelector('#parent-rules-result').hidden = true; });
  canvas.querySelector('#parent-activity-filter')?.addEventListener('change', event => {
    for (const row of canvas.querySelectorAll('[data-activity-bucket]')) row.hidden = event.target.value !== 'all' && row.dataset.activityBucket !== event.target.value;
  });
  for (const row of canvas.querySelectorAll('[data-activity-bucket]')) {
    const merchant = row.querySelector('h3').textContent;
    row.prepend(createSamplePhoto({ title: 'Bookstore · ₱240 · Checking payment', available: merchant === 'Bookstore' }));
  }
  for (const button of canvas.querySelectorAll('[data-parent-preview-action]')) button.addEventListener('click', () => explain('This is a sample request. Decisions are not connected here, and no funds were moved.'));
}
