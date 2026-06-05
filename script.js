// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyC-6ctoVjMq5fO9_ahOILi7rSUmtnmS9EQ",
  authDomain: "techno2-ccc7e.firebaseapp.com",
  databaseURL: "https://techno2-ccc7e-default-rtdb.firebaseio.com",
  projectId: "techno2-ccc7e",
  storageBucket: "techno2-ccc7e.firebasestorage.app",
  messagingSenderId: "622625787951",
  appId: "1:622625787951:web:a55ac204337af8b91636da",
  measurementId: "G-6GRHBDL8VZ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
db.enablePersistence().catch(() => {});

const IMGBB_API_KEY = "db671a28c5c7d432622dc7e5bc74eecc";
const SECRET_CODE = "14102008";
const ONESIGNAL_APP_ID = "aca4d5a8-52d7-4a9e-b276-117473b396d0";
const ONESIGNAL_REST_API_KEY = "os_v2_app_vssnlkcs25fj5mtwcf2hhm4w2djertadndpuabu4ekue5mp6ecqywi34ho2gzl54jsbfxqlq74huqrvgf7vyolcgr73fmt7cj4ygili";
const GIPHY_API_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65";

// ==================== GLOBAL VARIABLES ====================
let currentExpression = '',
    currentResult = '0',
    scientificVisible = false;
let currentUser = null,
    selectedUserId = null,
    selectedUserData = null,
    selectedImage = null;
let longPressTimer, selectedMessageData = { id: null, text: null, isOwner: false },
    isEditing = false;
let replyingTo = null;
let mediaRecorder = null,
    audioChunks = [],
    recordingStartTime = 0,
    recordingTimerInterval = null;
let lastTapTime = 0,
    lastTapTarget = null;
let swipeStartX = 0,
    swipeStartY = 0,
    swipeTargetMsgId = null;
let typingTimeout = null;

// Firebase Listeners
let messagesListener1 = null,
    messagesListener2 = null,
    typingListener = null,
    presenceListener = null;
let chatListData = new Map(),
    acceptedChats = new Set(),
    pendingRequests = new Map();

// Pagination
const PAGE_SIZE = 30;
let allMessages = [],
    messagesSet = new Set(),
    lastVisibleDoc = null,
    noMoreMessages = false;
let isLoadingOlder = false;

// Search
let chatSearchResults = [],
    chatSearchIndex = 0;

// Throttle
let lastTypingWrite = 0;
const TYPING_THROTTLE_MS = 8000;
let typingWritePending = false;
let lastPresenceWrite = 0;
const PRESENCE_THROTTLE_MS = 30000;

// Zoom
let zoomScale = 1,
    zoomTranslateX = 0,
    zoomTranslateY = 0,
    initialPinchDistance = 0,
    initialScale = 1,
    initialTranslateX = 0,
    initialTranslateY = 0;
let lastZoomUpdate = 0;

// ==================== PASSWORD TOGGLE ====================
function togglePasswordVisibility(inputId, element) {
    const input = document.getElementById(inputId);
    const icon = element.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ==================== CALCULATOR ====================
function toggleScientific() {
    scientificVisible = !scientificVisible;
    document.getElementById('scientificRow').classList.toggle('show');
    document.getElementById('expandIcon').style.transform = scientificVisible ? 'rotate(180deg)' : 'rotate(0deg)';
}

function appendNumber(num) {
    if (currentResult === '0' || currentResult === 'Error') currentResult = num;
    else currentResult += num;
    updateDisplay();
}

function appendOperator(op) {
    const lc = currentResult[currentResult.length - 1];
    if ('+-*/%'.includes(lc)) currentResult = currentResult.slice(0, -1) + op;
    else currentResult += op;
    updateDisplay();
}

function appendScientific(func) {
    currentExpression = currentResult;
    currentResult = func + '(' + currentResult + ')';
    updateDisplay();
}

function appendDecimal() {
    if (!currentResult.includes('.')) {
        currentResult += '.';
        updateDisplay();
    }
}

function backspace() {
    currentResult = currentResult.slice(0, -1);
    if (currentResult === '') currentResult = '0';
    updateDisplay();
}

function clearAll() {
    currentExpression = '';
    currentResult = '0';
    updateDisplay();
}

function calculate() {
    try {
        if (currentResult === SECRET_CODE) {
            const u = auth.currentUser;
            if (u) showUsersList();
            else showAuthScreen();
            clearAll();
            return;
        }
        let expr = currentResult.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
            .replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan')
            .replace(/log/g, 'Math.log10').replace(/ln/g, 'Math.log').replace(/√/g, 'Math.sqrt')
            .replace(/\^/g, '**');
        if (expr.includes('!')) {
            const p = expr.split('!');
            if (p.length === 2 && !isNaN(p[0])) {
                let f = 1;
                for (let i = 1; i <= parseInt(p[0]); i++) f *= i;
                currentResult = f.toString();
            } else throw new Error('Invalid factorial');
        } else {
            currentExpression = currentResult + '=';
            currentResult = eval(expr).toString();
        }
        updateDisplay();
    } catch (e) {
        currentExpression = currentResult;
        currentResult = 'Error';
        updateDisplay();
    }
}

function updateDisplay() {
    document.getElementById('expression').textContent = currentExpression;
    document.getElementById('result').textContent = currentResult;
}

// ==================== NAVIGATION ====================
function returnToCalculator() {
    cleanupListeners();
    document.getElementById('users-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('calculator').style.display = 'flex';
    resetKeyboardPadding();
}

function setupPanicDetection() {
    [document.getElementById('chat-screen'), document.getElementById('users-screen')].forEach(screen => {
        screen.addEventListener('click', function(e) {
            const now = Date.now();
            const isInteractive = e.target.closest(
                'button, input, textarea, .message-bubble, .user-item, .search-result-item, .request-item, .emoji-option, .emoji-tray-action-btn, .gif-grid img, .chat-info-tab, .media-grid img, .link-item'
            );
            if (isInteractive) { lastTapTime = 0; return; }
            if (now - lastTapTime < 350 && lastTapTarget === screen) {
                panicHide();
                lastTapTime = 0;
                lastTapTarget = null;
            } else {
                lastTapTime = now;
                lastTapTarget = screen;
            }
        });
    });
}

function panicHide() {
    cleanupListeners();
    document.getElementById('users-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('calculator').style.display = 'flex';
    cancelEdit();
    cancelReply();
    selectedUserId = null;
    selectedUserData = null;
    resetKeyboardPadding();
}

function showAuthScreen() {
    document.getElementById('calculator').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'block';
}

async function showUsersList() {
    cleanupListeners();
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('calculator').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('users-screen').style.display = 'flex';
    resetKeyboardPadding();
    if (currentUser) {
        const name = currentUser.displayName || currentUser.email.split('@')[0];
        const initial = name[0].toUpperCase();
        document.getElementById('current-user-avatar').textContent = initial;
        document.getElementById('current-user-name').textContent = name;
    }
    switchChatTab('chats');
    await loadAcceptedChatsOnce();
    await loadRequestsOnce();
    updatePresence(true);
}

async function loadAcceptedChatsOnce() {
    if (!currentUser) return;
    const snap1 = await db.collection('acceptedChats').where('userId1', '==', currentUser.uid).get();
    const snap2 = await db.collection('acceptedChats').where('userId2', '==', currentUser.uid).get();
    acceptedChats.clear();
    snap1.forEach(doc => acceptedChats.add(doc.data().userId2));
    snap2.forEach(doc => acceptedChats.add(doc.data().userId1));
    for (let uid of acceptedChats) {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            chatListData.set(uid, { userData: doc.data(), lastMessage: null, unreadCount: 0, lastMessageTime: null });
        }
    }
    renderChatList();
}

async function loadRequestsOnce() {
    if (!currentUser) return;
    const snap = await db.collection('chatRequests')
        .where('toUserId', '==', currentUser.uid)
        .where('status', '==', 'pending').get();
    pendingRequests.clear();
    for (let doc of snap.docs) {
        const r = doc.data();
        pendingRequests.set(r.fromUserId, { requestId: doc.id, ...r });
        const userDoc = await db.collection('users').doc(r.fromUserId).get();
        if (userDoc.exists) pendingRequests.get(r.fromUserId).fromUserData = userDoc.data();
    }
    renderRequestsList();
}

function goBackToUsers() {
    if (messagesListener1) { messagesListener1(); messagesListener1 = null; }
    if (messagesListener2) { messagesListener2(); messagesListener2 = null; }
    if (typingListener) { typingListener(); typingListener = null; }
    if (presenceListener) { presenceListener(); presenceListener = null; }
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
    if (selectedUserId && currentUser) markAllMessagesAsRead(selectedUserId);
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('users-screen').style.display = 'flex';
    document.getElementById('chat-error-banner').style.display = 'none';
    document.getElementById('chat-search-bar').style.display = 'none';
    cancelEdit();
    cancelReply();
    resetKeyboardPadding();
    updatePresence(true);
}

function cleanupListeners() {
    if (messagesListener1) messagesListener1();
    if (messagesListener2) messagesListener2();
    if (typingListener) typingListener();
    if (presenceListener) presenceListener();
    if (typingTimeout) clearTimeout(typingTimeout);
    messagesListener1 = messagesListener2 = typingListener = presenceListener = null;
    typingTimeout = null;
}

function switchChatTab(tab) {
    const ct = document.getElementById('chats-tab');
    const rt = document.getElementById('requests-tab');
    const cc = document.getElementById('chats-container');
    const rc = document.getElementById('requests-container');
    if (tab === 'chats') {
        ct.classList.add('active');
        rt.classList.remove('active');
        cc.style.display = 'block';
        rc.style.display = 'none';
        renderChatList();
    } else {
        rt.classList.add('active');
        ct.classList.remove('active');
        cc.style.display = 'none';
        rc.style.display = 'block';
        renderRequestsList();
    }
}

// ==================== AUTH ====================
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
        document.getElementById('signup-error').style.display = 'none';
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('signup-form').classList.add('active');
        document.getElementById('login-error').style.display = 'none';
    }
}

async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const cp = document.getElementById('signup-confirm-password').value;
    const ed = document.getElementById('signup-error');
    ed.style.display = 'none';
    if (!name || !email || !password || !cp) { showError('signup-error', 'Please fill all fields'); return; }
    if (password !== cp) { showError('signup-error', 'Passwords do not match'); return; }
    if (password.length < 6) { showError('signup-error', 'Password must be at least 6 characters'); return; }
    const btn = document.getElementById('signup-btn');
    btn.disabled = true;
    btn.innerHTML = 'Creating Account...';
    try {
        const uc = await auth.createUserWithEmailAndPassword(email, password);
        await uc.user.updateProfile({ displayName: name });
        await db.collection('users').doc(uc.user.uid).set({
            name, email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentUser = uc.user;
        setupOneSignalUser(uc.user.uid);
        showUsersList();
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/email-already-in-use') msg = 'Email already in use';
        else if (e.code === 'auth/invalid-email') msg = 'Invalid email';
        else if (e.code === 'auth/weak-password') msg = 'Password too weak';
        showError('signup-error', msg);
        btn.disabled = false;
        btn.innerHTML = 'Sign Up';
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    document.getElementById('login-error').style.display = 'none';
    if (!email || !password) { showError('login-error', 'Please fill all fields'); return; }
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = 'Logging in...';
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/user-not-found') msg = 'No account found';
        else if (e.code === 'auth/wrong-password') msg = 'Incorrect password';
        else if (e.code === 'auth/invalid-email') msg = 'Invalid email';
        else if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Try later';
        showError('login-error', msg);
        btn.disabled = false;
        btn.innerHTML = 'Login';
    }
}

function showError(elId, msg) {
    const ed = document.getElementById(elId);
    ed.textContent = msg;
    ed.style.display = 'block';
}

async function logout() {
    cleanupListeners();
    if (currentUser) await updatePresence(false);
    try {
        await auth.signOut();
        currentUser = null;
        chatListData.clear();
        acceptedChats.clear();
        pendingRequests.clear();
        resetKeyboardPadding();
        returnToCalculator();
    } catch (e) {
        console.error('Logout error:', e);
    }
}

// ==================== SEARCH USERS ====================
let searchTimeout = null;

function searchUsers() {
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    const rd = document.getElementById('search-results');
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q.length < 2) { rd.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
        const snap = await db.collection('users').get();
        const results = [];
        snap.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const d = doc.data();
            const n = (d.name || '').toLowerCase();
            const em = (d.email || '').toLowerCase();
            if (n.includes(q) || em.includes(q)) results.push({ id: doc.id, ...d });
        });
        if (results.length === 0) rd.innerHTML = '<div style="padding:16px;text-align:center;color:#888;">No users found</div>';
        else rd.innerHTML = results.map(u => createSearchResultItem(u)).join('');
        rd.style.display = 'block';
    }, 300);
}

function createSearchResultItem(user) {
    const isP = pendingRequests.has(user.id);
    const isA = acceptedChats.has(user.id);
    let btn = '';
    if (isA) btn = '<span class="request-badge">Added</span>';
    else if (isP) btn = '<span class="request-badge">Request Sent</span>';
    else btn = `<button class="accept-btn" onclick="sendChatRequest('${user.id}')">Add</button>`;
    return `
        <div class="search-result-item">
            <div class="user-avatar">${(user.name||'U')[0].toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.name||'User')}</div>
                <div class="user-email">${escapeHtml(user.email)}</div>
            </div>
            ${btn}
        </div>`;
}

// ==================== CHAT REQUESTS ====================
async function sendChatRequest(tid) {
    if (!currentUser || tid === currentUser.uid) return;
    try {
        const ex = await db.collection('chatRequests')
            .where('fromUserId', '==', currentUser.uid)
            .where('toUserId', '==', tid)
            .where('status', '==', 'pending').get();
        if (!ex.empty) { alert('Request already sent'); return; }
        await db.collection('chatRequests').add({
            fromUserId: currentUser.uid,
            fromUserName: currentUser.displayName || currentUser.email.split('@')[0],
            toUserId: tid,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('search-input').value = '';
        alert('Chat request sent!');
    } catch (e) { console.error(e); alert('Failed to send request'); }
}

async function acceptChatRequest(rid, fuid) {
    try {
        await db.collection('chatRequests').doc(rid).update({ status: 'accepted' });
        await db.collection('acceptedChats').add({
            userId1: currentUser.uid,
            userId2: fuid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadRequestsOnce();
    } catch (e) { console.error(e); alert('Failed to accept'); }
}

async function rejectChatRequest(rid) {
    try {
        await db.collection('chatRequests').doc(rid).update({ status: 'rejected' });
        loadRequestsOnce();
    } catch (e) { console.error(e); }
}

// ==================== RENDER (OPTIMIZED) ====================
function renderChatList() {
    const c = document.getElementById('chats-container');
    c.innerHTML = '';
    const sorted = Array.from(chatListData.entries())
        .filter(([uid]) => acceptedChats.has(uid))
        .sort((a, b) => {
            const ta = a[1].lastMessageTime ? a[1].lastMessageTime.toDate() : new Date(0);
            const tb = b[1].lastMessageTime ? b[1].lastMessageTime.toDate() : new Date(0);
            return tb - ta;
        });
    if (sorted.length === 0) {
        c.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No chats yet. Search for users!</div>';
        return;
    }
    sorted.forEach(([uid, d]) => { if (d.userData) c.appendChild(createChatListItem(uid, d)); });
}

function renderRequestsList() {
    const c = document.getElementById('requests-container');
    c.innerHTML = '';
    if (pendingRequests.size === 0) {
        c.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No pending requests</div>';
        return;
    }
    pendingRequests.forEach((r, uid) => { if (r.fromUserData) c.appendChild(createRequestItem(uid, r)); });
}

function createRequestItem(uid, r) {
    const div = document.createElement('div');
    div.className = 'request-item';
    const ud = r.fromUserData;
    const name = ud.name || ud.email?.split('@')[0] || 'User';
    div.innerHTML = `
        <div class="user-avatar">${name[0].toUpperCase()}</div>
        <div class="request-info">
            <div class="request-name">${escapeHtml(name)}</div>
            <div class="request-email">${escapeHtml(ud.email||'No email')}</div>
        </div>
        <div class="request-actions">
            <button class="accept-btn" onclick="acceptChatRequest('${r.requestId}','${uid}')">Accept</button>
            <button class="reject-btn" onclick="rejectChatRequest('${r.requestId}')">Reject</button>
        </div>`;
    return div;
}

function createChatListItem(uid, d) {
    const div = document.createElement('div');
    div.className = `user-item ${d.unreadCount>0?'unread':''}`;
    div.onclick = () => openChat(uid, d.userData);
    const name = d.userData.name || d.userData.email?.split('@')[0] || 'User';
    let ts = '';
    if (d.lastMessageTime) {
        const date = d.lastMessageTime.toDate();
        const now = new Date();
        const diff = now - date;
        if (diff < 86400000) ts = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        else ts = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    let lp = '';
    if (d.lastMessage) {
        if (d.lastMessage.text) lp = d.lastMessage.text;
        else if (d.lastMessage.imageUrl) lp = '📷 Image';
        else if (d.lastMessage.audioUrl) lp = '🎤 Voice Note';
    }
    if (lp.length > 30) lp = lp.substring(0, 27) + '...';
    div.innerHTML = `
        <div class="user-avatar">${name[0].toUpperCase()}</div>
        <div class="user-info">
            <div class="user-name-row">
                <div class="user-name">${escapeHtml(name)}</div>
                <div class="user-time">${ts}</div>
            </div>
            <div class="user-last-message">
                <div class="last-message-text">${escapeHtml(lp)}</div>
                ${d.unreadCount>0?`<div class="unread-badge">${d.unreadCount}</div>`:''}
            </div>
        </div>`;
    return div;
}

// ==================== OPEN CHAT ====================
function openChat(uid, ud) {
    selectedUserId = uid;
    selectedUserData = ud;
    document.getElementById('users-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('chat-search-bar').style.display = 'none';
    const name = ud.name || ud.email?.split('@')[0] || 'User';
    document.getElementById('chat-header-name').textContent = name;
    document.getElementById('chat-info-title').textContent = name;
    if (messagesListener1) { messagesListener1(); messagesListener1 = null; }
    if (messagesListener2) { messagesListener2(); messagesListener2 = null; }
    if (typingListener) { typingListener(); typingListener = null; }
    if (presenceListener) { presenceListener(); presenceListener = null; }
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
    document.getElementById('chat-error-banner').style.display = 'none';
    cancelEdit(); cancelReply();
    allMessages = []; messagesSet.clear(); lastVisibleDoc = null; noMoreMessages = false;
    markAllMessagesAsRead(uid);
    setupMessagesListener(uid, currentUser.uid);
    setupTypingListener(uid);
    setupPresenceListener(uid);
    updatePresence(true);
    applyKeyboardPadding();
    loadSharedMedia(uid);
}

async function markAllMessagesAsRead(sid) {
    if (!currentUser) return;
    const snap = await db.collection('messages')
        .where('senderId', '==', sid)
        .where('receiverId', '==', currentUser.uid)
        .where('status', 'in', ['sent', 'delivered']).get();
    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { status: 'read' }));
    await batch.commit();
    const chatId = [currentUser.uid, sid].sort().join('_');
    db.collection('chats').doc(chatId).update({ [`unread.${currentUser.uid}`]: 0 }).catch(() => {});
}

// ==================== MESSAGE LISTENERS (PAGINATION) ====================
function setupMessagesListener(ouid, cuid) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '<div class="loading-spinner"></div>';
    const sentRef = db.collection('messages')
        .where('senderId', '==', cuid).where('receiverId', '==', ouid)
        .orderBy('timestamp', 'desc').limit(PAGE_SIZE);
    const receivedRef = db.collection('messages')
        .where('senderId', '==', ouid).where('receiverId', '==', cuid)
        .orderBy('timestamp', 'desc').limit(PAGE_SIZE);
    const sentMap = new Map(), receivedMap = new Map();
    let loaded = false;

    const combineAndRender = () => {
        allMessages = [...sentMap.values(), ...receivedMap.values()].sort((a, b) => {
            const ta = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tb = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return ta - tb;
        });
        renderAllMessages(container);
    };

    messagesListener1 = sentRef.onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === 'added') sentMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            else if (change.type === 'modified') sentMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            else if (change.type === 'removed') sentMap.delete(change.doc.id);
        });
        combineAndRender();
        if (!loaded) { loaded = true; scrollChatToBottom(); }
    });
    messagesListener2 = receivedRef.onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === 'added') receivedMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            else if (change.type === 'modified') receivedMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
            else if (change.type === 'removed') receivedMap.delete(change.doc.id);
        });
        combineAndRender();
        if (!loaded) { loaded = true; scrollChatToBottom(); }
    });
}

async function loadOlderMessages() {
    if (isLoadingOlder || noMoreMessages || !selectedUserId || !currentUser) return;
    isLoadingOlder = true;
    const oldest = allMessages[0];
    if (!oldest) return;
    const ts = oldest.timestamp;
    const sentSnap = await db.collection('messages')
        .where('senderId', '==', currentUser.uid).where('receiverId', '==', selectedUserId)
        .orderBy('timestamp', 'desc').startAfter(ts).limit(PAGE_SIZE).get();
    const recvSnap = await db.collection('messages')
        .where('senderId', '==', selectedUserId).where('receiverId', '==', currentUser.uid)
        .orderBy('timestamp', 'desc').startAfter(ts).limit(PAGE_SIZE).get();
    const newMsgs = [];
    sentSnap.forEach(d => newMsgs.push({ id: d.id, ...d.data() }));
    recvSnap.forEach(d => newMsgs.push({ id: d.id, ...d.data() }));
    if (newMsgs.length === 0) { noMoreMessages = true; }
    else {
        newMsgs.forEach(m => { if (!messagesSet.has(m.id)) { allMessages.unshift(m); messagesSet.add(m.id); } });
        lastVisibleDoc = newMsgs[0].timestamp;
        if (newMsgs.length < PAGE_SIZE * 2) noMoreMessages = true;
    }
    renderAllMessages(document.getElementById('messages-container'));
    isLoadingOlder = false;
}

// ==================== RENDER ALL MESSAGES ====================
function renderAllMessages(container) {
    allMessages.sort((a, b) => (a.timestamp?.toDate().getTime() || 0) - (b.timestamp?.toDate().getTime() || 0));
    if (allMessages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No messages yet. Say hello! 👋</div>';
        return;
    }
    let html = '';
    if (!noMoreMessages) {
        html += `<div style="text-align:center;padding:8px;"><button id="load-older-btn" class="auth-btn" style="font-size:12px;padding:6px 20px;width:auto;border-radius:20px;" onclick="loadOlderMessages()">Load earlier messages</button></div>`;
    }
    let lastDate = null;
    allMessages.forEach(msg => {
        const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
        const dateKey = date.toDateString();
        if (dateKey !== lastDate) {
            html += `<div class="date-separator"><span>${formatDateLabel(date)}</span></div>`;
            lastDate = dateKey;
        }
        html += createMessageHTML(msg);
    });
    container.innerHTML = html;
    scrollChatToBottomIfNear();
}

function createMessageHTML(msg) {
    const isSent = msg.senderId === auth.currentUser?.uid;
    const wrapperClass = `message-wrapper ${isSent ? 'sent' : 'received'}`;
    let content = '';
    if (msg.replyTo) {
        content += `<div class="quoted-message-preview"><div class="quoted-sender">${escapeHtml(msg.replyTo.senderName||'User')}</div><div>${escapeHtml((msg.replyTo.text||'📷 Image').substring(0,60))}</div></div>`;
    }
    if (msg.text) {
        content += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
    } else if (msg.imageUrl) {
        content += `<img src="${msg.imageUrl}" class="message-image" onclick="event.stopPropagation();showImagePreview('${msg.imageUrl}')" loading="lazy">`;
    } else if (msg.audioUrl) {
        const dur = msg.audioDuration || 0;
        const mins = Math.floor(dur / 60);
        const secs = Math.floor(dur % 60);
        const dstr = `${mins}:${secs.toString().padStart(2,'0')}`;
        const bc = Math.min(Math.max(Math.floor(dur * 2), 8), 30);
        let bars = '';
        for (let i = 0; i < bc; i++) {
            bars += `<span class="bar" style="height:${Math.floor(Math.random()*20+6)}px;"></span>`;
        }
        content += `<div class="voice-note-bubble" onclick="event.stopPropagation();playVoiceNote(this,'${msg.audioUrl}',${dur})"><div class="voice-play-btn"><i class="fas fa-play"></i></div><div class="voice-waveform">${bars}</div><span class="voice-duration">${dstr}</span></div>`;
    }
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    let ticksHtml = '';
    if (isSent) {
        const st = msg.status || 'sent';
        if (st === 'sent') ticksHtml = '<span class="message-ticks ticks-sent">✓</span>';
        else if (st === 'delivered') ticksHtml = '<span class="message-ticks ticks-delivered">✓✓</span>';
        else if (st === 'read') ticksHtml = '<span class="message-ticks ticks-read">✓✓</span>';
    }
    const reaction = msg.reaction ? `<span class="message-reaction">${msg.reaction}</span>` : '';
    const edited = msg.edited ? '<span class="edited-label">(edited)</span>' : '';
    return `
        <div class="${wrapperClass}" id="msg-${msg.id}" data-msg-id="${msg.id}">
            <div class="message-bubble" data-msg-id="${msg.id}" 
                 oncontextmenu="event.preventDefault();openEmojiTray('${msg.id}','${msg.text||''}','${isSent}')"
                 onclick="handleMessageClick(this,event,'${msg.id}')">
                ${content}
                <div class="message-footer">${edited}<span class="message-time">${time}</span>${ticksHtml}</div>
                ${reaction}
            </div>
        </div>`;
}

function handleMessageClick(bubble, event, msgId) {
    const now = Date.now();
    if (now - (bubble._lastTap || 0) < 350) {
        addReactionDirect('❤️', msgId);
        showHeartAnimation(bubble, event);
    }
    bubble._lastTap = now;
}

function showHeartAnimation(bubble, event) {
    const heart = document.createElement('span');
    heart.className = 'heart-animation';
    heart.textContent = '❤️';
    const rect = bubble.getBoundingClientRect();
    heart.style.left = (event.clientX - rect.left - 14) + 'px';
    heart.style.top = (event.clientY - rect.top - 14) + 'px';
    bubble.style.position = 'relative';
    bubble.appendChild(heart);
    setTimeout(() => heart.remove(), 800);
}

function openEmojiTray(msgId, text, isOwnerStr) {
    const isOwner = isOwnerStr === 'true';
    selectedMessageData = { id: msgId, text: text, isOwner: isOwner };
    document.getElementById('tray-edit-btn').style.display = (text && isOwner) ? 'flex' : 'none';
    document.getElementById('tray-delete-btn').style.display = isOwner ? 'flex' : 'none';
    document.getElementById('emoji-tray-overlay').style.display = 'flex';
}

function closeEmojiTray() { document.getElementById('emoji-tray-overlay').style.display = 'none'; }

function addReaction(emoji) {
    if (!selectedMessageData.id) return;
    addReactionDirect(emoji, selectedMessageData.id);
    closeEmojiTray();
}

async function addReactionDirect(emoji, mid) {
    if (!currentUser || !mid) return;
    try { await db.collection('messages').doc(mid).update({ reaction: emoji }); }
    catch (e) { console.error(e); }
}

function handleEditFromTray() {
    if (!selectedMessageData.id || !selectedMessageData.text || !selectedMessageData.isOwner) { closeEmojiTray(); return; }
    isEditing = true;
    closeEmojiTray();
    document.getElementById('editing-banner').style.display = 'flex';
    const input = document.getElementById('chat-input');
    input.value = selectedMessageData.text;
    input.focus();
    autoExpandTextarea();
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-check"></i>';
}

function handleDeleteFromTray() {
    if (!selectedMessageData.id || !selectedMessageData.isOwner) { closeEmojiTray(); return; }
    const mid = selectedMessageData.id;
    closeEmojiTray();
    if (confirm('Unsend this message? It will be removed for everyone.')) {
        db.collection('messages').doc(mid).delete().then(() => {
            db.collection('reactions').doc(mid).delete().catch(() => {});
        }).catch(e => { console.error(e); alert('Failed to unsend.'); });
    }
}

function cancelEdit() {
    isEditing = false;
    selectedMessageData = { id: null, text: null, isOwner: false };
    document.getElementById('editing-banner').style.display = 'none';
    document.getElementById('chat-input').value = '';
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-paper-plane"></i>';
    autoExpandTextarea();
}

function setupReply(msg) {
    replyingTo = {
        id: msg.id,
        text: msg.text || (msg.imageUrl ? '📷 Image' : '🎤 Voice Note'),
        senderName: msg.senderId === currentUser?.uid ? 'You' : (selectedUserData?.name || 'User')
    };
    document.getElementById('reply-preview').style.display = 'flex';
    document.getElementById('reply-preview-name').textContent = replyingTo.senderName;
    document.getElementById('reply-preview-text').textContent = replyingTo.text.substring(0, 80);
    document.getElementById('chat-input').focus();
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('reply-preview').style.display = 'none';
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedImage && !isEditing) return;
    if (!selectedUserId || !auth.currentUser) return;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    try {
        const chatId = [auth.currentUser.uid, selectedUserId].sort().join('_');
        if (isEditing) {
            await db.collection('messages').doc(selectedMessageData.id).update({ text, edited: true });
            cancelEdit();
        } else {
            const md = {
                senderId: auth.currentUser.uid,
                receiverId: selectedUserId,
                participants: [auth.currentUser.uid, selectedUserId],
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'sent'
            };
            if (replyingTo) {
                md.replyTo = { messageId: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName };
                cancelReply();
            }
            if (selectedImage) {
                md.imageUrl = selectedImage;
                selectedImage = null;
            } else {
                md.text = text;
                input.value = '';
                autoExpandTextarea();
            }
            await db.collection('messages').add(md);
            // Update chat document
            db.collection('chats').doc(chatId).set({
                lastMessage: {
                    text: text || (selectedImage ? '📷 Image' : ''),
                    sender: auth.currentUser.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                [`unread.${selectedUserId}`]: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });
            try { await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete(); } catch (e) {}
        }
        scrollChatToBottom();
    } catch (e) {
        console.error(e);
        if (e.code === 'resource-exhausted') alert('⚠️ Daily message limit reached!');
        else alert('Failed to send.');
    } finally {
        sendBtn.disabled = false;
        autoExpandTextarea();
    }
}

function autoExpandTextarea() {
    const ta = document.getElementById('chat-input');
    ta.style.height = 'auto';
    const nh = Math.min(ta.scrollHeight, 110);
    ta.style.height = nh + 'px';
    const mb = document.getElementById('mic-btn');
    const sb = document.getElementById('send-btn');
    const ht = ta.value.trim().length > 0 || selectedImage;
    mb.style.display = ht ? 'none' : 'inline-flex';
    sb.style.display = ht ? 'flex' : 'none';
}

// ==================== TYPING INDICATOR ====================
function handleTyping(event) {
    if (!selectedUserId || !auth.currentUser) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); return; }
    autoExpandTextarea();
    const now = Date.now();
    if (now - lastTypingWrite > TYPING_THROTTLE_MS && !typingWritePending) {
        typingWritePending = true;
        lastTypingWrite = now;
        db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).set({
            isTyping: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => typingWritePending = false).catch(() => typingWritePending = false);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(async () => {
            await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete().catch(() => {});
            typingTimeout = null;
        }, 8000);
    } else if (!typingWritePending && now - lastTypingWrite <= TYPING_THROTTLE_MS) {
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(async () => {
            await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete().catch(() => {});
            typingTimeout = null;
        }, 8000);
    }
}

function setupTypingListener(ouid) {
    const container = document.getElementById('messages-container');
    if (!auth.currentUser) return;
    if (typingListener) typingListener();
    typingListener = db.collection('typing').doc(`${ouid}_${auth.currentUser.uid}`).onSnapshot(doc => {
        let ti = document.getElementById('typing-indicator');
        if (doc.exists && doc.data().isTyping) {
            if (!ti) {
                ti = document.createElement('div');
                ti.id = 'typing-indicator';
                ti.className = 'message-wrapper received';
                ti.innerHTML = '<div class="typing-indicator-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
                container.appendChild(ti);
                scrollChatToBottom();
            }
        } else {
            if (ti) ti.remove();
        }
    });
}

// ==================== IMAGE UPLOAD ====================
function selectImage() { document.getElementById('image-input').click(); }

async function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return; }
    const sb = document.getElementById('send-btn');
    sb.disabled = true;
    try {
        const fd = new FormData();
        fd.append('image', file);
        const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
        const result = await resp.json();
        if (result.success) {
            selectedImage = result.data.url;
            await sendMessage();
        } else alert('Image upload failed');
    } catch (e) { console.error(e); alert('Upload failed.'); }
    finally { sb.disabled = false; event.target.value = ''; }
}

function showImagePreview(url) {
    document.getElementById('preview-image').src = url;
    document.getElementById('image-preview').style.display = 'flex';
    zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0;
    applyZoomTransform(); setupPinchZoom();
}

function closeImagePreview() {
    document.getElementById('image-preview').style.display = 'none';
    zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0; applyZoomTransform();
}

function applyZoomTransform() {
    const img = document.getElementById('preview-image');
    img.style.transform = `translate(${zoomTranslateX}px,${zoomTranslateY}px) scale(${zoomScale})`;
}

function setupPinchZoom() {
    const container = document.getElementById('preview-image-container');
    const img = document.getElementById('preview-image');
    let isDragging = false, dragStartX = 0, dragStartY = 0, startTX = 0, startTY = 0;
    container.ontouchstart = function(e) {
        if (e.touches.length === 2) {
            initialPinchDistance = getPinchDistance(e.touches);
            initialScale = zoomScale;
            initialTranslateX = zoomTranslateX;
            initialTranslateY = zoomTranslateY;
            isDragging = false;
        } else if (e.touches.length === 1 && zoomScale > 1) {
            isDragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            startTX = zoomTranslateX;
            startTY = zoomTranslateY;
        }
    };
    container.ontouchmove = function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = getPinchDistance(e.touches);
            const newScale = Math.min(Math.max(initialScale * (dist / initialPinchDistance), 1), 5);
            zoomScale = newScale;
            zoomTranslateX = initialTranslateX;
            zoomTranslateY = initialTranslateY;
            applyZoomTransform();
        } else if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - dragStartX;
            const dy = e.touches[0].clientY - dragStartY;
            zoomTranslateX = startTX + dx;
            zoomTranslateY = startTY + dy;
            applyZoomTransform();
        }
    };
    container.ontouchend = function(e) {
        if (e.touches.length === 0) {
            isDragging = false;
            if (zoomScale < 1) { zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0; applyZoomTransform(); }
        }
    };
    const clickHandler = function(e) { if (e.target === img && zoomScale <= 1.05) closeImagePreview(); };
    document.getElementById('image-preview').addEventListener('click', clickHandler);
}

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// ==================== VOICE NOTES ====================
async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert('Voice recording not supported.'); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        audioChunks = [];
        mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) audioChunks.push(e.data); });
        mediaRecorder.addEventListener('stop', uploadVoiceNote);
        mediaRecorder.start();
        recordingStartTime = Date.now();
        document.getElementById('mic-btn').classList.add('recording');
        document.getElementById('recording-timer').style.display = 'inline';
        recordingTimerInterval = setInterval(updateRecordingTimer, 200);
    } catch (e) { console.error(e); alert('Please allow microphone access.'); }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        document.getElementById('mic-btn').classList.remove('recording');
        document.getElementById('recording-timer').style.display = 'none';
        if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    }
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    document.getElementById('recording-timer').textContent = `${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}`;
}

async function uploadVoiceNote() {
    if (audioChunks.length === 0) return;
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const dur = Math.floor((Date.now() - recordingStartTime) / 1000);
    if (dur < 1) return;
    const mid = db.collection('messages').doc().id;
    const sref = storage.ref(`voice_notes/${mid}.webm`);
    try {
        const snap = await sref.put(blob);
        const url = await snap.ref.getDownloadURL();
        const md = {
            senderId: auth.currentUser.uid,
            receiverId: selectedUserId,
            participants: [auth.currentUser.uid, selectedUserId],
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'sent',
            audioUrl: url,
            audioDuration: dur
        };
        if (replyingTo) {
            md.replyTo = { messageId: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName };
            cancelReply();
        }
        await db.collection('messages').doc(mid).set(md);
        // update chat document
        const chatId = [auth.currentUser.uid, selectedUserId].sort().join('_');
        db.collection('chats').doc(chatId).set({
            lastMessage: { text: '🎤 Voice Note', sender: auth.currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() },
            [`unread.${selectedUserId}`]: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
        scrollChatToBottom();
    } catch (e) { console.error(e); alert('Failed to send voice note.'); }
    audioChunks = [];
}

function playVoiceNote(element, url, duration) {
    const pb = element.querySelector('.voice-play-btn i');
    const allBtns = document.querySelectorAll('.voice-play-btn i');
    allBtns.forEach(b => { if (b !== pb && b.classList.contains('fa-pause')) { b.classList.remove('fa-pause'); b.classList.add('fa-play'); } });
    const ea = document.querySelector('.voice-note-audio-active');
    if (ea && ea.parentElement === element) { ea.pause(); ea.remove(); pb.classList.remove('fa-pause'); pb.classList.add('fa-play'); return; }
    if (ea) { ea.pause(); ea.remove(); }
    const audio = new Audio(url);
    audio.className = 'voice-note-audio-active';
    element.appendChild(audio);
    pb.classList.remove('fa-play');
    pb.classList.add('fa-pause');
    audio.play();
    audio.addEventListener('ended', () => { pb.classList.remove('fa-pause'); pb.classList.add('fa-play'); audio.remove(); });
    audio.addEventListener('error', () => { pb.classList.remove('fa-pause'); pb.classList.add('fa-play'); audio.remove(); alert('Failed to play voice note.'); });
}

// ==================== PRESENCE (OPTIMIZED) ====================
async function updatePresence(online) {
    if (!currentUser) return;
    const now = Date.now();
    if (now - lastPresenceWrite < PRESENCE_THROTTLE_MS && online) return;
    lastPresenceWrite = now;
    try {
        await db.collection('presence').doc(currentUser.uid).set({ online, lastActive: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.error(e); }
}

function setupPresenceListener(ouid) {
    if (!ouid) return;
    if (presenceListener) presenceListener();
    const se = document.getElementById('chat-header-status');
    presenceListener = db.collection('presence').doc(ouid).onSnapshot(doc => {
        if (doc.exists) {
            const d = doc.data();
            if (d.online) { se.textContent = 'Online'; se.className = 'chat-header-status online'; }
            else {
                se.className = 'chat-header-status';
                const la = d.lastActive ? d.lastActive.toDate() : null;
                if (la) {
                    const diff = Date.now() - la.getTime();
                    if (diff < 60000) se.textContent = 'Last seen just now';
                    else if (diff < 3600000) se.textContent = `Last seen ${Math.floor(diff/60000)} min ago`;
                    else if (diff < 86400000) se.textContent = `Last seen at ${la.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
                    else se.textContent = `Last seen ${la.toLocaleDateString([],{month:'short',day:'numeric'})}`;
                } else se.textContent = 'Offline';
            }
        } else { se.textContent = 'Offline'; se.className = 'chat-header-status'; }
    });
}

// ==================== ONESIGNAL ====================
function setupOneSignalUser(uid) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
        try {
            if (!window._oneSignalInitialized) {
                await OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } });
                window._oneSignalInitialized = true;
            }
            OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                const subId = event.current.id;
                if (subId) await db.collection('users').doc(uid).update({ oneSignalSubId: subId }).catch(() => {});
            });
            const perm = await OneSignal.Notifications.requestPermission();
            if (perm) {
                await OneSignal.login(uid);
                const subId = OneSignal.User.PushSubscription.id;
                if (subId) await db.collection('users').doc(uid).update({ oneSignalSubId: subId }).catch(() => {});
            }
        } catch (e) { console.error('OneSignal error:', e); }
    });
}

async function sendDisguisedNotification() {
    if (!selectedUserId || !currentUser) { alert('Open a chat first.'); return; }
    const bb = document.getElementById('bell-btn');
    bb.style.opacity = '0.5';
    try {
        const td = await db.collection('users').doc(selectedUserId).get();
        const tdata = td.data();
        let body;
        if (tdata && tdata.oneSignalSubId) {
            body = JSON.stringify({ app_id: ONESIGNAL_APP_ID, include_subscription_ids: [tdata.oneSignalSubId], headings: { en: 'Calculator Update' }, contents: { en: 'Use Calculator app for perfect calculations' }, data: { type: 'disguised_calculator' } });
        } else {
            body = JSON.stringify({ app_id: ONESIGNAL_APP_ID, include_aliases: { external_id: [selectedUserId] }, target_channel: 'push', headings: { en: 'Calculator Update' }, contents: { en: 'Use Calculator app for perfect calculations' }, data: { type: 'disguised_calculator' } });
        }
        const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent('https://onesignal.com/api/v1/notifications');
        const resp = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` }, body });
        const result = await resp.json();
        if (result.id && result.recipients > 0) {
            bb.style.color = '#4CAF50';
            setTimeout(() => { bb.style.color = '#A8C7FA'; bb.style.opacity = '1'; }, 1500);
        } else if (result.id && result.recipients === 0) {
            alert('0 recipients — ask user to reopen the app once.');
            bb.style.opacity = '1';
        } else {
            alert('Failed: ' + JSON.stringify(result.errors || result));
            bb.style.opacity = '1';
        }
    } catch (e) { console.error(e); alert('Failed.'); bb.style.opacity = '1'; }
}

// ==================== CHAT INFO PANEL ====================
function openChatInfoPanel() { if (!selectedUserId) return; document.getElementById('chat-info-panel').style.display = 'flex'; switchInfoTab('media'); loadSharedMedia(selectedUserId); }
function closeChatInfoPanel() { document.getElementById('chat-info-panel').style.display = 'none'; }
function switchInfoTab(tab) {
    document.querySelectorAll('.chat-info-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.chat-info-content').forEach(c => c.classList.remove('active'));
    if (tab === 'media') { document.querySelectorAll('.chat-info-tab')[0].classList.add('active'); document.getElementById('info-media').classList.add('active'); }
    else if (tab === 'links') { document.querySelectorAll('.chat-info-tab')[1].classList.add('active'); document.getElementById('info-links').classList.add('active'); }
    else { document.querySelectorAll('.chat-info-tab')[2].classList.add('active'); document.getElementById('info-docs').classList.add('active'); }
}

async function loadSharedMedia(ouid) {
    const cuid = auth.currentUser?.uid;
    if (!cuid || !ouid) return;
    try {
        const snap = await db.collection('messages').orderBy('timestamp', 'desc').get();
        const images = []; const links = []; const docs = [];
        snap.forEach(doc => {
            const msg = doc.data();
            if ((msg.senderId === cuid && msg.receiverId === ouid) || (msg.senderId === ouid && msg.receiverId === cuid)) {
                if (msg.imageUrl) images.push(msg.imageUrl);
                if (msg.text) {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const found = msg.text.match(urlRegex);
                    if (found) found.forEach(u => links.push({ url: u, text: msg.text, timestamp: msg.timestamp }));
                }
                if (msg.audioUrl) docs.push({ url: msg.audioUrl, name: 'Voice Note', timestamp: msg.timestamp });
            }
        });
        renderMediaGrid(images); renderLinksList(links); renderDocsList(docs);
    } catch (e) { console.error('Error loading shared media:', e); }
}
function renderMediaGrid(images) { const grid = document.getElementById('media-grid'); const noMsg = document.getElementById('no-media-msg'); if (images.length === 0) { grid.innerHTML = ''; noMsg.style.display = 'block'; return; } noMsg.style.display = 'none'; grid.innerHTML = images.map(url => `<img src="${url}" onclick="showImagePreview('${url}')" loading="lazy">`).join(''); }
function renderLinksList(links) { const list = document.getElementById('links-list'); const noMsg = document.getElementById('no-links-msg'); if (links.length === 0) { list.innerHTML = ''; noMsg.style.display = 'block'; return; } noMsg.style.display = 'none'; list.innerHTML = links.map(l => `<div class="link-item" onclick="window.open('${l.url}','_blank')"><div class="link-title">${escapeHtml((l.text||l.url).substring(0,60))}</div><div class="link-url">${escapeHtml(l.url)}</div></div>`).join(''); }
function renderDocsList(docs) { const list = document.getElementById('docs-list'); const noMsg = document.getElementById('no-docs-msg'); if (docs.length === 0) { list.innerHTML = ''; noMsg.style.display = 'block'; return; } noMsg.style.display = 'none'; list.innerHTML = docs.map(d => `<div class="link-item" onclick="window.open('${d.url}','_blank')"><div class="link-title">🎤 ${escapeHtml(d.name)}</div><div class="link-url">Tap to open</div></div>`).join(''); }

// ==================== SEARCH WITHIN CHAT ====================
function toggleChatSearch() {
    const sb = document.getElementById('chat-search-bar');
    if (sb.style.display === 'flex') { sb.style.display = 'none'; document.getElementById('chat-search-input').value = ''; clearSearchHighlights(); }
    else { sb.style.display = 'flex'; document.getElementById('chat-search-input').focus(); document.getElementById('search-nav').style.display = 'none'; chatSearchResults = []; chatSearchIndex = 0; }
}
function searchInChat() {
    const q = document.getElementById('chat-search-input').value.trim().toLowerCase();
    if (q.length < 2) { clearSearchHighlights(); document.getElementById('search-nav').style.display = 'none'; return; }
    chatSearchResults = []; chatSearchIndex = 0;
    allMessages.forEach(msg => { if (msg.text && msg.text.toLowerCase().includes(q)) chatSearchResults.push(msg); });
    if (chatSearchResults.length > 0) {
        document.getElementById('search-nav').style.display = 'flex';
        document.getElementById('search-count').textContent = `1/${chatSearchResults.length}`;
        chatSearchIndex = 0;
        scrollToSearchResult(0);
    } else {
        document.getElementById('search-nav').style.display = 'flex';
        document.getElementById('search-count').textContent = '0/0';
        clearSearchHighlights();
    }
}
function scrollToSearchResult(index) {
    if (index < 0 || index >= chatSearchResults.length) return;
    document.querySelectorAll('.message-bubble.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    const msg = chatSearchResults[index];
    const bubble = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (bubble) { bubble.classList.add('search-highlight'); bubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else { renderAllMessages(document.getElementById('messages-container')); const newBubble = document.querySelector(`[data-msg-id="${msg.id}"]`); if (newBubble) { newBubble.classList.add('search-highlight'); newBubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    document.getElementById('search-count').textContent = `${index+1}/${chatSearchResults.length}`;
}
function navigateSearch(dir) { if (chatSearchResults.length === 0) return; chatSearchIndex = (chatSearchIndex + dir + chatSearchResults.length) % chatSearchResults.length; scrollToSearchResult(chatSearchIndex); }
function clearSearchHighlights() { document.querySelectorAll('.message-bubble.search-highlight').forEach(el => el.classList.remove('search-highlight')); }

// ==================== GIF PICKER ====================
function openGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'flex'; document.getElementById('gif-search-input').value = ''; document.getElementById('gif-grid').innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>'; document.getElementById('gif-search-input').focus(); }
function closeGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'none'; }
async function searchGifs() {
    const q = document.getElementById('gif-search-input').value.trim();
    const grid = document.getElementById('gif-grid');
    if (q.length < 2) { grid.innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>'; return; }
    grid.innerHTML = '<div class="loading-spinner"></div>';
    try {
        const resp = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`);
        const data = await resp.json();
        if (data.data && data.data.length > 0) {
            grid.innerHTML = data.data.map(g => `<img src="${g.images.fixed_height_downsampled.url}" onclick="sendGif('${g.images.fixed_height.url}')" loading="lazy">`).join('');
        } else grid.innerHTML = '<div class="gif-placeholder">No GIFs found.</div>';
    } catch (e) { console.error(e); grid.innerHTML = '<div class="gif-placeholder">Failed to load GIFs.</div>'; }
}
async function sendGif(url) { selectedImage = url; closeGifPicker(); await sendMessage(); }

// ==================== KEYBOARD ====================
function applyKeyboardPadding() { if (!window.visualViewport) return; const cs = document.getElementById('chat-screen'); if (cs.style.display !== 'flex') return; const vp = window.visualViewport; const kh = window.innerHeight - vp.height; if (kh > 100) { cs.style.paddingBottom = kh + 'px'; scrollChatToBottom(); } else cs.style.paddingBottom = '0px'; }
function resetKeyboardPadding() { document.getElementById('chat-screen').style.paddingBottom = '0px'; }
function setupViewportHandler() { if (!window.visualViewport) return; window.visualViewport.addEventListener('resize', applyKeyboardPadding); window.visualViewport.addEventListener('scroll', applyKeyboardPadding); }
function scrollChatToBottom() { const c = document.getElementById('messages-container'); c.scrollTop = c.scrollHeight; }
function scrollChatToBottomIfNear() { const c = document.getElementById('messages-container'); const isNear = c.scrollHeight - c.scrollTop - c.clientHeight < 150; if (isNear) scrollChatToBottom(); }

function formatDateLabel(date) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toDateString();
    const d = date.toDateString();
    if (d === today) return 'Today';
    if (d === yd) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ==================== HELPERS ====================
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ==================== AUTH STATE ====================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        setupOneSignalUser(user.uid);
        db.collection('users').doc(user.uid).get().then(doc => {
            if (!doc.exists) db.collection('users').doc(user.uid).set({ name: user.displayName || user.email.split('@')[0], email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        if (document.getElementById('auth-screen').style.display === 'block') showUsersList();
    } else {
        if (currentUser) updatePresence(false);
        currentUser = null;
        cleanupListeners();
        chatListData.clear(); acceptedChats.clear(); pendingRequests.clear();
        returnToCalculator();
    }
});

// ==================== INIT ====================
updateDisplay();
returnToCalculator();
setupPanicDetection();
setupViewportHandler();
setupPresenceEventHandlers();
document.getElementById('chat-input').addEventListener('focus', () => { setTimeout(() => { document.getElementById('chat-input').scrollIntoView({ behavior: 'smooth', block: 'end' }); applyKeyboardPadding(); }, 300); });
autoExpandTextarea();
document.getElementById('mic-btn').style.display = 'inline-flex';
document.getElementById('send-btn').style.display = 'none';

function setupPresenceEventHandlers() {
    window.addEventListener('beforeunload', () => {
        if (currentUser) updatePresence(false);
    });
}
