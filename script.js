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
let usersListener = null,
    messagesListener1 = null,
    messagesListener2 = null,
    typingListener = null,
    unreadMessagesListener = null,
    requestsListener = null,
    acceptedChatsListener = null,
    presenceListener = null;
let chatListData = new Map(),
    acceptedChats = new Set(),
    pendingRequests = new Map();

// Pagination
let allMessages = [],
    messagesSet = new Set(),
    lastVisibleDoc = null,
    isLoadingMore = false,
    noMoreMessages = false,
    messagesObserver = null;
const PAGE_SIZE = 20;

// Search
let chatSearchResults = [],
    chatSearchIndex = 0,
    isLoadingAllForSearch = false;

// Throttle
let lastTypingWrite = 0;
const TYPING_THROTTLE_MS = 5000;
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
    if (!currentResult.includes('.')) { currentResult += '.'; updateDisplay(); }
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

function showUsersList() {
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
    loadData();
    updatePresence(true);
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
    if (usersListener) usersListener();
    if (messagesListener1) messagesListener1();
    if (messagesListener2) messagesListener2();
    if (typingListener) typingListener();
    if (unreadMessagesListener) unreadMessagesListener();
    if (requestsListener) requestsListener();
    if (acceptedChatsListener) acceptedChatsListener();
    if (presenceListener) presenceListener();
    if (typingTimeout) clearTimeout(typingTimeout);
    usersListener = messagesListener1 = messagesListener2 = typingListener = unreadMessagesListener = requestsListener = acceptedChatsListener = presenceListener = null;
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
        try {
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
        } catch (e) {
            console.error('Search error:', e);
        }
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
        loadRequests();
    } catch (e) { console.error(e); alert('Failed to accept'); }
}

async function rejectChatRequest(rid) {
    try {
        await db.collection('chatRequests').doc(rid).update({ status: 'rejected' });
        loadRequests();
    } catch (e) { console.error(e); }
}

// ==================== LOAD DATA ====================
function loadData() {
    loadAcceptedChats();
    loadRequests();
    setupUnreadMessagesListener();
}

function loadAcceptedChats() {
    if (!currentUser) return;
    if (acceptedChatsListener) acceptedChatsListener();
    acceptedChatsListener = db.collection('acceptedChats')
        .where('userId1', '==', currentUser.uid)
        .onSnapshot((snap) => {
            snap.forEach(doc => {
                const d = doc.data();
                acceptedChats.add(d.userId2);
                loadUserData(d.userId2);
            });
            db.collection('acceptedChats').where('userId2', '==', currentUser.uid).get().then(snap2 => {
                snap2.forEach(doc => {
                    const d = doc.data();
                    acceptedChats.add(d.userId1);
                    loadUserData(d.userId1);
                });
                renderChatList();
            });
        });
}

function loadUserData(uid) {
    if (chatListData.has(uid) && chatListData.get(uid).userData) return;
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            if (!chatListData.has(uid)) chatListData.set(uid, { userData: doc.data(), lastMessage: null, unreadCount: 0, lastMessageTime: null });
            else {
                const d = chatListData.get(uid);
                d.userData = doc.data();
                chatListData.set(uid, d);
            }
            renderChatList();
        }
    });
}

function loadRequests() {
    if (!currentUser) return;
    if (requestsListener) requestsListener();
    requestsListener = db.collection('chatRequests')
        .where('toUserId', '==', currentUser.uid)
        .where('status', '==', 'pending')
        .onSnapshot((snap) => {
            pendingRequests.clear();
            snap.forEach(doc => {
                const r = doc.data();
                pendingRequests.set(r.fromUserId, { requestId: doc.id, ...r });
                loadRequesterData(r.fromUserId, doc.id, r);
            });
            renderRequestsList();
        });
}

function loadRequesterData(uid, rid, rd) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const r = pendingRequests.get(uid);
            if (r) {
                r.fromUserData = doc.data();
                pendingRequests.set(uid, r);
                renderRequestsList();
            }
        }
    });
}

// ==================== RENDER ====================
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

function setupUnreadMessagesListener() {
    if (!currentUser) return;
    if (unreadMessagesListener) unreadMessagesListener();
    unreadMessagesListener = db.collection('messages')
        .where('receiverId', '==', currentUser.uid)
        .where('status', '==', 'sent')
        .onSnapshot((snap) => {
            snap.docChanges().forEach(ch => {
                if (ch.type === 'added') {
                    const msg = ch.doc.data();
                    const sid = msg.senderId;
                    if (acceptedChats.has(sid)) {
                        if (!chatListData.has(sid)) loadUserData(sid);
                        const d = chatListData.get(sid) || { unreadCount: 0 };
                        d.lastMessage = msg;
                        d.unreadCount = (d.unreadCount || 0) + 1;
                        d.lastMessageTime = msg.timestamp;
                        chatListData.set(sid, d);
                        renderChatList();
                    }
                }
            });
        });
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
    allMessages = [];
    messagesSet = new Set();
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
    try {
        const snap = await db.collection('messages')
            .where('senderId', '==', sid)
            .where('receiverId', '==', currentUser.uid)
            .where('status', 'in', ['sent', 'delivered']).get();
        const batch = db.batch();
        snap.forEach(doc => batch.update(doc.ref, { status: 'read' }));
        await batch.commit();
        if (chatListData.has(sid)) {
            const d = chatListData.get(sid);
            d.unreadCount = 0;
            chatListData.set(sid, d);
            renderChatList();
        }
    } catch (e) { console.error('Error marking read:', e); }
}

async function markReceivedMessagesAsDelivered(sid, cuid) {
    try {
        const snap = await db.collection('messages')
            .where('senderId', '==', sid)
            .where('receiverId', '==', cuid)
            .where('status', '==', 'sent').get();
        if (!snap.empty) {
            const batch = db.batch();
            snap.forEach(doc => batch.update(doc.ref, { status: 'delivered' }));
            await batch.commit();
        }
    } catch (e) { console.error(e); }
}

function scrollChatToBottom() {
    const c = document.getElementById('messages-container');
    c.scrollTop = c.scrollHeight;
}

function retryLoadMessages() {
    if (selectedUserId && currentUser) setupMessagesListener(selectedUserId, currentUser.uid);
}

// ==================== RENDER ALL MESSAGES WITH DATE SEPARATORS ====================
function renderAllMessages() {
    const container = document.getElementById('messages-container');
    allMessages.sort((a, b) => {
        const tA = a.timestamp ? a.timestamp.toDate().getTime() : Date.now();
        const tB = b.timestamp ? b.timestamp.toDate().getTime() : Date.now();
        return tA - tB;
    });
    if (allMessages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No messages yet. Say hello! 👋</div>';
        return;
    }
    if (container.textContent.includes('No messages yet')) container.innerHTML = '';
    let sentinel = document.getElementById('messages-sentinel');
    let spinner = document.getElementById('load-more-spinner');
    if (!sentinel || !spinner) {
        container.innerHTML = '<div id="load-more-spinner" class="loading-spinner" style="display:none; margin:10px auto;"></div><div id="messages-sentinel" style="height:1px;"></div>';
        sentinel = document.getElementById('messages-sentinel');
        spinner = document.getElementById('load-more-spinner');
    }
    let lastEl = sentinel;
    allMessages.forEach((msg, idx) => {
        const msgDate = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
        const dateKey = msgDate.toDateString();
        let needSeparator = false;
        if (idx === 0) needSeparator = true;
        else {
            const prevMsg = allMessages[idx - 1];
            const prevDate = prevMsg.timestamp ? new Date(prevMsg.timestamp.toDate()) : new Date();
            if (prevDate.toDateString() !== dateKey) needSeparator = true;
        }
        if (needSeparator) {
            let sepEl = lastEl.nextSibling;
            if (sepEl && sepEl.classList && sepEl.classList.contains('date-separator')) {
                const span = sepEl.querySelector('span');
                if (span) span.textContent = formatDateLabel(msgDate);
            } else {
                sepEl = document.createElement('div');
                sepEl.className = 'date-separator';
                sepEl.innerHTML = `<span>${formatDateLabel(msgDate)}</span>`;
                lastEl.parentNode.insertBefore(sepEl, lastEl.nextSibling);
            }
            lastEl = sepEl;
        }
        let el = document.getElementById(`msg-${msg.id}`);
        if (el) {
            updateExistingMessageDOM(el, msg);
            if (el !== lastEl.nextSibling) lastEl.parentNode.insertBefore(el, lastEl.nextSibling);
        } else {
            el = createMessageElement(msg);
            lastEl.parentNode.insertBefore(el, lastEl.nextSibling);
        }
        lastEl = el;
    });
}

function updateExistingMessageDOM(el, msg) {
    const bubble = el.querySelector('.message-bubble');
    if (!bubble) return;
    const isSent = msg.senderId === auth.currentUser?.uid;
    let content = '';
    if (msg.replyTo) {
        content += `<div class="quoted-message-preview"><div class="quoted-sender">${escapeHtml(msg.replyTo.senderName||'User')}</div><div>${escapeHtml((msg.replyTo.text||'📷 Image').substring(0,60))}</div></div>`;
    }
    if (msg.text) {
        content += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
    } else if (msg.imageUrl) {
        const currentImg = bubble.querySelector('.message-image');
        if (currentImg && currentImg.src === msg.imageUrl) content += currentImg.outerHTML;
        else content += `<img src="${msg.imageUrl}" class="message-image" onclick="event.stopPropagation();showImagePreview('${msg.imageUrl}')" loading="lazy">`;
    } else if (msg.audioUrl) {
        const dur = msg.audioDuration || 0;
        const mins = Math.floor(dur / 60);
        const secs = Math.floor(dur % 60);
        const dstr = `${mins}:${secs.toString().padStart(2,'0')}`;
        const activeAudio = bubble.querySelector('.voice-note-audio-active');
        const isPlaying = bubble.querySelector('.voice-play-btn i')?.classList.contains('fa-pause');
        const bc = Math.min(Math.max(Math.floor(dur * 2), 8), 30);
        let bars = '';
        for (let i = 0; i < bc; i++) {
            const h = Math.floor(Math.random() * 20 + 6);
            bars += `<span class="bar" style="height:${h}px;"></span>`;
        }
        content += `<div class="voice-note-bubble" onclick="event.stopPropagation();playVoiceNote(this,'${msg.audioUrl}',${dur})"><div class="voice-play-btn"><i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i></div><div class="voice-waveform">${bars}</div><span class="voice-duration">${dstr}</span></div>`;
    }
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    let ticksHtml = '';
    if (isSent) {
        const st = msg.status || 'sent';
        if (st === 'sent') ticksHtml = '<span class="message-ticks ticks-sent">✓</span>';
        else if (st === 'delivered') ticksHtml = '<span class="message-ticks ticks-delivered">✓✓</span>';
        else if (st === 'read') ticksHtml = '<span class="message-ticks ticks-read">✓✓</span>';
    }
    bubble.innerHTML = `${content}<div class="message-footer">${msg.edited?'<span class="edited-label">(edited)</span>':''}<span class="message-time">${time}</span>${ticksHtml}</div>`;
    if (msg.reaction) {
        const rs = document.createElement('span');
        rs.className = 'message-reaction';
        rs.textContent = msg.reaction;
        bubble.appendChild(rs);
    }
}

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

function setupMessagesListener(ouid, cuid) {
    const container = document.getElementById('messages-container');
    const eb = document.getElementById('chat-error-banner');
    if (messagesListener1) messagesListener1();
    if (messagesListener2) messagesListener2();
    allMessages = [];
    messagesSet = new Set();
    eb.style.display = 'none';
    container.innerHTML = '<div class="loading-spinner"></div>';
    const sentMap = new Map();
    const receivedMap = new Map();
    let loadedCount = 0;
    const handleSnapshot = (snap, isSent) => {
        snap.docChanges().forEach(change => {
            const msg = { id: change.doc.id, ...change.doc.data() };
            if (change.type === 'removed') {
                if (isSent) sentMap.delete(msg.id);
                else receivedMap.delete(msg.id);
                const el = document.getElementById(`msg-${msg.id}`);
                if (el) el.remove();
            } else {
                if (isSent) sentMap.set(msg.id, msg);
                else receivedMap.set(msg.id, msg);
                if (!isSent && msg.status === 'sent') {
                    change.doc.ref.update({ status: 'delivered' }).catch(() => {});
                }
            }
        });
        allMessages = [...sentMap.values(), ...receivedMap.values()];
        allMessages.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : Date.now();
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : Date.now();
            return tA - tB;
        });
        renderAllMessages();
        if (loadedCount < 2) {
            loadedCount++;
            if (loadedCount === 2) scrollChatToBottom();
        } else {
            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
            if (isAtBottom) scrollChatToBottom();
        }
    };
    messagesListener1 = db.collection('messages').where('senderId', '==', cuid).where('receiverId', '==', ouid)
        .onSnapshot(snap => handleSnapshot(snap, true), err => { console.error(err); eb.style.display = 'block'; });
    messagesListener2 = db.collection('messages').where('senderId', '==', ouid).where('receiverId', '==', cuid)
        .onSnapshot(snap => handleSnapshot(snap, false), err => { console.error(err); eb.style.display = 'block'; });
}

function createMessageElement(msg) {
    const wrapper = document.createElement('div');
    const isSent = msg.senderId === auth.currentUser?.uid;
    wrapper.className = `message-wrapper ${isSent?'sent':'received'}`;
    wrapper.id = `msg-${msg.id}`;
    wrapper.setAttribute('data-msg-id', msg.id);
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.setAttribute('data-msg-id', msg.id);
    bubble.addEventListener('touchstart', function(e) { longPressTimer = setTimeout(() => openEmojiTray(msg, e), 500); });
    bubble.addEventListener('touchend', () => clearTimeout(longPressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    bubble.addEventListener('contextmenu', function(e) { e.preventDefault(); openEmojiTray(msg, e); });
    bubble.addEventListener('click', function(e) {
        const now = Date.now();
        if (now - (bubble._lastTap || 0) < 350) {
            addReactionDirect('❤️', msg.id);
            showHeartAnimation(bubble, e);
        }
        bubble._lastTap = now;
    });
    bubble.addEventListener('touchstart', function(e) {
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeTargetMsgId = msg.id;
    });
    bubble.addEventListener('touchend', function(e) {
        const dx = e.changedTouches[0].clientX - swipeStartX;
        const dy = e.changedTouches[0].clientY - swipeStartY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2 && dx > 0 && swipeTargetMsgId === msg.id) setupReply(msg);
        swipeTargetMsgId = null;
    });
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
            const h = Math.floor(Math.random() * 20 + 6);
            bars += `<span class="bar" style="height:${h}px;"></span>`;
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
    bubble.innerHTML = `${content}<div class="message-footer">${msg.edited?'<span class="edited-label">(edited)</span>':''}<span class="message-time">${time}</span>${ticksHtml}</div>`;
    if (msg.reaction) {
        const rs = document.createElement('span');
        rs.className = 'message-reaction';
        rs.textContent = msg.reaction;
        bubble.appendChild(rs);
    }
    wrapper.appendChild(bubble);
    return wrapper;
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

function openEmojiTray(msg, event) {
    const isOwner = msg.senderId === currentUser?.uid;
    selectedMessageData = { id: msg.id, text: msg.text || '', isOwner: isOwner };
    document.getElementById('tray-edit-btn').style.display = (msg.text && isOwner) ? 'flex' : 'none';
    document.getElementById('tray-delete-btn').style.display = isOwner ? 'flex' : 'none';
    document.getElementById('emoji-tray-overlay').style.display = 'flex';
    if (event && event.preventDefault) event.preventDefault();
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
    replyingTo = { id: msg.id, text: msg.text || (msg.imageUrl ? '📷 Image' : '🎤 Voice Note'), senderName: msg.senderId === currentUser?.uid ? 'You' : (selectedUserData?.name || 'User') };
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
            try { await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete(); } catch (e) {}
        }
        scrollChatToBottom();
    } catch (e) {
        console.error(e);
        if (e.code === 'resource-exhausted') alert('⚠️ Daily message limit reached! Please wait or try tomorrow.');
        else alert('Failed to send. Please try again.');
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
        const tr = db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`);
        tr.set({ isTyping: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { typingWritePending = false; }).catch(() => { typingWritePending = false; });
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(async () => { try { await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete(); } catch (e) {} typingTimeout = null; }, 6000);
    } else if (!typingWritePending && now - lastTypingWrite <= TYPING_THROTTLE_MS) {
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(async () => { try { await db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete(); } catch (e) {} typingTimeout = null; }, 6000);
    }
}

function setupTypingListener(ouid) {
    const container = document.getElementById('messages-container');
    if (!auth.currentUser) return;
    try {
        if (typingListener) typingListener();
        typingListener = db.collection('typing').doc(`${ouid}_${auth.currentUser.uid}`).onSnapshot((doc) => {
            const ti = document.getElementById('typing-indicator');
            if (doc.exists && doc.data().isTyping) {
                const ts = doc.data().timestamp;
                if (ts) {
                    const tDate = ts.toDate();
                    const age = Date.now() - tDate.getTime();
                    if (age > 15000) { if (ti) ti.remove(); return; }
                }
                if (!ti) {
                    const ie = document.createElement('div');
                    ie.className = 'message-wrapper received';
                    ie.id = 'typing-indicator';
                    ie.innerHTML = '<div class="typing-indicator-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
                    container.appendChild(ie);
                    scrollChatToBottom();
                }
            } else { if (ti) ti.remove(); }
        });
    } catch (e) { console.error('Typing listener error:', e); }
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

// ==================== PRESENCE ====================
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
    presenceListener = db.collection('presence').doc(ouid).onSnapshot((doc) => {
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
                    else se.textContent = `Last seen ${la.toLocaleDateString([],{month:'short',day:'numeric'})} at ${la.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
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
            body = JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_subscription_ids: [tdata.oneSignalSubId],
                headings: { en: 'Calculator Update' },
                contents: { en: 'Use Calculator app for perfect calculations' },
                data: { type: 'disguised_calculator' }
            });
        } else {
            body = JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_aliases: { external_id: [selectedUserId] },
                target_channel: 'push',
                headings: { en: 'Calculator Update' },
                contents: { en: 'Use Calculator app for perfect calculations' },
                data: { type: 'disguised_calculator' }
            });
        }
        const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent('https://onesignal.com/api/v1/notifications');
        const resp = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` },
            body
        });
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
    if (tab === 'media') {
        document.querySelectorAll('.chat-info-tab')[0].classList.add('active');
        document.getElementById('info-media').classList.add('active');
    } else if (tab === 'links') {
        document.querySelectorAll('.chat-info-tab')[1].classList.add('active');
        document.getElementById('info-links').classList.add('active');
    } else {
        document.querySelectorAll('.chat-info-tab')[2].classList.add('active');
        document.getElementById('info-docs').classList.add('active');
    }
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
async function loadAllMessagesForSearch() { if (isLoadingAllForSearch || noMoreMessages) return; isLoadingAllForSearch = true; const spinner = document.getElementById('search-loading-spinner'); if (spinner) spinner.style.display = 'inline-block'; try { while (!noMoreMessages) { await loadOlderMessages(); } } catch (e) { console.error('Error loading messages for search:', e); } finally { isLoadingAllForSearch = false; if (spinner) spinner.style.display = 'none'; renderAllMessages(); } }
function toggleChatSearch() { const sb = document.getElementById('chat-search-bar'); if (sb.style.display === 'flex') { sb.style.display = 'none'; document.getElementById('chat-search-input').value = ''; clearSearchHighlights(); } else { sb.style.display = 'flex'; document.getElementById('chat-search-input').focus(); document.getElementById('search-nav').style.display = 'none'; chatSearchResults = []; chatSearchIndex = 0; loadAllMessagesForSearch(); } }
function searchInChat() { const q = document.getElementById('chat-search-input').value.trim().toLowerCase(); if (q.length < 2) { clearSearchHighlights(); document.getElementById('search-nav').style.display = 'none'; return; } chatSearchResults = []; chatSearchIndex = 0; allMessages.forEach(msg => { if (msg.text && msg.text.toLowerCase().includes(q)) { chatSearchResults.push(msg); } }); if (chatSearchResults.length > 0) { document.getElementById('search-nav').style.display = 'flex'; document.getElementById('search-count').textContent = `1/${chatSearchResults.length}`; chatSearchIndex = 0; scrollToSearchResult(0); } else { document.getElementById('search-nav').style.display = 'flex'; document.getElementById('search-count').textContent = '0/0'; clearSearchHighlights(); } }
function scrollToSearchResult(index) { if (index < 0 || index >= chatSearchResults.length) return; document.querySelectorAll('.message-bubble.search-highlight').forEach(el => el.classList.remove('search-highlight')); const msg = chatSearchResults[index]; const bubble = document.querySelector(`[data-msg-id="${msg.id}"]`); if (bubble) { bubble.classList.add('search-highlight'); bubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { renderAllMessages(); const newBubble = document.querySelector(`[data-msg-id="${msg.id}"]`); if (newBubble) { newBubble.classList.add('search-highlight'); newBubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } document.getElementById('search-count').textContent = `${index+1}/${chatSearchResults.length}`; }
function navigateSearch(dir) { if (chatSearchResults.length === 0) return; chatSearchIndex = (chatSearchIndex + dir + chatSearchResults.length) % chatSearchResults.length; scrollToSearchResult(chatSearchIndex); }
function clearSearchHighlights() { document.querySelectorAll('.message-bubble.search-highlight').forEach(el => el.classList.remove('search-highlight')); }

// ==================== GIF PICKER ====================
function openGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'flex'; document.getElementById('gif-search-input').value = ''; document.getElementById('gif-grid').innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>'; document.getElementById('gif-search-input').focus(); }
function closeGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'none'; }
async function searchGifs() { const q = document.getElementById('gif-search-input').value.trim(); const grid = document.getElementById('gif-grid'); if (q.length < 2) { grid.innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>'; return; } grid.innerHTML = '<div class="loading-spinner"></div>'; try { const resp = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`); const data = await resp.json(); if (data.data && data.data.length > 0) { grid.innerHTML = data.data.map(g => `<img src="${g.images.fixed_height_downsampled.url}" onclick="sendGif('${g.images.fixed_height.url}')" loading="lazy">`).join(''); } else { grid.innerHTML = '<div class="gif-placeholder">No GIFs found. Try another search.</div>'; } } catch (e) { console.error(e); grid.innerHTML = '<div class="gif-placeholder">Failed to load GIFs. Check your connection.</div>'; } }
async function sendGif(url) { selectedImage = url; closeGifPicker(); await sendMessage(); }

// ==================== KEYBOARD ====================
function applyKeyboardPadding() { if (!window.visualViewport) return; const cs = document.getElementById('chat-screen'); if (cs.style.display !== 'flex') return; const vp = window.visualViewport; const kh = window.innerHeight - vp.height; if (kh > 100) { cs.style.paddingBottom = kh + 'px'; scrollChatToBottom(); } else cs.style.paddingBottom = '0px'; }
function resetKeyboardPadding() { document.getElementById('chat-screen').style.paddingBottom = '0px'; }
function setupViewportHandler() { if (!window.visualViewport) return; window.visualViewport.addEventListener('resize', applyKeyboardPadding); window.visualViewport.addEventListener('scroll', applyKeyboardPadding); }
function setupPresenceEventHandlers() {
    document.addEventListener('visibilitychange', () => { if (!currentUser) return; if (document.visibilityState === 'hidden') db.collection('presence').doc(currentUser.uid).set({ online: false, lastActive: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); else if (document.visibilityState === 'visible') db.collection('presence').doc(currentUser.uid).set({ online: true, lastActive: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); });
    window.addEventListener('beforeunload', () => { if (!currentUser) return; db.collection('presence').doc(currentUser.uid).set({ online: false, lastActive: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); });
}
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ==================== AUTH STATE ====================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        setupOneSignalUser(user.uid);
        db.collection('users').doc(user.uid).get().then(doc => { if (!doc.exists) { db.collection('users').doc(user.uid).set({ name: user.displayName || user.email.split('@')[0], email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); } }).catch(() => {});
        if (document.getElementById('auth-screen').style.display === 'block') showUsersList();
        updatePresence(true);
    } else {
        if (currentUser) updatePresence(false);
        currentUser = null;
        cleanupListeners();
        chatListData.clear();
        acceptedChats.clear();
        pendingRequests.clear();
        if (document.getElementById('users-screen').style.display !== 'none' || document.getElementById('chat-screen').style.display !== 'none') returnToCalculator();
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
console.log('✅ App initialized with separated files.');
