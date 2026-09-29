/*!
 * Actuaria Flipbook 1.0.1 — visor de PDF con efecto de hoja para Actuaweb.
 * Usa PDF.js 4.10.38 (Apache-2.0, Mozilla) y StPageFlip 2.0.7 (MIT, Oleg Litovski), auto-hospedados
 * junto a este archivo y verificados por hash antes de ejecutarse.
 *
 * Uso:
 *  - Automático: cualquier <a href="...pdf"> del sitio abre el visor en ventana emergente.
 *    Excluir un enlace: data-flipbook="off" (en el enlace o en un ancestro). Los enlaces con
 *    atributo download se respetan (descargan). Título opcional: data-flipbook-title="…".
 *  - Incrustado: <div data-flipbook-inline data-src="URL.pdf" data-title="…"></div>
 *  - JS: ActuariaFlipbook.open(url, {title}) · ActuariaFlipbook.mount(el, url, {title}) → {load(url,title), destroy()}
 */
(function () {
  'use strict';
  if (window.ActuariaFlipbook) return;

  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/[^/]*$/, '') : 'https://renatopuente-ux.github.io/actuaria-flipbook/';
  var PDFJS_DIR = BASE + 'vendor/pdfjs-4.10.38/';
  // SHA-384 (base64) of each vendored file; a mismatch aborts loading instead of running unknown code.
  var VENDOR = {
    pdf: { url: PDFJS_DIR + 'pdf.min.mjs', sha384: '+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7' },
    worker: { url: PDFJS_DIR + 'pdf.worker.min.mjs', sha384: 'ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o' },
    flip: { url: BASE + 'vendor/page-flip-2.0.7/page-flip.browser.js', sha384: 'L4eWrYFdqQ+LoGA0MMuqLqzV13x7SKkQaqacy4MED8e815dS37tTKlO/6xBEUpZW' }
  };

  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- estilos ---------- */
  var CSS = [
    '.afb{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;font-family:Nunito,sans-serif;color:#151f47}',
    '.afb_stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.afb_book{position:relative}',
    '.afb_page{background:#fff;overflow:hidden}',
    '.afb_page img{display:block;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none;pointer-events:none}',
    '.afb_page img:not([src]){visibility:hidden}',
    '.afb_status{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;font-weight:700;font-size:15px;text-align:center;padding:24px}',
    '.afb_status[hidden]{display:none}',
    '.afb_spin{width:36px;height:36px;border-radius:50%;border:3px solid rgba(76,100,217,.25);border-top-color:#4c64d9;animation:afbSpin .8s linear infinite}',
    '@keyframes afbSpin{to{transform:rotate(360deg)}}',
    '.afb_status a{color:#4c64d9}',
    '.afb_bar{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:12px}',
    '.afb_group{display:flex;align-items:center;gap:4px;padding:4px;border-radius:14px;background:#e8ecf4;box-shadow:4px 4px 10px rgba(15,23,42,.12),-4px -4px 10px rgba(255,255,255,.9)}',
    '.afb_btn{appearance:none;border:0;background:transparent;color:#151f47;width:40px;height:40px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font:900 16px "Fa Solid 900","Font Awesome 6 Free";text-decoration:none;transition:background-color .2s,color .2s}',
    '.afb_btn:hover{background:#dde3f0;color:#4c64d9}',
    '.afb_btn:focus-visible{outline:2px solid #4c64d9;outline-offset:2px}',
    '.afb_btn[disabled]{opacity:.35;cursor:default;background:transparent;color:#151f47}',
    '.afb_btn[hidden]{display:none}',
    '.afb_count{min-width:84px;text-align:center;font:800 14px Nunito,sans-serif;font-variant-numeric:tabular-nums}',
    '.afb_zoom{position:absolute;inset:0;overflow:auto;background:inherit;display:flex;justify-content:center;align-items:flex-start;gap:0;padding:16px;-webkit-overflow-scrolling:touch}',
    '.afb_zoom[hidden]{display:none}',
    '.afb_zoom img{display:block;background:#fff;box-shadow:0 10px 30px rgba(18,19,26,.25)}',
    '.afb_sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    /* incrustado */
    '.afb.is-inline{height:auto}',
    '.afb.is-inline .afb_stage{background:#e8ecf4;border-radius:20px;box-shadow:inset 3px 3px 10px rgba(15,23,42,.10),inset -3px -3px 10px rgba(255,255,255,.9);padding:20px}',
    /* ventana emergente */
    '.afb_modal{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:rgba(18,19,26,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease}',
    '.afb_modal.is-open{opacity:1}',
    '.afb_head{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:12px 16px;color:#fff}',
    '.afb_title{flex:1;min-width:0;margin:0;font:800 17px/1.3 Nunito,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.afb_modal .afb{flex:1;min-height:0}',
    '.afb_modal .afb_stage{padding:8px 16px}',
    '.afb_modal .afb_status{color:#fff}',
    '.afb_modal .afb_status a{color:#ffbba1}',
    '.afb_modal .afb_zoom{background:#12131a}',
    '.afb_close{color:#fff;background:rgba(255,255,255,.08)}',
    '.afb_close:hover{background:rgba(255,255,255,.18);color:#fff}',
    'html.afb-lock,html.afb-lock body{overflow:hidden}',
    '@media (max-width:767px){.afb_modal .afb_stage{padding:4px}.afb_bar{gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}.afb_group{gap:2px}.afb_btn{width:40px;height:44px}.afb_count{min-width:60px}.afb.is-inline .afb_stage{padding:10px;border-radius:14px}}',
    '@media (prefers-reduced-motion:reduce){.afb_modal{transition:none}.afb_spin{animation-duration:2s}}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('afb-css')) return;
    var st = document.createElement('style');
    st.id = 'afb-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- carga verificada de librerías ---------- */
  function b64(buf) {
    var s = '', bytes = new Uint8Array(buf);
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fetchVerified(v, type) {
    return fetch(v.url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + v.url);
      return r.arrayBuffer();
    }).then(function (buf) {
      return crypto.subtle.digest('SHA-384', buf).then(function (d) {
        if (b64(d) !== v.sha384) throw new Error('Integridad inválida: ' + v.url);
        return URL.createObjectURL(new Blob([buf], { type: type }));
      });
    });
  }

  var libsPromise = null;
  function loadLibs() {
    if (libsPromise) return libsPromise;
    libsPromise = Promise.all([
      fetchVerified(VENDOR.pdf, 'text/javascript').then(function (u) { return import(u); }),
      fetchVerified(VENDOR.worker, 'text/javascript'),
      fetchVerified(VENDOR.flip, 'text/javascript').then(function (u) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = u;
          s.onload = function () { res(window.St); };
          s.onerror = function () { rej(new Error('No se pudo iniciar el efecto de hoja')); };
          document.head.appendChild(s);
        });
      })
    ]).then(function (r) {
      var pdfjs = r[0];
      // The worker lives on another origin, so it is started from a same-origin Blob URL. It is
      // passed explicitly to every document: destroying a document then leaves it alive.
      var port = new Worker(r[1], { type: 'module' });
      return { pdfjs: pdfjs, St: r[2], worker: new pdfjs.PDFWorker({ port: port }) };
    });
    libsPromise.catch(function () { libsPromise = null; });
    return libsPromise;
  }

  /* ---------- utilidades ---------- */
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function btn(glyph, label, cls) {
    var b = el('button', 'afb_btn' + (cls ? ' ' + cls : ''), { type: 'button', 'aria-label': label, title: label });
    b.innerHTML = '<span aria-hidden="true">' + glyph + '</span>';
    return b;
  }
  function fileNameOf(url) {
    try {
      var name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || 'documento.pdf');
      // Webflow prefixes asset names with the asset id: "6abb…_nombre.pdf" → "nombre.pdf"
      return name.replace(/^[0-9a-f]{24}_/, '');
    } catch (e) { return 'documento.pdf'; }
  }
  function titleFromName(name) {
    return name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function downloadFile(url, name) {
    fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }).catch(function () { window.open(url, '_blank', 'noopener'); });
  }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------- el libro ---------- */
  function Book(host, opts) {
    this.opts = opts || {};
    this.host = host;
    this.doc = null;
    this.flip = null;
    this.pages = [];        // {el, url, width} por página
    this.ratio = 0.7071;
    this.current = 0;
    this.token = 0;
    this.queue = Promise.resolve();
    this.build();
  }

  Book.prototype.build = function () {
    var self = this;
    var root = this.root = el('div', 'afb' + (this.opts.inline ? ' is-inline' : ''));
    var stage = this.stage = el('div', 'afb_stage');
    this.bookEl = el('div', 'afb_book');
    this.status = el('div', 'afb_status', { role: 'status' });
    this.zoomEl = el('div', 'afb_zoom', { hidden: '' });
    stage.appendChild(this.bookEl);
    stage.appendChild(this.zoomEl);
    stage.appendChild(this.status);

    var bar = el('div', 'afb_bar', { role: 'toolbar', 'aria-label': 'Controles del documento' });
    var nav = el('div', 'afb_group');
    this.prevBtn = btn('&#xf053;', 'Página anterior');
    this.count = el('span', 'afb_count', { 'aria-live': 'polite' });
    this.nextBtn = btn('&#xf054;', 'Página siguiente');
    nav.appendChild(this.prevBtn); nav.appendChild(this.count); nav.appendChild(this.nextBtn);
    var tools = el('div', 'afb_group');
    this.zoomBtn = btn('&#xf00e;', 'Ampliar');
    this.fullBtn = btn('&#xf065;', 'Pantalla completa');
    this.dlBtn = btn('&#xf019;', 'Descargar PDF');
    this.openLink = el('a', 'afb_btn', { target: '_blank', rel: 'noopener', 'aria-label': 'Abrir el PDF original en una pestaña nueva', title: 'Abrir PDF original' });
    this.openLink.innerHTML = '<span aria-hidden="true">&#xf08e;</span>';
    this.openLink.setAttribute('data-flipbook', 'off');
    tools.appendChild(this.zoomBtn); tools.appendChild(this.fullBtn); tools.appendChild(this.dlBtn); tools.appendChild(this.openLink);
    bar.appendChild(nav); bar.appendChild(tools);

    root.appendChild(stage);
    root.appendChild(bar);
    this.host.appendChild(root);

    this.prevBtn.addEventListener('click', function () { self.go(-1); });
    this.nextBtn.addEventListener('click', function () { self.go(1); });
    this.zoomBtn.addEventListener('click', function () { self.toggleZoom(); });
    this.dlBtn.addEventListener('click', function () { downloadFile(self.url, fileNameOf(self.url)); });
    this.fullBtn.addEventListener('click', function () {
      if (self.opts.onFullscreen) self.opts.onFullscreen(self);
    });
    if (!this.opts.onFullscreen) this.fullBtn.hidden = true;

    this.onResize = debounce(function () { if (self.doc) self.layout(); }, 180);
    window.addEventListener('resize', this.onResize);
    this.setControls(false);
  };

  Book.prototype.setStatus = function (html) {
    if (html == null) { this.status.hidden = true; this.status.innerHTML = ''; return; }
    this.status.hidden = false;
    this.status.innerHTML = html;
  };

  Book.prototype.setControls = function (on) {
    [this.prevBtn, this.nextBtn, this.zoomBtn, this.dlBtn].forEach(function (b) { b.disabled = !on; });
  };

  Book.prototype.load = function (url, title, startPage) {
    var self = this, token = ++this.token;
    this.teardown();
    this.current = startPage || 0;
    this.url = new URL(url, location.href).href;
    this.title = title || titleFromName(fileNameOf(this.url));
    this.openLink.href = this.url;
    this.setControls(false);
    this.count.textContent = '';
    this.setStatus('<div class="afb_spin" aria-hidden="true"></div><span>Cargando documento…</span>');

    return loadLibs().then(function (libs) {
      if (token !== self.token) return;
      self.libs = libs;
      return libs.pdfjs.getDocument({
        url: self.url,
        worker: libs.worker,
        isEvalSupported: false,
        withCredentials: false,
        // cmaps are not shipped: they only matter for CJK text with non-embedded fonts.
        standardFontDataUrl: PDFJS_DIR + 'standard_fonts/'
      }).promise.then(function (doc) {
        if (token !== self.token) { doc.destroy(); return; }
        self.doc = doc;
        return doc.getPage(1).then(function (p) {
          var vp = p.getViewport({ scale: 1 });
          self.ratio = vp.width / vp.height;
          self.pages = [];
          for (var i = 0; i < doc.numPages; i++) self.pages.push({ url: null, width: 0 });
          self.layout();
        });
      });
    }).catch(function (err) {
      if (token !== self.token) return;
      if (window.console) console.warn('[flipbook]', err);
      self.setStatus('<span>No pudimos mostrar este documento aquí.</span>' +
        '<a href="' + self.url + '" target="_blank" rel="noopener" data-flipbook="off">Abrir el PDF en una pestaña nueva</a>');
    });
  };

  // Builds (or rebuilds after a resize) the page-flip instance to fit the stage.
  Book.prototype.layout = function () {
    var self = this, St = this.libs.St;
    var cs = getComputedStyle(this.stage);
    var W = this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H;
    if (this.opts.inline) {
      // Inline: height follows the width, capped to 85% of the viewport.
      var spreadW = W >= 640 ? W / 2 : W;
      H = Math.min(spreadW / this.ratio, window.innerHeight * 0.85);
    } else {
      H = this.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    }
    if (W < 50 || H < 50) return;
    var two = W >= 640 && W >= this.ratio * H * 1.2;
    var pageW = Math.floor(Math.min(two ? W / 2 : W, H * this.ratio));
    var pageH = Math.floor(pageW / this.ratio);

    if (this.flip) this.current = this.flip.getCurrentPageIndex();
    this.destroyFlip();
    // Set before creating page-flip: it fires events during loadFromHTML that schedule renders.
    this.pageW = pageW;
    this.bookEl.style.width = (two ? pageW * 2 : pageW) + 'px';
    this.bookEl.style.height = pageH + 'px';

    var els = this.pages.map(function (p, i) {
      var d = el('div', 'afb_page', { 'data-page': String(i) });
      var img = el('img', '', { alt: 'Página ' + (i + 1), draggable: 'false' });
      if (p.url) img.src = p.url;
      d.appendChild(img);
      self.bookEl.appendChild(d);
      return d;
    });

    this.flip = new St.PageFlip(this.bookEl, {
      width: pageW,
      height: pageH,
      size: 'fixed',
      autoSize: false,
      usePortrait: !two,
      showCover: this.cover = two && this.pages.length > 2,
      startPage: Math.min(this.current, this.pages.length - 1),
      flippingTime: REDUCED_MOTION ? 250 : 750,
      maxShadowOpacity: 0.45,
      mobileScrollSupport: true,
      showPageCorners: !REDUCED_MOTION
    });
    this.flip.on('flip', function (e) { self.current = e.data; self.update(); });
    this.flip.on('changeOrientation', function () { self.update(); });
    this.flip.loadFromHTML(els);
    this.setStatus(null);
    this.setControls(true);
    this.update();
  };

  Book.prototype.visibleRange = function () {
    var n = this.pages.length, i = this.flip ? this.flip.getCurrentPageIndex() : this.current;
    var portrait = !this.flip || this.flip.getOrientation() === 'portrait';
    if (portrait) return [i, i];
    if (!this.cover) { var s = i - (i % 2); return [s, Math.min(s + 1, n - 1)]; }
    // With cover mode, spreads are [0], [1,2], [3,4]…
    var start = (i === 0) ? 0 : (i % 2 === 1 ? i : i - 1);
    return [start, Math.min(start + (start === 0 ? 0 : 1), n - 1)];
  };

  Book.prototype.update = function () {
    if (!this.flip) return;
    var n = this.pages.length, r = this.visibleRange();
    this.count.textContent = (r[0] === r[1] ? (r[0] + 1) : (r[0] + 1) + '–' + (r[1] + 1)) + ' / ' + n;
    this.prevBtn.disabled = r[0] <= 0;
    this.nextBtn.disabled = r[1] >= n - 1;
    this.schedule(r[0] - 2, r[1] + 3);
  };

  // Renders pages near the current spread first, then the rest in the background.
  Book.prototype.schedule = function (from, to) {
    var self = this, n = this.pages.length, token = this.token, target = Math.round(this.pageW * DPR);
    if (!(target > 0)) return;
    var order = [];
    for (var i = Math.max(0, from); i <= Math.min(n - 1, to); i++) order.push(i);
    for (var j = 0; j < n; j++) if (order.indexOf(j) < 0) order.push(j);
    order.forEach(function (idx) {
      self.queue = self.queue.then(function () {
        if (token !== self.token || !self.doc) return;
        var p = self.pages[idx];
        if (p.url && p.width >= target * 0.9) return;
        return self.renderPage(idx, target).then(function (res) {
          if (token !== self.token) { URL.revokeObjectURL(res.url); return; }
          if (p.url) URL.revokeObjectURL(p.url);
          p.url = res.url; p.width = res.width;
          // page-flip clones pages while turning in portrait mode: update every copy.
          self.bookEl.querySelectorAll('.afb_page[data-page="' + idx + '"] img').forEach(function (img) { img.src = res.url; });
        });
      }).catch(function (e) { if (window.console) console.warn('[flipbook] página', idx + 1, e); });
    });
  };

  Book.prototype.renderPage = function (idx, targetWidth) {
    return this.doc.getPage(idx + 1).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(Math.max(targetWidth / base.width, 0.5), 4);
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      var ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        return new Promise(function (res) {
          canvas.toBlob(function (blob) {
            res({ url: URL.createObjectURL(blob), width: canvas.width });
            canvas.width = canvas.height = 0;
          }, 'image/jpeg', 0.92);
        });
      });
    });
  };

  Book.prototype.go = function (dir) {
    if (!this.flip) return;
    if (this.zoomEl.hidden === false) this.toggleZoom();
    if (dir > 0) this.flip.flipNext(); else this.flip.flipPrev();
  };

  // Zoom shows the visible page(s) re-rendered at higher resolution in a scrollable layer.
  Book.prototype.toggleZoom = function () {
    var self = this;
    if (!this.zoomEl.hidden) {
      this.zoomEl.hidden = true;
      this.zoomEl.querySelectorAll('img').forEach(function (i) { URL.revokeObjectURL(i.src); });
      this.zoomEl.innerHTML = '';
      this.zoomBtn.innerHTML = '<span aria-hidden="true">&#xf00e;</span>';
      this.zoomBtn.setAttribute('aria-label', 'Ampliar'); this.zoomBtn.title = 'Ampliar';
      return;
    }
    var r = this.visibleRange(), width = Math.round(Math.min(this.stage.clientWidth * 1.6 / (r[1] - r[0] + 1), 2400));
    this.zoomEl.hidden = false;
    this.zoomBtn.innerHTML = '<span aria-hidden="true">&#xf010;</span>';
    this.zoomBtn.setAttribute('aria-label', 'Reducir'); this.zoomBtn.title = 'Reducir';
    for (var i = r[0]; i <= r[1]; i++) (function (idx) {
      var img = el('img', '', { alt: 'Página ' + (idx + 1) + ' ampliada' });
      img.style.width = width + 'px';
      self.zoomEl.appendChild(img);
      self.renderPage(idx, width * DPR).then(function (res) { img.src = res.url; });
    })(i);
  };

  // page-flip's destroy() removes the element it was mounted on, so a fresh one replaces it.
  Book.prototype.destroyFlip = function () {
    if (this.flip) { this.flip.destroy(); this.flip = null; }
    if (this.bookEl.parentNode) this.bookEl.remove();
    this.bookEl = el('div', 'afb_book');
    this.stage.insertBefore(this.bookEl, this.stage.firstChild);
  };

  Book.prototype.teardown = function () {
    if (!this.zoomEl.hidden) this.toggleZoom();
    this.destroyFlip();
    this.pages.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
    this.pages = [];
    this.current = 0;
    if (this.doc) { this.doc.destroy(); this.doc = null; }
  };

  Book.prototype.destroy = function () {
    this.token++;
    this.teardown();
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  };

  /* ---------- ventana emergente ---------- */
  var modal = null;

  function openModal(url, opts) {
    opts = opts || {};
    injectCss();
    if (modal) closeModal(true);
    var returnFocus = document.activeElement;
    var wrap = el('div', 'afb_modal', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'afb-title' });
    var head = el('div', 'afb_head');
    var h = el('h2', 'afb_title', { id: 'afb-title' });
    var close = btn('&#xf00d;', 'Cerrar visor', 'afb_close');
    head.appendChild(h); head.appendChild(close);
    wrap.appendChild(head);
    document.body.appendChild(wrap);
    document.documentElement.classList.add('afb-lock');

    var book = new Book(wrap, {
      onFullscreen: (wrap.requestFullscreen || wrap.webkitRequestFullscreen) ? function () {
        var fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
      } : null
    });
    book.load(url, opts.title, opts.startPage).then(function () { h.textContent = book.title; });
    h.textContent = opts.title || book.title || '';

    function onKey(e) {
      if (e.key === 'Escape') { if (!book.zoomEl.hidden) book.toggleZoom(); else closeModal(); }
      else if (e.key === 'ArrowRight') book.go(1);
      else if (e.key === 'ArrowLeft') book.go(-1);
      else if (e.key === 'Tab') {
        // Keep keyboard focus inside the dialog.
        var f = [].slice.call(wrap.querySelectorAll('button:not([disabled]):not([hidden]),a[href]')).filter(function (n) { return n.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    close.addEventListener('click', function () { closeModal(); });
    requestAnimationFrame(function () { wrap.classList.add('is-open'); close.focus(); });

    modal = {
      wrap: wrap, book: book,
      cleanup: function () {
        document.removeEventListener('keydown', onKey);
        document.documentElement.classList.remove('afb-lock');
        if (returnFocus && returnFocus.focus) returnFocus.focus();
      }
    };
    return book;
  }

  function closeModal(immediate) {
    if (!modal) return;
    var m = modal; modal = null;
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    m.book.destroy();
    m.cleanup();
    if (immediate || REDUCED_MOTION) { m.wrap.remove(); return; }
    m.wrap.classList.remove('is-open');
    setTimeout(function () { m.wrap.remove(); }, 200);
  }

  /* ---------- incrustado ---------- */
  function mount(host, url, opts) {
    injectCss();
    opts = opts || {};
    var book = new Book(host, {
      inline: true,
      onFullscreen: function (b) { openModal(b.url, { title: b.title, startPage: b.current }); }
    });
    if (url) book.load(url, opts.title);
    return {
      load: function (u, t) { return book.load(u, t); },
      destroy: function () { book.destroy(); },
      book: book
    };
  }

  function mountAll() {
    document.querySelectorAll('[data-flipbook-inline]:not([data-flipbook-ready])').forEach(function (n) {
      n.setAttribute('data-flipbook-ready', '');
      n._flipbook = mount(n, n.getAttribute('data-src'), { title: n.getAttribute('data-title') });
    });
  }

  /* ---------- enlaces a PDF de todo el sitio ---------- */
  function isPdfLink(a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    try { return /\.pdf$/i.test(new URL(href, location.href).pathname); } catch (e) { return false; }
  }
  // Bubble phase and no stopPropagation: other handlers (Webflow's included) still see the click.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('download') || a.closest('[data-flipbook="off"]') || !isPdfLink(a)) return;
    e.preventDefault();
    openModal(a.href, { title: a.getAttribute('data-flipbook-title') || (a.textContent || '').replace(/\s+/g, ' ').trim() || null });
  });

  window.ActuariaFlipbook = { open: openModal, close: closeModal, mount: mount, version: '1.0.1' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
})();
