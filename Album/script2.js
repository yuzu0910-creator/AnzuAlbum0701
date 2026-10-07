const lightbox = document.getElementById("lightbox");
const lightboxArt = document.getElementById("lightboxArt");
const lightboxMeta = document.getElementById("lightboxMeta");
const closeButton = document.querySelector(".close");


// 写真をクリックしたとき
document.querySelectorAll(".photo").forEach((photo) => {

    photo.addEventListener("click", () => {

        // 写真の場所を取得
        const imagePath = photo.dataset.image;

        // 写真を表示
        lightboxArt.innerHTML = `
            <img src="${imagePath}" alt="${photo.dataset.title}">
        `;

        // タイトルを表示
        lightboxMeta.textContent = photo.dataset.title;

        // ライトボックスを開く
        lightbox.classList.add("open");

        // 後ろのページをスクロールできなくする
        document.body.style.overflow = "hidden";
    });

});


// ライトボックスを閉じる関数
function closeLightbox() {

    lightbox.classList.remove("open");

    // ページのスクロールを元に戻す
    document.body.style.overflow = "";

}


// ×ボタン
closeButton.addEventListener("click", closeLightbox);


// 写真の外側（暗い部分）をクリックして閉じる
lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {
        closeLightbox();
    }

});


// Escキーでも閉じる
document.addEventListener("keydown", (event) => {

    if (
        event.key === "Escape" &&
        lightbox.classList.contains("open")
    ) {
        closeLightbox();
    }

});