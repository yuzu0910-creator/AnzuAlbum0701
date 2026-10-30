
const API_URL =
  "https://zxdxwdwcokcxkhowqgfc.supabase.co/functions/v1/admin-api";

const SUPABASE_URL =
  "https://zxdxwdwcokcxkhowqgfc.supabase.co";

// 公開用 anon / publishable キー。
// service_role キーや secret は絶対に入れない。
const SUPABASE_PUBLIC_KEY =
  "sb_publishable_e4oahRKe2qT4rKcecddXyw_G8pfY-6x";

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const statusBox = document.getElementById("status");
const commentsBox = document.getElementById("comments");
const likesBox = document.getElementById("likes");
const galleryPhotosBox = document.getElementById("galleryPhotos");

let adminToken = sessionStorage.getItem("album_admin_token") || "";

function showStatus(message) {
  statusBox.textContent = message;
}

function makeElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text ?? "";
  if (className) element.className = className;
  return element;
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


// =====================================
// ログイン・ログアウト
// =====================================

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  showStatus("ログイン中...");

  try {
    const password = document.getElementById("password").value;
    const result = await callAdmin("login", { password });

    if (!result.token) {
      throw new Error("トークンを取得できませんでした。");
    }

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
  document.getElementById("likesRanking").replaceChildren();
  galleryPhotosBox.replaceChildren();

  updateScreen();
  showStatus("ログアウトしました。");
});

document.getElementById("refreshButton").addEventListener("click", refreshAll);


// =====================================
// 全体更新
// =====================================

async function refreshAll() {
  showStatus("一覧を読み込み中...");

  try {
    await Promise.all([
      loadComments(),
      loadLikes(),
      loadGallery(),
      loadCommunityAll()
    ]);

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


// =====================================
// ALBUM：コメント管理
// =====================================

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
    item.append(
      makeElement(
        "p",
        `写真ID: ${comment.photo_id} / コメントID: ${comment.id}`
      )
    );
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


// =====================================
// ALBUM：いいね管理
// =====================================

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

  const maxCount = Math.max(...entries.map(item => item.count), 1);

  // 人気ランキング
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

      likeRow.append(makeElement("span", `日時：${dateText}`));

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


// =====================================
// GALLERY：写真アップロード
// =====================================

const galleryForm = document.getElementById("galleryForm");

galleryForm.addEventListener("submit", async event => {
  event.preventDefault();

  const fileInput = document.getElementById("galleryFile");
  const titleInput = document.getElementById("galleryTitle");
  const descriptionInput = document.getElementById("galleryDescription");
  const dateInput = document.getElementById("galleryDate");
  const publishInput = document.getElementById("galleryPublish");
  const submitButton = document.getElementById("gallerySubmitButton");

  const file = fileInput.files[0];
  const title = titleInput.value.trim();

  if (!file) {
    showStatus("写真を選択してください。");
    return;
  }

  if (!title) {
    showStatus("タイトルを入力してください。");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(file.type)) {
    showStatus("JPEG・PNG・WebP・GIF形式の画像を選択してください。");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showStatus("画像サイズは10MB以下にしてください。");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "アップロード中...";

  try {
    // 1. アップロード用の署名付きURLを取得
    const upload = await callAdmin("create_gallery_upload", {
      file_name: file.name,
      content_type: file.type
    });

    if (!upload.path || !upload.token) {
      throw new Error("アップロード情報を取得できませんでした。");
    }

    // 2. Supabase Storageへ画像をアップロード
    const encodedPath = upload.path
      .split("/")
      .map(segment => encodeURIComponent(segment))
      .join("/");

    const uploadUrl =
      `${SUPABASE_URL}/storage/v1/object/upload/sign/gallery-photos/${encodedPath}?token=${encodeURIComponent(upload.token)}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "apikey": SUPABASE_PUBLIC_KEY,
        "Content-Type": file.type,
        "x-upsert": "false"
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json().catch(() => ({}));
      throw new Error(
        uploadError.message || uploadError.error || "画像のアップロードに失敗しました。"
      );
    }

    // 3. データベースに写真情報を登録
    await callAdmin("create_gallery_photo", {
      title,
      description: descriptionInput.value.trim(),
      taken_at: dateInput.value || null,
      storage_path: upload.path,
      is_published: publishInput.checked
    });

    galleryForm.reset();

    showStatus("GALLERYに写真を追加しました。");
    await loadGallery();

  } catch (error) {
    showStatus("写真の追加に失敗しました: " + error.message);

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "写真を追加";
  }
});


// =====================================
// GALLERY：写真一覧
// =====================================

async function loadGallery() {
  const result = await callAdmin("list_gallery");

  galleryPhotosBox.replaceChildren();

  const photos = result.photos || result.gallery || [];

  if (photos.length === 0) {
    galleryPhotosBox.append(
      makeElement("p", "登録されている写真はありません。")
    );
    return;
  }

  for (const photo of photos) {
    const item = makeElement("article", "", "gallery-photo");

    const image = makeElement("img");
    image.src = photo.image_url;
    image.alt = photo.title || "GALLERY photo";
    image.loading = "lazy";

    const info = makeElement("div", "", "gallery-photo-info");

    const status = makeElement(
      "span",
      photo.is_published ? "公開中" : "非公開",
      photo.is_published
        ? "gallery-status published"
        : "gallery-status"
    );

    const title = makeElement("h3", photo.title);
    const description = makeElement("p", photo.description || "説明なし");

    const dateText = photo.taken_at
      ? new Date(`${photo.taken_at}T00:00:00`).toLocaleDateString("ja-JP")
      : "撮影日未設定";

    const date = makeElement("p", `撮影日：${dateText}`, "muted");

    // 編集フォーム
    const editButton = makeElement("button", "編集");
    const editForm = makeElement("div", "", "gallery-edit-form hidden");

    const editTitle = makeElement("input");
    editTitle.type = "text";
    editTitle.maxLength = 100;
    editTitle.value = photo.title || "";

    const editDescription = makeElement("textarea");
    editDescription.rows = 4;
    editDescription.value = photo.description || "";

    const editDate = makeElement("input");
    editDate.type = "date";
    editDate.value = photo.taken_at || "";

    const editPublishLabel = makeElement("label", "公開する");
    const editPublish = makeElement("input");
    editPublish.type = "checkbox";
    editPublish.checked = Boolean(photo.is_published);

    editPublishLabel.prepend(editPublish);

    const saveButton = makeElement("button", "保存");
    const cancelButton = makeElement("button", "キャンセル", "secondary");

    editForm.append(
      makeElement("label", "タイトル"),
      editTitle,
      makeElement("label", "説明"),
      editDescription,
      makeElement("label", "撮影日"),
      editDate,
      editPublishLabel,
      saveButton,
      cancelButton
    );

    editButton.addEventListener("click", () => {
      editForm.classList.toggle("hidden");
    });

    cancelButton.addEventListener("click", () => {
      editForm.classList.add("hidden");
      editTitle.value = photo.title || "";
      editDescription.value = photo.description || "";
      editDate.value = photo.taken_at || "";
      editPublish.checked = Boolean(photo.is_published);
    });

    saveButton.addEventListener("click", async () => {
      const newTitle = editTitle.value.trim();

      if (!newTitle) {
        alert("タイトルを入力してください。");
        return;
      }

      try {
        saveButton.disabled = true;

        await callAdmin("update_gallery_photo", {
          id: photo.id,
          title: newTitle,
          description: editDescription.value.trim(),
          taken_at: editDate.value || null,
          is_published: editPublish.checked
        });

        showStatus("GALLERYの写真情報を更新しました。");
        await loadGallery();

      } catch (error) {
        showStatus("編集に失敗しました: " + error.message);

      } finally {
        saveButton.disabled = false;
      }
    });

    // 公開・非公開の切り替え
    const toggleButton = makeElement(
      "button",
      photo.is_published ? "非公開にする" : "公開する",
      "secondary"
    );

    toggleButton.addEventListener("click", async () => {
      const nextState = !photo.is_published;

      if (
        !confirm(
          nextState
            ? "この写真を公開しますか？"
            : "この写真を非公開にしますか？"
        )
      ) {
        return;
      }

      try {
        toggleButton.disabled = true;

        await callAdmin("update_gallery_photo", {
          id: photo.id,
          title: photo.title,
          description: photo.description || "",
          taken_at: photo.taken_at || null,
          is_published: nextState
        });

        showStatus(nextState ? "写真を公開しました。" : "写真を非公開にしました。");
        await loadGallery();

      } catch (error) {
        showStatus("変更に失敗しました: " + error.message);

      } finally {
        toggleButton.disabled = false;
      }
    });

    // 削除
    const deleteButton = makeElement("button", "削除", "danger");

    deleteButton.addEventListener("click", async () => {
      if (
        !confirm(
          `「${photo.title}」を削除しますか？\n画像ファイルもStorageから削除されます。`
        )
      ) {
        return;
      }

      try {
        deleteButton.disabled = true;

        await callAdmin("delete_gallery_photo", {
          id: photo.id
        });

        showStatus("写真を削除しました。");
        await loadGallery();

      } catch (error) {
        showStatus("削除に失敗しました: " + error.message);
        deleteButton.disabled = false;
      }
    });

    info.append(
      status,
      title,
      description,
      date,
      editButton,
      toggleButton,
      deleteButton,
      editForm
    );

    item.append(image, info);
    galleryPhotosBox.append(item);
  }
}


// =====================================
// タブ切り替え
// =====================================

// サイト切り替え
document.querySelectorAll(".site-tab-button").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.site;

    document.querySelectorAll(".site-tab-button").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll(".site-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === target);
    });
  });
});

// ALBUM内の機能切り替え
document.querySelectorAll(".function-tab-button").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.function;

    document.querySelectorAll(".function-tab-button").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll("#albumSite .function-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === target);
    });
  });
});


// =====================================
// COMMUNITY：管理機能
// =====================================

const communityUserBox = document.getElementById("communityUsers");
const communityPostBox = document.getElementById("communityPosts");
const communityReportBox = document.getElementById("communityReports");
const communityDmBox = document.getElementById("communityReportedDm");
const communityLogBox = document.getElementById("communityLogs");

function formatCommunityDate(value) {
  if (!value) return "日時不明";

  return new Date(value).toLocaleString("ja-JP");
}

function createCommunityItem(title, text, meta = "") {
  const item = makeElement("article", "", "community-item");

  item.append(makeElement("h3", title));

  if (text) {
    item.append(makeElement("p", text));
  }

  if (meta) {
    item.append(makeElement("p", meta, "community-meta"));
  }

  return item;
}


// -------------------------------------
// ダッシュボード
// -------------------------------------

async function loadCommunityDashboard() {
  const result = await callAdmin("community_dashboard");

  document.getElementById("communityUserCount").textContent =
    result.userCount ?? "--";

  document.getElementById("communityPostCount").textContent =
    result.postCount ?? "--";

  document.getElementById("communityReportCount").textContent =
    result.reportCount ?? "--";

  document.getElementById("communityDashboardUpdated").textContent =
    "更新：" + new Date().toLocaleString("ja-JP");
}


// -------------------------------------
// ユーザー管理
// -------------------------------------

async function loadCommunityUsers() {
  const search = document
    .getElementById("communityUserSearch")
    .value.trim();

  communityUserBox.replaceChildren();

  const result = await callAdmin("list_community_users", {
    search
  });

  const users = result.users || [];

  if (users.length === 0) {
    communityUserBox.append(makeElement("p", "ユーザーはいません。"));
    return;
  }

  for (const user of users) {
    const item = createCommunityItem(
      user.username || "名前なし",
      `ユーザーID：${user.id}`,
      `登録日時：${formatCommunityDate(user.created_at)}`
    );

    const active = user.is_active !== false;

    item.append(
      makeElement(
        "span",
        active ? "利用中" : "利用停止中",
        "community-status"
      )
    );

    const button = makeElement(
      "button",
      active ? "利用停止にする" : "利用停止を解除",
      active ? "danger" : "secondary"
    );

    button.addEventListener("click", async () => {
      const nextActive = !active;

      const message = nextActive
        ? "このユーザーの利用停止を解除しますか？"
        : "このユーザーを利用停止にしますか？";

      if (!confirm(message)) return;

      try {
        button.disabled = true;

        await callAdmin("set_community_user_active", {
          user_id: user.id,
          is_active: nextActive
        });

        showStatus("ユーザーの状態を更新しました。");
        await loadCommunityUsers();
        await loadCommunityDashboard();

      } catch (error) {
        showStatus("変更に失敗しました：" + error.message);
      } finally {
        button.disabled = false;
      }
    });

    item.append(button);
    communityUserBox.append(item);
  }
}


// -------------------------------------
// 投稿管理
// -------------------------------------

async function loadCommunityPosts() {
  const search = document
    .getElementById("communityPostSearch")
    .value.trim();

  communityPostBox.replaceChildren();

  const result = await callAdmin("list_community_posts", {
    search
  });

  const posts = result.posts || [];

  if (posts.length === 0) {
    communityPostBox.append(makeElement("p", "投稿はありません。"));
    return;
  }

  for (const post of posts) {
    const item = createCommunityItem(
      post.username || "ユーザー名不明",
      post.content || "",
      `投稿ID：${post.id}\nユーザーID：${post.user_id}\n投稿日時：${formatCommunityDate(post.created_at)}`
    );

    const deleteButton = makeElement("button", "投稿を削除", "danger");

    deleteButton.addEventListener("click", async () => {
      if (!confirm("この投稿を削除しますか？")) return;

      try {
        deleteButton.disabled = true;

        await callAdmin("delete_community_post", {
          post_id: post.id
        });

        showStatus("投稿を削除しました。");
        await loadCommunityPosts();
        await loadCommunityDashboard();

      } catch (error) {
        showStatus("削除に失敗しました：" + error.message);
      } finally {
        deleteButton.disabled = false;
      }
    });

    item.append(deleteButton);
    communityPostBox.append(item);
  }
}


// -------------------------------------
// 通報管理
// -------------------------------------

async function loadCommunityReports() {
  const status = document.getElementById("communityReportStatus").value;

  communityReportBox.replaceChildren();

  const result = await callAdmin("list_community_reports", {
    status
  });

  const reports = result.reports || [];

  if (reports.length === 0) {
    communityReportBox.append(makeElement("p", "通報はありません。"));
    return;
  }

  for (const report of reports) {
    const typeLabels = {
      post: "投稿",
      user: "ユーザー",
      dm: "DM"
    };

    const item = createCommunityItem(
      `通報：${typeLabels[report.target_type] || report.target_type}`,
      `理由：${report.reason}\n詳細：${report.details || "なし"}`,
      `通報ID：${report.id}\n通報日時：${formatCommunityDate(report.created_at)}`
    );

    item.append(
      makeElement(
        "span",
        report.status,
        `community-status ${report.status}`
      )
    );

    const statusSelect = makeElement("select");

    [
      ["pending", "未対応"],
      ["reviewing", "確認中"],
      ["resolved", "対応済み"],
      ["rejected", "対応不要"]
    ].forEach(([value, label]) => {
      const option = makeElement("option", label);
      option.value = value;
      statusSelect.append(option);
    });

    statusSelect.value = report.status;

    const note = makeElement("textarea");
    note.placeholder = "管理者メモ";
    note.value = report.admin_note || "";

    const saveButton = makeElement("button", "対応状況を保存");

    saveButton.addEventListener("click", async () => {
      try {
        saveButton.disabled = true;

        await callAdmin("update_community_report", {
          report_id: report.id,
          status: statusSelect.value,
          admin_note: note.value.trim()
        });

        showStatus("通報の対応状況を更新しました。");
        await loadCommunityReports();
        await loadCommunityDashboard();

      } catch (error) {
        showStatus("更新に失敗しました：" + error.message);
      } finally {
        saveButton.disabled = false;
      }
    });

    item.append(statusSelect, note, saveButton);

    if (report.target_type === "dm") {
      const dmButton = makeElement(
        "button",
        "通報されたDMを確認",
        "secondary"
      );

      dmButton.addEventListener("click", async () => {
        await loadReportedDm(report.id);
      });

      item.append(dmButton);
    }

    communityReportBox.append(item);
  }
}


// -------------------------------------
// 通報されたDMのみ確認
// -------------------------------------

async function loadReportedDm(reportId) {
  communityDmBox.replaceChildren();

  try {
    const result = await callAdmin("get_reported_dm", {
      report_id: reportId
    });

    const messages = result.messages || [];

    if (messages.length === 0) {
      communityDmBox.append(
        makeElement("p", "確認できるメッセージはありません。")
      );
      return;
    }

    for (const message of messages) {
      const item = createCommunityItem(
        message.sender_username || "ユーザー名不明",
        message.content || "",
        formatCommunityDate(message.created_at)
      );

      communityDmBox.append(item);
    }

    showStatus("通報対象のDMを読み込みました。");

  } catch (error) {
    showStatus("DMの確認に失敗しました：" + error.message);
  }
}


// -------------------------------------
// 管理者操作ログ
// -------------------------------------

async function loadCommunityLogs() {
  communityLogBox.replaceChildren();

  const result = await callAdmin("list_admin_logs");
  const logs = result.logs || [];

  if (logs.length === 0) {
    communityLogBox.append(makeElement("p", "操作ログはありません。"));
    return;
  }

  for (const log of logs) {
    const item = createCommunityItem(
      log.action,
      `対象：${log.target_type || "不明"}\n対象ID：${log.target_id || "なし"}`,
      formatCommunityDate(log.created_at)
    );

    communityLogBox.append(item);
  }
}


// -------------------------------------
// 検索・更新ボタン
// -------------------------------------

document
  .getElementById("communityUserSearchButton")
  .addEventListener("click", async () => {
    try {
      await loadCommunityUsers();
    } catch (error) {
      showStatus("ユーザー取得に失敗しました：" + error.message);
    }
  });

document
  .getElementById("communityPostSearchButton")
  .addEventListener("click", async () => {
    try {
      await loadCommunityPosts();
    } catch (error) {
      showStatus("投稿取得に失敗しました：" + error.message);
    }
  });

document
  .getElementById("communityReportSearchButton")
  .addEventListener("click", async () => {
    try {
      await loadCommunityReports();
    } catch (error) {
      showStatus("通報取得に失敗しました：" + error.message);
    }
  });


// -------------------------------------
// COMMUNITYタブ切り替え
// -------------------------------------

document
  .querySelectorAll("#communitySite .function-tab-button")
  .forEach(button => {
    button.addEventListener("click", async () => {
      const target = button.dataset.function;

      document
        .querySelectorAll("#communitySite .function-tab-button")
        .forEach(tab => {
          tab.classList.toggle("active", tab === button);
        });

      document
        .querySelectorAll("#communitySite .function-panel")
        .forEach(panel => {
          panel.classList.toggle("active", panel.id === target);
        });

      try {
        if (target === "communityDashboardPanel") {
          await loadCommunityDashboard();
        } else if (target === "communityUsersPanel") {
          await loadCommunityUsers();
        } else if (target === "communityPostsPanel") {
          await loadCommunityPosts();
        } else if (target === "communityReportsPanel") {
          await loadCommunityReports();
        } else if (target === "communityLogsPanel") {
          await loadCommunityLogs();
        }
      } catch (error) {
        showStatus("読み込みに失敗しました：" + error.message);
      }
    });
  });


// -------------------------------------
// COMMUNITY初回読み込み
// -------------------------------------

async function loadCommunityAll() {
  await loadCommunityDashboard();
}


// =====================================
// 初期化
// =====================================

updateScreen();

if (adminToken) {
  refreshAll();
}
