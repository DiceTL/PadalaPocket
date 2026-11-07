import './camera.css';

export function createCameraButton({ onPhoto, onError }) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'camera-trigger'; button.textContent = 'Take a photo';
  button.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const picker = document.createElement('input');
      picker.type = 'file'; picker.accept = 'image/jpeg,image/png'; picker.setAttribute('capture', 'environment');
      picker.addEventListener('change', () => { if (picker.files[0]) onPhoto(picker.files[0]); });
      picker.click();
      return;
    }
    const dialog = document.createElement('dialog'); dialog.className = 'photo-camera';
    dialog.setAttribute('aria-labelledby', 'photo-camera-title');
    dialog.innerHTML = '<header><h2 id="photo-camera-title">Take a product photo</h2><button type="button" class="camera-close" autofocus>Close camera</button></header><p>Keep the item in frame and make sure it is well lit.</p><video autoplay playsinline muted></video><p class="camera-status" role="status">Opening camera…</p><button type="button" class="camera-capture" disabled>Use this photo</button>';
    const video = dialog.querySelector('video'), capture = dialog.querySelector('.camera-capture'), status = dialog.querySelector('.camera-status');
    let stream;
    const stop = () => { stream?.getTracks().forEach(track => track.stop()); video.srcObject = null; };
    const close = () => dialog.close();
    const fail = message => { stop(); status.textContent = message; capture.disabled = true; onError?.(message); };
    dialog.querySelector('.camera-close').addEventListener('click', close);
    dialog.addEventListener('close', () => { stop(); window.removeEventListener('pagehide', stop); dialog.remove(); if (button.isConnected) button.focus(); }, { once: true });
    window.addEventListener('pagehide', stop);
    document.body.append(dialog); dialog.showModal();
    capture.addEventListener('click', () => {
      if (!video.videoWidth) return;
      capture.disabled = true;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!dialog.open) return;
        if (!blob || blob.size > 2 * 1024 * 1024) { fail('Could not prepare a photo under 2 MiB. Close the camera and choose a smaller photo.'); return; }
        close(); onPhoto(new File([blob], 'product-photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', .85);
    });
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!dialog.open) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; video.srcObject = stream; await video.play();
      if (!dialog.open) { stop(); return; }
      capture.disabled = false; status.textContent = 'Ready. Capture when the item is clear.';
    } catch (error) {
      if (dialog.open) fail(error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or close this and choose a photo.' : 'Could not open a camera. Check that it is connected and available, or choose a photo instead.');
    }
  });
  return button;
}
