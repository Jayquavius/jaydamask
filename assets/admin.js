const API_URL = 'https://api.github.com/repos/Jayquavius/jaydamask/contents/_data/artworks.json';
let accessToken = '';
let fileSha = '';
let savedDetails = {};
let selectedWork = null;
let isDirty = false;

const loginPanel = document.querySelector('#login-panel');
const editorPanel = document.querySelector('#editor-panel');
const loginForm = document.querySelector('#login-form');
const artworkForm = document.querySelector('#artwork-form');
const bodyEditor = document.querySelector('#work-body');

function setMessage(id, message, error = false) {
  const element = document.querySelector(id);
  element.textContent = message;
  element.classList.toggle('is-error', error);
}

function decodeBase64Utf8(value) {
  const bytes = Uint8Array.from(atob(value.replace(/\s/g, '')), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...options.headers
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    let message = `GitHub returned ${response.status}.`;
    try { message = (await response.json()).message || message; } catch (_) { /* Keep status. */ }
    throw new Error(message);
  }
  return response.json();
}

function renderList() {
  const list = document.querySelector('#admin-list');
  list.replaceChildren();
  document.querySelector('#admin-no-images').hidden = artworks.length > 0;
  artworks.forEach((work) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-work-item';
    button.dataset.filename = work.filename;
    const image = document.createElement('img');
    image.src = work.src;
    image.alt = '';
    const text = document.createElement('span');
    text.textContent = savedDetails[work.filename]?.title || titleFromFilename(work.filename);
    button.append(image, text);
    button.addEventListener('click', () => selectWork(work));
    list.append(button);
  });
  if (artworks.length) selectWork(artworks[0]);
}

function selectWork(work) {
  if (isDirty && !window.confirm('Discard unsaved changes to this artwork?')) return;
  selectedWork = work;
  isDirty = false;
  const data = savedDetails[work.filename] || {};
  document.querySelector('#selected-image').src = work.src;
  document.querySelector('#selected-image').alt = data.title || titleFromFilename(work.filename);
  document.querySelector('#selected-filename').textContent = work.filename;
  document.querySelector('#view-work').href = workUrl(work);
  document.querySelector('#work-title').value = data.title || titleFromFilename(work.filename);
  document.querySelector('#work-year').value = data.year || '';
  document.querySelector('#work-medium').value = data.medium || '';
  document.querySelector('#work-dimensions').value = data.dimensions || '';
  bodyEditor.innerHTML = sanitizeRichHtml(data.body || (data.description ? `<p>${escapeHtml(data.description)}</p>` : ''));
  artworkForm.hidden = false;
  document.querySelectorAll('.admin-work-item').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.filename === work.filename);
  });
  setMessage('#save-message', '');
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  accessToken = document.querySelector('#access-token').value.trim();
  const button = document.querySelector('#login-button');
  button.disabled = true;
  setMessage('#login-message', 'Connecting to GitHub…');
  try {
    await githubRequest('https://api.github.com/user');
    const file = await githubRequest(API_URL);
    if (file.encoding !== 'base64') throw new Error('The artwork data file is too large for this editor.');
    savedDetails = JSON.parse(decodeBase64Utf8(file.content));
    if (!savedDetails || Array.isArray(savedDetails) || typeof savedDetails !== 'object') throw new Error('Artwork data must be a JSON object.');
    fileSha = file.sha;
    document.querySelector('#access-token').value = '';
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    renderList();
  } catch (error) {
    accessToken = '';
    setMessage('#login-message', `Could not open editor: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', () => {
  accessToken = '';
  fileSha = '';
  savedDetails = {};
  selectedWork = null;
  isDirty = false;
  artworkForm.hidden = true;
  editorPanel.hidden = true;
  loginPanel.hidden = false;
  setMessage('#login-message', 'Logged out.');
});

artworkForm.addEventListener('input', () => { isDirty = true; });
artworkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedWork || !accessToken) return;
  const button = document.querySelector('#save-button');
  button.disabled = true;
  setMessage('#save-message', 'Saving to GitHub…');
  const filename = selectedWork.filename;
  const nextDetails = { ...savedDetails };
  nextDetails[filename] = {
    title: document.querySelector('#work-title').value.trim() || titleFromFilename(filename),
    year: document.querySelector('#work-year').value.trim(),
    medium: document.querySelector('#work-medium').value.trim(),
    dimensions: document.querySelector('#work-dimensions').value.trim(),
    body: sanitizeRichHtml(bodyEditor.innerHTML)
  };
  try {
    const result = await githubRequest(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Update artwork details for ${filename}`,
        content: encodeBase64Utf8(JSON.stringify(nextDetails, null, 2) + '\n'),
        sha: fileSha
      })
    });
    fileSha = result.content.sha;
    savedDetails = nextDetails;
    isDirty = false;
    document.querySelector('.admin-work-item.is-selected span').textContent = nextDetails[filename].title;
    setMessage('#save-message', 'Saved. The public page will update after GitHub Pages rebuilds.');
  } catch (error) {
    const conflict = /409|sha|conflict/i.test(error.message);
    setMessage('#save-message', conflict ? 'This file changed on GitHub. Reload the editor and try again.' : `Save failed: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('.editor-toolbar button').forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    bodyEditor.focus();
    if (button.dataset.command === 'createLink') {
      const href = window.prompt('Link URL (https://...)');
      if (!href) return;
      try {
        const url = new URL(href);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error();
        document.execCommand('createLink', false, url.href);
      } catch (_) { setMessage('#save-message', 'Enter a valid https:// link.', true); }
    } else {
      document.execCommand(button.dataset.command, false, button.dataset.value || null);
    }
    isDirty = true;
  });
});

bodyEditor.addEventListener('paste', (event) => {
  event.preventDefault();
  const html = event.clipboardData.getData('text/html');
  const plain = event.clipboardData.getData('text/plain');
  if (html) document.execCommand('insertHTML', false, sanitizeRichHtml(html));
  else document.execCommand('insertText', false, plain);
  isDirty = true;
});
