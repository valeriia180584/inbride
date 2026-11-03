/* InBride — інтерактивність лендингу */
(function () {
  'use strict';

  /* Кольори відтінків для кружечків. ДЕМО: замініть на реальні відтінки тканин. */
  var SHADE_COLORS = {
    'Білий': '#FFFFFF',
    'Айворі': '#F4EBD8',
    'Молочний': '#F7F0E4',
    'Шампань': '#EADBC3',
    'Сріблястий': '#C9C8C4'
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Рік у підвалі ---------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Мобільне меню ---------- */
  var burger = $('.burger');
  var nav = $('#main-nav');

  function setMenu(open) {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.querySelector('.visually-hidden').textContent = open ? 'Закрити меню' : 'Відкрити меню';
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  }

  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });
    window.matchMedia('(min-width: 1000px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Відтінки на картках ---------- */
  var products = $$('.product');

  function splitList(str) {
    return (str || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  products.forEach(function (card, i) {
    var shades = splitList(card.dataset.shades);
    var fs = $('.swatches', card);
    if (!fs || !shades.length) { if (fs) fs.remove(); return; }

    var nameOut = document.createElement('span');
    nameOut.className = 'swatch-name';
    nameOut.setAttribute('aria-hidden', 'true');

    shades.forEach(function (shade, j) {
      var label = document.createElement('label');
      label.className = 'swatch';
      label.innerHTML =
        '<input type="radio" name="shade-' + i + '" value="' + shade + '"' + (j === 0 ? ' checked' : '') + '>' +
        '<span style="--sw:' + (SHADE_COLORS[shade] || '#fff') + '"></span>' +
        '<span class="visually-hidden">' + shade + '</span>';
      fs.appendChild(label);
    });
    fs.appendChild(nameOut);
    nameOut.textContent = shades[0];

    fs.addEventListener('change', function (e) {
      if (e.target.name === 'shade-' + i) nameOut.textContent = e.target.value;
    });
  });

  /* ---------- Фільтр колекції ---------- */
  var chips = $$('.chip');
  var emptyState = $('#empty-state');
  var emptyCta = $('#empty-cta');
  var CATEGORY_NAMES = { veil: 'фати', cape: 'накидки й кейпи', gloves: 'рукавички', hair: 'прикраси для волосся' };

  function countIn(filter) {
    return products.filter(function (p) { return p.dataset.category === filter; }).length;
  }

  // Ховаємо кнопки фільтра для категорій, де ще немає виробів
  chips.forEach(function (c) {
    if (c.dataset.filter !== 'all' && countIn(c.dataset.filter) === 0) c.hidden = true;
  });

  function applyFilter(filter) {
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
    });
    var shown = 0;
    products.forEach(function (p) {
      var match = filter === 'all' || p.dataset.category === filter;
      p.hidden = !match;
      if (match) shown++;
    });
    if (emptyState) {
      emptyState.hidden = shown > 0;
      if (!shown && emptyCta) {
        var name = CATEGORY_NAMES[filter] || 'ці вироби';
        $('#empty-text').textContent = 'Вироби категорії «' + name + '» ще не додані на сайт. Залиште заявку, і ми розповімо про доступні моделі.';
        emptyCta.dataset.prefill = name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { applyFilter(chip.dataset.filter); });
  });

  // Картки категорій ведуть до колекції з відповідним фільтром
  $$('.category[data-filter]').forEach(function (cat) {
    cat.addEventListener('click', function () { applyFilter(cat.dataset.filter); });
  });

  /* ---------- Передзаповнення форми ---------- */
  var itemInput = $('#f-item');
  var orderSection = $('#order');

  function goToForm(text, focusId) {
    if (itemInput && text) {
      itemInput.value = text;
      itemInput.removeAttribute('aria-invalid');
      var err = $('#f-item-err');
      if (err) err.hidden = true;
    }
    if (orderSection) orderSection.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    var target = $('#' + (focusId || 'f-name'));
    if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, prefersReduced() ? 0 : 600);
  }

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  $$('[data-prefill]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      goToForm(el.dataset.prefill, el.dataset.focus);
    });
  });

  /* ---------- Вікно «Детальніше» ---------- */
  var dialog = $('#product-dialog');
  var currentCard = null;

  function buildOptions(container, name, values, selected, withColor) {
    container.innerHTML = '';
    values.forEach(function (v, idx) {
      var label = document.createElement('label');
      label.className = 'option';
      var checked = selected ? v === selected : idx === 0;
      label.innerHTML =
        '<input type="radio" name="' + name + '" value="' + v + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + (withColor ? '<i style="--sw:' + (SHADE_COLORS[v] || '#fff') + '"></i>' : '') + v + '</span>';
      container.appendChild(label);
    });
  }

  function imgSrc(name, w) { return 'images/' + name + '-' + w + '.webp'; }

  function showImage(name, alt) {
    var img = $('#pd-img');
    img.src = imgSrc(name, 1200);
    img.srcset = imgSrc(name, 640) + ' 640w, ' + imgSrc(name, 1200) + ' 1200w';
    img.sizes = '(min-width: 800px) 520px, 100vw';
    img.alt = alt || '';
  }

  function buildGallery(images, alts, title) {
    var thumbs = $('#pd-thumbs');
    thumbs.innerHTML = '';
    if (!images.length) return;
    showImage(images[0], alts[0] || title);
    if (images.length < 2) return;
    images.forEach(function (name, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pd-thumb';
      b.setAttribute('aria-label', 'Фото ' + (idx + 1) + ' з ' + images.length);
      if (idx === 0) b.setAttribute('aria-current', 'true');
      b.innerHTML = '<img src="' + imgSrc(name, 640) + '" alt="" width="64" height="80" loading="lazy">';
      b.addEventListener('click', function () {
        showImage(name, alts[idx] || title);
        $$('.pd-thumb', thumbs).forEach(function (t) { t.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
      });
      thumbs.appendChild(b);
    });
  }

  function openDetails(card) {
    currentCard = card;
    var d = card.dataset;
    var shades = splitList(d.shades);
    var lengths = splitList(d.lengths);
    var checkedShade = $('.swatches input:checked', card);

    $('#pd-title').textContent = d.name;
    $('#pd-price').textContent = d.price;
    $('#pd-desc').textContent = d.desc;
    buildGallery(splitList(d.images), splitList(d.alts), d.name);

    var shadeBox = $('#pd-shades');
    shadeBox.hidden = !shades.length;
    buildOptions($('.options', shadeBox), 'pd-shade', shades, checkedShade ? checkedShade.value : null, true);

    var lenBox = $('#pd-lengths');
    lenBox.hidden = !lengths.length;
    $('legend', lenBox).textContent = d.lengthLabel || 'Довжина';
    buildOptions($('.options', lenBox), 'pd-length', lengths, null, false);

    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      dialog.scrollTop = 0;
    } else {
      // Старі браузери без <dialog>: одразу до форми
      goToForm(d.name);
    }
  }

  $$('.js-details').forEach(function (btn) {
    btn.addEventListener('click', function () { openDetails(btn.closest('.product')); });
  });

  // Синхронізуємо відтінок у вікні з карткою
  if (dialog) {
    dialog.addEventListener('change', function (e) {
      if (e.target.name === 'pd-shade' && currentCard) {
        var r = $('.swatches input[value="' + e.target.value + '"]', currentCard);
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });
    // Клік по затемненню закриває вікно
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  var pdOrder = $('#pd-order');
  if (pdOrder) {
    pdOrder.addEventListener('click', function () {
      if (!currentCard) return;
      var parts = [currentCard.dataset.name];
      var s = $('input[name="pd-shade"]:checked', dialog);
      var l = $('input[name="pd-length"]:checked', dialog);
      if (s && !$('#pd-shades').hidden) parts.push(s.value.toLowerCase());
      if (l && !$('#pd-lengths').hidden) parts.push(l.value);
      dialog.close();
      goToForm(parts.join(', '));
    });
  }

  /* ---------- Попередній перегляд вишивки ---------- */
  var embInitials = $('#emb-initials');
  var embDate = $('#emb-date');
  var embText = $('#emb-text');
  var embPreview = $('#emb-preview');
  var threadBox = $('#thread-options');

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function embValues() {
    return {
      initials: embInitials ? embInitials.value.trim() : '',
      date: embDate ? embDate.value.trim() : '',
      text: embText ? embText.value.trim() : ''
    };
  }

  function renderPreview() {
    if (!embPreview) return;
    var v = embValues();
    var lines = [v.initials, v.text, v.date].filter(Boolean).map(escapeHtml);
    embPreview.innerHTML = lines.length ? lines.join('<br>') : 'А &amp; М<br>12.09.2027';
  }

  [embInitials, embDate, embText].forEach(function (el) {
    if (el) el.addEventListener('input', renderPreview);
  });

  if (threadBox && embPreview) {
    var applyThread = function () {
      var r = $('input:checked', threadBox);
      if (r) embPreview.style.setProperty('--thread', r.dataset.color);
    };
    threadBox.addEventListener('change', applyThread);
    applyThread();
  }

  var embSend = $('#emb-send');
  if (embSend) {
    embSend.addEventListener('click', function () {
      var v = embValues();
      var parts = [];
      if (v.initials) parts.push('ініціали «' + v.initials + '»');
      if (v.text) parts.push('надпис «' + v.text + '»');
      if (v.date) parts.push('дата ' + v.date);
      var thread = threadBox ? $('input:checked', threadBox) : null;
      var text = 'Вишивка на фаті' + (parts.length ? ': ' + parts.join(', ') : '') +
        (thread ? '; нитка: ' + thread.value : '');
      goToForm(text);
    });
  }

  /* ---------- Форма заявки ---------- */
  var form = $('#lead-form');
  if (!form) return;

  var statusEl = $('#form-status');
  var submitBtn = $('button[type="submit"]', form);
  var dateInput = $('#f-date');

  // Дата весілля не може бути в минулому
  if (dateInput) {
    var t = new Date();
    var iso = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateInput.min = iso;
  }

  function phoneDigits(v) { return (v || '').replace(/\D/g, ''); }

  function validPhone(v) {
    var d = phoneDigits(v);
    // 0XXXXXXXXX, 380XXXXXXXXX або міжнародний номер 10–15 цифр
    return /^0\d{9}$/.test(d) || /^380\d{9}$/.test(d) || (d.length >= 10 && d.length <= 15);
  }

  var rules = {
    'f-name': function (el) { return el.value.trim().length >= 2 ? '' : 'Вкажіть, будь ласка, ваше ім\'я.'; },
    'f-phone': function (el) { return validPhone(el.value) ? '' : 'Вкажіть номер телефону, наприклад +380 67 123 45 67.'; },
    'f-date': function (el) {
      if (!el.value) return 'Оберіть дату весілля. Якщо дата ще не відома, вкажіть орієнтовну.';
      if (el.min && el.value < el.min) return 'Дата весілля не може бути в минулому.';
      return '';
    },
    'f-item': function (el) { return el.value.trim() ? '' : 'Напишіть, який аксесуар вас цікавить, або оберіть «Ще не визначилася».'; },
    'f-photo': function (el) {
      if (!el.value.trim()) return '';
      return /^https?:\/\/\S+\.\S+/i.test(el.value.trim()) ? '' : 'Посилання має починатися з https://';
    },
    'f-consent': function (el) { return el.checked ? '' : 'Щоб надіслати заявку, потрібна ваша згода на обробку даних.'; }
  };

  function check(id) {
    var el = document.getElementById(id);
    var errEl = document.getElementById(id + '-err');
    var msg = rules[id](el);
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', id + '-err');
      errEl.textContent = msg;
      errEl.hidden = false;
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
      errEl.hidden = true;
    }
    return !msg;
  }

  Object.keys(rules).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.addEventListener('change', function () { check(id); });
      return;
    }
    // Помилку прибираємо під час введення, а не на blur:
    // інакше макет зсувається саме в момент кліку на наступне поле.
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid')) check(id);
    });
    // На blur лише показуємо помилку для заповненого поля
    el.addEventListener('blur', function () {
      if (el.value && !el.getAttribute('aria-invalid') && rules[id](el)) check(id);
    });
  });

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'form-status' + (type ? ' is-' + type : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstInvalid = null;
    Object.keys(rules).forEach(function (id) {
      if (!check(id) && !firstInvalid) firstInvalid = document.getElementById(id);
    });
    if (firstInvalid) {
      setStatus('Перевірте поля, позначені вище.', 'error');
      firstInvalid.focus();
      return;
    }

    var data = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      weddingDate: form.weddingDate.value,
      accessory: form.accessory.value.trim(),
      dressPhoto: form.dressPhoto.value.trim(),
      consent: form.consent.checked,
      company: form.company.value, // пастка для ботів
      page: location.href
    };

    submitBtn.disabled = true;
    setStatus('Надсилаємо заявку…', '');

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok || !body.ok) throw new Error(body.error || 'HTTP ' + res.status);
        });
      })
      .then(function () {
        form.reset();
        setStatus('Дякуємо, ' + data.name + '! Заявку отримано. Ми зв\'яжемося з вами за вказаним номером.', 'success');
      })
      .catch(function (err) {
        if (window.console) console.warn('[InBride] Заявка не надіслана:', err.message);
        setStatus('Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам в Instagram чи зателефонуйте — контакти внизу сторінки.', 'error');
      })
      .then(function () {
        submitBtn.disabled = false;
      });
  });
})();
