/*
 * Хотхоны самбар — browser тал. Server: worker/edge/index.js (/api/edge/*).
 *   fetch()     → Worker API (D1, R2, KV)
 *   WebSocket   → Durable Object (realtime чат + самбарын шууд мэдэгдэл)
 * Хүсэлт бүр «API лог»-т харагдана: статус, хугацаа, X-Cache (KV HIT/MISS), X-Edge-Colo.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('sokh-edge:' + k);
        return v == null ? d : v;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('sokh-edge:' + k, v);
      } catch (e) {}
    },
  };
  const fmtTime = (ms) =>
    new Date(ms).toLocaleString('mn-MN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const myName = () => ($('#chat-name').value.trim() || 'Зочин').slice(0, 24);
  const wsBase = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;

  /* ------------------------------------------------------------ API + лог */
  async function api(method, path, body, headers = {}) {
    const t0 = performance.now();
    const opt = { method, headers: { ...headers } };
    if (body instanceof Blob) {
      opt.body = body;
      opt.headers['content-type'] = body.type;
    } else if (body !== undefined) {
      opt.body = JSON.stringify(body);
      opt.headers['content-type'] = 'application/json';
    }
    let res, data;
    try {
      res = await fetch('/api/edge' + path, opt);
      data = await res.json().catch(() => ({}));
    } catch (e) {
      log(method, path, 'ERR', Math.round(performance.now() - t0), 'сүлжээ');
      throw new Error('Сүлжээний алдаа');
    }
    const extra = [
      res.headers.get('x-cache'),
      res.headers.get('x-edge-colo'),
      res.headers.get('x-edge-time') && 'worker ' + res.headers.get('x-edge-time') + 'ms',
    ]
      .filter(Boolean)
      .join(' · ');
    log(method, path, res.status, Math.round(performance.now() - t0), extra);
    if (!res.ok) throw new Error(data.error || 'Алдаа ' + res.status);
    return { data, res };
  }
  function log(method, path, status, ms, extra) {
    const li = document.createElement('li');
    const ok = typeof status === 'number' && status < 400;
    li.innerHTML = `<span class="m">${esc(method)}</span><span class="p" title="${esc(path)}">${esc(path)}</span><span class="s ${ok ? 'ok' : 'bad'}">${esc(status)}</span><span class="x">${ms}ms${extra ? ' · ' + esc(extra) : ''}</span>`;
    const ol = $('#log');
    ol.prepend(li);
    while (ol.children.length > 60) ol.lastChild.remove();
  }
  $('#log-clear').onclick = () => ($('#log').innerHTML = '');

  /* ------------------------------------------------------------ Үйлчилгээний төлөв */
  const ABOUT = {
    Worker: 'Edge дээрх серверийн код, API',
    D1: 'SQL өгөгдлийн сан (зарлал)',
    R2: 'Файл, зургийн сан',
    KV: 'Хурдан кэш, тохиргоо',
    DO: 'Realtime WebSocket өрөө',
  };
  async function health() {
    const box = $('#services');
    if (!box.children.length)
      box.innerHTML = Object.keys(ABOUT)
        .map(
          (n) =>
            `<div class="ed-svc"><div class="ed-svc-h"><span class="dot"></span>${n}</div><p>${ABOUT[n]}</p></div>`,
        )
        .join('');
    try {
      const { data } = await api('GET', '/health');
      box.innerHTML = data.services
        .map(
          (s) => `<div class="ed-svc" title="${esc(ABOUT[s.name])}">
            <div class="ed-svc-h"><span class="dot ${s.ok ? 'ok' : 'bad'}"></span>${esc(s.name)}${s.ms != null ? `<span class="ms">${s.ms}ms</span>` : ''}</div>
            <p class="${s.ok ? '' : 'err'}">${esc(s.ok ? s.info : s.error)}</p></div>`,
        )
        .join('');
    } catch (e) {
      box.querySelectorAll('.dot').forEach((d) => d.classList.add('bad'));
    }
  }

  /* ------------------------------------------------------------ Баннер (KV) */
  function showBanner(b) {
    const el = $('#banner');
    el.hidden = !(b && b.text);
    if (!b || !b.text) return;
    el.className = 'ed-banner ' + (b.tone || 'info');
    el.textContent = b.text;
  }
  async function loadBanner() {
    try {
      const { data } = await api('GET', '/banner');
      showBanner(data);
      const f = $('#banner-form');
      f.text.value = data.text || '';
      f.tone.value = data.tone || 'info';
    } catch (e) {}
  }
  $('#banner-form').key.value = store.get('key', '');
  $('#banner-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    store.set('key', f.key.value);
    try {
      const { data } = await api(
        'PUT',
        '/banner',
        { text: f.text.value, tone: f.tone.value },
        adminHeaders(),
      );
      showBanner(data);
    } catch (err) {
      alertLine(err.message);
    }
  };
  const adminHeaders = () => {
    const k = $('#banner-form').key.value.trim();
    return k ? { 'x-edge-key': k } : {};
  };

  /* ------------------------------------------------------------ Зарлалууд (D1 + KV кэш) */
  let posts = [];
  function renderPosts(flashId) {
    const box = $('#posts');
    if (!posts.length) {
      box.innerHTML = '<div class="ed-empty">Одоогоор зарлал алга — эхнийхийг нь нийтлээрэй.</div>';
      return;
    }
    box.innerHTML = posts
      .map(
        (p) => `<article class="ed-post${p.id === flashId ? ' new' : ''}" data-id="${p.id}">
          ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" data-full="${esc(p.image)}" />` : ''}
          <div class="ed-post-b">
            <h3>${esc(p.title)}</h3>
            <div class="meta">${esc(p.author)} · ${fmtTime(p.createdAt)} · #${p.id}</div>
            ${p.body ? `<p>${esc(p.body)}</p>` : ''}
            <div class="ed-post-f">
              <button class="btn s" data-like type="button">👍 ${p.likes}</button>
              <button class="btn s" data-del type="button">Устгах</button>
            </div>
          </div></article>`,
      )
      .join('');
  }
  async function loadPosts() {
    try {
      const { data, res } = await api('GET', '/posts');
      posts = data.posts;
      const hit = res.headers.get('x-cache');
      const tag = $('#cache-tag');
      tag.className = 'ed-tag ' + (hit === 'HIT' ? 'hit' : 'miss');
      tag.textContent = 'KV ' + (hit || '?');
      renderPosts();
    } catch (e) {
      $('#posts').innerHTML = `<div class="ed-empty">${esc(e.message)}</div>`;
    }
  }
  $('#reload').onclick = () => (loadPosts(), health());
  $('#posts').onclick = async (e) => {
    const art = e.target.closest('.ed-post');
    if (!art) return;
    const id = Number(art.dataset.id);
    if (e.target.matches('img')) return window.open(e.target.dataset.full, '_blank', 'noopener');
    try {
      if (e.target.closest('[data-like]')) {
        const { data } = await api('POST', `/posts/${id}/like`);
        setPost(id, { likes: data.likes });
      } else if (e.target.closest('[data-del]')) {
        await api('DELETE', `/posts/${id}`, undefined, adminHeaders());
        posts = posts.filter((p) => p.id !== id);
        renderPosts();
        health();
      }
    } catch (err) {
      alertLine(err.message);
    }
  };
  function setPost(id, patch) {
    const p = posts.find((x) => x.id === id);
    if (p) Object.assign(p, patch), renderPosts();
  }

  /* ------------------------------------------------------------ Шинэ зарлал + зураг (R2) */
  let file = null;
  const form = $('#post-form');
  form.author.value = store.get('name', '');
  $('#image').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      file = await shrink(f);
    } catch (err) {
      return alertLine(err.message);
    }
    $('#preview').src = URL.createObjectURL(file);
    $('#preview').hidden = $('#image-clear').hidden = false;
    $('#image-info').textContent =
      `${f.name} · ${(file.size / 1024).toFixed(0)} KB${file !== f ? ' (жижигрүүлсэн)' : ''}`;
  };
  $('#image-clear').onclick = clearImage;
  function clearImage() {
    file = null;
    $('#preview').hidden = $('#image-clear').hidden = true;
    $('#image-info').textContent = 'Заавал биш · ≤5MB · R2-д хадгалагдана';
  }
  /** Том зургийг browser дээр 1600px болгож багасгана (GIF-ийг хэвээр) */
  async function shrink(f) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) throw new Error('Зөвхөн JPG, PNG, WEBP, GIF');
    if (f.type === 'image/gif' || f.size < 1.5 * 1024 * 1024) {
      if (f.size > 5 * 1024 * 1024) throw new Error('Зураг 5MB-аас их байна');
      return f;
    }
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Зураг 5MB-аас их байна');
    return blob;
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#post-btn');
    btn.disabled = true;
    store.set('name', form.author.value.trim());
    try {
      let imageKey = null;
      if (file) {
        status('Зураг R2 руу илгээж байна…');
        const { data } = await api(
          'POST',
          '/upload?name=' + encodeURIComponent(file.name || 'image'),
          file,
        );
        imageKey = data.key;
      }
      status('D1-д хадгалж байна…');
      const { data } = await api('POST', '/posts', {
        author: form.author.value,
        title: form.title.value,
        body: form.body.value,
        imageKey,
      });
      addPost(data.post);
      form.title.value = form.body.value = '';
      clearImage();
      status('Нийтэллээ ✓');
      health();
    } catch (err) {
      status(err.message);
    } finally {
      btn.disabled = false;
    }
  };
  function addPost(p) {
    if (posts.some((x) => x.id === p.id)) return;
    posts.unshift(p);
    renderPosts(p.id);
  }
  const status = (t) => ($('#post-status').textContent = t);
  const alertLine = (t) => (sys(t), status(t));

  /* ------------------------------------------------------------ WebSocket (DO) */
  /** Тасарвал автоматаар дахин холбогдох WebSocket */
  function socket(getUrl, handlers) {
    let ws,
      wait = 500,
      closed = false,
      timer;
    const open = () => {
      ws = new WebSocket(getUrl());
      ws.onopen = () => ((wait = 500), handlers.open && handlers.open());
      ws.onmessage = (e) => {
        try {
          handlers.message(JSON.parse(e.data));
        } catch (err) {}
      };
      ws.onclose = () => {
        handlers.close && handlers.close();
        if (!closed) timer = setTimeout(open, (wait = Math.min(wait * 2, 10000)));
      };
    };
    open();
    return {
      send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)),
      close() {
        closed = true;
        clearTimeout(timer);
        ws.close();
      },
    };
  }

  // 2) Чат: хэрэглэгчийн сонгосон өрөө (өрөө бүр тусдаа Durable Object)
  $('#chat-name').value = store.get('chat-name', store.get('name', ''));
  $('#chat-room').value = store.get('room', 'lobby');
  let chat = null,
    pingT = 0,
    typingTimer;
  function joinRoom() {
    const room = $('#chat-room').value.trim().toLowerCase() || 'lobby';
    if (!/^[a-z0-9-]{1,32}$/.test(room)) return sys('Өрөөний нэр: a-z, 0-9, - тэмдэгт');
    store.set('room', room);
    store.set('chat-name', $('#chat-name').value.trim());
    if (chat) chat.close();
    $('#msgs').innerHTML = '';
    $('#chat-state').textContent = 'холбогдож байна…';
    chat = socket(() => `${wsBase}/api/edge/chat/${room}?name=${encodeURIComponent(myName())}`, {
      open() {
        $('#chat-state').textContent = '● ' + room;
        pingT = performance.now();
        chat && chat.send({ type: 'ping', t: pingT });
      },
      close() {
        $('#chat-state').textContent = 'тасарсан — дахин холбогдож байна…';
      },
      message(m) {
        if (m.type === 'history') {
          $('#msgs').innerHTML = '';
          m.messages.forEach(addMsg);
          sys(`«${room}» өрөөнд холбогдлоо · ${m.messages.length} хуучин мессеж (DO SQLite)`);
        } else if (m.type === 'chat') {
          addMsg(m);
          $('#typing').textContent = '';
        } else if (m.type === 'presence') {
          $('#chat-online').textContent = `${m.count} хүн онлайн: ${m.people.join(', ')}`;
        } else if (m.type === 'typing') {
          $('#typing').textContent = m.name + ' бичиж байна…';
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => ($('#typing').textContent = ''), 2000);
        } else if (m.type === 'pong') {
          $('#chat-state').textContent = `● ${room} · ${Math.round(performance.now() - m.t)}ms`;
        }
      },
    });
  }
  function addMsg(m) {
    const box = $('#msgs');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    const d = document.createElement('div');
    d.className = 'ed-msg' + (m.name === myName() ? ' me' : '');
    d.innerHTML = `<b>${esc(m.name)}<time>${new Date(m.at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</time></b>${esc(m.text)}`;
    box.append(d);
    if (near || m.name === myName()) box.scrollTop = box.scrollHeight;
  }
  function sys(t) {
    const d = document.createElement('div');
    d.className = 'ed-msg sys';
    d.textContent = t;
    $('#msgs').append(d);
    $('#msgs').scrollTop = 1e9;
  }
  $('#chat-room').onchange = joinRoom;
  $('#chat-name').onchange = joinRoom;
  let lastTyping = 0;
  $('#chat-text').oninput = () => {
    if (Date.now() - lastTyping > 1500)
      (lastTyping = Date.now()), chat && chat.send({ type: 'typing' });
  };
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const t = $('#chat-text').value.trim();
    if (!t || !chat) return;
    chat.send({ type: 'chat', text: t });
    $('#chat-text').value = '';
  };

  /* ------------------------------------------------------------ Өнгө */
  $('#theme').onclick = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      const s = JSON.parse(localStorage.getItem('sokh-v1') || '{}') || {};
      s.theme = dark ? 'dark' : 'light';
      localStorage.setItem('sokh-v1', JSON.stringify(s));
    } catch (e) {}
  };

  // 1) Самбар: "board" өрөө — шинэ зарлал, like, устгал, баннерыг серверээс түлхэнэ
  socket(() => wsBase + '/api/edge/chat/board?name=' + encodeURIComponent(myName() + ' (самбар)'), {
    message(m) {
      if (m.type === 'post') addPost(m.post);
      else if (m.type === 'like') setPost(m.id, { likes: m.likes });
      else if (m.type === 'delete') (posts = posts.filter((p) => p.id !== m.id)), renderPosts();
      else if (m.type === 'banner') showBanner(m.banner);
    },
  });

  health();
  loadBanner();
  loadPosts();
  joinRoom();
})();
