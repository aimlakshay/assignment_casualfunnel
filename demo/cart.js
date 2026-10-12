// Demo store cart: kept in localStorage so it survives page changes.
// Any element with data-add-to-cart="<product id>" adds that product.
(function () {
  'use strict';

  var CART_KEY = 'shopdemo_cart';

  var PRODUCTS = {
    backpack: { name: 'Canvas Backpack', price: 49, emoji: '🎒' },
    bottle: { name: 'Steel Water Bottle', price: 19, emoji: '🧴' },
    earbuds: { name: 'Wireless Earbuds', price: 89, emoji: '🎧' },
    lamp: { name: 'Desk Lamp', price: 34, emoji: '💡' },
    notebook: { name: 'Notebook Set', price: 12, emoji: '📓' },
    cap: { name: 'Running Cap', price: 22, emoji: '🧢' },
  };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      /* cart still works for this page */
    }
  }

  var cart = load();

  function money(n) {
    return '$' + n.toFixed(2);
  }

  function count() {
    var n = 0;
    for (var id in cart) n += cart[id];
    return n;
  }

  function total() {
    var t = 0;
    for (var id in cart) if (PRODUCTS[id]) t += PRODUCTS[id].price * cart[id];
    return t;
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = qty;
    save(cart);
    render();
  }

  function render() {
    var badge = document.getElementById('cart-count');
    var n = count();
    if (badge) {
      badge.textContent = n;
      badge.hidden = n === 0;
    }

    var list = document.getElementById('cart-items');
    var totalEl = document.getElementById('cart-total');
    var checkout = document.getElementById('cart-checkout');
    if (!list) return;

    list.innerHTML = '';
    var ids = Object.keys(cart).filter(function (id) {
      return PRODUCTS[id];
    });

    if (ids.length === 0) {
      list.innerHTML =
        '<div class="cart-empty"><div class="cart-empty-icon">🛒</div>' +
        '<p>Your cart is empty</p><span>Add a few products to see them here.</span></div>';
    }

    ids.forEach(function (id) {
      var p = PRODUCTS[id];
      var qty = cart[id];
      var row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML =
        '<div class="cart-thumb">' + p.emoji + '</div>' +
        '<div class="cart-info"><div class="cart-name">' + p.name + '</div>' +
        '<div class="cart-price">' + money(p.price) + ' each</div>' +
        '<div class="qty">' +
        '<button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>' +
        '<span>' + qty + '</span>' +
        '<button type="button" data-qty="1" aria-label="Increase quantity">+</button>' +
        '</div></div>' +
        '<div class="cart-side"><div class="cart-line">' + money(p.price * qty) + '</div>' +
        '<button type="button" class="link-btn" data-remove>Remove</button></div>';

      row.querySelector('[data-qty="-1"]').onclick = function () {
        setQty(id, qty - 1);
      };
      row.querySelector('[data-qty="1"]').onclick = function () {
        setQty(id, qty + 1);
      };
      row.querySelector('[data-remove]').onclick = function () {
        setQty(id, 0);
        toast(p.name + ' removed');
      };
      list.appendChild(row);
    });

    if (totalEl) totalEl.textContent = money(total());
    if (checkout) checkout.disabled = ids.length === 0;
  }

  function openCart() {
    document.body.classList.add('cart-open');
  }

  function closeCart() {
    document.body.classList.remove('cart-open');
  }

  function addToCart(id, button) {
    var p = PRODUCTS[id];
    if (!p) return;
    setQty(id, (cart[id] || 0) + 1);
    toast(p.emoji + ' ' + p.name + ' added to cart');

    var badge = document.getElementById('cart-count');
    if (badge) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // restart the animation
      badge.classList.add('bump');
    }
    if (button) {
      var label = button.textContent;
      button.textContent = 'Added ✓';
      button.classList.add('added');
      setTimeout(function () {
        button.textContent = label;
        button.classList.remove('added');
      }, 1200);
    }
  }

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add-to-cart]');
    if (add) return addToCart(add.getAttribute('data-add-to-cart'), add);
    if (e.target.closest('[data-open-cart]')) return openCart();
    if (e.target.closest('[data-close-cart]')) return closeCart();
    if (e.target.closest('#cart-checkout')) {
      cart = {};
      save(cart);
      render();
      closeCart();
      toast('🎉 Order placed (demo, nothing is charged)');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCart();
  });

  // Keep the badge in sync if the cart changes in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === CART_KEY) {
      cart = load();
      render();
    }
  });

  window.toast = toast;
  render();
})();
