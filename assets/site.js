---
---
const rawArtworks = [
{% for file in site.static_files %}{% if file.path contains '/art/' %}
  { filename: {{ file.name | jsonify }}, src: {{ file.path | relative_url | jsonify }} },
{% endif %}{% endfor %}
];
const details = {{ site.data.artworks | jsonify }} || {};
const artworks = rawArtworks
  .filter(({ filename }) => /\.(avif|gif|jpe?g|png|webp)$/i.test(filename))
  .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }))
  .map((work) => ({ ...work, ...details[work.filename], title: details[work.filename]?.title || titleFromFilename(work.filename) }));

function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]*/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

function workUrl(work) {
  return {{ '/artwork/' | relative_url | jsonify }} + '?work=' + encodeURIComponent(work.filename);
}

function showGallery() {
  const gallery = document.querySelector('#gallery-grid');
  document.querySelector('#work-count').textContent = artworks.length ? `(${String(artworks.length).padStart(2, '0')})` : '';
  document.querySelector('#empty-state').hidden = artworks.length > 0;
  artworks.forEach((work, index) => {
    const link = document.createElement('a');
    link.className = 'work-card';
    link.href = workUrl(work);
    link.setAttribute('aria-label', `View ${work.title}`);
    const frame = document.createElement('div');
    frame.className = 'work-image-wrap';
    const image = document.createElement('img');
    image.src = work.src;
    image.alt = work.title;
    image.loading = index < 3 ? 'eager' : 'lazy';
    frame.append(image);
    const caption = document.createElement('div');
    caption.className = 'work-caption';
    const title = document.createElement('span');
    title.textContent = work.title;
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(artworks.length).padStart(2, '0');
    caption.append(title, number);
    link.append(frame, caption);
    gallery.append(link);
  });
}

function addFact(container, label, value) {
  if (value === undefined || value === null || value === '') return;
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  container.append(row);
}

function sanitizeRichHtml(html) {
  const source = document.createElement('template');
  source.innerHTML = html || '';
  const output = document.createElement('div');
  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A']);
  const renamed = { B: 'STRONG', I: 'EM', DIV: 'P' };
  function clean(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'SVG', 'IFRAME', 'OBJECT'].includes(node.tagName)) return;
    const tag = renamed[node.tagName] || node.tagName;
    const child = allowed.has(tag) ? document.createElement(tag.toLowerCase()) : parent;
    if (tag === 'A' && child !== parent) {
      const href = node.getAttribute('href');
      try {
        const url = new URL(href, location.origin);
        if (href && ['http:', 'https:', 'mailto:'].includes(url.protocol)) {
          child.href = url.href;
          child.rel = 'noopener noreferrer';
        }
      } catch (_) { /* Ignore invalid links. */ }
    }
    for (const item of node.childNodes) clean(item, child);
    if (child !== parent) parent.append(child);
  }
  for (const node of source.content.childNodes) clean(node, output);
  return output.innerHTML;
}

function showArtwork() {
  const filename = new URLSearchParams(location.search).get('work');
  const index = artworks.findIndex((work) => work.filename === filename);
  if (index === -1) {
    document.querySelector('#missing-work').hidden = false;
    return;
  }
  const work = artworks[index];
  document.title = `${work.title} — Jay Damask`;
  const image = document.querySelector('#artwork-image');
  image.src = work.src;
  image.alt = work.title;
  document.querySelector('#artwork-title').textContent = work.title;
  document.querySelector('#artwork-number').textContent = `Work ${String(index + 1).padStart(2, '0')} / ${String(artworks.length).padStart(2, '0')}`;
  const description = document.querySelector('#artwork-description');
  if (work.body || work.description) {
    if (work.body) description.innerHTML = sanitizeRichHtml(work.body);
    else description.textContent = work.description;
    description.hidden = false;
  }
  const facts = document.querySelector('#artwork-facts');
  addFact(facts, 'Year', work.year);
  addFact(facts, 'Medium', work.medium);
  addFact(facts, 'Dimensions', work.dimensions);
  document.querySelector('#previous-work').href = workUrl(artworks[(index - 1 + artworks.length) % artworks.length]);
  document.querySelector('#next-work').href = workUrl(artworks[(index + 1) % artworks.length]);
  document.querySelector('#artwork-layout').hidden = false;
}

document.querySelector('#year').textContent = new Date().getFullYear();
if (document.body.dataset.page === 'home') showGallery();
if (document.body.dataset.page === 'artwork') showArtwork();
