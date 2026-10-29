const API_URL = 'https://api.github.com/repos/Jayquavius/jaydamask/contents/_data/artworks.json';
let accessToken = '';
let fileSha = '';
let savedDetails = {};
let selectedWork = null;
let isDirty = false;
let savingSelection = false;
let savingDetails = false;
let deletingWork = false;
let publicationCheck = 0;

const loginPanel = document.querySelector('#login-panel');
const editorPanel = document.querySelector('#editor-panel');
const loginForm = document.querySelector('#login-form');
const artworkForm = document.querySelector('#artwork-form');
const bodyEditor = document.querySelector('#work-body');
const uploadInput = document.querySelector('#upload-files');
let uploadFiles = [];
let uploading = false;

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
    const image = workMedia(work, '', true);
    const text = document.createElement('span');
    text.textContent = savedDetails[work.filename]?.title || titleFromFilename(work.filename);
    button.append(image, text);
    button.addEventListener('click', () => selectWork(work));
    list.append(button);
  });
  if (artworks.length) selectWork(artworks[0]);
}

function selectWork(work) {
  if (savingSelection || savingDetails || deletingWork) return;
  if (isDirty && !window.confirm('Discard unsaved changes to this artwork?')) return;
  selectedWork = work;
  isDirty = false;
  const data = savedDetails[work.filename] || {};
  document.querySelector('#selected-media').replaceChildren(workMedia(work, data.title || titleFromFilename(work.filename), true));
  document.querySelector('#selected-filename').textContent = work.filename;
  document.querySelector('#view-work').href = workUrl(work);
  document.querySelector('#work-title').value = data.title || titleFromFilename(work.filename);
  document.querySelector('#work-year').value = data.year || '';
  document.querySelector('#work-medium').value = data.medium || '';
  document.querySelector('#work-dimensions').value = data.dimensions || '';
  document.querySelector('#work-selected').checked = data.selected !== false;
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

async function waitForPublication(filename, expected, checkId, selectionOnly = false) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (checkId !== publicationCheck) return;
    try {
      const response = await fetch(`/assets/artworks.json?v=${Date.now()}-${attempt}`, { cache: 'no-store' });
      if (response.ok) {
        const published = (await response.json())[filename] || {};
        if (Object.entries(expected).every(([key, value]) => published[key] === value)) {
          if (selectedWork?.filename === filename) {
            if (selectionOnly) {
              setMessage('#save-message', 'Selection published. Refresh the home page to see it.');
            } else {
              document.querySelector('#view-work').href = workUrl(selectedWork) + '&updated=' + Date.now();
              setMessage('#save-message', 'Published. Open “View page” to see the updated text.');
            }
          }
          return;
        }
      }
    } catch (_) { /* The site may still be rebuilding. */ }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (checkId === publicationCheck && selectedWork?.filename === filename) {
    setMessage('#save-message', 'Saved to GitHub. The public site is still rebuilding; check the page shortly.');
  }
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
    showAdminPage();
  } catch (error) {
    accessToken = '';
    setMessage('#login-message', `Could not open editor: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', () => {
  if (uploading || deletingWork) return;
  publicationCheck++;
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

function showAdminPage() {
  const upload = location.hash === '#upload';
  document.querySelector('#details-page').hidden = upload;
  document.querySelector('#upload-page').hidden = !upload;
  document.querySelector('#details-tab').classList.toggle('is-current', !upload);
  document.querySelector('#upload-tab').classList.toggle('is-current', upload);
  document.querySelector('#editor-heading').textContent = upload ? 'Add new work' : 'Artwork details';
}
window.addEventListener('hashchange', showAdminPage);

const uploadExtensions = /\.(avif|gif|jpe?g|png|webp|mp4|webm|mov)$/i;
const maxUploadBytes = 90 * 1024 * 1024;

function safeFilename(name) {
  const match = name.match(uploadExtensions);
  if (!match) throw new Error(`${name}: unsupported file type.`);
  const extension = match[0].toLowerCase();
  const stem = name.slice(0, -match[0].length).normalize('NFKC')
    .replace(/[^a-zA-Z0-9._ -]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 100);
  return (stem || 'untitled') + extension;
}

function renderUploadList() {
  const list = document.querySelector('#upload-list');
  list.replaceChildren();
  uploadFiles.forEach((file, index) => {
    const row = document.createElement('li');
    const preview = document.createElement('span');
    preview.className = 'upload-preview';
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file);
      image.alt = '';
      image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
      preview.append(image);
    } else {
      preview.textContent = '▶';
    }
    const text = document.createElement('span');
    text.className = 'upload-file-name';
    text.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Remove';
    remove.disabled = uploading;
    remove.addEventListener('click', () => {
      uploadFiles.splice(index, 1);
      renderUploadList();
    });
    row.append(preview, text, remove);
    list.append(row);
  });
  document.querySelector('#upload-button').disabled = uploading || !uploadFiles.length;
}

uploadInput.addEventListener('change', () => {
  const incoming = Array.from(uploadInput.files);
  uploadInput.value = '';
  const invalid = incoming.find((file) => !uploadExtensions.test(file.name) || !file.size || file.size > maxUploadBytes);
  if (invalid) {
    const reason = !uploadExtensions.test(invalid.name) ? 'is not a supported image or video' : !invalid.size ? 'is empty' : 'exceeds 90 MB';
    setMessage('#upload-message', `${invalid.name} ${reason}.`, true);
    return;
  }
  uploadFiles.push(...incoming);
  setMessage('#upload-message', '');
  renderUploadList();
});

async function encodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

async function waitForUploadedFiles(filenames) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`/assets/site.js?v=${Date.now()}-${attempt}`, { cache: 'no-store' });
      if (response.ok) {
        const script = await response.text();
        if (filenames.every((name) => script.includes(JSON.stringify(name)))) {
          setMessage('#upload-message', `Published ${filenames.length} file${filenames.length === 1 ? '' : 's'}. View the gallery. Reload this editor to add details for the new work.`);
          return;
        }
      }
    } catch (_) { /* The site may still be rebuilding. */ }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  setMessage('#upload-message', 'Saved to GitHub. The public site is still rebuilding; check the gallery shortly.');
}

document.querySelector('#upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!accessToken || !uploadFiles.length || uploading || deletingWork) return;
  uploading = true;
  const files = [...uploadFiles];
  uploadInput.disabled = true;
  document.querySelector('#logout-button').disabled = true;
  renderUploadList();
  const base = 'https://api.github.com/repos/Jayquavius/jaydamask';
  try {
    setMessage('#upload-message', 'Checking the repository…');
    const ref = await githubRequest(`${base}/git/ref/heads/main`);
    const commit = await githubRequest(`${base}/git/commits/${ref.object.sha}`);
    const existingTree = await githubRequest(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
    if (existingTree.truncated) throw new Error('The repository file list is incomplete. Try uploading through GitHub instead.');
    const used = new Set(existingTree.tree.filter((item) => item.path.startsWith('art/')).map((item) => item.path.slice(4).toLowerCase()));
    const planned = files.map((file) => {
      const original = safeFilename(file.name);
      const extension = original.match(/\.[^.]+$/)[0];
      const stem = original.slice(0, -extension.length);
      let filename = original;
      let suffix = 2;
      while (used.has(filename.toLowerCase())) filename = `${stem}-${suffix++}${extension}`;
      used.add(filename.toLowerCase());
      return { file, filename };
    });
    const tree = [];
    for (const [index, item] of planned.entries()) {
      setMessage('#upload-message', `Uploading ${index + 1} of ${planned.length}: ${item.filename}…`);
      const content = await encodeFile(item.file);
      const blob = await githubRequest(`${base}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, encoding: 'base64' })
      });
      tree.push({ path: `art/${item.filename}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
    setMessage('#upload-message', 'Publishing the batch…');
    const nextTree = await githubRequest(`${base}/git/trees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: commit.tree.sha, tree })
    });
    const nextCommit = await githubRequest(`${base}/git/commits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Add ${planned.length} portfolio file${planned.length === 1 ? '' : 's'}`, tree: nextTree.sha, parents: [ref.object.sha] })
    });
    await githubRequest(`${base}/git/refs/heads/main`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: nextCommit.sha, force: false })
    });
    uploadFiles = [];
    renderUploadList();
    setMessage('#upload-message', 'Saved to GitHub. Waiting for the gallery to update…');
    waitForUploadedFiles(planned.map((item) => item.filename));
  } catch (error) {
    setMessage('#upload-message', `Upload failed: ${error.message}`, true);
  } finally {
    uploading = false;
    uploadInput.disabled = false;
    document.querySelector('#logout-button').disabled = false;
    renderUploadList();
  }
});

artworkForm.addEventListener('input', (event) => {
  if (event.target.id !== 'work-selected') isDirty = true;
});
document.querySelector('#work-selected').addEventListener('change', async (event) => {
  if (!selectedWork || !accessToken || savingSelection || savingDetails || deletingWork) return;
  const checkbox = event.currentTarget;
  const filename = selectedWork.filename;
  const selected = checkbox.checked;
  savingSelection = true;
  checkbox.disabled = true;
  document.querySelector('#save-button').disabled = true;
  document.querySelector('#logout-button').disabled = true;
  setMessage('#save-message', 'Saving selection to GitHub…');
  const nextDetails = { ...savedDetails, [filename]: { ...savedDetails[filename], selected } };
  try {
    const result = await githubRequest(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${selected ? 'Select' : 'Deselect'} ${filename} for the home gallery`,
        content: encodeBase64Utf8(JSON.stringify(nextDetails, null, 2) + '\n'),
        sha: fileSha
      })
    });
    fileSha = result.content.sha;
    savedDetails = nextDetails;
    try {
      const key = 'jaydamask-selected-works';
      const overrides = JSON.parse(localStorage.getItem(key) || '{}');
      overrides[filename] = { selected, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(overrides));
    } catch (_) { /* The selection is still saved on GitHub if storage is unavailable. */ }
    setMessage('#save-message', 'Selection saved. Waiting for the home page to update…');
    waitForPublication(filename, { selected }, ++publicationCheck, true);
  } catch (error) {
    checkbox.checked = savedDetails[filename]?.selected !== false;
    const conflict = /409|sha|conflict/i.test(error.message);
    setMessage('#save-message', conflict ? 'This file changed on GitHub. Reload the editor and try again.' : `Selection save failed: ${error.message}`, true);
  } finally {
    savingSelection = false;
    checkbox.disabled = false;
    document.querySelector('#save-button').disabled = false;
    document.querySelector('#logout-button').disabled = false;
  }
});
artworkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedWork || !accessToken || savingSelection || savingDetails || deletingWork) return;
  savingDetails = true;
  const button = document.querySelector('#save-button');
  button.disabled = true;
  document.querySelector('#work-selected').disabled = true;
  document.querySelector('#logout-button').disabled = true;
  setMessage('#save-message', 'Saving to GitHub…');
  const filename = selectedWork.filename;
  const nextDetails = { ...savedDetails };
  nextDetails[filename] = {
    title: document.querySelector('#work-title').value.trim() || titleFromFilename(filename),
    year: document.querySelector('#work-year').value.trim(),
    medium: document.querySelector('#work-medium').value.trim(),
    dimensions: document.querySelector('#work-dimensions').value.trim(),
    selected: document.querySelector('#work-selected').checked,
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
    setMessage('#save-message', 'Saved to GitHub. Waiting for the public page to update…');
    waitForPublication(filename, nextDetails[filename], ++publicationCheck);
  } catch (error) {
    const conflict = /409|sha|conflict/i.test(error.message);
    setMessage('#save-message', conflict ? 'This file changed on GitHub. Reload the editor and try again.' : `Save failed: ${error.message}`, true);
  } finally {
    savingDetails = false;
    button.disabled = false;
    document.querySelector('#work-selected').disabled = false;
    document.querySelector('#logout-button').disabled = false;
  }
});

document.querySelector('#delete-button').addEventListener('click', async () => {
  if (!selectedWork || !accessToken || savingSelection || savingDetails || uploading || deletingWork) return;
  const filename = selectedWork.filename;
  if (!window.confirm(`Delete “${savedDetails[filename]?.title || titleFromFilename(filename)}” (${filename}) from the portfolio? This removes the media file and its details from the current site. Earlier versions remain in Git history.`)) return;

  deletingWork = true;
  const deleteButton = document.querySelector('#delete-button');
  const saveButton = document.querySelector('#save-button');
  const selectedCheckbox = document.querySelector('#work-selected');
  const logoutButton = document.querySelector('#logout-button');
  deleteButton.disabled = true;
  saveButton.disabled = true;
  selectedCheckbox.disabled = true;
  logoutButton.disabled = true;
  setMessage('#delete-message', 'Deleting from GitHub…');

  const base = 'https://api.github.com/repos/Jayquavius/jaydamask';
  try {
    const ref = await githubRequest(`${base}/git/ref/heads/main`);
    const commit = await githubRequest(`${base}/git/commits/${ref.object.sha}`);
    const currentTree = await githubRequest(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
    if (currentTree.truncated) throw new Error('The repository file list is incomplete. Reload and try again.');
    const mediaPath = `art/${filename}`;
    if (!currentTree.tree.some((item) => item.path === mediaPath && item.type === 'blob')) {
      throw new Error('This artwork file is no longer in the repository. Reload the editor.');
    }
    const detailsFile = currentTree.tree.find((item) => item.path === '_data/artworks.json');
    if (detailsFile?.sha !== fileSha) {
      throw new Error('Artwork details changed on GitHub. Reload the editor and try again.');
    }

    const nextDetails = { ...savedDetails };
    delete nextDetails[filename];
    const detailsBlob = await githubRequest(`${base}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: encodeBase64Utf8(JSON.stringify(nextDetails, null, 2) + '\n'), encoding: 'base64' })
    });
    const nextTree = await githubRequest(`${base}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: [
        { path: mediaPath, mode: '100644', type: 'blob', sha: null },
        { path: '_data/artworks.json', mode: '100644', type: 'blob', sha: detailsBlob.sha }
      ] })
    });
    const nextCommit = await githubRequest(`${base}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Delete portfolio work ${filename}`, tree: nextTree.sha, parents: [ref.object.sha] })
    });
    await githubRequest(`${base}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: nextCommit.sha, force: false })
    });

    fileSha = detailsBlob.sha;
    savedDetails = nextDetails;
    const index = artworks.findIndex((work) => work.filename === filename);
    if (index !== -1) artworks.splice(index, 1);
    publicationCheck++;
    selectedWork = null;
    isDirty = false;
    deletingWork = false;
    artworkForm.hidden = true;
    renderList();
    setMessage('#delete-message', `Deleted ${filename} from GitHub. The public gallery will update after GitHub Pages rebuilds.`);
  } catch (error) {
    setMessage('#delete-message', `Delete failed: ${error.message}`, true);
  } finally {
    deletingWork = false;
    deleteButton.disabled = false;
    saveButton.disabled = false;
    selectedCheckbox.disabled = false;
    logoutButton.disabled = false;
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
