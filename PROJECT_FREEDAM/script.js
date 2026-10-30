// スクロールすると要素を表示する

const revealElements = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver((entries) => {
entries.forEach(entry => {
    if (entry.isIntersecting) {
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
    }
});
}, {
threshold: 0.12
});

revealElements.forEach(element => {
observer.observe(element);
});

// カードをクリックしたときの移動演出

document.querySelectorAll(".portal-card, .destination-link").forEach(link => {
link.addEventListener("click", event => {
    // Ctrlキーや新しいタブで開く操作はそのままにする
    if (
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.button !== 0
    ) {
    return;
    }

    const destination = link.getAttribute("href");

    if (!destination) return;

    event.preventDefault();

    document.body.classList.add("leaving");

    setTimeout(() => {
    window.location.href = destination;
    }, 350);
});
});