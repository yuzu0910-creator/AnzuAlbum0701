const API_URL =
  "https://zxdxwdwcokcxkhowqgfc.supabase.co/functions/v1/admin-api";

// Supabaseの公開用 anon / publishable キーをここに設定。
// service_role や secret キーは絶対に入れない。
const SUPABASE_PUBLIC_KEY = "sb_publishable_e4oahRKe2qT4rKcecddXyw_G8pfY-6x";

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const statusBox = document.getElementById("status");
const commentsBox = document.getElementById("comments");
const likesBox = document.getElementById("likes");

let adminToken = sessionStorage.getItem("album_admin_token") || "";

function showStatus(message) {
  statusBox.textContent = message;
}

async function callAdmin(action, extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_PUBLIC_KEY
  };

  if (adminToken) {
    headers["x-admin-token"] = adminToken;
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...extra })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `通信エラー (${response.status})`);
  }

  return result;
}

function updateScreen() {
  const loggedIn = Boolean(adminToken);
  loginPanel.classList.toggle("hidden", loggedIn);
  dashboard.classList.toggle("hidden", !loggedIn);
}

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  showStatus("ログイン中...");

  try {
    const password = document.getElementById("password").value;
    const result = await callAdmin("login", { password });

    if (!result.token) throw new Error("トークンを取得できませんでした。");

    adminToken = result.token;
    sessionStorage.setItem("album_admin_token", adminToken);
    document.getElementById("password").value = "";
    updateScreen();
    showStatus("ログインしました。");
    await refreshAll();
  } catch (error) {
    showStatus("ログインできませんでした: " + error.message);
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  adminToken = "";
  sessionStorage.removeItem("album_admin_token");
  commentsBox.replaceChildren();
  likesBox.replaceChildren();
  updateScreen();
  showStatus("ログアウトしました。");
});

document.getElementById("refreshButton").addEventListener("click", refreshAll);

function makeElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text ?? "";
  if (className) element.className = className;
  return element;
}

async function refreshAll() {
  showStatus("一覧を読み込み中...");

  try {
    await Promise.all([loadComments(), loadLikes()]);
    showStatus("一覧を更新しました。");
  } catch (error) {
    showStatus("読み込みに失敗しました: " + error.message);

    if (error.message.toLowerCase().includes("unauthorized")) {
      adminToken = "";
      sessionStorage.removeItem("album_admin_token");
      updateScreen();
      showStatus("ログイン期限が切れた可能性があります。再ログインしてください。");
    }
  }
}

async function loadComments() {
  const result = await callAdmin("list_comments");
  commentsBox.replaceChildren();

  if (!result.comments || result.comments.length === 0) {
    commentsBox.append(makeElement("p", "コメントはありません。"));
    return;
  }

  for (const comment of result.comments) {
    const item = makeElement("article", "", "item");
    item.append(makeElement("strong", comment.nickname || "匿名"));
    item.append(makeElement("p", `写真ID: ${comment.photo_id} / コメントID: ${comment.id}`));
    item.append(makeElement("p", comment.body));
    item.append(makeElement("p", comment.created_at || "", "muted"));

    const editButton = makeElement("button", "編集");

    const editForm = makeElement("div", "", "edit-form hidden");

    const nicknameInput = makeElement("input");
    nicknameInput.type = "text";
    nicknameInput.value = comment.nickname || "";
    nicknameInput.placeholder = "ニックネーム";

    const bodyInput = makeElement("textarea");
    bodyInput.value = comment.body || "";
    bodyInput.placeholder = "コメント本文";

    const saveButton = makeElement("button", "保存");
    const cancelButton = makeElement("button", "キャンセル", "secondary");

    editForm.append(
    makeElement("label", "ニックネーム"),
    nicknameInput,
    makeElement("label", "コメント本文"),
    bodyInput,
    saveButton,
    cancelButton
    );

    editButton.addEventListener("click", () => {
    editForm.classList.toggle("hidden");
    });

    cancelButton.addEventListener("click", () => {
    editForm.classList.add("hidden");
    nicknameInput.value = comment.nickname || "";
    bodyInput.value = comment.body || "";
    });

    saveButton.addEventListener("click", async () => {
    const newNickname = nicknameInput.value.trim();
    const newBody = bodyInput.value.trim();

    if (!newNickname || !newBody) {
        alert("ニックネームとコメント本文を入力してください。");
        return;
    }

    try {
        saveButton.disabled = true;

        await callAdmin("update_comment", {
        id: comment.id,
        nickname: newNickname,
        body: newBody
        });

        showStatus("コメントを更新しました。");
        await loadComments();
    } catch (error) {
        showStatus("編集に失敗しました: " + error.message);
    } finally {
        saveButton.disabled = false;
    }
    });

    // 削除ボタンを作る処理
    const deleteButton = makeElement("button", "削除", "danger");

    deleteButton.addEventListener("click", async () => {
    if (!confirm("このコメントを削除しますか？")) return;

    try {
        await callAdmin("delete_comment", { id: comment.id });
        showStatus("コメントを削除しました。");
        await loadComments();
    } catch (error) {
        showStatus("削除に失敗しました: " + error.message);
    }
    });

    item.append(editButton, editForm, deleteButton);
    commentsBox.append(item);
  }
}

async function loadLikes() {
  const result = await callAdmin("list_likes");
  likesBox.replaceChildren();

  const rankingBox = document.getElementById("likesRanking");
  rankingBox.replaceChildren();

  const likes = result.likes || [];
  const counts = result.counts || {};
  const entries = Object.entries(counts)
    .map(([photoId, count]) => ({
      photoId,
      count: Number(count) || 0
    }))
    .sort((a, b) => b.count - a.count);

  if (entries.length === 0) {
    rankingBox.append(makeElement("p", "いいねはまだありません。"));
    likesBox.append(makeElement("p", "いいねはまだありません。"));
    return;
  }

  // 人気ランキング
  const maxCount = Math.max(...entries.map(item => item.count), 1);

  entries.slice(0, 5).forEach((entry, index) => {
    const item = makeElement("div", "", "ranking-item");
    const topRow = makeElement("div", "", "ranking-top");
    const label = makeElement(
      "div",
      `${index + 1}. 写真ID: ${entry.photoId}`,
      "ranking-label"
    );
    const count = makeElement(
      "span",
      `${entry.count} いいね`,
      "ranking-count"
    );
    const track = makeElement("div", "", "ranking-track");
    const bar = makeElement("div", "", "ranking-bar");

    bar.style.width = `${entry.count / maxCount * 100}%`;
    topRow.append(label, count);
    track.append(bar);
    item.append(topRow, track);
    rankingBox.append(item);
  });

  // 写真ごとの管理一覧
  for (const { photoId, count } of entries) {
    const item = makeElement("article", "", "item");

    item.append(makeElement("strong", `写真ID: ${photoId}`));
    item.append(makeElement("p", `いいね数: ${count}`));

    // いいねの詳細を折りたたんで表示
    const photoLikes = likes.filter(
    like => String(like.photo_id) === String(photoId)
    );

    const details = makeElement("details", "", "likes-details");
    const summary = makeElement(
    "summary",
    `いいねの詳細を開く（${photoLikes.length}件）`
    );

    details.append(summary);

    for (const like of photoLikes) {
    const likeRow = makeElement("div", "", "like-row");

    const dateText = like.created_at
        ? new Date(like.created_at).toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        })
        : "日時不明";

    likeRow.append(
        makeElement("span", `日時：${dateText}`)
    );

    const deleteOneButton = makeElement(
        "button",
        "この1件を削除",
        "danger"
    );

    deleteOneButton.addEventListener("click", async () => {
        if (!confirm("このいいねを1件削除しますか？")) return;

        try {
        await callAdmin("delete_like", {
            photo_id: photoId,
            visitor_id: like.visitor_id
        });

        showStatus("いいねを1件削除しました。");
        await loadLikes();
        } catch (error) {
        showStatus("削除に失敗しました: " + error.message);
        }
    });

    likeRow.append(deleteOneButton);
    details.append(likeRow);
    }

    item.append(details);

    // 写真のいいねを全削除するボタン
    const deleteAllButton = makeElement(
      "button",
      "この写真のいいねを全削除",
      "danger"
    );

    deleteAllButton.addEventListener("click", async () => {
      if (!confirm(`写真ID「${photoId}」のいいねをすべて削除しますか？`)) {
        return;
      }

      try {
        await callAdmin("delete_likes_for_photo", {
          photo_id: photoId
        });

        showStatus("いいねを全削除しました。");
        await loadLikes();
      } catch (error) {
        showStatus("削除に失敗しました: " + error.message);
      }
    });

    item.append(deleteAllButton);
    likesBox.append(item);
  }
}

updateScreen();
if (adminToken) {
  refreshAll();
}

document.querySelectorAll(".tab-button").forEach(button => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.tab;

    document.querySelectorAll(".tab-button").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === targetId);
    });
  });
});