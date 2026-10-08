/* ===== Славодолье — общая логика сайта =====
   1. Контакты из config.js      5. Корзина пекарни (панель, оформление)
   2. Меню-«бургер»              6. Нижняя плашка корзины на телефоне
   3. Хранение корзины           7. Пироги на заказ (4 шага)
   4. Каталог и витрина          8. Обеды для организаций (2 шага)
*/
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var MENU = window.MENU || [];
  var DISTRICTS = window.UFA_DISTRICTS || [];

  /* ---------- Помощники ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmt = function (n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; };
  var get = function (path) {
    return path.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : null; }, SITE);
  };
  var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoDate = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var ruDate = function (iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return Number(p[2]) + ' ' + m[Number(p[1]) - 1];
  };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* без хранилища просто не запоминаем */ } }
  };

  /* Место для будущей отправки заявок администратору (Telegram через серверного посредника).
     Сейчас заявка никуда не уходит: только показываем «Спасибо». */
  function sendRequest(kind, data) {
    window.lastRequest = { kind: kind, data: data, at: new Date().toISOString() };
    return Promise.resolve(true);
  }

  /* ========== 1. Контакты и реквизиты из config.js ========== */
  function fillSiteData() {
    $$('[data-site]').forEach(function (el) {
      var v = get(el.getAttribute('data-site'));
      if (v) el.textContent = v;
    });
    $$('[data-phone]').forEach(function (a) {
      var v = get(a.getAttribute('data-phone') + '.phone');
      if (v) { if (!a.hasAttribute('data-keep-label')) a.textContent = v; a.href = 'tel:+' + digits(v).replace(/^8/, '7'); }
      else { a.href = 'contacts.html'; }
    });
    $$('[data-map]').forEach(function (a) {
      var place = SITE[a.getAttribute('data-map')] || {};
      if (place.mapUrl) a.href = place.mapUrl;
      else if (place.address) a.href = 'https://yandex.ru/maps/?text=' + encodeURIComponent('Уфа, ' + place.address);
      else a.href = 'contacts.html';
      if (/^https?:/.test(a.href)) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    if (SITE.email) $$('[data-email]').forEach(function (el) { el.innerHTML = '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>'; });
    if (SITE.socials && SITE.socials.length) {
      $$('[data-socials]').forEach(function (box) {
        box.innerHTML = SITE.socials.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>';
        }).join('');
      });
    }
    var d = SITE.delivery || {};
    $$('[data-delivery]').forEach(function (el) {
      var k = el.getAttribute('data-delivery');
      if (k === 'zone' && d.districts && d.districts.length) el.textContent = d.districts.join(', ') + ' район' + (d.districts.length > 1 ? 'ы' : '');
      if (k === 'min' && d.minOrder) el.textContent = 'от ' + fmt(d.minOrder);
      if (k === 'fee' && d.fee !== null && d.fee !== undefined) el.textContent = d.fee === 0 ? 'бесплатно' : fmt(d.fee);
      if (k === 'time' && d.time) el.textContent = d.time;
    });
  }

  /* ========== 2. Меню-«бургер» ========== */
  function initBurger() {
    var btn = $('.burger'), nav = $('#mainNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ========== 3. Корзина: хранение ========== */
  var byId = {}, flat = [];
  MENU.forEach(function (c) { c.items.forEach(function (it) { flat.push(it); byId[it.id] = it; }); });

  var cart = (function () {
    var saved = store.get('slavodolie-cart') || {};
    var clean = {};
    Object.keys(saved).forEach(function (id) { if (byId[id] && saved[id] > 0) clean[id] = Math.min(99, saved[id] | 0); });
    return clean;
  })();
  var bump = 0;

  function lines() { return flat.filter(function (it) { return cart[it.id]; }); }
  function count() { return lines().reduce(function (a, it) { return a + cart[it.id]; }, 0); }
  function totalInfo() {
    var ls = lines(), known = true, sum = 0;
    ls.forEach(function (it) { if (typeof it.price === 'number') sum += it.price * cart[it.id]; else known = false; });
    return { sum: sum, known: known };
  }
  function totalText() {
    var t = totalInfo();
    return t.known ? fmt(t.sum) : 'уточним при звонке';
  }

  function setQty(id, q) {
    var before = cart[id] || 0;
    q = Math.max(0, Math.min(99, q));
    if (q === 0) delete cart[id]; else cart[id] = q;
    store.set('slavodolie-cart', cart);
    if (q > before) bump += 1;
    refreshCard(id);
    refreshCartUI(q > before);
    if (drawer.isOpen()) drawer.afterChange(id);
  }

  /* ========== 4. Каталог и витрина ========== */
  function priceHTML(it) {
    return typeof it.price === 'number'
      ? '<span class="price">' + fmt(it.price) + '</span>'
      : '<span class="price unknown">Цена [уточнить]</span>';
  }
  function actionHTML(it) {
    var q = cart[it.id] || 0;
    if (!q) return '<button class="btn-sky add-btn" type="button" data-act="add" data-id="' + it.id + '">В корзину</button>';
    return '<div class="stepper step-in">' +
      '<button class="st-btn dec" type="button" data-act="dec" data-id="' + it.id + '" aria-label="Убрать одну: ' + esc(it.name) + '">−</button>' +
      '<span class="qty" aria-live="polite">' + q + '</span>' +
      '<button class="pill st-btn inc" type="button" data-act="inc" data-id="' + it.id + '" aria-label="Добавить ещё: ' + esc(it.name) + '">+</button>' +
    '</div>';
  }
  function cardHTML(it, idx) {
    return '<article class="card menu-card" data-id="' + it.id + '" style="animation-delay:' + (Math.min(idx, 8) * 70) + 'ms">' +
      (it.photo
        ? '<div class="card-photo has-img"><picture><source srcset="' + esc(it.photo) + '.webp" type="image/webp">' +
          '<img src="' + esc(it.photo) + '.jpg" alt="' + esc(it.name) + '" width="800" height="600" loading="lazy" decoding="async"></picture>'
        : '<div class="card-photo"><span>Фото: ' + esc(it.name) + '</span>') +
        (it.badge ? '<span class="badge">' + esc(it.badge) + '</span>' : '') + '</div>' +
      '<div class="card-body">' +
        '<h4>' + esc(it.name) + '</h4>' +
        '<p class="card-desc">' + esc(it.desc) + '</p>' +
        '<div class="card-foot">' +
          '<div class="card-price">' + priceHTML(it) + '<span class="weight">' + esc(it.weight) + '</span></div>' +
          '<div class="card-action">' + actionHTML(it) + '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  function refreshCard(id, focusAct) {
    $$('article.menu-card[data-id="' + id + '"]').forEach(function (card) {
      var box = card.querySelector('.card-action');
      var q = cart[id] || 0;
      var st = box.querySelector('.stepper');
      if (q > 0 && st) st.querySelector('.qty').textContent = q;
      else box.innerHTML = actionHTML(byId[id]);
      if (focusAct && card.contains(document.activeElement) === false && card.hasAttribute('data-focus')) {
        card.removeAttribute('data-focus');
        var t = box.querySelector('[data-act="' + focusAct + '"]') || box.querySelector('button');
        if (t) t.focus();
      }
    });
  }

  var catState = { cat: 'all', anim: 0 };
  function initCatalog() {
    var tabsEl = $('#tabs'), gridEl = $('#menuGrid');
    if (tabsEl && gridEl) {
      var cats = [{ id: 'all', label: 'Всё' }].concat(MENU.map(function (c) { return { id: c.id, label: c.label }; }));
      tabsEl.innerHTML = cats.map(function (c) {
        return '<button class="pill tab" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === 'all') + '">' + esc(c.label) + '</button>';
      }).join('');
      var render = function () {
        var secs = MENU.filter(function (c) { return catState.cat === 'all' || catState.cat === c.id; });
        gridEl.className = 'menu-grid ' + (catState.anim % 2 ? 'cards-b' : 'cards-a');
        gridEl.innerHTML = secs.map(function (c) {
          return '<div class="menu-sec"><div class="menu-sec-head"><h3>' + esc(c.label) + '</h3><p>' + esc(c.note) + '</p></div>' +
            '<div class="menu-cards">' + c.items.map(cardHTML).join('') + '</div></div>';
        }).join('');
      };
      tabsEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cat]');
        if (!b) return;
        catState.cat = b.getAttribute('data-cat');
        catState.anim += 1;
        $$('[data-cat]', tabsEl).forEach(function (t) { t.setAttribute('aria-pressed', String(t === b)); });
        render();
      });
      render();
    }
    var show = $('#showcase');
    if (show) {
      var items = flat.filter(function (it) { return it.showcase; }).slice(0, 6);
      show.className = 'menu-cards cards-a';
      show.innerHTML = items.map(cardHTML).join('');
    }
    // один обработчик на все карточки на странице
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.menu-card [data-act]');
      if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-act'), q = cart[id] || 0;
      var hadFocus = document.activeElement === b;
      var card = b.closest('.menu-card');
      if (hadFocus) card.setAttribute('data-focus', '');
      setQty(id, act === 'add' ? 1 : act === 'inc' ? q + 1 : q - 1);
      if (hadFocus) {
        var nq = cart[id] || 0;
        card.removeAttribute('data-focus');
        var t = card.querySelector('[data-act="' + (nq === 0 ? 'add' : act === 'add' ? 'inc' : act) + '"]');
        if (t) t.focus();
      }
    });
  }

  /* ========== 5. Корзина пекарни: панель и оформление ========== */
  var cartBtn = $('#cartBtn');
  var countEl = $('#cartCount');

  function refreshCartUI(pecked) {
    var n = count();
    if (countEl) { countEl.textContent = n; countEl.hidden = n === 0; }
    if (cartBtn) {
      cartBtn.setAttribute('aria-label', 'Корзина пекарни' + (n ? ', товаров: ' + n : ', пусто'));
      if (pecked) { cartBtn.classList.remove('peck-a', 'peck-b'); cartBtn.classList.add(bump % 2 ? 'peck-a' : 'peck-b'); }
    }
    bar.refresh();
  }

  var CLOSE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function signImgs(cls) {
    return '<img class="logo-l ' + cls + '" src="assets/sign-light.png" alt=""><img class="logo-d ' + cls + '" src="assets/sign-dark.png" alt="">';
  }
  function consentHTML(name) {
    return '<label class="consent" data-field="' + name + '"><input type="checkbox" name="' + name + '"> ' +
      '<span>Согласен(на) на обработку персональных данных по <a href="privacy.html" target="_blank">политике конфиденциальности</a>. Данные нужны только чтобы связаться по заказу.</span></label>';
  }

  var drawer = (function () {
    var layer, views, titleEl, subEl, linesEl, form, errorEl, lastFocus = null;
    var st = { open: false, step: 'cart', mode: 'delivery', when: 'asap', zone: 'unknown', callback: false };
    var d = SITE.delivery || {};
    var zoneKnown = !!(d.districts && d.districts.length);

    function build() {
      var html =
      '<div class="cart-layer" id="cartLayer" hidden>' +
        '<button class="veil" type="button" data-close aria-label="Закрыть корзину"></button>' +
        '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">' +
          '<div class="drawer-head"><h2 id="drawerTitle">Корзина</h2><span class="visually-hidden" id="drawerSub"></span>' +
            '<button class="btn-sky close-btn" type="button" data-close aria-label="Закрыть">' + CLOSE_SVG + '</button></div>' +

          '<div class="view view-center" id="viewEmpty" hidden>' +
            '<div class="bird-circle">' + signImgs('nod') + '</div>' +
            '<p>Корзина пока пустая. Загляните в пекарню — утренний хлеб ещё тёплый.</p>' +
            '<a class="btn-p btn-md" href="bakery.html#catalog">Перейти в пекарню</a>' +
          '</div>' +

          '<div class="view" id="viewList" hidden>' +
            '<div class="lines" id="cartLines"></div>' +
            '<div class="drawer-foot">' +
              '<p class="note" id="minHint" hidden></p>' +
              '<div class="total"><span>Итого</span><span class="js-total"></span></div>' +
              '<button class="btn-p btn-lg btn-block" type="button" id="toForm">Оформить заказ</button>' +
            '</div>' +
          '</div>' +

          '<form class="view" id="orderForm" novalidate hidden>' +
            '<div class="form-body">' +
              '<div class="modes" role="group" aria-label="Способ получения">' +
                '<button class="pill mode" type="button" data-mode="delivery" aria-pressed="true">Доставка</button>' +
                '<button class="pill mode" type="button" data-mode="pickup" aria-pressed="false">Самовывоз</button>' +
              '</div>' +
              '<div class="stack" id="deliveryBlock">' +
                '<label class="field" data-field="district">Район Уфы' +
                  '<select name="district"><option value="">Выберите район</option>' +
                    DISTRICTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') +
                    '<option value="?">Не знаю / другой</option></select>' +
                  '<span class="hint" id="zoneNote">' + (zoneKnown ? 'Проверим, возим ли мы туда.' : 'Зону доставки уточним при звонке.') + '</span>' +
                '</label>' +
                '<div class="zone-box line-in" id="zoneOut" hidden>' +
                  '<p><b>Сюда мы пока не возим.</b> Можно забрать заказ в пекарне или оставить телефон — перезвоним и подумаем вместе. Корзина сохранится.</p>' +
                  '<div class="btn-row"><button class="btn-p btn-sm" type="button" data-zone="pickup">Заберу в пекарне</button>' +
                  '<button class="btn-s btn-sm" type="button" data-zone="call">Перезвоните мне</button></div>' +
                '</div>' +
                '<label class="field" data-field="address">Адрес: улица, дом, квартира<input name="address" autocomplete="street-address"></label>' +
              '</div>' +
              '<div class="zone-box" id="pickupBlock" hidden><p><b>Самовывоз из пекарни:</b> г. Уфа, <span data-site="bakery.address">[адрес пекарни — уточнить]</span>. ' +
                'Часы: <span data-site="bakery.hours">[уточнить]</span>.</p></div>' +
              '<fieldset class="stack" style="border:0;margin:0;padding:0"><legend class="field" style="padding:0;margin-bottom:6px">Когда</legend>' +
                '<div class="choices">' +
                  '<label class="choice-opt"><input type="radio" name="when" value="asap" checked><b>Как можно скорее</b><span class="js-asap">' + (d.time ? esc(d.time) : 'срок уточним при звонке') + '</span></label>' +
                  '<label class="choice-opt"><input type="radio" name="when" value="time"><b>Ко времени</b><span>выберите день и час</span></label>' +
                '</div>' +
                '<div class="field-row" id="whenRow" hidden>' +
                  '<label class="field" data-field="date">День<input type="date" name="date"></label>' +
                  '<label class="field" data-field="time">Время<input type="time" name="time" step="900"></label>' +
                '</div>' +
              '</fieldset>' +
              '<label class="field" data-field="name">Имя<input name="name" autocomplete="name"></label>' +
              '<label class="field" data-field="phone">Телефон<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7"></label>' +
              '<label class="field">Комментарий к заказу<textarea name="comment" rows="3" placeholder="Домофон, этаж, пожелания"></textarea></label>' +
              consentHTML('consent') +
              '<p class="form-error line-in" id="formError" role="alert" hidden></p>' +
            '</div>' +
            '<div class="drawer-foot">' +
              '<div class="total"><span>К оплате</span><span class="js-total"></span></div>' +
              '<p class="note">Оплата при получении: [способ оплаты — уточнить]. Мы перезвоним и подтвердим заказ.</p>' +
              '<button class="btn-p btn-lg btn-block" type="submit">Отправить заказ</button>' +
              '<button class="btn-s btn-sm btn-block" type="button" id="backToCart">Вернуться к корзине</button>' +
            '</div>' +
          '</form>' +

          '<div class="view view-center" id="viewDone" hidden>' +
            '<div class="done-ring"><svg class="ring" aria-hidden="true" viewBox="0 0 220 220"><circle cx="110" cy="110" r="104" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 12"/></svg>' +
              '<div class="bird-circle">' + signImgs('hop') + '</div></div>' +
            '<p id="doneText"></p>' +
            '<button class="btn-s btn-md" type="button" data-close>Вернуться на сайт</button>' +
          '</div>' +
        '</aside>' +
      '</div>';
      document.body.insertAdjacentHTML('beforeend', html);
      layer = $('#cartLayer');
      views = { empty: $('#viewEmpty'), list: $('#viewList'), form: $('#orderForm'), done: $('#viewDone') };
      titleEl = $('#drawerTitle'); subEl = $('#drawerSub');
      linesEl = $('#cartLines'); form = $('#orderForm'); errorEl = $('#formError');
      bind();
    }

    function lineHTML(it, i) {
      var q = cart[it.id];
      var sum = typeof it.price === 'number' ? fmt(it.price * q) : '—';
      return '<div class="line line-in" data-id="' + it.id + '" style="animation-delay:' + (Math.min(i, 8) * 50) + 'ms">' +
        '<div class="line-info"><span class="line-name">' + esc(it.name) + '</span>' +
          '<span class="line-price">' + (typeof it.price === 'number' ? fmt(it.price) : 'цена [уточнить]') + ' × <span class="js-q">' + q + '</span></span></div>' +
        '<div class="line-step">' +
          '<button type="button" data-act="dec" data-id="' + it.id + '" aria-label="Убрать одну: ' + esc(it.name) + '">−</button>' +
          '<span class="qty js-q">' + q + '</span>' +
          '<button type="button" data-act="inc" data-id="' + it.id + '" aria-label="Добавить ещё: ' + esc(it.name) + '">+</button>' +
        '</div><span class="line-sum">' + sum + '</span></div>';
    }

    function currentView() {
      if (st.step === 'form') return 'form';
      if (st.step === 'done') return 'done';
      return count() > 0 ? 'list' : 'empty';
    }
    function updateTotals() {
      $$('.js-total', layer).forEach(function (el) { el.textContent = totalText(); el.className = 'js-total' + (totalInfo().known ? '' : ' unknown'); });
      var hint = $('#minHint');
      var t = totalInfo();
      if (d.minOrder && t.known && t.sum < d.minOrder) {
        hint.hidden = false;
        hint.textContent = 'До минимальной суммы доставки осталось ' + fmt(d.minOrder - t.sum) + '. Для самовывоза минимума нет.';
      } else hint.hidden = true;
    }
    function render() {
      var v = currentView();
      titleEl.textContent = v === 'form' ? 'Оформление' : v === 'done' ? 'Спасибо!' : 'Корзина пекарни';
      if (v === 'list') linesEl.innerHTML = lines().map(lineHTML).join('');
      if (v === 'form') applyMode();
      updateTotals();
      Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; });
    }
    function afterChange(id) {
      updateTotals();
      if (st.step !== 'cart') return;
      var v = currentView();
      if (v !== 'list' || views.list.hidden) { render(); return; }
      var row = linesEl.querySelector('.line[data-id="' + id + '"]');
      var q = cart[id] || 0;
      if (!row) { render(); return; }
      if (q === 0) { row.remove(); return; }
      $$('.js-q', row).forEach(function (el) { el.textContent = q; });
      var it = byId[id];
      row.querySelector('.line-sum').textContent = typeof it.price === 'number' ? fmt(it.price * q) : '—';
    }

    function applyMode() {
      $$('[data-mode]', form).forEach(function (m) { m.setAttribute('aria-pressed', String(m.getAttribute('data-mode') === st.mode)); });
      $('#deliveryBlock').hidden = st.mode !== 'delivery';
      $('#pickupBlock').hidden = st.mode !== 'pickup';
      checkZone();
    }
    function checkZone() {
      var sel = form.elements.district.value;
      var out = $('#zoneOut');
      if (!zoneKnown || !sel || sel === '?') { st.zone = sel === '?' ? 'ask' : 'unknown'; out.hidden = true; return; }
      st.zone = d.districts.indexOf(sel) >= 0 ? 'in' : 'out';
      out.hidden = st.zone !== 'out' || st.callback;
      $('#zoneNote').textContent = st.zone === 'in' ? 'Отлично, сюда возим.' : st.callback ? 'Перезвоним и договоримся о доставке.' : 'Проверим, возим ли мы туда.';
    }

    function mark(name, bad) {
      var f = form.querySelector('[data-field="' + name + '"]');
      if (f) { if (bad) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }
      return bad;
    }
    function showError(text, focusEl) {
      errorEl.textContent = text; errorEl.hidden = false;
      if (focusEl) focusEl.focus();
    }
    function hideError() { errorEl.hidden = true; errorEl.textContent = ''; }

    function submit(e) {
      e.preventDefault();
      var f = form.elements;
      $$('[aria-invalid]', form).forEach(function (x) { x.removeAttribute('aria-invalid'); });
      var name = f.name.value.trim(), phone = f.phone.value.trim(), address = f.address.value.trim();
      if (mark('name', !name) | mark('phone', digits(phone).length < 10)) {
        return showError('Укажите имя и телефон, чтобы мы могли подтвердить заказ.', !name ? f.name : f.phone);
      }
      if (st.mode === 'delivery') {
        if (zoneKnown && mark('district', !f.district.value)) return showError('Выберите район, чтобы мы проверили доставку.', f.district);
        if (st.zone === 'out' && !st.callback) return showError('Сюда мы пока не возим — выберите самовывоз или попросите перезвонить.', $('[data-zone="pickup"]', form));
        if (mark('address', !address)) return showError('Укажите адрес доставки или выберите самовывоз.', f.address);
      }
      if (st.when === 'time') {
        var bad = !f.date.value || !f.time.value;
        mark('date', !f.date.value); mark('time', !f.time.value);
        if (bad) return showError('Выберите день и время или «Как можно скорее».', !f.date.value ? f.date : f.time);
        var chosen = new Date(f.date.value + 'T' + f.time.value);
        if (chosen < new Date()) { mark('time', true); return showError('Это время уже прошло — выберите другое.', f.time); }
      }
      if (mark('consent', !f.consent.checked)) return showError('Отметьте согласие на обработку персональных данных.', f.consent);

      var order = {
        items: lines().map(function (it) { return { id: it.id, name: it.name, qty: cart[it.id], price: it.price }; }),
        total: totalInfo(), mode: st.mode, district: f.district.value, address: address,
        outOfZoneCallback: st.callback, when: st.when === 'asap' ? 'asap' : f.date.value + ' ' + f.time.value,
        name: name, phone: phone, comment: f.comment.value.trim()
      };
      sendRequest('order', order).then(function () {
        Object.keys(cart).forEach(function (id) { delete cart[id]; refreshCard(id); });
        store.set('slavodolie-cart', cart);
        refreshCartUI(false);
        form.reset(); st.when = 'asap'; st.callback = false; $('#whenRow').hidden = true;
        hideError();
        var mins = d.callbackMinutes ? ' в течение ' + d.callbackMinutes + ' минут' : '';
        $('#doneText').textContent = 'Спасибо за заказ! Мы перезвоним' + mins + ', чтобы подтвердить состав и время.' +
          (order.outOfZoneCallback ? ' Заодно договоримся, как доставить заказ по вашему адресу.' : '');
        st.step = 'done'; render();
        var back = views.done.querySelector('button'); if (back) back.focus({ preventScroll: true });
      });
    }

    function bind() {
      $$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open) close(); });
      $('#toForm').addEventListener('click', function () {
        st.step = 'form'; render();
        var first = $('[data-mode][aria-pressed="true"]', form); if (first) first.focus({ preventScroll: true });
      });
      $('#backToCart').addEventListener('click', function () { hideError(); st.step = 'cart'; render(); });
      linesEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var id = b.getAttribute('data-id'), q = cart[id] || 0, hadFocus = document.activeElement === b;
        setQty(id, b.getAttribute('data-act') === 'inc' ? q + 1 : q - 1);
        if (hadFocus && !document.body.contains(b)) {
          var next = linesEl.querySelector('[data-act="dec"]') || layer.querySelector('.close-btn');
          if (next) next.focus();
        }
      });
      $$('[data-mode]', form).forEach(function (m) {
        m.addEventListener('click', function () { st.mode = m.getAttribute('data-mode'); hideError(); applyMode(); });
      });
      form.elements.district.addEventListener('change', function () { st.callback = false; checkZone(); });
      $$('[data-zone]', form).forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('data-zone') === 'pickup') { st.mode = 'pickup'; applyMode(); }
          else { st.callback = true; checkZone(); form.elements.address.focus(); }
          hideError();
        });
      });
      $$('input[name="when"]', form).forEach(function (r) {
        r.addEventListener('change', function () {
          st.when = r.value; $('#whenRow').hidden = st.when !== 'time';
          if (st.when === 'time' && !form.elements.date.value) form.elements.date.value = isoDate(new Date());
        });
      });
      form.elements.date.min = isoDate(new Date());
      form.addEventListener('input', function (e) {
        hideError();
        var f = e.target.closest('[data-field]'); if (f) f.removeAttribute('aria-invalid');
      });
      form.addEventListener('submit', submit);
    }

    function open() {
      if (!layer) build();
      if (st.step === 'done') st.step = 'cart';
      st.open = true;
      lastFocus = document.activeElement;
      fillSiteData();
      render();
      layer.hidden = false;
      var c = layer.querySelector('.close-btn'); if (c) c.focus({ preventScroll: true });
    }
    function close() {
      if (st.step === 'done') st.step = 'cart';
      st.open = false;
      layer.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    return { open: open, close: close, isOpen: function () { return st.open; }, afterChange: afterChange };
  })();

  /* ========== 6. Нижняя плашка корзины (телефон) ========== */
  var bar = (function () {
    var el = null;
    var enabled = document.body.hasAttribute('data-cart-bar');
    function refresh() {
      if (!enabled) return;
      var n = count();
      if (!el) {
        document.body.insertAdjacentHTML('beforeend', '<button class="cart-bar" id="cartBar" type="button" hidden><span class="txt"></span><span class="go">Оформить</span></button>');
        el = $('#cartBar');
        el.addEventListener('click', drawer.open);
      }
      el.hidden = n === 0;
      document.body.classList.toggle('has-bar', n > 0);
      var t = totalInfo();
      el.querySelector('.txt').textContent = 'Корзина · ' + n + ' шт.' + (t.known && n ? ' · ' + fmt(t.sum) : '');
    }
    return { refresh: refresh };
  })();

  /* ---------- общий помощник для пошаговых форм ---------- */
  function wizard(formEl, opts) {
    var panels = $$('[data-step]', formEl);
    var prog = $$('.progress li', formEl);
    var errorEl = $('.form-error', formEl);
    var cur = 0;
    function show(i, focus) {
      cur = i;
      panels.forEach(function (p, k) { p.hidden = k !== i; });
      prog.forEach(function (li, k) {
        li.classList.toggle('done', k < i);
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (errorEl) { errorEl.hidden = true; }
      if (opts.onShow) opts.onShow(i);
      if (focus) { var h = panels[i].querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: false }); } }
    }
    function fail(text, el) {
      if (errorEl) { errorEl.textContent = text; errorEl.hidden = false; }
      if (el) { var f = el.closest('[data-field]'); if (f) f.setAttribute('aria-invalid', 'true'); el.focus(); }
      return false;
    }
    formEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-next]')) { if (opts.validate(cur, fail)) show(cur + 1, true); }
      if (e.target.closest('[data-prev]')) show(cur - 1, true);
    });
    formEl.addEventListener('input', function (e) {
      if (errorEl) errorEl.hidden = true;
      var f = e.target.closest('[data-field]'); if (f) f.removeAttribute('aria-invalid');
      if (opts.onInput) opts.onInput(e);
    });
    formEl.addEventListener('change', function (e) { if (opts.onInput) opts.onInput(e); });
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!opts.validate(cur, fail)) return;
      opts.submit();
    });
    show(0, false);
    return { show: show };
  }

  /* ========== 7. Пироги на заказ ========== */
  function initPies() {
    var formEl = $('#pieForm');
    if (!formEl) return;
    var P = SITE.pies || {};
    var fill = $('#pieFillings'), wts = $('#pieWeights');
    fill.innerHTML = (P.fillings || []).map(function (x, i) {
      return '<label class="choice-opt"><input type="radio" name="filling" value="' + esc(x.id) + '"' + (i === 0 ? '' : '') + '><b>' + esc(x.name) + '</b><span>Фото на разрезе [уточнить]</span></label>';
    }).join('');
    wts.innerHTML = (P.weights || []).map(function (x) {
      return '<label class="choice-opt"><input type="radio" name="weight" value="' + esc(x.id) + '"><b>' + esc(x.label) + '</b><span>' + esc(x.serves) +
        (typeof x.price === 'number' ? ' · ' + fmt(x.price) : ' · цена [уточнить]') + '</span></label>';
    }).join('');
    var lead = typeof P.leadDays === 'number' && P.leadDays > 0 ? P.leadDays : 1;
    var min = new Date(); min.setDate(min.getDate() + lead);
    formEl.elements.date.min = isoDate(min);
    $('#pieLead').textContent = typeof P.leadDays === 'number'
      ? 'Принимаем заказ минимум за ' + P.leadDays + ' дн. Ближайшая дата — ' + ruDate(isoDate(min)) + '.'
      : 'Ближайшая дата — ' + ruDate(isoDate(min)) + '. Точный срок заказа [уточнить].';
    if (P.prepay) $('#piePrepay').textContent = P.prepay;

    var val = function (n) { var r = formEl.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; };
    var find = function (arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0]; };
    function summary() {
      var f = find(P.fillings, val('filling')), w = find(P.weights, val('weight'));
      var parts = [f ? f.name : null, w ? w.label : null, formEl.elements.date.value ? ruDate(formEl.elements.date.value) : null,
        formEl.elements.date.value ? (val('pmode') === 'delivery' ? 'доставка' : 'самовывоз') : null].filter(Boolean);
      $$('.js-pie-summary', formEl).forEach(function (el) { el.textContent = parts.length ? parts.join(' · ') : 'Пока ничего не выбрано'; });
    }
    function syncMode() { $('#pieAddress').hidden = val('pmode') !== 'delivery'; }

    var w = wizard(formEl, {
      onShow: function () { summary(); syncMode(); },
      onInput: function () { summary(); syncMode(); },
      validate: function (i, fail) {
        var f = formEl.elements;
        if (i === 0 && !val('filling')) return fail('Выберите начинку.', formEl.querySelector('input[name="filling"]'));
        if (i === 1 && !val('weight')) return fail('Выберите вес пирога.', formEl.querySelector('input[name="weight"]'));
        if (i === 2) {
          if (!f.date.value) return fail('Выберите дату.', f.date);
          if (f.date.value < f.date.min) return fail('На эту дату уже не успеем — выберите ' + ruDate(f.date.min) + ' или позже.', f.date);
          if (val('pmode') === 'delivery' && !f.address.value.trim()) return fail('Укажите адрес доставки или выберите самовывоз.', f.address);
        }
        if (i === 3) {
          if (!f.name.value.trim()) return fail('Укажите имя.', f.name);
          if (digits(f.phone.value).length < 10) return fail('Укажите телефон, чтобы мы могли подтвердить заказ.', f.phone);
          if (!f.consent.checked) return fail('Отметьте согласие на обработку персональных данных.', f.consent);
        }
        return true;
      },
      submit: function () {
        var f = formEl.elements;
        sendRequest('pie', { filling: val('filling'), weight: val('weight'), date: f.date.value, mode: val('pmode'), address: f.address.value.trim(),
          name: f.name.value.trim(), phone: f.phone.value.trim(), wish: f.wish.value.trim() }).then(function () {
          formEl.hidden = true;
          var t = $('#pieThanks'); t.hidden = false;
          $('#pieThanksText').textContent = 'Спасибо! Заявка на пирог (' + $('.js-pie-summary', formEl).textContent + ') у нас. Перезвоним, чтобы всё подтвердить и рассказать о предоплате.';
          var b = t.querySelector('button, a'); if (b) b.focus();
        });
      }
    });
    $('#pieAgain') && $('#pieAgain').addEventListener('click', function () {
      formEl.reset(); formEl.hidden = false; $('#pieThanks').hidden = true; w.show(0, true);
    });
  }

  /* ========== 8. Обеды для организаций ========== */
  function initLunch() {
    var formEl = $('#lunchForm');
    if (!formEl) return;
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    formEl.elements.start.min = isoDate(tomorrow);
    var w = wizard(formEl, {
      validate: function (i, fail) {
        var f = formEl.elements;
        if (i === 0) {
          if (!f.org.value.trim()) return fail('Укажите организацию.', f.org);
          if (!f.person.value.trim()) return fail('Укажите контактное лицо.', f.person);
          if (digits(f.phone.value).length < 10) return fail('Укажите телефон для связи.', f.phone);
          if (f.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return fail('Проверьте e-mail.', f.email);
        }
        if (i === 1) {
          if (!f.address.value.trim()) return fail('Укажите адрес, куда привозить обеды.', f.address);
          if (!(Number(f.people.value) > 0)) return fail('Укажите, на сколько человек.', f.people);
          if (!f.consent.checked) return fail('Отметьте согласие на обработку персональных данных.', f.consent);
        }
        return true;
      },
      submit: function () {
        var f = formEl.elements, data = {};
        ['org', 'inn', 'person', 'phone', 'email', 'address', 'people', 'start', 'freq', 'comment'].forEach(function (k) { data[k] = (f[k].value || '').trim(); });
        sendRequest('lunch', data).then(function () {
          formEl.hidden = true;
          var t = $('#lunchThanks'); t.hidden = false;
          var b = t.querySelector('a, button'); if (b) b.focus();
        });
      }
    });
    $('#lunchAgain') && $('#lunchAgain').addEventListener('click', function () {
      formEl.reset(); formEl.hidden = false; $('#lunchThanks').hidden = true; w.show(0, true);
    });
  }

  /* закреплённая кнопка на телефоне прячется, когда её цель уже на экране */
  function initStickyCta() {
    $$('.sticky-cta').forEach(function (bar) {
      document.body.classList.add('has-bar');
      var target = bar.getAttribute('data-hide-on') && $(bar.getAttribute('data-hide-on'));
      if (!target || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(function (en) { bar.hidden = en[0].isIntersecting; }).observe(target);
    });
  }

  /* ---------- Старт ---------- */
  fillSiteData();
  initBurger();
  initCatalog();
  if (cartBtn) cartBtn.addEventListener('click', drawer.open);
  $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', drawer.open); });
  refreshCartUI(false);
  initPies();
  initLunch();
  initStickyCta();
  // корзина общая для всех вкладок браузера
  window.addEventListener('storage', function (e) {
    if (e.key !== 'slavodolie-cart') return;
    var fresh = store.get('slavodolie-cart') || {};
    Object.keys(byId).forEach(function (id) { var q = fresh[id] | 0; if ((cart[id] || 0) !== q) { if (q) cart[id] = q; else delete cart[id]; refreshCard(id); } });
    refreshCartUI(false);
  });
})();
