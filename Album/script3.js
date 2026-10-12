const lightbox = document.getElementById('lightbox');
const lightboxArt = document.getElementById('lightboxArt');
const lightboxMeta = document.getElementById('lightboxMeta');
const closeButton = document.querySelector('.close');
const prevButton = document.getElementById('prevPhoto');
const nextButton = document.getElementById('nextPhoto');

const photos = [...document.querySelectorAll('.photo')];

let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;

// 写真を表示する
function showPhoto(index) {
    // 最後から次へ進むと最初に戻る
    currentIndex = (index + photos.length) % photos.length;

    const photo = photos[currentIndex];
    const imagePath = photo.dataset.image;
    const title = photo.dataset.title || '';

    lightboxArt.innerHTML = '';

    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = title;

    lightboxArt.appendChild(img);
    lightboxMeta.textContent = title;
}

// Lightboxを開く
function openLightbox(index) {
    showPhoto(index);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// Lightboxを閉じる
function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
}

// 前の写真・次の写真
function showPrevious() {
    showPhoto(currentIndex - 1);
}

function showNext() {
    showPhoto(currentIndex + 1);
}

// 一覧の写真をクリック
photos.forEach((photo, index) => {
    photo.addEventListener('click', () => {
        openLightbox(index);
    });
});

// ボタン
prevButton.addEventListener('click', showPrevious);
nextButton.addEventListener('click', showNext);
closeButton.addEventListener('click', closeLightbox);

// 背景をクリックしたら閉じる
lightbox.addEventListener('click', event => {
    if (event.target === lightbox) {
        closeLightbox();
    }
});

// キーボード操作
document.addEventListener('keydown', event => {
    if (!lightbox.classList.contains('open')) return;

    if (event.key === 'ArrowLeft') {
        showPrevious();
    }

    if (event.key === 'ArrowRight') {
        showNext();
    }

    if (event.key === 'Escape') {
        closeLightbox();
    }
});

// スマホのスワイプ操作
lightboxArt.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

lightboxArt.addEventListener('touchend', event => {
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;

    const diffX = endX - touchStartX;
    const diffY = endY - touchStartY;

    // 横方向に十分スライドしたときだけ切り替える
    if (Math.abs(diffX) > 50 &&
        Math.abs(diffX) > Math.abs(diffY)) {

        if (diffX < 0) {
            showNext();      // 左スワイプ
        } else {
            showPrevious();  // 右スワイプ
        }
    }
}, { passive: true });