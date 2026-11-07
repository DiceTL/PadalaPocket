// Licensed illustrative photo only. Never use this static URL for private purchase uploads.
export function createSamplePhoto({ title, available }) {
  const photo = document.createElement(available ? 'button' : 'span');
  photo.className = 'parent-activity-photo';
  if (!available) { photo.textContent = 'No sample photo'; return photo; }
  photo.type = 'button'; photo.setAttribute('aria-label', 'View Bookstore sample photo');
  const image = document.createElement('img'); image.src = '/demo-photos/spiral-notebooks.jpg'; image.alt = 'Spiral notebooks, illustrative sample photo'; image.width = 88; image.height = 72;
  photo.append(image);
  photo.addEventListener('click', () => {
    const dialog = document.createElement('dialog'); dialog.className = 'activity-photo-dialog'; dialog.setAttribute('aria-label', 'Bookstore sample photo');
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close photo'; close.className = 'parent-secondary'; close.addEventListener('click', () => dialog.close());
    const fullImage = image.cloneNode(); fullImage.removeAttribute('width'); fullImage.removeAttribute('height');
    const heading = document.createElement('h2'); heading.textContent = title;
    const caption = document.createElement('p'); caption.textContent = 'Illustrative sample photo. Not a student upload or payment confirmation.';
    const credit = document.createElement('a'); credit.href = 'https://commons.wikimedia.org/wiki/File:Spiral-bound_notebooks.JPG'; credit.textContent = 'Photo: Mk2010 · CC BY-SA 3.0';
    const license = document.createElement('a'); license.href = 'https://creativecommons.org/licenses/by-sa/3.0/'; license.textContent = 'View license';
    dialog.append(close, heading, fullImage, caption, credit, document.createTextNode(' · '), license);
    dialog.addEventListener('close', () => { dialog.remove(); photo.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
  });
  return photo;
}
