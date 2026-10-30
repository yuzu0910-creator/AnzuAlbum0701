
// ========================================
// COMMUNITY - Supabase Connected
// ========================================

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SUPABASE_URL = "https://zxdxwdwcokcxkhowqgfc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e4oahRKe2qT4rKcecddXyw_G8pfY-6x";

// ログイン情報はメモリ内だけに保持する
let authToken = null;
let currentUser = null;
let toastTimer = null;

// Supabase Realtime
const realtimeClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let realtimeChannel = null;
let realtimeRefreshTimer = null;
let realtimeGeneration = 0;

const AUTH_URL = `${SUPABASE_URL}/functions/v1/community-auth`;
const API_URL = `${SUPABASE_URL}/functions/v1/community-api`;

const MOODS = [
  "☀️ いい感じ",
  "🌙 まったり",
  "⚡ やる気",
  "☕ ひと休み"
];


// ========================================
// 1. 通知
// ========================================

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}


// ========================================
// 2. API通信
// ========================================

async function requestAuth(action, data = {}) {
  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "認証に失敗しました");
  }

  return result;
}


async function requestAPI(action, data = {}) {
  if (!authToken) {
    throw new Error("ログインしてください");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "x-community-token": authToken
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "通信に失敗しました");
  }

  return result;
}


// ========================================
// Realtime接続・解除
// ========================================

// Realtime用JWTを取得してSupabaseに設定
async function refreshRealtimeToken() {
  if (!authToken) {
    throw new Error("ログインしてください");
  }

  const result = await requestAuth("realtime_token", {
    token: authToken
  });

  if (!result.token) {
    throw new Error("Realtime認証トークンを取得できませんでした");
  }

  await realtimeClient.realtime.setAuth(result.token);
}

// 現在のRealtime接続を解除
async function stopRealtime() {
  realtimeGeneration++;

  if (realtimeRefreshTimer) {
    clearInterval(realtimeRefreshTimer);
    realtimeRefreshTimer = null;
  }

  if (realtimeChannel) {
    const oldChannel = realtimeChannel;
    realtimeChannel = null;

    await realtimeClient.removeChannel(oldChannel);
  }
}

// 指定した会話のRealtime接続を開始
async function startRealtime(conversationId) {
  await stopRealtime();

  const generation = realtimeGeneration;

  if (!authToken || !conversationId) return;

  try {
    // 最初のJWTを取得
    await refreshRealtimeToken();

    // 接続中に会話が切り替わっていないか確認
    if (
      generation !== realtimeGeneration ||
      activeConversationId !== conversationId ||
      !authToken
    ) {
      return;
    }

    const channel = realtimeClient
      .channel(`community-dm-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          // 通知は更新の合図としてだけ使用する
          if (
            activeConversationId === conversationId &&
            generation === realtimeGeneration
          ) {
            loadMessages();
          }
        }
      );

    realtimeChannel = channel;

    channel.subscribe(status => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime接続成功:", conversationId);
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime接続エラー:", status);
      }
    });

    // JWTの有効期限は5分なので、4分ごとに更新
    realtimeRefreshTimer = setInterval(async () => {
      if (
        generation !== realtimeGeneration ||
        activeConversationId !== conversationId ||
        !authToken
      ) {
        return;
      }

      try {
        await refreshRealtimeToken();
        console.log("Realtime認証を更新しました");
      } catch (error) {
        console.error("Realtime認証更新エラー:", error);
      }
    }, 4 * 60 * 1000);

  } catch (error) {
    console.error("Realtime開始エラー:", error);
    showToast("リアルタイム接続に失敗しました");
  }
}

// ========================================
// 3. ログイン・新規登録
// ========================================

function updateUserDisplay() {
  if (!currentUser) return;

  const name = currentUser.username;
  const initial = name.charAt(0).toUpperCase();

  $("#sideName").textContent = name;
  $("#profileName").textContent = name;

  $$(".profile-mini .avatar, .profile-large .avatar, .compose-row .avatar")
    .forEach(avatar => {
      avatar.textContent = initial;
    });

  const handle = $(".profile-mini .handle");
  if (handle) handle.textContent = `@${name}`;

  const profileHandle = $(".profile-large .handle");
  if (profileHandle) profileHandle.textContent = `@${name}`;
}


function setLoading(button, loading, originalText) {
  button.disabled = loading;
  button.textContent = loading ? "処理中..." : originalText;
}


async function login() {
  const button = $("#loginBtn");
  const username = $("#loginName").value.trim();
  const password = $("#loginPassword").value;

  if (!username || !password) {
    showToast("ユーザーネームとパスワードを入力してね");
    return;
  }

  const originalText = "ログイン →";
  setLoading(button, true, originalText);

  try {
    const result = await requestAuth("login", {
      username,
      password
    });

    authToken = result.token;
    currentUser = result.user;

    if (!authToken || !currentUser) {
      throw new Error("ログイン情報を取得できませんでした");
    }

    updateUserDisplay();

    $("#loginModal").classList.remove("open");

    await Promise.all([
      loadPosts(),
      loadFriends(),
      loadMyStats()
    ]);

    showToast(`ようこそ、${currentUser.username}！`);

  } catch (error) {
    authToken = null;
    currentUser = null;
    showToast(error.message);
  } finally {
    setLoading(button, false, originalText);
  }
}


async function signup() {
  const button = $("#signupBtn");
  const username = $("#loginName").value.trim();
  const password = $("#loginPassword").value;

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showToast("ユーザー名は英数字と_で3〜20文字にしてね");
    return;
  }

  if (password.length < 12 || password.length > 128) {
    showToast("パスワードは12〜128文字にしてね");
    return;
  }

  const originalText = "アカウント作成";
  setLoading(button, true, originalText);

  try {
    await requestAuth("signup", {
      username,
      password
    });

    showToast("アカウントを作成しました。ログインしてね");

  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(button, false, originalText);
  }
}


// ========================================
// 4. ログアウト
// ========================================

function addLogoutButton() {
  const topActions = $(".top-actions");

  if (!topActions || $("#logoutBtn")) return;

  const button = document.createElement("button");
  button.id = "logoutBtn";
  button.className = "ghost-btn";
  button.textContent = "ログアウト";

  topActions.prepend(button);

  button.addEventListener("click", logout);
}


async function logout() {
  try {
    if (authToken) {
      await requestAuth("logout", {
        token: authToken
      });
    }
  } catch (error) {
    console.error("Logout error:", error);
  }

  await stopRealtime();
  activeConversationId = null;

  authToken = null;
  currentUser = null;

  $("#loginName").value = "";
  $("#loginPassword").value = "";

  $("#posts").replaceChildren();

  $("#loginModal").classList.add("open");

  showToast("ログアウトしました");
}


// ========================================
// 5. ページ切り替え
// ========================================

$$(".nav-item").forEach(button => {
  button.addEventListener("click", async () => {
    const targetView = button.dataset.view;

    $$(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $$(".view").forEach(view => {
      view.classList.remove("active");
    });

    const target = $(`#${targetView}View`);
    if (target) target.classList.add("active");

    if (targetView === "feed" && authToken) {
      await loadPosts();
    }
  });
});


// ========================================
// 6. 投稿文と気分の分離
// ========================================

function separateMood(text) {
  const lines = text.split("\n");
  const moodIndex = lines.findIndex(line =>
    MOODS.includes(line.trim())
  );

  let mood = null;

  if (moodIndex !== -1) {
    mood = lines[moodIndex].trim();
    lines.splice(moodIndex, 1);
  }

  return {
    content: lines.join("\n").trim(),
    mood
  };
}


// ========================================
// 7. 投稿一覧の読み込み
// ========================================

async function loadPosts() {
  if (!authToken) return;

  const postsArea = $("#posts");

  try {
    const result = await requestAPI("list_posts");

    postsArea.replaceChildren();

    for (const postData of result.posts || []) {
      const post = createPostElement(postData);
      postsArea.append(post);
    }

  } catch (error) {
    showToast(error.message);
  }
}


// ========================================
// 9. 投稿カードの作成
// ========================================

function createPostElement(data) {
  const post = document.createElement("article");
  post.className = "post";
  post.dataset.postId = data.id;

  const head = document.createElement("div");
  head.className = "post-head";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = (data.username || "G").charAt(0).toUpperCase();

  const author = document.createElement("div");
  author.className = "post-author";

  const authorName = document.createElement("strong");
  authorName.textContent = data.username || "Guest";

  const authorHandle = document.createElement("span");
  authorHandle.textContent =
    data.user_id === currentUser?.id ? "@you · あなた" : `@${data.username}`;

  author.append(authorName, authorHandle);

  const time = document.createElement("span");
  time.className = "post-time";
  time.textContent = formatTime(data.created_at);

  head.append(avatar, author, time);

  if (data.mood) {
    const mood = document.createElement("div");
    mood.className = "post-mood";
    mood.textContent = data.mood;
    post.append(head, mood);
  } else {
    post.append(head);
  }

  const content = document.createElement("p");
  content.className = "post-text";
  content.textContent = data.content;

  const actions = document.createElement("div");
  actions.className = "post-actions";

  const likeButton = document.createElement("button");
  likeButton.className = "action-btn like-btn";
  likeButton.type = "button";

  if (data.liked_by_me) {
    likeButton.classList.add("liked");
  }

  const likeIcon = document.createTextNode(
    data.liked_by_me ? "♥ " : "♡ "
  );

  const likeCount = document.createElement("span");
  likeCount.textContent = `いいね ${data.like_count || 0}`;

  likeButton.append(likeIcon, likeCount);

  const commentButton = document.createElement("button");
  commentButton.className = "action-btn comment-btn";
  commentButton.type = "button";
  commentButton.textContent =
    `▢ コメント ${data.comment_count || 0}`;

  actions.append(likeButton, commentButton);

  const comments = document.createElement("div");
  comments.className = "comments";

  const commentBox = document.createElement("div");
  commentBox.className = "comment-box";

  const input = document.createElement("input");
  input.placeholder = "コメントを書く…";
  input.maxLength = 1000;

  const sendButton = document.createElement("button");
  sendButton.type = "button";
  sendButton.textContent = "送信";

  commentBox.append(input, sendButton);

  post.append(content, actions, comments, commentBox);

  setupLikeButton(likeButton, data);
  setupComments(post, data);

  return post;
}


// ========================================
// 10. 時刻表示
// ========================================

function formatTime(dateString) {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();

  if (!Number.isFinite(diff) || diff < 0) return "たった今";

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;

  return date.toLocaleDateString("ja-JP");
}


// ========================================
// 11. いいね機能
// ========================================

function setupLikeButton(button, data) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;

    const wasLiked = button.classList.contains("liked");
    const nextLiked = !wasLiked;

    button.disabled = true;

    try {
      await requestAPI("set_like", {
        post_id: data.id,
        liked: nextLiked
      });

      data.liked_by_me = nextLiked;
      data.like_count = Math.max(
        0,
        (data.like_count || 0) + (nextLiked ? 1 : -1)
      );

      button.classList.toggle("liked", nextLiked);
      button.firstChild.textContent = nextLiked ? "♥ " : "♡ ";

      $("span", button).textContent = `いいね ${data.like_count}`;

    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });
}


// ========================================
// 12. コメント機能
// ========================================

function setupComments(post, data) {
  const button = $(".comment-btn", post);
  const box = $(".comment-box", post);
  const input = $("input", box);
  const sendButton = $("button", box);

  let commentsLoaded = false;

  button.addEventListener("click", async () => {
    box.classList.toggle("open");

    if (!box.classList.contains("open")) return;

    input.focus();

    if (!commentsLoaded) {
      await loadComments(post, data);
      commentsLoaded = true;
    }
  });

  sendButton.addEventListener("click", async () => {
    const content = input.value.trim();

    if (!content) {
      showToast("コメントを入力してね");
      return;
    }

    if (content.length > 1000) {
      showToast("コメントは1000文字以内にしてね");
      return;
    }

    sendButton.disabled = true;

    try {
      const result = await requestAPI("create_comment", {
        post_id: data.id,
        content
      });

      appendComment($(".comments", post), result.comment);

      input.value = "";

      data.comment_count = (data.comment_count || 0) + 1;
      button.textContent = `▢ コメント ${data.comment_count}`;

      commentsLoaded = true;
      showToast("コメントしました");

    } catch (error) {
      showToast(error.message);
    } finally {
      sendButton.disabled = false;
    }
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendButton.click();
    }
  });
}


async function loadComments(post, data) {
  const area = $(".comments", post);
  area.replaceChildren();

  try {
    const result = await requestAPI("list_comments", {
      post_id: data.id
    });

    for (const comment of result.comments || []) {
      appendComment(area, comment);
    }

  } catch (error) {
    showToast(error.message);
  }
}


function appendComment(area, data) {
  const line = document.createElement("div");

  const name = document.createElement("strong");
  name.textContent = `${data.username || "Guest"}：`;

  const content = document.createElement("span");
  content.textContent = data.content;

  line.append(name, content);
  area.append(line);
}


// ========================================
// 13. 投稿機能
// ========================================

async function publishPost() {
  const button = $("#publishBtn");
  const field = $("#postText");
  const text = field.value.trim();

  if (!text) {
    showToast("投稿内容を入力してね");
    field.focus();
    return;
  }

  const separated = separateMood(text);

  if (!separated.content) {
    showToast("投稿内容も入力してね");
    field.focus();
    return;
  }

  if (separated.content.length > 2000) {
    showToast("投稿は2000文字以内にしてね");
    return;
  }

  const originalText = "投稿する ↗";
  setLoading(button, true, originalText);

  try {
    await requestAPI("create_post", {
      content: separated.content,
      mood: separated.mood
    });

    field.value = "";

    await Promise.all([
      loadPosts(),
      loadMyStats()
    ]);

    showToast("投稿しました！");

  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(button, false, originalText);
  }
}


// ========================================
// 14. 写真ボタン
// ========================================

$("#photoTool").addEventListener("click", () => {
  showToast("写真投稿は次のステップで追加します");
});


// ========================================
// 15. 気分ボタン
// ========================================

$("#moodTool").addEventListener("click", () => {
  const existingMenu = $("#moodMenu");

  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.id = "moodMenu";
  menu.className = "mood-menu";

  MOODS.forEach(mood => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "mood-option";
    option.textContent = mood;

    option.addEventListener("click", () => {
      const field = $("#postText");
      const lines = field.value.split("\n");

      const oldIndex = lines.findIndex(line =>
        MOODS.includes(line.trim())
      );

      if (oldIndex !== -1) {
        lines[oldIndex] = mood;
      } else {
        lines.push(mood);
      }

      field.value = lines.join("\n").trim();
      menu.remove();
      field.focus();
    });

    menu.append(option);
  });

  $("#moodTool").parentElement.append(menu);
});


// ========================================
// 16. イベント登録
// ========================================

$("#loginBtn").addEventListener("click", login);
$("#signupBtn").addEventListener("click", signup);
$("#publishBtn").addEventListener("click", publishPost);

$("#loginPassword").addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});


// ========================================
// 17. 初期状態
// ========================================

// ページを開いた時は必ずログアウト状態
authToken = null;
currentUser = null;

$("#loginModal").classList.add("open");
addLogoutButton();



// ========================================
// 18. COMMUNITY 追加機能
// ========================================

let selectedProfileId = null;
let activeConversationId = null;
let isSendingDM = false;
let messageRefreshTimer = null;
let isLoadingMessages = false;

// HTML要素を安全に作る
function createElement(tag, className, text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function addSectionTitle(parent, title) {
  const heading = createElement("h2", "community-heading", title);
  parent.append(heading);
  return heading;
}

// 画面を切り替える
function showCommunityView(viewName) {
  if (viewName !== "dm") {
    stopRealtime();
  }

  $$(".view").forEach(view => view.classList.remove("active"));

  const view = $(`#${viewName}View`);
  if (view) view.classList.add("active");

  $$(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
}

// ========================================
// 19. プロフィールメニュー
// ========================================

function setupProfileMenu() {
  const avatar = $(".topbar .avatar");
  if (!avatar) return;

  avatar.style.cursor = "pointer";
  avatar.setAttribute("aria-label", "プロフィールメニュー");

  avatar.addEventListener("click", event => {
    event.stopPropagation();

    let menu = $("#profileDropdown");

    if (menu) {
      menu.remove();
      return;
    }

    menu = createElement("div", "profile-dropdown");
    menu.id = "profileDropdown";

    const items = [
      ["プロフィール", () => openMyProfile()],
      ["ユーザー検索", () => openSearchView()],
      ["友達リクエスト", () => openRequestsView()],
      ["設定", () => showToast("設定機能は今後追加します")],
      ["ログアウト", () => logout()]
    ];

    items.forEach(([label, action]) => {
      const button = createElement("button", "dropdown-item", label);
      button.type = "button";
      button.addEventListener("click", () => {
        menu.remove();
        action();
      });
      menu.append(button);
    });

    $(".topbar").append(menu);
  });

  document.addEventListener("click", event => {
    const menu = $("#profileDropdown");
    if (menu && !menu.contains(event.target) && event.target !== avatar) {
      menu.remove();
    }
  });
}

// ========================================
// 20. 追加画面を作成
// ========================================

function createExtraViews() {
  const main = $("main");
  if (!main) return;

  // ユーザー検索
  if (!$("#searchView")) {
    const view = createElement("section", "view");
    view.id = "searchView";

    const panel = createElement("div", "panel extra-panel");
    addSectionTitle(panel, "ユーザーを探す");

    const row = createElement("div", "search-row");
    const input = createElement("input", "extra-input");
    input.id = "userSearchInput";
    input.placeholder = "ユーザー名を入力…";
    input.maxLength = 20;

    const button = createElement("button", "primary-btn", "検索");
    button.type = "button";
    button.addEventListener("click", searchUsers);

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") searchUsers();
    });

    row.append(input, button);

    const results = createElement("div", "extra-list");
    results.id = "userSearchResults";

    panel.append(row, results);
    view.append(panel);
    main.append(view);
  }

  // 友達リクエスト
  if (!$("#requestsView")) {
    const view = createElement("section", "view");
    view.id = "requestsView";

    const panel = createElement("div", "panel extra-panel");
    addSectionTitle(panel, "友達リクエスト");

    const incoming = createElement("div", "extra-list");
    incoming.id = "incomingRequests";

    const outgoing = createElement("div", "extra-list");
    outgoing.id = "outgoingRequests";

    panel.append(
      createElement("h3", "extra-subtitle", "受信"),
      incoming,
      createElement("h3", "extra-subtitle", "送信"),
      outgoing
    );

    view.append(panel);
    main.append(view);
  }

  // DM
  if (!$("#dmView")) {
    const view = createElement("section", "view");
    view.id = "dmView";

    const panel = createElement("div", "panel extra-panel dm-panel");

    const conversations = createElement("div", "dm-friends");
    conversations.id = "dmFriends";

    const chat = createElement("div", "dm-chat");
    chat.id = "dmChat";

    panel.append(conversations, chat);
    view.append(panel);
    main.append(view);
  }
}

// ========================================
// 21. ユーザー検索
// ========================================

async function openSearchView() {
  createExtraViews();
  showCommunityView("search");
  $("#userSearchInput")?.focus();
}

async function searchUsers() {
  const input = $("#userSearchInput");
  const area = $("#userSearchResults");
  const query = input.value.trim();

  if (query.length < 2) {
    showToast("2文字以上入力してね");
    return;
  }

  area.replaceChildren();
  area.append(createElement("p", "empty-note", "検索中…"));

  try {
    const result = await requestAPI("search_users", { query });
    area.replaceChildren();

    const users = result.users || [];

    if (!users.length) {
      area.append(createElement("p", "empty-note", "ユーザーが見つかりませんでした"));
      return;
    }

    users.forEach(user => {
      const card = createElement("div", "user-card");

      const avatar = createElement(
        "div",
        "avatar",
        user.username.charAt(0).toUpperCase()
      );

      const name = createElement("strong", "", user.username);

      const info = createElement("div", "user-card-info");
      info.append(name);

      const profileButton = createElement("button", "ghost-btn", "プロフィール");
      profileButton.addEventListener("click", () => openUserProfile(user.id));

      card.append(avatar, info, profileButton);

      if (user.is_friend) {
        card.append(createElement("span", "friend-status", "友達"));
      } else {
        const requestButton = createElement("button", "primary-btn", "友達申請");
        requestButton.addEventListener("click", async () => {
          try {
            await requestAPI("send_friend_request", {
              recipient_id: user.id
            });
            showToast("友達リクエストを送りました");
            requestButton.textContent = "申請済み";
            requestButton.disabled = true;
          } catch (error) {
            showToast(error.message);
          }
        });
        card.append(requestButton);
      }

      area.append(card);
    });

  } catch (error) {
    area.replaceChildren();
    showToast(error.message);
  }
}

// ========================================
// 22. プロフィール表示
// ========================================

async function openMyProfile() {
  if (!currentUser) return;
  await openUserProfile(currentUser.id);
}

async function openUserProfile(userId) {
  createExtraViews();
  selectedProfileId = userId;

  showCommunityView("profile");

  const profileView = $("#profileView");
  const profileContainer = $(".profile-view", profileView);

  if (!profileContainer) return;

  profileContainer.replaceChildren();
  profileContainer.append(createElement("p", "empty-note", "プロフィールを読み込み中…"));

  try {
    const result = await requestAPI("get_profile", {
      user_id: userId
    });

    const user = result.user || result.profile;
    if (!user) throw new Error("プロフィールを取得できませんでした");

    profileContainer.replaceChildren();

    const banner = createElement("div", "profile-banner");

    const top = createElement("div", "profile-large");
    const avatar = createElement(
      "div",
      "avatar",
      user.username.charAt(0).toUpperCase()
    );

    const nameArea = createElement("div");
    nameArea.append(
      createElement("h2", "", user.username),
      createElement("span", "handle", `@${user.username}`)
    );

    top.append(avatar, nameArea);
    profileContainer.append(banner, top);

    const stats = createElement("div", "profile-stats");
    const statData = [
      ["POSTS", user.post_count ?? (user.posts || []).length],
      ["LIKES", user.received_likes ?? 0]
    ];

    statData.forEach(([label, value]) => {
      const item = createElement("div");
      item.append(
        createElement("b", "", String(value)),
        createElement("span", "", label)
      );
      stats.append(item);
    });

    profileContainer.append(stats);

    if (userId !== currentUser.id) {
      const relationship = user.relationship || "none";

      const actionArea = createElement("div", "profile-actions");

      if (relationship === "friend") {
        actionArea.append(createElement("span", "friend-status", "友達"));
        const dmButton = createElement("button", "primary-btn", "メッセージ");
        dmButton.addEventListener("click", () => openDMWithUser(userId));
        actionArea.append(dmButton);

      } else if (relationship === "outgoing_pending") {
        actionArea.append(createElement("span", "friend-status", "申請済み"));

      } else if (relationship === "incoming_pending") {
        actionArea.append(createElement("span", "friend-status", "申請が届いています"));

      } else {
        const requestButton = createElement("button", "primary-btn", "友達申請");
        requestButton.addEventListener("click", async () => {
          try {
            await requestAPI("send_friend_request", {
              recipient_id: userId
            });
            requestButton.textContent = "申請済み";
            requestButton.disabled = true;
            showToast("友達リクエストを送りました");
          } catch (error) {
            showToast(error.message);
          }
        });
        actionArea.append(requestButton);
      }

      profileContainer.append(actionArea);
    }

    profileContainer.append(createElement("h3", "extra-subtitle", "投稿"));
   
    const posts = result.posts || [];

    if (!posts.length) {
      profileContainer.append(createElement("p", "empty-note", "まだ投稿がありません"));
    } else {
      posts.forEach(post => {
        const item = createElement("article", "post");
        item.append(
          createElement("p", "post-text", post.content),
          createElement("span", "post-time", formatTime(post.created_at))
        );
        profileContainer.append(item);
      });
    }

  } catch (error) {
    profileContainer.replaceChildren();
    showToast(error.message);
  }
}

// ========================================
// 23. 友達リクエスト
// ========================================

async function openRequestsView() {
  createExtraViews();
  showCommunityView("requests");
  await loadFriendRequests();
}

async function loadFriendRequests() {
  const incoming = $("#incomingRequests");
  const outgoing = $("#outgoingRequests");

  incoming.replaceChildren();
  outgoing.replaceChildren();

  try {
    const result = await requestAPI("list_friend_requests");

    (result.incoming || []).forEach(request => {
      const card = createElement("div", "user-card");
      card.append(createElement("strong", "", request.username));

      const accept = createElement("button", "primary-btn", "承認");
      accept.addEventListener("click", () => respondRequest(request.id, "accept"));

      const reject = createElement("button", "ghost-btn", "拒否");
      reject.addEventListener("click", () => respondRequest(request.id, "reject"));

      card.append(accept, reject);
      incoming.append(card);
    });

    (result.outgoing || []).forEach(request => {
      const card = createElement("div", "user-card");
      card.append(
        createElement("strong", "", request.username),
        createElement("span", "friend-status", "申請中")
      );
      outgoing.append(card);
    });

    if (!incoming.children.length) {
      incoming.append(createElement("p", "empty-note", "受信したリクエストはありません"));
    }

    if (!outgoing.children.length) {
      outgoing.append(createElement("p", "empty-note", "送信中のリクエストはありません"));
    }

  } catch (error) {
    showToast(error.message);
  }
}

async function respondRequest(requestId, response) {
  try {
    await requestAPI("respond_friend_request", {
      request_id: requestId,
      response
    });

    showToast(response === "accept" ? "友達になりました！" : "リクエストを拒否しました");
    await loadFriendRequests();
    await loadFriends();

  } catch (error) {
    showToast(error.message);
  }
}

// ========================================
// 24. 友達一覧
// ========================================


async function loadFriends() {
  const area = $(".friend-items");
  if (!area) return;

  area.replaceChildren();

  try {
    const result = await requestAPI("list_friends");
    const friends = result.friends || [];

    if (!friends.length) {
      area.append(
        createElement("p", "empty-note", "友達はまだいません。")
      );
      return;
    }

    friends.forEach(friend => {
      const row = createElement("button", "friend friend-button");
      row.type = "button";

      const friendId = friend.user_id;
      const username = friend.username || "Guest";

      const avatar = createElement(
        "div",
        "avatar",
        username.charAt(0).toUpperCase()
      );

      row.append(
        avatar,
        createElement("span", "friend-name", username)
      );

      row.addEventListener("click", () => {
        openUserProfile(friendId);
      });

      area.append(row);
    });

  } catch (error) {
    showToast(error.message);
  }
}

async function loadMyStats() {
  try {
    const result = await requestAPI("get_my_stats");
    const stats = result.stats;

    if (!stats) return;

    $("#profilePostCount").textContent = stats.posts;
    $("#profileFriendCount").textContent = stats.friends;
    $("#profileLikeCount").textContent = stats.likes;

  } catch (error) {
    showToast(error.message);
  }
}

// ========================================
// 25. ダイレクトメッセージ
// ========================================

async function openDMView() {
  createExtraViews();
  showCommunityView("dm");
  await loadConversations();
}

async function loadConversations() {
  const area = $("#dmFriends");
  area.replaceChildren();

  area.append(createElement("h3", "extra-subtitle", "メッセージ"));

  try {
    const result = await requestAPI("list_conversations");
    const conversations = result.conversations || [];

    if (!conversations.length) {
      area.append(createElement("p", "empty-note", "友達との会話はまだありません"));
      return;
    }

    conversations.forEach(conversation => {
      const button = createElement("button", "dm-friend");
      button.type = "button";

      const name = conversation.friend_username || "ユーザー";
      button.append(
        createElement("div", "avatar", name.charAt(0).toUpperCase()),
        createElement("span", "", name)
      );

      button.addEventListener("click", () => {
        openConversation(conversation.id);
      });

      area.append(button);
    });

  } catch (error) {
    showToast(error.message);
  }
}

async function openDMWithUser(userId) {
  try {
    const result = await requestAPI("open_conversation", {
      user_id: userId
    });

    const conversation = result.conversation;
    if (!conversation) throw new Error("会話を開けませんでした");

    await openDMView();
    await openConversation(conversation.id);

  } catch (error) {
    showToast(error.message);
  }
}

async function openConversation(conversationId) {
  activeConversationId = conversationId;
  isSendingDM = false;

  // 前の会話のRealtime接続を解除
  await stopRealtime();

  const area = $("#dmChat");
  area.replaceChildren();

  const messages = createElement("div", "dm-messages");
  messages.id = "dmMessages";

  const form = createElement("div", "dm-form");

  const input = createElement("input", "extra-input");
  input.id = "dmMessageInput";
  input.placeholder = "メッセージを書く…";
  input.maxLength = 2000;

  const send = createElement("button", "primary-btn", "送信");
  send.type = "button";
  send.id = "dmSendButton";

  send.addEventListener("click", sendDM);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      sendDM();
    }
  });

  form.append(input, send);
  area.append(messages, form);

  // 最初のメッセージを取得
  await loadMessages();

  // 初回メッセージ取得後にRealtime接続
  await startRealtime(conversationId);

}

async function loadMessages() {
  if (!activeConversationId || isLoadingMessages) return;

  const conversationId = activeConversationId;
  const area = $("#dmMessages");

  if (!area) return;

  isLoadingMessages = true;

  try {
    const result = await requestAPI("list_messages", {
      conversation_id: conversationId
    });

    // 読み込み中に別の会話へ移動していたら表示しない
    if (activeConversationId !== conversationId) return;

    const messages = result.messages || [];

    // 表示位置を記録
    const wasNearBottom =
      area.scrollHeight - area.scrollTop - area.clientHeight < 100;

    area.replaceChildren();

    messages.forEach(message => {
      const mine = message.sender_id === currentUser.id;

      const bubble = createElement(
        "div",
        mine ? "message-bubble mine" : "message-bubble"
      );

      bubble.append(
        createElement("small", "", message.username || ""),
        createElement("p", "", message.content)
      );

      area.append(bubble);
    });

    // もともと一番下にいた場合だけ追従
    if (wasNearBottom) {
      area.scrollTop = area.scrollHeight;
    }

  } catch (error) {
    console.error("メッセージ取得エラー:", error);

  } finally {
    isLoadingMessages = false;
  }
}

async function sendDM() {
  if (isSendingDM) return;
  if (!activeConversationId) return;

  const input = $("#dmMessageInput");
  const button = $("#dmSendButton");

  if (!input || !button) return;

  const content = input.value.trim();

  if (!content) return;

  if (content.length > 2000) {
    showToast("メッセージは2000文字以内にしてね");
    return;
  }

  // 送信中の二重実行を防ぐ
  isSendingDM = true;

  const conversationId = activeConversationId;
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "送信中…";

  try {
    await requestAPI("send_message", {
      conversation_id: conversationId,
      content
    });

    // 別の会話に切り替わっていなければ入力欄を更新
    if (activeConversationId === conversationId) {
      input.value = "";
      await loadMessages();
    }

  } catch (error) {
    showToast(error.message);

  } finally {
    isSendingDM = false;

    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// ========================================
// 26. ナビゲーションの追加
// ========================================

function setupExtraNavigation() {
  const messageButton = $('[data-view="messages"]');

  if (messageButton) {
    messageButton.addEventListener("click", openDMView);
  }

  const searchButton = createElement("button", "nav-item", "⌕ ユーザー検索");
  searchButton.type = "button";
  searchButton.addEventListener("click", openSearchView);

  const nav = $(".nav-panel");
  if (nav && !$("#extraSearchNav")) {
    searchButton.id = "extraSearchNav";
    nav.append(searchButton);
  }
}

// ========================================
// 27. 投稿者からプロフィールへ
// ========================================

function setupPostProfileLinks() {
  // 投稿カードを作る関数を置き換えず、後からクリックを追加
  const observer = new MutationObserver(() => {
    $$(".post-head").forEach(head => {
      if (head.dataset.profileReady) return;
      head.dataset.profileReady = "true";

      const post = head.closest(".post");
      const postData = post?.dataset.postId;
      if (!postData) return;

      const author = $(".post-author", head);
      const avatar = $(".avatar", head);

      const open = async () => {
        try {
          const result = await requestAPI("list_posts");
          const data = (result.posts || []).find(item => item.id === postData);
          if (data?.user_id) await openUserProfile(data.user_id);
        } catch (error) {
          showToast(error.message);
        }
      };

      [author, avatar].filter(Boolean).forEach(element => {
        element.style.cursor = "pointer";
        element.addEventListener("click", open);
      });
    });
  });

  const posts = $("#posts");
  if (posts) observer.observe(posts, { childList: true, subtree: true });
}

// ========================================
// 28. 初期化
// ========================================

function initializeCommunityExtras() {
  createExtraViews();
  setupProfileMenu();
  setupExtraNavigation();
  setupPostProfileLinks();

  // 友達一覧を更新
  const originalLogin = login;
  // ログイン後の読み込みは既存処理を利用
}

initializeCommunityExtras();
