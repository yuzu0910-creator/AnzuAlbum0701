
/* =========================
   Supabase設定
========================= */

const SUPABASE_URL =
  "https://zxdxwdwcokcxkhowqgfc.supabase.co";

// ADMINのSUPABASE_PUBLIC_KEYと同じ公開キーを入れる
const SUPABASE_ANON_KEY = "sb_publishable_e4oahRKe2qT4rKcecddXyw_G8pfY-6x";


/* =========================
   HTML要素
========================= */

const emptyState = document.getElementById("emptyState");
const galleryState = document.getElementById("galleryState");
const photoGrid = document.getElementById("photoGrid");
const photoCount = document.getElementById("photoCount");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxDate = document.getElementById("lightboxDate");
const lightboxClose = document.getElementById("lightboxClose");


/* =========================
   Supabaseから写真を取得
========================= */

async function fetchPhotos() {
  const url =
    `${SUPABASE_URL}/rest/v1/gallery_photos` +
    `?select=id,title,description,image_url,taken_at,created_at` +
    `&is_published=eq.true` +
    `&order=created_at.desc`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`写真の取得に失敗しました: ${errorText}`);
  }

  return await response.json();
}


/* =========================
   日付表示
========================= */

function formatDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}


/* =========================
   ページの状態を切り替える
========================= */

function renderGallery(photos) {
  if (photos.length === 0) {
    emptyState.hidden = false;
    galleryState.hidden = true;
    return;
  }

  emptyState.hidden = true;
  galleryState.hidden = false;

  renderPhotoGrid(photos);

  photoCount.textContent =
    `${String(photos.length).padStart(2, "0")} PHOTOGRAPHS`;
}


/* =========================
   写真グリッド
========================= */

function renderPhotoGrid(items) {
  photoGrid.innerHTML = "";

  items.forEach((photo, index) => {
    const card = document.createElement("article");
    card.className = "photo-card";
    card.style.animationDelay =
      `${Math.min(index * 0.08, 0.6)}s`;

    const image = document.createElement("img");
    image.src = photo.image_url;
    image.alt = photo.title || "Gallery photograph";
    image.loading = "lazy";

    const info = document.createElement("div");
    info.className = "photo-info";

    const title = document.createElement("strong");
    title.textContent = photo.title || "Untitled";

    const date = document.createElement("span");
    date.textContent = formatDate(
      photo.taken_at || photo.created_at
    );

    info.append(title, date);
    card.append(image, info);

    card.addEventListener("click", () => {
      openLightbox(photo);
    });

    photoGrid.appendChild(card);
  });
}


/* =========================
   写真を拡大する
========================= */

function openLightbox(photo) {
  lightboxImage.src = photo.image_url;
  lightboxImage.alt = photo.title || "Gallery photograph";

  lightboxTitle.textContent =
    photo.title || "Untitled";

  lightboxDate.textContent =
    formatDate(photo.taken_at || photo.created_at);

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}


/* =========================
   拡大表示を閉じる
========================= */

function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
  lightboxImage.src = "";
}

lightboxClose.addEventListener("click", closeLightbox);

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLightbox();
  }
});


/* =========================
   最初の表示
========================= */

async function initGallery() {
  try {
    const photos = await fetchPhotos();
    renderGallery(photos);
  } catch (error) {
    console.error(error);

    emptyState.hidden = false;
    galleryState.hidden = true;

    const message = emptyState.querySelector(".empty-content p");

    if (message) {
      message.textContent =
        "写真を読み込めませんでした。時間をおいて再度お試しください。";
    }
  }
}

initGallery();
