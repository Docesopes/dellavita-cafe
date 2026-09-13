/* ============================================================
   Dellavita — main.js
   Carousel + nav state + cart (persisted in localStorage)
   ============================================================ */

const WHATSAPP_NUMBER = "5493482640243"; // +54 9 3482 64-0243, formato wa.me

/* ---------- Nav solid on scroll ---------- */
const nav = document.querySelector(".site-nav");
if (nav) {
  const setNavState = () => {
    if (window.scrollY > 60) nav.classList.add("solid");
    else nav.classList.remove("solid");
  };
  setNavState();
  window.addEventListener("scroll", setNavState, { passive: true });
}

/* ---------- Hero carousel ---------- */
(function initCarousel() {
  const slides = document.querySelectorAll(".slide");
  const dotsWrap = document.querySelector(".carousel-controls");
  if (!slides.length || !dotsWrap) return;

  let current = 0;
  let timer;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", "Ir a la imagen " + (i + 1));
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = dotsWrap.querySelectorAll(".dot");

  function goTo(index) {
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = index;
    slides[current].classList.add("active");
    dots[current].classList.add("active");
    resetTimer();
  }

  function next() { goTo((current + 1) % slides.length); }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(next, 5500);
  }
  resetTimer();
})();

/* ---------- Cart ---------- */
const Cart = {
  KEY: "dellavita-cart",
  items: [],

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.items = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.items = [];
    }
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.items)); } catch (e) {}
  },
  add(product) {
    const existing = this.items.find((i) => i.id === product.id);
    if (existing) existing.qty += 1;
    else this.items.push({ ...product, qty: 1 });
    this.save();
    render();
    openCart();
  },
  changeQty(id, delta) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) this.items = this.items.filter((i) => i.id !== id);
    this.save();
    render();
  },
  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.save();
    render();
  },
  total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  },
  count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  },
};

function formatARS(n) {
  return "$" + n.toLocaleString("es-AR");
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

const BEAN_COLORS = ["#8C5A2E", "#A8492E", "#C79A44", "#5A3A1C", "#5C6B47"];

function productCardHTML(p, i) {
  const c1 = BEAN_COLORS[i % BEAN_COLORS.length];
  const c2 = BEAN_COLORS[(i + 1) % BEAN_COLORS.length];
  const c3 = BEAN_COLORS[(i + 2) % BEAN_COLORS.length];
  const price = Number(p.price) || 0;
  return `
    <article class="product-card">
      <span class="product-badge">${escapeHTML(p.badge)}</span>
      <div class="product-art">
        <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="65" rx="26" ry="17" fill="${c1}" transform="rotate(-15 60 65)"/>
          <ellipse cx="100" cy="50" rx="26" ry="17" fill="${c2}" transform="rotate(10 100 50)"/>
          <ellipse cx="140" cy="70" rx="26" ry="17" fill="${c3}" transform="rotate(-8 140 70)"/>
        </svg>
      </div>
      <h3 class="product-name">${escapeHTML(p.name)}</h3>
      <div class="product-origin">${escapeHTML(p.origin)}</div>
      <p class="product-notes">${escapeHTML(p.notes)}</p>
      <div class="product-foot">
        <span class="product-price">${formatARS(price)}</span>
        <button class="add-btn" data-id="${escapeHTML(p.id)}" data-name="${escapeHTML(p.name)} (250 g)" data-price="${price}">Agregar</button>
      </div>
    </article>`;
}

async function loadProducts() {
  const container = document.getElementById("product-row");
  if (!container) return;
  try {
    const res = await fetch("products.json?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar la tienda");
    const products = await res.json();
    container.innerHTML = products.map(productCardHTML).join("");
  } catch (e) {
    container.innerHTML = '<p class="cart-empty">No pudimos cargar la tienda. Probá recargar la página.</p>';
  }
}

function render() {
  const countEl = document.querySelector(".cart-count");
  const itemsEl = document.querySelector(".cart-items");
  const totalEl = document.querySelector(".cart-total-value");
  const checkoutBtn = document.querySelector(".checkout-btn");
  if (!itemsEl) return;

  if (countEl) countEl.textContent = Cart.count();

  if (!Cart.items.length) {
    itemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío.<br>Elegí tu café en la tienda.</p>';
  } else {
    itemsEl.innerHTML = Cart.items
      .map(
        (i) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">${formatARS(i.price)} x ${i.qty}</div>
          <div class="qty-control">
            <button aria-label="Restar" onclick="Cart.changeQty('${i.id}', -1)">−</button>
            <span>${i.qty}</span>
            <button aria-label="Sumar" onclick="Cart.changeQty('${i.id}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="Cart.remove('${i.id}')">Quitar</button>
      </div>`
      )
      .join("");
  }

  if (totalEl) totalEl.textContent = formatARS(Cart.total());
  if (checkoutBtn) checkoutBtn.disabled = Cart.items.length === 0;
}

function buildWhatsappMessage() {
  const lines = Cart.items.map(
    (i) => `• ${i.name} x${i.qty} — ${formatARS(i.price * i.qty)}`
  );
  const msg =
    `Hola Dellavita! Quiero hacer este pedido:\n\n` +
    lines.join("\n") +
    `\n\nTotal: ${formatARS(Cart.total())}\n\n¿Me confirman disponibilidad y forma de entrega?`;
  return encodeURIComponent(msg);
}

function openCart() {
  document.querySelector(".cart-drawer")?.classList.add("open");
  document.querySelector(".cart-overlay")?.classList.add("open");
}
function closeCart() {
  document.querySelector(".cart-drawer")?.classList.remove("open");
  document.querySelector(".cart-overlay")?.classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  Cart.load();
  render();
  loadProducts();

  document.getElementById("product-row")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-btn");
    if (!btn) return;
    Cart.add({
      id: btn.dataset.id,
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
    });
  });

  document.querySelector(".cart-btn")?.addEventListener("click", openCart);
  document.querySelector(".cart-close")?.addEventListener("click", closeCart);
  document.querySelector(".cart-overlay")?.addEventListener("click", closeCart);

  document.querySelector(".checkout-btn")?.addEventListener("click", () => {
    if (!Cart.items.length) return;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsappMessage()}`, "_blank");
  });
});
