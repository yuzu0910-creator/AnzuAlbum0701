// 表紙の写真を切り替える
const coverArt = document.getElementById('coverArt');
const coverImage = document.getElementById('coverImage');
const coverNumber = document.getElementById('coverNumber');

// ここに表示したい写真のファイル名を追加する
const coverPhotos = [
  'images/home1.jpg',
  'images/home2.jpg',
  'images/home3.jpg',
  'images/home4.jpg'
];

let coverIndex = 0;
let isChangingCover = false;

function changeCover() {
  if (isChangingCover) return;

  isChangingCover = true;

  const nextIndex = (coverIndex + 1) % coverPhotos.length;

  const nextImage = document.createElement('img');
  nextImage.className = 'cover-next';
  nextImage.alt = `Photo ${nextIndex + 1}`;

  // 読み込み完了後にフェードを開始
  nextImage.addEventListener('load', () => {
    coverArt.appendChild(nextImage);

    // 透明な状態をブラウザに認識させてから表示
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextImage.style.opacity = '1';
      });
    });

    // フェードが終わったら写真を入れ替える
    nextImage.addEventListener('transitionend', () => {
      coverImage.src = coverPhotos[nextIndex];
      coverImage.alt = nextImage.alt;

      coverIndex = nextIndex;
      coverNumber.textContent =
        String(coverIndex + 1).padStart(2, '0');

      nextImage.remove();
      isChangingCover = false;
    }, { once: true });
  }, { once: true });

  nextImage.addEventListener('error', () => {
    nextImage.remove();
    isChangingCover = false;
    console.error('写真を読み込めませんでした:', coverPhotos[nextIndex]);
  }, { once: true });

  // イベントを登録してから画像を読み込む
  nextImage.src = coverPhotos[nextIndex];
}

// クリック・タップで切り替え
coverArt.addEventListener('click', changeCover);

// キーボードでも切り替えられるようにする
coverArt.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    changeCover();
  }
});



const lightbox = document.getElementById('lightbox');
const lightboxArt = document.getElementById('lightboxArt');
const lightboxMeta = document.getElementById('lightboxMeta');
const closeButton = document.querySelector('.close');

const photos = [...document.querySelectorAll('.photo, .photo-f')];

let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;

// 写真を表示する
function showPhoto(index, direction = 0) {
    currentIndex = (index + photos.length) % photos.length;

    const photo = photos[currentIndex];
    const imagePath = photo.dataset.image;
    const title = photo.dataset.title || '';

    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = title;

    // 切り替え方向に応じてアニメーションを付ける
    if (direction > 0) {
        img.classList.add('slide-in-next');
    } else if (direction < 0) {
        img.classList.add('slide-in-prev');
    }

    lightboxArt.replaceChildren(img);
    lightboxMeta.textContent = title;
}

// 開く
function openLightbox(index) {
    showPhoto(index);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// 閉じる
function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
}

// 前後に切り替える
function showPrevious() {
    showPhoto(currentIndex - 1, -1);
}

function showNext() {
    showPhoto(currentIndex + 1, 1);
}

// 一覧の写真をクリック
photos.forEach((photo, index) => {
    photo.addEventListener('click', () => {
        openLightbox(index);
    });
});

// ボタン操作（ボタンがHTMLにある場合）
const prevButton = document.getElementById('prevPhoto');
const nextButton = document.getElementById('nextPhoto');

if (prevButton) {
    prevButton.addEventListener('click', showPrevious);
}

if (nextButton) {
    nextButton.addEventListener('click', showNext);
}

closeButton.addEventListener('click', closeLightbox);

// 背景をクリックして閉じる
lightbox.addEventListener('click', event => {
    if (event.target === lightbox) {
        closeLightbox();
    }
});

// キーボード操作
document.addEventListener('keydown', event => {
    if (!lightbox.classList.contains('open')) return;

    if (event.key === 'ArrowLeft') showPrevious();
    if (event.key === 'ArrowRight') showNext();
    if (event.key === 'Escape') closeLightbox();
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

    // 縦スクロールでは切り替えず、横スワイプだけ反応
    if (
        Math.abs(diffX) > 50 &&
        Math.abs(diffX) > Math.abs(diffY)
    ) {
        if (diffX < 0) {
            showNext();
        } else {
            showPrevious();
        }
    }
}, { passive: true });