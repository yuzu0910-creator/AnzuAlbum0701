/* ==============================
   ライトボックス（写真の拡大表示）
============================== */

const lightbox = document.getElementById("lightbox");
const lightboxArt = document.getElementById("lightboxArt");
const lightboxMeta = document.getElementById("lightboxMeta");
const closeButton = document.querySelector(".close");
const prevButton = document.getElementById("prevPhoto");
const nextButton = document.getElementById("nextPhoto");

const photos = Array.from(
    document.querySelectorAll(".photo, .photo-f")
);

let currentPhotoIndex = 0;

// ゲームの隠しコマンド入力中は写真を拡大しない
window.__secretPatternInput = false;

function showPhoto(index, direction = 0) {
    if (!lightbox || !lightboxArt || !lightboxMeta || !photos.length) {
        return;
    }

    currentPhotoIndex = (index + photos.length) % photos.length;

    const photo = photos[currentPhotoIndex];
    const image = photo.querySelector("img");
    const imagePath = photo.dataset.image || image?.src;
    const title = photo.dataset.title || image?.alt || "";

    if (!imagePath) return;

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

photos.forEach((photo, index) => {
    photo.addEventListener("click", () => {
        if (window.__secretPatternInput) return;
        showPhoto(index);
    });
});

prevButton?.addEventListener("click", event => {
    event.stopPropagation();
    showPhoto(currentPhotoIndex - 1, -1);
});

nextButton?.addEventListener("click", event => {
    event.stopPropagation();
    showPhoto(currentPhotoIndex + 1, 1);
});

closeButton?.addEventListener("click", closeLightbox);

lightbox?.addEventListener("click", event => {
    if (event.target === lightbox) closeLightbox();
});

let touchStartX = 0;
let touchStartY = 0;

lightboxArt?.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

lightboxArt?.addEventListener("touchend", event => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        showPhoto(
            currentPhotoIndex + (deltaX < 0 ? 1 : -1),
            deltaX < 0 ? 1 : -1
        );
    }
}, { passive: true });


/* ==============================
   スクロールメニュー
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

    if (event.key === "Escape") closeMenu();
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
   共通エフェクト
============================== */

function showErrorFlash() {
    const flash = document.createElement("div");
    flash.className = "error-flash";
    document.body.appendChild(flash);

    flash.addEventListener("animationend", () => {
        flash.remove();
    }, { once: true });
}

function showPhotoTap(photo, event) {
    photo.classList.remove("command-tap");
    void photo.offsetWidth;
    photo.classList.add("command-tap");

    const rect = photo.getBoundingClientRect();
    const ripple = document.createElement("span");

    ripple.className = "command-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;

    photo.appendChild(ripple);

    ripple.addEventListener("animationend", () => {
        ripple.remove();
    }, { once: true });

    photo.addEventListener("animationend", () => {
        photo.classList.remove("command-tap");
    }, { once: true });
}



/* ==============================
   画面Aの隠しコマンド
   2 → 1 → 4 → 3
============================== */

(() => {
    const openingPhotos = [
        ...document.querySelectorAll("#home .opening-photo")
    ];

    const secretSequence = [2, 1, 4, 3];

    let progress = [];
    let locked = false;

    if (openingPhotos.length < 4) {
        console.warn("画面Aの写真が4枚見つかりません。");
        return;
    }

    function startSecretReveal() {
        document.dispatchEvent(
            new CustomEvent("secret-entrance-unlocked")
        );
    }

    openingPhotos.forEach(photo => {
        photo.addEventListener("click", event => {
            if (locked) return;

            showPhotoTap(photo, event);

            const match = photo.className.match(
                /opening-photo-([1-4])/
            );

            if (!match) return;

            progress.push(Number(match[1]));

            if (progress.length < secretSequence.length) return;

            const isCorrect = progress.every(
                (number, index) => number === secretSequence[index]
            );

            progress = [];

            if (!isCorrect) {
                showErrorFlash();
                return;
            }

            locked = true;
            startSecretReveal();
        });
    });

    // 画面Bの演出が終わるまで画面Aの再入力を防ぐ
    document.addEventListener("secret-intro-finished", () => {
        locked = false;
        progress = [];
    });
})();



/* ==============================
   画面B：秘密の演出と隠しコマンド
============================== */

(() => {
    const intro = document.getElementById("secretIntro");
    const photoField = document.getElementById("secretPhotoField");

    const secretPrompt = document.getElementById("secretPrompt");
    const secretPromptText = document.getElementById("secretPromptText");
    const cancelPatternButton =
        document.getElementById("cancelSecretPattern");

    const albumPhotos = [
        ...document.querySelectorAll("#album .photo")
    ];

    const secretSequence = [6, 19, 1, 24];

    let progress = [];
    let sequenceEnabled = false;
    let revealTimers = [];

    function clearRevealTimers() {
        revealTimers.forEach(timer => clearTimeout(timer));
        revealTimers = [];
    }

    function hidePrompt() {
        secretPrompt?.classList.remove("visible");
        window.__secretPatternInput = false;
    }

    function resetProgress() {
        progress = [];
    }

    function getImagePath(photo) {
        return photo.dataset.image || photo.querySelector("img")?.src;
    }

    function alignSecretPhotos() {
        const secretPhotos = [
            ...photoField.querySelectorAll(".secret-photo")
        ];

        if (secretPhotos.length < 4) {
            console.warn("画面Bの写真が4枚未満です。");
            return;
        }

        const isMobile = window.innerWidth <= 600;

        // 写真を文字の周りに配置する座標
        // left / top は画面に対する割合
        const desktopPositions = [
        // 上側
            [10, 12], [24, 10], [40, 16], [60, 16], [76, 10], [90, 12],

            // 左右の外側
            [8, 30], [7, 50], [8, 70],
            [92, 30], [93, 50], [92, 70],

            // 中央より少し外側
            [19, 29], [19, 50], [19, 71],
            [81, 29], [81, 50], [81, 71],

            // 下側
            [10, 90], [24, 90], [40, 86], [60, 86], [76, 90], [90, 90]
        ];

        const mobilePositions = [
            // 上半分：上端から中央に向かって並べる
            [12, 10], [37, 9], [63, 9], [88, 10],
            [8, 23], [28, 28], [72, 28], [92, 23],

            // 下半分：中央から下端に向かって並べる
            [8, 72], [28, 68], [72, 68], [92, 72],
            [12, 87], [37, 91], [63, 91], [88, 87],

            // 追加分も上下の外側に配置
            [18, 17], [50, 16], [82, 17],
            [18, 82], [50, 84], [82, 82],
            [5, 34], [95, 34]
        ];

        const positions = isMobile
            ? mobilePositions
            : desktopPositions;

        secretPhotos.forEach((photo, index) => {
            const [x, y] = positions[index % positions.length];

            photo.style.setProperty("--target-x", `${x}%`);
            photo.style.setProperty("--target-y", `${y}%`);
            photo.classList.add("secret-photo-aligned");
        });

        sequenceEnabled = true;
        resetProgress();
        window.__secretPatternInput = true;

        if (secretPrompt && secretPromptText) {
            secretPromptText.textContent =
                "MEMORIES — 写真を 2 → 1 → 4 → 3 の順にクリック";

            secretPrompt.classList.add("visible");
        }
    }

    function openMemoryGame() {
        sequenceEnabled = false;
        hidePrompt();

        document.dispatchEvent(
            new CustomEvent("secret-game-start", {
                detail: { gameId: "memory" }
            })
        );
    }

    function handleSecretPhotoClick(photo) {
        if (!sequenceEnabled) return;

        photo.classList.remove("pressed");
        void photo.offsetWidth;
        photo.classList.add("pressed");

        setTimeout(() => {
            photo.classList.remove("pressed");
        }, 180);

        // クリックした写真のファイル名から番号を取得
        const imagePath =
            photo.currentSrc ||
            photo.src ||
            photo.dataset.image ||
            "";

        const match = imagePath.match(
            /photo0*(\d+)\.(?:jpg|jpeg|png|webp)(?:$|\?)/i
        );
        if (!match) {
            console.warn("写真番号を取得できません:", imagePath);
            return;
        }

        const number = Number(match[1]);

        // クリックした番号を記録
        progress.push(number);

        photo.classList.remove("command-tap");
        void photo.offsetWidth;
        photo.classList.add("command-tap");

        // 4枚クリックするまでは判定しない
        if (progress.length < secretSequence.length) return;

        // 正解の順番と比較
        const isCorrect = progress.every(
            (value, i) => value === secretSequence[i]
        );

        resetProgress();
        sequenceEnabled = false;

        if (isCorrect) {
            // 正解
            photoField
                .querySelectorAll(".secret-photo")
                .forEach(item => item.classList.add("correct"));

            intro.classList.add("success-close");

            setTimeout(() => {
                intro.classList.remove("active", "success-close", "epic");
                intro.setAttribute("aria-hidden", "true");
                openMemoryGame();
            }, 550);

        } else {
            // 不正解
            intro.classList.add("wrong-close");

            setTimeout(() => {
                intro.classList.remove("active", "wrong-close", "epic");
                intro.setAttribute("aria-hidden", "true");
                hidePrompt();
            }, 550);
        }
    }

    function startReveal() {
    clearRevealTimers();
    resetProgress();

    sequenceEnabled = false;
    hidePrompt();

    if (!intro || !photoField) return;

    intro.classList.remove("epic", "wrong");
    intro.classList.add("active");
    intro.setAttribute("aria-hidden", "false");
    photoField.replaceChildren();

    const imagePaths = albumPhotos
        .map(getImagePath)
        .filter(Boolean);

    if (!imagePaths.length) {
        console.warn("写真が見つかりません");
        return;
    }

    const positions = [
        [12, 15], [72, 18], [28, 65], [80, 67],
        [48, 12], [8, 48], [65, 45], [38, 82],
        [88, 40], [22, 30], [55, 72], [44, 35],
        [14, 78], [76, 83], [60, 22], [33, 48],
        [91, 57], [5, 28], [50, 55], [70, 8],
        [25, 88], [83, 30], [42, 18], [62, 88]
    ];

    positions.forEach((pos, i) => {
        const img = document.createElement("img");

        img.className = "secret-photo";
        img.src = imagePaths[i % imagePaths.length];
        img.alt = "";
        img.draggable = false;

        img.style.left = `${pos[0]}%`;
        img.style.top = `${pos[1]}%`;
        img.style.pointerEvents = "auto";
        img.style.cursor = "pointer";
        img.style.animationDelay = `${i * 0.13}s`;

        img.style.setProperty(
            "--tilt",
            `${(i % 2 ? 1 : -1) * (i % 7 + 2)}deg`
        );

        img.addEventListener("click", () => {
            console.log("画像がクリックされました");
            handleSecretPhotoClick(img);
        });

        photoField.appendChild(img);
    });

    const lastPhoto = photoField.lastElementChild;

    const epicTimer = setTimeout(() => {
        intro.classList.add("epic");
    }, 1300);

    revealTimers.push(epicTimer);

    if (lastPhoto) {
        lastPhoto.addEventListener("animationend", () => {
            if (!intro.classList.contains("active")) return;

            intro.classList.remove("epic");
            alignSecretPhotos();

            document.dispatchEvent(
                new CustomEvent("secret-intro-finished")
            );
        }, { once: true });
    }
}

document.addEventListener(
    "secret-entrance-unlocked",
    startReveal
);

cancelPatternButton?.addEventListener("click", () => {
    resetProgress();
    hidePrompt();
    sequenceEnabled = false;
});

})();

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
    const exitGame = document.getElementById("exitGame");

    if (
        !board || !instruction || !feedback || !startButton ||
        !targetWrap || !targetImage || !countdown ||
        !roundDisplay || !scoreDisplay || !countDisplay
    ) {
        return;
    }

    const gamePhotos = [
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
    let remainingSeconds = MEMORIZE_TIME;
    let gameOver = false;

    function getRoundConfig(roundNumber) {
        if (roundNumber === 1) {
            return { photos: 3, cells: 6 };
        }

        if (roundNumber === 2) {
            return { photos: 4, cells: 6 };
        }

        if (roundNumber <= 8) {
            return { photos: 4, cells: roundNumber + 4 };
        }

        if (roundNumber <= 15) {
            return { photos: roundNumber - 4, cells: 12 };
        }

        return { photos: 12, cells: 12 };
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
        countdownInterval = null;
    }

    function updateStatus() {
        roundDisplay.textContent = round;
        scoreDisplay.textContent = score;
        countDisplay.textContent = photoCount;
    }

    function makeChallenge() {
        const config = getRoundConfig(round);

        photoCount = Math.min(config.photos, gamePhotos.length);
        cellCount = config.cells;

        const shuffledPhotos = shuffle(gamePhotos).slice(0, photoCount);
        const positions = shuffle(
            Array.from({ length: cellCount }, (_, index) => index)
        );

        challenge = Array(cellCount).fill(null);

        shuffledPhotos.forEach((path, index) => {
            challenge[positions[index]] = path;
        });

        targetPath = shuffledPhotos[
            Math.floor(Math.random() * shuffledPhotos.length)
        ];
    }

    function renderBoard(showPhotos, allowAnswer = false) {
        board.replaceChildren();
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

            if (!showPhotos) slot.classList.add("is-hidden");

            if (allowAnswer && path) {
                slot.classList.add("is-answer");
                slot.setAttribute("aria-label", `位置 ${index + 1} を選ぶ`);
                slot.addEventListener("click", () => checkAnswer(index));
            } else {
                slot.disabled = true;
            }

            board.appendChild(slot);
        });
    }

    function showCountdown() {
        remainingSeconds = MEMORIZE_TIME;
        countdown.hidden = false;
        countdown.textContent = String(remainingSeconds).padStart(2, "0");

        countdownInterval = setInterval(() => {
            if (phase !== "memorize") {
                clearTimers();
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                countdown.textContent =
                    String(remainingSeconds).padStart(2, "0");
            } else {
                clearTimers();
                finishMemorizing();
            }
        }, 1000);
    }

    function finishMemorizing() {
        if (phase !== "memorize") return;

        phase = "answer";
        countdown.hidden = true;
        targetWrap.hidden = false;
        targetImage.src = targetPath;

        instruction.textContent = "この写真は、どの位置にあった？";
        feedback.textContent = "写真があったマスを選んでね。";

        renderBoard(false, true);
    }

    function startRound() {
        clearTimers();
        makeChallenge();

        phase = "memorize";
        updateStatus();

        targetWrap.hidden = true;
        startButton.hidden = true;
        countdown.hidden = false;

        instruction.textContent = "写真と位置を覚えよう。";
        feedback.textContent = "カウントダウンが終わる前に覚えよう。";

        renderBoard(true);
        showCountdown();
    }

    function checkAnswer(index) {
        if (phase !== "answer") return;

        const slots = board.querySelectorAll(".memory-slot");
        const selected = slots[index];

        if (challenge[index] === targetPath) {
            phase = "correct";
            score += POINTS_PER_ROUND;

            selected.classList.add("is-correct");

            instruction.textContent = "位置を見つけた！";
            feedback.textContent = `正解！ +${POINTS_PER_ROUND} POINTS`;

            targetWrap.hidden = true;
            countdown.hidden = true;

            updateStatus();

            startButton.textContent = "NEXT ROUND";
            startButton.hidden = false;
        } else {
            phase = "wrong";
            gameOver = true;

            selected.classList.add("is-wrong");

            instruction.textContent = "GAME OVER";
            feedback.textContent = `不正解！最終スコア：${score} POINTS`;

            targetWrap.hidden = true;
            countdown.hidden = true;

            round = 1;
            score = 0;
            photoCount = 3;
            cellCount = 6;

            updateStatus();

            startButton.textContent = "START AGAIN";
            startButton.hidden = false;
        }
    }

    startButton.addEventListener("click", () => {
        if (phase === "idle") {
            startRound();
        } else if (phase === "correct") {
            round++;
            gameOver = false;
            startRound();
        } else if (phase === "wrong" && gameOver) {
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

    function openPhotoMemory() {
        memoryScreen?.classList.remove("active");
        app?.classList.remove("memory-unlocked");
        document.body.style.overflow = "";

        if (!photoMemorySection) return;

        photoMemorySection.classList.add("game-visible");
        photoMemorySection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    document.addEventListener("secret-game-start", event => {
        if (event.detail?.gameId === "memory") {
            openPhotoMemory();
        }
    });

    secretGameStart?.addEventListener("click", openPhotoMemory);

    exitGame?.addEventListener("click", () => {
        memoryScreen?.classList.remove("active");
        app?.classList.remove("memory-unlocked");
        document.body.style.overflow = "";
    });

    // 初期状態
    photoMemorySection?.classList.remove("game-visible");

    challenge = Array(6).fill(null);
    photoCount = 3;
    cellCount = 6;

    renderBoard(false);
    updateStatus();

    instruction.textContent = "隠されたゲームを解除して始めよう。";
    feedback.textContent = "ゲームを表示したらSTARTを押してね。";

    startButton.textContent = "START GAME";
    startButton.hidden = false;

    targetWrap.hidden = true;
    countdown.hidden = true;
})();