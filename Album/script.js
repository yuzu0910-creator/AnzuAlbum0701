const lightbox =
    document.getElementById("lightbox");

const lightboxArt =
    document.getElementById("lightboxArt");

const lightboxMeta =
    document.getElementById("lightboxMeta");

const photos =
    document.querySelectorAll(".photo");

const closeButton =
    document.querySelector(".close");



/*
    写真をクリックしたとき
*/

photos.forEach((photo) => {

    photo.addEventListener("click", () => {

        const fake =
            photo.querySelector(".fake");


        /*
            クリックした写真の
            クラスを取得
        */

        const photoClass =
            fake.className.replace("fake ", "");


        /*
            拡大表示側に
            同じクラスを付ける
        */

        lightboxArt.className =
            "lightbox-art " + photoClass;


        /*
            写真タイトルを表示
        */

        lightboxMeta.textContent =
            photo.dataset.title;


        /*
            Lightboxを表示
        */

        lightbox.classList.add("open");

    });

});



/*
    ×ボタンで閉じる
*/

closeButton.addEventListener("click", () => {

    lightbox.classList.remove("open");

});



/*
    写真以外の黒い部分を
    クリックしても閉じる
*/

lightbox.addEventListener("click", (event) => {

    if (event.target === lightbox) {

        lightbox.classList.remove("open");

    }

});



/*
    ESCキーでも閉じる
*/

document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

        lightbox.classList.remove("open");

    }

});