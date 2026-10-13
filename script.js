
/* ==============================
   ライトボックス（写真の拡大表示）
============================== */

const lightbox = document.getElementById("lightbox");
const lightboxArt = document.getElementById("lightboxArt");
const lightboxMeta = document.getElementById("lightboxMeta");
const closeButton = document.querySelector(".close");
const prevButton = document.getElementById("prevPhoto");
const nextButton = document.getElementById("nextPhoto");

// 写真一覧（通常の写真＋友達との写真）
const photos = Array.from(
    document.querySelectorAll(".photo, .photo-f")
);

let currentPhotoIndex = 0;

function showPhoto(index, direction = 0) {
    if (!lightbox || !lightboxArt || !lightboxMeta || photos.length === 0) {
        return;
    }

    // 最後の次は最初へ、最初の前は最後へ
    currentPhotoIndex = (index + photos.length) % photos.length;

    const photo = photos[currentPhotoIndex];
    const image = photo.querySelector("img");
    const imagePath = photo.dataset.image || image?.src;
    const title = photo.dataset.title || image?.alt || "";

    if (!imagePath) {
        console.error("写真の画像が見つかりません:", photo);
        return;
    }

    const enlargedImage = document.createElement("img");
    enlargedImage.src = imagePath;
    enlargedImage.alt = title;

    if (direction > 0) {
        enlargedImage.classList.add("slide-in-next");
    } else if (direction < 0) {
        enlargedImage.classList.add("slide-in-prev");
    }

    lightboxArt.replaceChildren(enlargedImage);
    lightboxMeta.textContent = title;

    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    if (!lightbox) return;

    lightbox.classList.remove("open");
    document.body.style.overflow = "";
}

// 写真をクリックして拡大
photos.forEach((photo, index) => {
    photo.addEventListener("click", () => {
        showPhoto(index);
    });
});

// 前の写真
if (prevButton) {
    prevButton.addEventListener("click", event => {
        event.stopPropagation();
        showPhoto(currentPhotoIndex - 1, -1);
    });
}

// 次の写真
if (nextButton) {
    nextButton.addEventListener("click", event => {
        event.stopPropagation();
        showPhoto(currentPhotoIndex + 1, 1);
    });
}

// 閉じるボタン
if (closeButton) {
    closeButton.addEventListener("click", closeLightbox);
}

// 暗い背景をクリックして閉じる
if (lightbox) {
    lightbox.addEventListener("click", event => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });
}

// スマホのスワイプ操作
let touchStartX = 0;
let touchStartY = 0;

if (lightboxArt) {
    lightboxArt.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
    }, { passive: true });

    lightboxArt.addEventListener("touchend", event => {
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        const deltaY = event.changedTouches[0].clientY - touchStartY;

        // 横方向の移動が大きいときだけ切り替える
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < 0) {
                showPhoto(currentPhotoIndex + 1, 1);
            } else {
                showPhoto(currentPhotoIndex - 1, -1);
            }
        }
    }, { passive: true });
}


/* ==============================
   スクロールメニュー（三本線）
============================== */

const menuButton = document.getElementById("menuButton");
const menu = document.getElementById("scrollMenu");

function closeMenu() {
    if (!menuButton || !menu) return;

    menu.classList.remove("is-open");
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "メニューを開く");
}

if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
        const isOpen = menu.classList.toggle("is-open");

        menuButton.classList.toggle("is-open", isOpen);
        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute(
            "aria-label",
            isOpen ? "メニューを閉じる" : "メニューを開く"
        );
    });

    // リンクを押したらメニューを閉じる
    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });
}


/* ==============================
   キーボード操作
============================== */

document.addEventListener("keydown", event => {
    if (lightbox?.classList.contains("open")) {
        if (event.key === "Escape") {
            closeLightbox();
        } else if (event.key === "ArrowRight") {
            showPhoto(currentPhotoIndex + 1, 1);
        } else if (event.key === "ArrowLeft") {
            showPhoto(currentPhotoIndex - 1, -1);
        }

        return;
    }

    if (event.key === "Escape") {
        closeMenu();
    }
});


/* ==============================
   動画の再生状態
============================== */

document.querySelectorAll(".memory-video").forEach(video => {
    video.addEventListener("play", () => {
        video.classList.add("playing");
    });

    video.addEventListener("pause", () => {
        video.classList.remove("playing");
    });
});



/* ==============================
   隠しコマンド
   右上 → 左下 → 左上 → 右下
============================== */

const openingScreen = document.querySelector("#home");
const openingPhotos = document.querySelectorAll(".opening-photo");
const memoryScreen = document.querySelector("#memoryScreen");
const memoryStart = document.querySelector("#memoryStart");
const app = document.querySelector("#app");

const secretSequence = [
    "top-right",
    "bottom-left",
    "top-left",
    "bottom-right"
];

// 各写真の位置
const photoPositions = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right"
];

let enteredSequence = [];
let commandLocked = false;
let memoryUnlocked = false;

/* 赤いフラッシュ */
function showErrorFlash() {
    const flash = document.createElement("div");
    flash.className = "error-flash";
    document.body.appendChild(flash);

    flash.addEventListener("animationend", () => {
        flash.remove();
    }, { once: true });
}

/* 写真を押したときのアニメーション */
function showPhotoTap(photo) {
    photo.classList.remove("command-tap");
    void photo.offsetWidth;
    photo.classList.add("command-tap");

    photo.addEventListener("animationend", () => {
        photo.classList.remove("command-tap");
    }, { once: true });
}

/* 波紋 */
function showRipple(photo, event) {
    const rect = photo.getBoundingClientRect();
    const ripple = document.createElement("span");

    ripple.className = "command-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;

    photo.appendChild(ripple);

    ripple.addEventListener("animationend", () => {
        ripple.remove();
    }, { once: true });
}

/* 正解したらゲーム画面へ */
function unlockMemoryGame() {
    if (!app || !memoryScreen) return;

    memoryUnlocked = true;
    commandLocked = true;

    app.classList.add("memory-unlocked");

    setTimeout(() => {
        memoryScreen.classList.add("active");
        document.body.style.overflow = "hidden";
    }, 350);
}

/* 写真を押したときの処理 */
openingPhotos.forEach((photo, index) => {
    photo.addEventListener("click", event => {
        if (commandLocked || memoryUnlocked) return;

        // 押した写真のアニメーション
        showPhotoTap(photo);
        showRipple(photo, event);

        // 押した位置を記録
        enteredSequence.push(photoPositions[index]);

        // 4回押すまではエラー判定をしない
        if (enteredSequence.length < secretSequence.length) {
            return;
        }

        // 4回押した時点で正誤判定
        const isCorrect = enteredSequence.every(
            (position, i) => position === secretSequence[i]
        );

        if (isCorrect) {
            unlockMemoryGame();
        } else {
            commandLocked = true;
            showErrorFlash();

            setTimeout(() => {
                enteredSequence = [];
                commandLocked = false;
            }, 1000);
        }
    });
});

/* ゲーム終了ボタン */

const exitGame = document.querySelector("#exitGame");

if (exitGame) {
    exitGame.addEventListener("click", () => {
        // ゲーム画面を閉じる
        memoryScreen.classList.remove("active");

        // ホーム画面を再表示する
        app.classList.remove("memory-unlocked");

        // スクロールを元に戻す
        document.body.style.overflow = "";

        // 隠しコマンドを再び入力できるようにする
        enteredSequence = [];
        commandLocked = false;
        memoryUnlocked = false;
    });
}


/* ==============================
   PHOTO MEMORY GAME
============================== */

(() => {
    const board = document.getElementById("memoryBoard");
    const instruction = document.getElementById("memoryInstruction");
    const feedback = document.getElementById("memoryFeedback");
    const startButton = document.getElementById("memoryStart");
    const targetWrap = document.getElementById("memoryTargetWrap");
    const targetImage = document.getElementById("memoryTarget");
    const countdown = document.getElementById("memoryCountdown");

    const roundDisplay = document.getElementById("memoryRound");
    const scoreDisplay = document.getElementById("memoryScore");
    const countDisplay = document.getElementById("memoryCount");

    const photoMemorySection = document.getElementById("photo-memory");
    const secretGameStart = document.getElementById("secretGameStart");
    const memoryScreen = document.getElementById("memoryScreen");
    const app = document.getElementById("app");

    // アルバムの写真
    const photos = [
        "images/home1.jpg",
        "images/home2.jpg",
        "images/home3.jpg",
        "images/home4.jpg",
        "images/photo01.jpg",
        "images/photo02.jpg",
        "images/photo03.jpg",
        "images/photo04.png",
        "images/photo05.jpg",
        "images/photo06.jpg",
        "images/photo07.jpg",
        "images/photo08.jpg",
        "images/photo09.jpg",
        "images/photo10.jpg",
        "images/photo11.jpg",
        "images/photo12.jpg",
        "images/photo13.jpg",
        "images/photo14.jpg",
        "images/photo15.jpg",
        "images/photo16.jpg",
        "images/photo17.jpg",
        "images/photo18.jpg",
        "images/photo19.jpg",
        "images/photo20.jpg",
        "images/photo21.jpg",
        "images/photo22.jpg",
        "images/photo23.jpg",
        "images/photo24.jpg",
        "images/photo-f1.jpg",
        "images/photo-f2.jpg",
        "images/photo-f3.jpg",
        "images/photo-f4.jpg",
        "images/photo-f5.jpg",
        "images/photo-f6.jpg",
        "images/photo-f7.jpg",
        "images/photo-f8.jpg",
        "images/photo-f9.jpg"
    ];

    const MEMORIZE_TIME = 5;
    const POINTS_PER_ROUND = 100;

    let round = 1;
    let score = 0;
    let photoCount = 3;
    let cellCount = 6;

    let challenge = [];
    let targetPath = "";
    let phase = "idle";

    let countdownInterval = null;
    let roundTimeout = null;
    let remainingSeconds = MEMORIZE_TIME;
    let gameOver = false;

    // ラウンドごとの写真枚数・マス数
    function getRoundConfig(roundNumber) {
        if (roundNumber === 1) {
            return { photos: 3, cells: 6 };
        }

        if (roundNumber === 2) {
            return { photos: 4, cells: 6 };
        }

        if (roundNumber >= 3 && roundNumber <= 8) {
            return {
                photos: 4,
                cells: roundNumber + 4
            };
        }

        if (roundNumber >= 9 && roundNumber <= 15) {
            return {
                photos: roundNumber - 4,
                cells: 12
            };
        }

        // 16ラウンド以降は12枚・12マスで固定
        return {
            photos: 12,
            cells: 12
        };
    }

    function shuffle(array) {
        const result = [...array];

        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result;
    }

    function clearTimers() {
        clearInterval(countdownInterval);
        clearTimeout(roundTimeout);

        countdownInterval = null;
        roundTimeout = null;
    }

    function updateStatus() {
        roundDisplay.textContent = round;
        scoreDisplay.textContent = score;
        countDisplay.textContent = photoCount;
    }

    // ラウンドに応じたマス数と写真枚数で問題を作成
    function makeChallenge() {
        const config = getRoundConfig(round);

        photoCount = Math.min(config.photos, photos.length);
        cellCount = config.cells;

        const shuffledPhotos = shuffle(photos).slice(0, photoCount);

        const positions = shuffle(
            Array.from({ length: cellCount }, (_, index) => index)
        );

        challenge = Array(cellCount).fill(null);

        shuffledPhotos.forEach((path, index) => {
            challenge[positions[index]] = path;
        });

        // 今回探す写真を選ぶ
        targetPath =
            shuffledPhotos[
                Math.floor(Math.random() * shuffledPhotos.length)
            ];
    }

    // 盤面を表示
    function renderBoard(showPhotos, allowAnswer = false) {
        board.replaceChildren();

        // 常に3列にして、マス数に応じて行数を変える
        board.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";

        challenge.forEach((path, index) => {
            const slot = document.createElement("button");

            slot.type = "button";
            slot.className = "memory-slot";
            slot.setAttribute("aria-label", `位置 ${index + 1}`);

            if (path) {
                const image = document.createElement("img");

                image.src = path;
                image.alt = showPhotos ? `写真 ${index + 1}` : "";
                image.draggable = false;

                slot.appendChild(image);
            } else {
                slot.classList.add("is-empty");
            }

            if (!showPhotos) {
                slot.classList.add("is-hidden");
            }

            if (allowAnswer) {
                slot.classList.add("is-answer");
                slot.setAttribute(
                    "aria-label",
                    `位置 ${index + 1} を選ぶ`
                );

                if (!path) {
                    slot.disabled = true;
                } else {
                    slot.addEventListener("click", () => {
                        checkAnswer(index);
                    });
                }
            } else {
                slot.disabled = true;
            }

            board.appendChild(slot);
        });
    }

    // 5秒のカウントダウン
    function showCountdown() {
        remainingSeconds = MEMORIZE_TIME;

        countdown.hidden = false;
        countdown.textContent =
            String(remainingSeconds).padStart(2, "0");

        countdownInterval = setInterval(() => {
            if (phase !== "memorize") {
                clearInterval(countdownInterval);
                countdownInterval = null;
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                countdown.textContent =
                    String(remainingSeconds).padStart(2, "0");
            } else {
                clearInterval(countdownInterval);
                countdownInterval = null;

                finishMemorizing();
            }
        }, 1000);
    }

    // 覚える時間が終了したとき
    function finishMemorizing() {
        if (phase !== "memorize") return;

        phase = "answer";
        countdown.hidden = true;

        targetWrap.hidden = false;
        targetImage.src = targetPath;

        instruction.textContent =
            "この写真は、どの位置にあった？";

        feedback.textContent =
            "写真があったマスを選んでね。";

        renderBoard(false, true);
    }

    // ラウンド開始
    function startRound(isRetry = false) {
        clearTimers();

        if (!isRetry) {
            makeChallenge();
        }

        phase = "memorize";
        updateStatus();

        targetWrap.hidden = true;
        startButton.hidden = true;
        countdown.hidden = false;

        instruction.textContent = "写真と位置を覚えよう。";
        feedback.textContent =
            "カウントダウンが終わる前に覚えよう。";

        renderBoard(true);
        showCountdown();
    }

    // 正解・不正解を判定
    function checkAnswer(index) {
        if (phase !== "answer") return;

        const slots = board.querySelectorAll(".memory-slot");
        const selected = slots[index];

        if (challenge[index] === targetPath) {
            phase = "correct";

            score += POINTS_PER_ROUND;
            selected.classList.add("is-correct");

            instruction.textContent = "位置を見つけた！";
            feedback.textContent =
                `正解！ +${POINTS_PER_ROUND} POINTS`;

            targetWrap.hidden = true;
            countdown.hidden = true;

            updateStatus();

            // 自動では次のラウンドへ進まず、ボタンを表示
            startButton.textContent = "NEXT ROUND";
            startButton.hidden = false;

        } else {
            phase = "wrong";
            gameOver = true;

            selected.classList.add("is-wrong");

            instruction.textContent = "GAME OVER";
            feedback.textContent =
                `不正解！最終スコア：${score} POINTS`;

            targetWrap.hidden = true;
            countdown.hidden = true;

            // ラウンド・スコアをリセット
            round = 1;
            score = 0;
            photoCount = 3;
            cellCount = 6;

            updateStatus();

            // リトライボタンではなく、最初から始めるボタン
            startButton.textContent = "START AGAIN";
            startButton.hidden = false;
        }
    }

        // ゲーム本体のボタン
    if (startButton) {
        startButton.addEventListener("click", () => {
            if (phase === "idle") {
                // 初回スタート
                startRound();

            } else if (phase === "correct") {
                // NEXT ROUNDを押したら次のラウンドへ
                round++;
                gameOver = false;
                startRound();

            } else if (phase === "wrong" && gameOver) {
                // GAME OVER後は最初から
                round = 1;
                score = 0;
                photoCount = 3;
                cellCount = 6;
                gameOver = false;

                updateStatus();

                phase = "idle";
                startButton.textContent = "START GAME";

                startRound();
            }
        });
    }

    // 隠し画面のSTARTは、閉じてゲームの場所へ移動するだけ
    if (secretGameStart && photoMemorySection) {
        secretGameStart.addEventListener("click", () => {
            if (memoryScreen) {
                memoryScreen.classList.remove("active");
            }

            if (app) {
                app.classList.remove("memory-unlocked");
            }

            document.body.style.overflow = "";

            // ゲーム部分を表示
            photoMemorySection.classList.add("game-visible");

            // ゲームの場所へスクロール
            photoMemorySection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            // ここでは startRound() を呼ばない
            // 本体のSTARTボタンを押してゲームを開始する
        });
    }

    // 初期状態ではゲームを隠す
    if (photoMemorySection) {
        photoMemorySection.classList.remove("game-visible");
    }

    // 初期盤面
    challenge = Array(6).fill(null);
    photoCount = 3;
    cellCount = 6;

    renderBoard(false);
    updateStatus();

    instruction.textContent =
        "隠されたゲームを解除して始めよう。";

    feedback.textContent =
        "ゲームを表示したらSTARTを押してね。";

    startButton.textContent = "START GAME";
    startButton.hidden = false;

    targetWrap.hidden = true;
    countdown.hidden = true;
})();
