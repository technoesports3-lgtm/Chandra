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

// ==================== API KEYS ====================
const IMGBB_API_KEY = "db671a28c5c7d432622dc7e5bc74eecc";
const SECRET_CODE = "14102008";
const ONESIGNAL_APP_ID = "aca4d5a8-52d7-4a9e-b276-117473b396d0";
const ONESIGNAL_REST_API_KEY_PART1 = "os_v2_app_vssnlkcs25fj5mtwcf2hhm4w2";
const ONESIGNAL_REST_API_KEY_PART2 = "djertadndpuabu4ekue5mp6ecqywi34ho2gzl54jsbfxqlq74huqrvgf7vyolcgr73fmt7cj4ygili";
const ONESIGNAL_REST_API_KEY = ONESIGNAL_REST_API_KEY_PART1 + ONESIGNAL_REST_API_KEY_PART2;
const GIPHY_API_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65";

// ==================== GLOBAL VARIABLES ====================
let currentExpression = '', currentResult = '0', scientificVisible = false;
let currentUser = null, selectedUserId = null, selectedUserData = null, selectedImage = null;
let longPressTimer, selectedMessageData = { id: null, text: null, isOwner: false }, isEditing = false;
let replyingTo = null;
let mediaRecorder = null, audioChunks = [], recordingStartTime = 0, recordingTimerInterval = null;
let lastTapTime = 0, lastTapTarget = null;
let swipeStartX = 0, swipeStartY = 0, swipeTargetMsgId = null;
let typingTimeout = null;

// Firebase Listeners
let messagesListener1 = null, messagesListener2 = null, typingListener = null, presenceListener = null;
let acceptedChatsListener = null, requestsListener = null, unreadMessagesListener = null;

// Data State
let chatListData = new Map(), acceptedChats = new Set(), pendingRequests = new Map();

// Pagination & Chat State
const PAGE_SIZE = 30;
let allMessagesMap = new Map();
let oldestSentTs = null, oldestRecvTs = null;
let noMoreSent = false, noMoreRecv = false;
let isLoadingOlder = false;

// Search & Info Panel
let chatSearchResults = [], chatSearchIndex = 0;

// Throttles
let lastTypingWrite = 0;
const TYPING_THROTTLE_MS = 8000;
let typingWritePending = false;
let lastPresenceWrite = 0;
const PRESENCE_THROTTLE_MS = 30000;

// Pinch Zoom
let zoomScale = 1, zoomTranslateX = 0, zoomTranslateY = 0;
let initialPinchDistance = 0, initialScale = 1, initialTranslateX = 0, initialTranslateY = 0;

// ==================== UI & NAVIGATION ====================
function togglePasswordVisibility(inputId, element) {
    const input = document.getElementById(inputId);
    const icon = element.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

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
            const isInteractive = e.target.closest('button, input, textarea, .message-bubble, .user-item, .search-result-item, .request-item, .emoji-option, .emoji-tray-action-btn, .gif-grid img, .chat-info-tab, .media-grid img, .link-item');
            if (isInteractive) { lastTapTime = 0; return; }
            if (now - lastTapTime < 350 && lastTapTarget === screen) {
                panicHide(); lastTapTime = 0; lastTapTarget = null;
            } else { lastTapTime = now; lastTapTarget = screen; }
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
    cancelEdit(); cancelReply();
    selectedUserId = null; selectedUserData = null;
    resetKeyboardPadding();
}

// ==================== CALCULATOR ====================
function toggleScientific() {
    scientificVisible = !scientificVisible;
    document.getElementById('scientificRow').classList.toggle('show');
    document.getElementById('expandIcon').style.transform = scientificVisible ? 'rotate(180deg)' : 'rotate(0deg)';
}
function appendNumber(num) { if (currentResult === '0' || currentResult === 'Error') currentResult = num; else currentResult += num; updateDisplay(); }
function appendOperator(op) { const lc = currentResult[currentResult.length - 1]; if ('+-*/%'.includes(lc)) currentResult = currentResult.slice(0, -1) + op; else currentResult += op; updateDisplay(); }
function appendScientific(func) { currentExpression = currentResult; currentResult = func + '(' + currentResult + ')'; updateDisplay(); }
function appendDecimal() { if (!currentResult.includes('.')) { currentResult += '.'; updateDisplay(); } }
function backspace() { currentResult = currentResult.slice(0, -1); if (currentResult === '') currentResult = '0'; updateDisplay(); }
function clearAll() { currentExpression = ''; currentResult = '0'; updateDisplay(); }
function calculate() {
    try {
        if (currentResult === SECRET_CODE) {
            if (auth.currentUser) showUsersList(); else showAuthScreen();
            clearAll(); return;
        }
        let expr = currentResult.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan').replace(/log/g, 'Math.log10').replace(/ln/g, 'Math.log').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
        if (expr.includes('!')) {
            const p = expr.split('!');
            if (p.length === 2 && !isNaN(p[0])) { let f = 1; for (let i = 1; i <= parseInt(p[0]); i++) f *= i; currentResult = f.toString(); } 
            else throw new Error('Invalid');
        } else {
            currentExpression = currentResult + '='; currentResult = eval(expr).toString();
        }
        updateDisplay();
    } catch (e) { currentExpression = currentResult; currentResult = 'Error'; updateDisplay(); }
}
function updateDisplay() { document.getElementById('expression').textContent = currentExpression; document.getElementById('result').textContent = currentResult; }

// ==================== AUTHENTICATION ====================
function showAuthScreen() { document.getElementById('calculator').style.display = 'none'; document.getElementById('auth-screen').style.display = 'block'; }
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active'); document.getElementById('login-form').classList.add('active'); document.getElementById('signup-error').style.display = 'none';
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active'); document.getElementById('signup-form').classList.add('active'); document.getElementById('login-error').style.display = 'none';
    }
}
function showError(elId, msg) { document.getElementById(elId).textContent = msg; document.getElementById(elId).style.display = 'block'; }

async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim(), email = document.getElementById('signup-email').value.trim(), pwd = document.getElementById('signup-password').value, cpwd = document.getElementById('signup-confirm-password').value;
    document.getElementById('signup-error').style.display = 'none';
    if (!name || !email || !pwd || !cpwd) return showError('signup-error', 'Please fill all fields');
    if (pwd !== cpwd) return showError('signup-error', 'Passwords do not match');
    if (pwd.length < 6) return showError('signup-error', 'Password must be at least 6 characters');
    
    const btn = document.getElementById('signup-btn'); btn.disabled = true; btn.innerHTML = 'Creating Account...';
    try {
        const uc = await auth.createUserWithEmailAndPassword(email, pwd);
        await uc.user.updateProfile({ displayName: name });
        await db.collection('users').doc(uc.user.uid).set({ name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        currentUser = uc.user; setupOneSignalUser(uc.user.uid); showUsersList();
    } catch (e) { showError('signup-error', e.message); btn.disabled = false; btn.innerHTML = 'Sign Up'; }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim(), pwd = document.getElementById('login-password').value;
    document.getElementById('login-error').style.display = 'none';
    if (!email || !pwd) return showError('login-error', 'Please fill all fields');
    
    const btn = document.getElementById('login-btn'); btn.disabled = true; btn.innerHTML = 'Logging in...';
    try { await auth.signInWithEmailAndPassword(email, pwd); } 
    catch (e) { showError('login-error', e.message); btn.disabled = false; btn.innerHTML = 'Login'; }
}

async function logout() {
    cleanupListeners();
    if (currentUser) await updatePresence(false);
    try {
        await auth.signOut(); currentUser = null; chatListData.clear(); acceptedChats.clear(); pendingRequests.clear();
        resetKeyboardPadding(); returnToCalculator();
    } catch (e) { console.error(e); }
}

// ==================== USER LIST & DATA ====================
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
        document.getElementById('current-user-avatar').textContent = name[0].toUpperCase();
        document.getElementById('current-user-name').textContent = name;
    }
    switchChatTab('chats'); loadData(); updatePresence(true);
}

function switchChatTab(tab) {
    if (tab === 'chats') {
        document.getElementById('chats-tab').classList.add('active'); document.getElementById('requests-tab').classList.remove('active');
        document.getElementById('chats-container').style.display = 'block'; document.getElementById('requests-container').style.display = 'none';
        renderChatList();
    } else {
        document.getElementById('requests-tab').classList.add('active'); document.getElementById('chats-tab').classList.remove('active');
        document.getElementById('chats-container').style.display = 'none'; document.getElementById('requests-container').style.display = 'block';
        renderRequestsList();
    }
}

function loadData() {
    if (!currentUser) return;
    
    // Accepted Chats Listener
    if (acceptedChatsListener) acceptedChatsListener();
    acceptedChatsListener = db.collection('acceptedChats').where('userId1', '==', currentUser.uid).onSnapshot(snap => {
        snap.forEach(doc => { acceptedChats.add(doc.data().userId2); loadUserData(doc.data().userId2); });
        db.collection('acceptedChats').where('userId2', '==', currentUser.uid).get().then(snap2 => {
            snap2.forEach(doc => { acceptedChats.add(doc.data().userId1); loadUserData(doc.data().userId1); });
            renderChatList();
        });
    });

    // Requests Listener
    if (requestsListener) requestsListener();
    requestsListener = db.collection('chatRequests').where('toUserId', '==', currentUser.uid).where('status', '==', 'pending').onSnapshot(snap => {
        pendingRequests.clear();
        snap.forEach(doc => {
            const r = doc.data(); pendingRequests.set(r.fromUserId, { requestId: doc.id, ...r });
            db.collection('users').doc(r.fromUserId).get().then(uDoc => {
                if (uDoc.exists) { pendingRequests.get(r.fromUserId).fromUserData = uDoc.data(); renderRequestsList(); }
            });
        });
        renderRequestsList();
    });

    // Unread Messages Listener
    if (unreadMessagesListener) unreadMessagesListener();
    unreadMessagesListener = db.collection('messages').where('receiverId', '==', currentUser.uid).where('status', '==', 'sent').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === 'added') {
                const msg = change.doc.data();
                if (acceptedChats.has(msg.senderId)) {
                    if (!chatListData.has(msg.senderId)) loadUserData(msg.senderId);
                    const d = chatListData.get(msg.senderId) || { unreadCount: 0 };
                    d.lastMessage = msg; d.unreadCount = (d.unreadCount || 0) + 1; d.lastMessageTime = msg.timestamp;
                    chatListData.set(msg.senderId, d); renderChatList();
                }
            }
        });
    });
}

function loadUserData(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const currentData = chatListData.get(uid) || { lastMessage: null, unreadCount: 0, lastMessageTime: null };
            chatListData.set(uid, { ...currentData, userData: doc.data() });
            renderChatList();
        }
    });
}

// ==================== SEARCH & REQUESTS ====================
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
            if ((d.name||'').toLowerCase().includes(q) || (d.email||'').toLowerCase().includes(q)) results.push({ id: doc.id, ...d });
        });
        rd.innerHTML = results.length ? results.map(u => createSearchResultItem(u)).join('') : '<div style="padding:16px;text-align:center;color:#888;">No users found</div>';
        rd.style.display = 'block';
    }, 300);
}

function createSearchResultItem(user) {
    const isP = pendingRequests.has(user.id), isA = acceptedChats.has(user.id);
    let btn = isA ? '<span class="request-badge">Added</span>' : isP ? '<span class="request-badge">Request Sent</span>' : `<button class="accept-btn" onclick="sendChatRequest('${user.id}')">Add</button>`;
    return `<div class="search-result-item"><div class="user-avatar">${(user.name||'U')[0].toUpperCase()}</div><div class="user-info"><div class="user-name">${escapeHtml(user.name||'User')}</div><div class="user-email">${escapeHtml(user.email)}</div></div>${btn}</div>`;
}

async function sendChatRequest(tid) {
    try {
        const ex = await db.collection('chatRequests').where('fromUserId', '==', currentUser.uid).where('toUserId', '==', tid).where('status', '==', 'pending').get();
        if (!ex.empty) return alert('Request already sent');
        await db.collection('chatRequests').add({ fromUserId: currentUser.uid, fromUserName: currentUser.displayName || currentUser.email.split('@')[0], toUserId: tid, status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('search-results').style.display = 'none'; document.getElementById('search-input').value = ''; alert('Request sent!');
    } catch (e) { alert('Failed to send request'); }
}

async function acceptChatRequest(rid, fuid) {
    try { await db.collection('chatRequests').doc(rid).update({ status: 'accepted' }); await db.collection('acceptedChats').add({ userId1: currentUser.uid, userId2: fuid, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); } catch (e) {}
}
async function rejectChatRequest(rid) { try { await db.collection('chatRequests').doc(rid).update({ status: 'rejected' }); } catch (e) {} }

// ==================== RENDERING LISTS ====================
function renderChatList() {
    const c = document.getElementById('chats-container'); c.innerHTML = '';
    const sorted = Array.from(chatListData.entries()).filter(([uid]) => acceptedChats.has(uid)).sort((a, b) => {
        const ta = a[1].lastMessageTime ? a[1].lastMessageTime.toDate() : new Date(0);
        const tb = b[1].lastMessageTime ? b[1].lastMessageTime.toDate() : new Date(0);
        return tb - ta;
    });
    if (sorted.length === 0) return c.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No chats yet. Search for users!</div>';
    sorted.forEach(([uid, d]) => { if (d.userData) c.appendChild(createChatListItem(uid, d)); });
}

function renderRequestsList() {
    const c = document.getElementById('requests-container'); c.innerHTML = '';
    if (pendingRequests.size === 0) return c.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No pending requests</div>';
    pendingRequests.forEach((r, uid) => { if (r.fromUserData) c.appendChild(createRequestItem(uid, r)); });
}

function createRequestItem(uid, r) {
    const div = document.createElement('div'); div.className = 'request-item';
    const name = r.fromUserData.name || r.fromUserData.email?.split('@')[0] || 'User';
    div.innerHTML = `<div class="user-avatar">${name[0].toUpperCase()}</div><div class="request-info"><div class="request-name">${escapeHtml(name)}</div><div class="request-email">${escapeHtml(r.fromUserData.email||'')}</div></div><div class="request-actions"><button class="accept-btn" onclick="acceptChatRequest('${r.requestId}','${uid}')">Accept</button><button class="reject-btn" onclick="rejectChatRequest('${r.requestId}')">Reject</button></div>`;
    return div;
}

function createChatListItem(uid, d) {
    const div = document.createElement('div'); div.className = `user-item ${d.unreadCount>0?'unread':''}`;
    div.onclick = () => openChat(uid, d.userData);
    const name = d.userData.name || d.userData.email?.split('@')[0] || 'User';
    let ts = '';
    if (d.lastMessageTime) {
        const date = d.lastMessageTime.toDate(), diff = new Date() - date;
        ts = diff < 86400000 ? date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : date.toLocaleDateString([], {month:'short',day:'numeric'});
    }
    let lp = d.lastMessage ? (d.lastMessage.text || (d.lastMessage.imageUrl ? '📷 Image' : (d.lastMessage.audioUrl ? '🎤 Voice Note' : ''))) : '';
    if (lp.length > 30) lp = lp.substring(0,27)+'...';
    div.innerHTML = `<div class="user-avatar">${name[0].toUpperCase()}</div><div class="user-info"><div class="user-name-row"><div class="user-name">${escapeHtml(name)}</div><div class="user-time">${ts}</div></div><div class="user-last-message"><div class="last-message-text">${escapeHtml(lp)}</div>${d.unreadCount>0?`<div class="unread-badge">${d.unreadCount}</div>`:''}</div></div>`;
    return div;
}

// ==================== CHAT ROOM ====================
function openChat(uid, ud) {
    selectedUserId = uid; selectedUserData = ud;
    document.getElementById('users-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('chat-search-bar').style.display = 'none';
    
    const name = ud.name || ud.email?.split('@')[0] || 'User';
    document.getElementById('chat-header-name').textContent = name;
    document.getElementById('chat-info-title').textContent = name;
    
    cleanupChatListeners();
    document.getElementById('chat-error-banner').style.display = 'none';
    cancelEdit(); cancelReply();
    
    allMessagesMap.clear(); oldestSentTs = null; oldestRecvTs = null; noMoreSent = false; noMoreRecv = false;
    
    markAllMessagesAsRead(uid);
    setupMessagesListener(uid, currentUser.uid);
    setupTypingListener(uid);
    setupPresenceListener(uid);
    updatePresence(true);
    applyKeyboardPadding();
    loadSharedMedia(uid);
}

function cleanupChatListeners() {
    if (messagesListener1) { messagesListener1(); messagesListener1 = null; }
    if (messagesListener2) { messagesListener2(); messagesListener2 = null; }
    if (typingListener) { typingListener(); typingListener = null; }
    if (presenceListener) { presenceListener(); presenceListener = null; }
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
}

function goBackToUsers() {
    cleanupChatListeners();
    if (selectedUserId && currentUser) markAllMessagesAsRead(selectedUserId);
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('chat-info-panel').style.display = 'none';
    document.getElementById('users-screen').style.display = 'flex';
    cancelEdit(); cancelReply();
    resetKeyboardPadding(); updatePresence(true);
}

async function markAllMessagesAsRead(sid) {
    if (!currentUser) return;
    const snap = await db.collection('messages').where('senderId', '==', sid).where('receiverId', '==', currentUser.uid).where('status', 'in', ['sent','delivered']).get();
    const batch = db.batch(); snap.forEach(doc => batch.update(doc.ref, { status: 'read' })); await batch.commit();
    if (chatListData.has(sid)) { const d = chatListData.get(sid); d.unreadCount = 0; chatListData.set(sid, d); renderChatList(); }
}

function cleanupListeners() {
    cleanupChatListeners();
    if (acceptedChatsListener) { acceptedChatsListener(); acceptedChatsListener = null; }
    if (requestsListener) { requestsListener(); requestsListener = null; }
    if (unreadMessagesListener) { unreadMessagesListener(); unreadMessagesListener = null; }
}

// ==================== MESSAGES LISTENER & PAGINATION ====================
function setupMessagesListener(ouid, cuid) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    const sentRef = db.collection('messages').where('senderId', '==', cuid).where('receiverId', '==', ouid).orderBy('timestamp', 'desc').limit(PAGE_SIZE);
    const receivedRef = db.collection('messages').where('senderId', '==', ouid).where('receiverId', '==', cuid).orderBy('timestamp', 'desc').limit(PAGE_SIZE);

    const updateMapAndRender = (snap, isSent) => {
        let hasNew = false;
        snap.docChanges().forEach(change => {
            const msgData = change.doc.data();
            if (change.type === 'removed') allMessagesMap.delete(change.doc.id);
            else { allMessagesMap.set(change.doc.id, { id: change.doc.id, ...msgData }); hasNew = true; }
            
            // Auto-Deliver feature
            if (!isSent && change.type === 'added' && msgData.status === 'sent') {
                change.doc.ref.update({ status: 'delivered' }).catch(()=>{});
            }
        });
        
        if (snap.size > 0) {
            const oldest = snap.docs[snap.docs.length-1].data().timestamp;
            if (isSent) { if(!oldestSentTs || oldest < oldestSentTs) oldestSentTs = oldest; } 
            else { if(!oldestRecvTs || oldest < oldestRecvTs) oldestRecvTs = oldest; }
        }
        
        renderAllMessages(container);
        if (hasNew && !isLoadingOlder) scrollChatToBottomIfNear();
    };

    messagesListener1 = sentRef.onSnapshot(snap => updateMapAndRender(snap, true));
    messagesListener2 = receivedRef.onSnapshot(snap => updateMapAndRender(snap, false));
}

async function loadOlderMessages() {
    if (isLoadingOlder || !selectedUserId || !currentUser) return;
    isLoadingOlder = true;
    const container = document.getElementById('messages-container');
    
    // Save scroll state before loading new elements at the top
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    const btn = document.getElementById('load-older-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    const promises = [];
    if (!noMoreSent && oldestSentTs) promises.push(db.collection('messages').where('senderId', '==', currentUser.uid).where('receiverId', '==', selectedUserId).orderBy('timestamp', 'desc').startAfter(oldestSentTs).limit(PAGE_SIZE).get()); else promises.push(null);
    if (!noMoreRecv && oldestRecvTs) promises.push(db.collection('messages').where('senderId', '==', selectedUserId).where('receiverId', '==', currentUser.uid).orderBy('timestamp', 'desc').startAfter(oldestRecvTs).limit(PAGE_SIZE).get()); else promises.push(null);

    const [sentSnap, recvSnap] = await Promise.all(promises);
    let newSent = 0, newRecv = 0;
    
    if (sentSnap) {
        sentSnap.forEach(doc => { if (!allMessagesMap.has(doc.id)) { allMessagesMap.set(doc.id, { id: doc.id, ...doc.data() }); newSent++; } });
        if (sentSnap.size < PAGE_SIZE) noMoreSent = true; else oldestSentTs = sentSnap.docs[sentSnap.docs.length-1].data().timestamp;
    } else noMoreSent = true;

    if (recvSnap) {
        recvSnap.forEach(doc => { if (!allMessagesMap.has(doc.id)) { allMessagesMap.set(doc.id, { id: doc.id, ...doc.data() }); newRecv++; } });
        if (recvSnap.size < PAGE_SIZE) noMoreRecv = true; else oldestRecvTs = recvSnap.docs[recvSnap.docs.length-1].data().timestamp;
    } else noMoreRecv = true;

    renderAllMessages(container);
    
    // Perfect Scroll Restoration
    container.scrollTop = previousScrollTop + (container.scrollHeight - previousScrollHeight);
    isLoadingOlder = false;
}

// ==================== RENDER MESSAGES ====================
function formatDateLabel(date) {
    const today = new Date().toDateString(), yesterday = new Date(Date.now() - 86400000).toDateString();
    if (date.toDateString() === today) return 'Today';
    if (date.toDateString() === yesterday) return 'Yesterday';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function renderAllMessages(container) {
    const sorted = [...allMessagesMap.values()].sort((a, b) => {
        const ta = a.timestamp ? a.timestamp.toDate().getTime() : Date.now();
        const tb = b.timestamp ? b.timestamp.toDate().getTime() : Date.now();
        return ta - tb;
    });
    
    if (sorted.length === 0) return container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No messages yet. Say hello! 👋</div>';
    
    let html = '';
    if (!(noMoreSent && noMoreRecv)) {
        html += `<div style="text-align:center;padding:12px 8px;"><button id="load-older-btn" class="auth-btn" style="font-size:13px;padding:8px 24px;width:auto;border-radius:20px;background:#2d2d2d;color:#A8C7FA;" onclick="loadOlderMessages()">Load earlier messages</button></div>`;
    }
    
    let lastDate = null;
    sorted.forEach(msg => {
        const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
        const dateKey = date.toDateString();
        if (dateKey !== lastDate) {
            html += `<div class="date-separator" style="text-align:center;margin:16px 0;"><span style="background:#1e1e1e;color:#888;padding:4px 12px;border-radius:12px;font-size:12px;box-shadow:0 1px 2px rgba(0,0,0,0.2);">${formatDateLabel(date)}</span></div>`;
            lastDate = dateKey;
        }
        html += createMessageHTML(msg);
    });
    
    container.innerHTML = html;
}

function createMessageHTML(msg) {
    const isSent = msg.senderId === auth.currentUser?.uid;
    const wrapperClass = `message-wrapper ${isSent ? 'sent' : 'received'}`;
    let content = '';
    
    if (msg.replyTo) {
        content += `<div class="quoted-message-preview"><div class="quoted-sender">${escapeHtml(msg.replyTo.senderName||'User')}</div><div>${escapeHtml((msg.replyTo.text||'📷 Image').substring(0,60))}</div></div>`;
    }
    if (msg.text) content += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
    else if (msg.imageUrl) content += `<img src="${msg.imageUrl}" class="message-image" onclick="event.stopPropagation();showImagePreview('${msg.imageUrl}')" loading="lazy">`;
    else if (msg.audioUrl) {
        const dur = msg.audioDuration || 0, mins = Math.floor(dur / 60), secs = Math.floor(dur % 60);
        const dstr = `${mins}:${secs.toString().padStart(2, '0')}`;
        content += `<div class="voice-note-bubble" onclick="event.stopPropagation();playVoiceNote(this,'${msg.audioUrl}',${dur})"><div class="voice-play-btn"><i class="fas fa-play"></i></div><div class="voice-waveform">${Array(Math.min(Math.max(Math.floor(dur * 2), 8), 30)).fill().map(() => '<span class="bar" style="height:' + (Math.random() * 20 + 6) + 'px;"></span>').join('')}</div><span class="voice-duration">${dstr}</span></div>`;
    }
    
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    let ticks = '';
    if (isSent) {
        const st = msg.status || 'sent';
        ticks = st === 'sent' ? '<span class="message-ticks ticks-sent">✓</span>' : st === 'delivered' ? '<span class="message-ticks ticks-delivered">✓✓</span>' : '<span class="message-ticks ticks-read">✓✓</span>';
    }
    
    const reaction = msg.reaction ? `<span class="message-reaction">${msg.reaction}</span>` : '';
    const edited = msg.edited ? '<span class="edited-label">(edited)</span>' : '';
    
    return `
        <div class="${wrapperClass}" id="msg-${msg.id}" data-msg-id="${msg.id}">
            <div class="message-bubble" data-msg-id="${msg.id}" 
                 oncontextmenu="event.preventDefault();openEmojiTray('${msg.id}','${escapeHtml(msg.text||'')}','${isSent}')"
                 onclick="handleMessageClick(this,event,'${msg.id}')"
                 ontouchstart="handleTouchStart(this,event,'${msg.id}')"
                 ontouchend="handleTouchEnd(this,event,'${msg.id}')">
                ${content}
                <div class="message-footer">${edited}<span class="message-time">${time}</span>${ticks}</div>
                ${reaction}
            </div>
        </div>`;
}

// ==================== MESSAGE INTERACTIONS ====================
function handleMessageClick(bubble, event, msgId) {
    const now = Date.now();
    if (now - (bubble._lastTap || 0) < 350) { addReactionDirect('❤️', msgId); showHeartAnimation(bubble, event); }
    bubble._lastTap = now;
}

function handleTouchStart(bubble, e, msgId) {
    const msg = allMessagesMap.get(msgId);
    longPressTimer = setTimeout(() => openEmojiTray(msgId, msg?.text || '', msg?.senderId === currentUser?.uid ? 'true' : 'false'), 500);
    swipeStartX = e.touches[0].clientX; swipeStartY = e.touches[0].clientY; swipeTargetMsgId = msgId;
}

function handleTouchEnd(bubble, e, msgId) {
    clearTimeout(longPressTimer);
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - swipeStartX, dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2 && dx > 0 && swipeTargetMsgId === msgId) setupReply(allMessagesMap.get(msgId));
    swipeTargetMsgId = null;
}

function showHeartAnimation(bubble, event) {
    const heart = document.createElement('span'); heart.className = 'heart-animation'; heart.textContent = '❤️';
    const rect = bubble.getBoundingClientRect(); heart.style.left = (event.clientX - rect.left - 14) + 'px'; heart.style.top = (event.clientY - rect.top - 14) + 'px';
    bubble.style.position = 'relative'; bubble.appendChild(heart);
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
function addReaction(emoji) { if (!selectedMessageData.id) return; addReactionDirect(emoji, selectedMessageData.id); closeEmojiTray(); }
async function addReactionDirect(emoji, mid) { if (!currentUser || !mid) return; try { await db.collection('messages').doc(mid).update({ reaction: emoji }); } catch (e) {} }

function handleEditFromTray() {
    if (!selectedMessageData.id || !selectedMessageData.text || !selectedMessageData.isOwner) { closeEmojiTray(); return; }
    isEditing = true; closeEmojiTray(); document.getElementById('editing-banner').style.display = 'flex';
    const input = document.getElementById('chat-input'); input.value = selectedMessageData.text; input.focus();
    autoExpandTextarea(); document.getElementById('send-btn').innerHTML = '<i class="fas fa-check"></i>';
}
function handleDeleteFromTray() {
    if (!selectedMessageData.id || !selectedMessageData.isOwner) { closeEmojiTray(); return; }
    const mid = selectedMessageData.id; closeEmojiTray();
    if (confirm('Unsend this message?')) { db.collection('messages').doc(mid).delete().then(() => db.collection('reactions').doc(mid).delete().catch(()=>{})).catch(e => alert('Failed to unsend.')); }
}
function cancelEdit() {
    isEditing = false; selectedMessageData = { id: null, text: null, isOwner: false };
    document.getElementById('editing-banner').style.display = 'none'; document.getElementById('chat-input').value = '';
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-paper-plane"></i>'; autoExpandTextarea();
}

function setupReply(msg) {
    replyingTo = { id: msg.id, text: msg.text || (msg.imageUrl ? '📷 Image' : '🎤 Voice Note'), senderName: msg.senderId === currentUser?.uid ? 'You' : (selectedUserData?.name || 'User') };
    document.getElementById('reply-preview').style.display = 'flex'; document.getElementById('reply-preview-name').textContent = replyingTo.senderName;
    document.getElementById('reply-preview-text').textContent = replyingTo.text.substring(0, 80); document.getElementById('chat-input').focus();
}
function cancelReply() { replyingTo = null; document.getElementById('reply-preview').style.display = 'none'; }

// ==================== SEND MESSAGE ====================
async function sendMessage() {
    const input = document.getElementById('chat-input'), text = input.value.trim();
    if (!text && !selectedImage && !isEditing) return;
    if (!selectedUserId || !auth.currentUser) return;
    const sendBtn = document.getElementById('send-btn'); sendBtn.disabled = true;
    
    try {
        if (isEditing) {
            await db.collection('messages').doc(selectedMessageData.id).update({ text, edited: true }); cancelEdit();
        } else {
            const md = { senderId: auth.currentUser.uid, receiverId: selectedUserId, participants: [auth.currentUser.uid, selectedUserId], timestamp: firebase.firestore.FieldValue.serverTimestamp(), status: 'sent' };
            if (replyingTo) { md.replyTo = { messageId: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName }; cancelReply(); }
            if (selectedImage) md.imageUrl = selectedImage; else md.text = text;
            
            await db.collection('messages').add(md);
            if (!selectedImage) { input.value = ''; autoExpandTextarea(); } else selectedImage = null;
        }
        scrollChatToBottom();
    } catch (e) {
        if (e.code === 'resource-exhausted') alert('⚠️ Daily message limit reached!'); else alert('Failed to send.');
    } finally { sendBtn.disabled = false; autoExpandTextarea(); }
}

function autoExpandTextarea() {
    const ta = document.getElementById('chat-input'); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
    const mb = document.getElementById('mic-btn'), sb = document.getElementById('send-btn');
    const ht = ta.value.trim().length > 0 || selectedImage;
    mb.style.display = ht ? 'none' : 'inline-flex'; sb.style.display = ht ? 'flex' : 'none';
}

// ==================== TYPING INDICATOR ====================
function handleTyping(event) {
    if (!selectedUserId || !auth.currentUser) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); return; }
    autoExpandTextarea();
    
    const now = Date.now();
    if (now - lastTypingWrite > TYPING_THROTTLE_MS && !typingWritePending) {
        typingWritePending = true; lastTypingWrite = now;
        db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).set({ isTyping: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() }).then(() => typingWritePending = false).catch(() => typingWritePending = false);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { db.collection('typing').doc(`${auth.currentUser.uid}_${selectedUserId}`).delete().catch(()=>{}); typingTimeout = null; }, 8000);
    }
}

function setupTypingListener(ouid) {
    if (!auth.currentUser) return;
    if (typingListener) typingListener();
    typingListener = db.collection('typing').doc(`${ouid}_${auth.currentUser.uid}`).onSnapshot(doc => {
        let ti = document.getElementById('typing-indicator');
        if (doc.exists && doc.data().isTyping) {
            if (!ti) {
                ti = document.createElement('div'); ti.id = 'typing-indicator'; ti.className = 'message-wrapper received';
                ti.innerHTML = '<div class="typing-indicator-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
                document.getElementById('messages-container').appendChild(ti); scrollChatToBottom();
            }
        } else { if (ti) ti.remove(); }
    });
}

// ==================== IMAGE & ZOOM ====================
function selectImage() { document.getElementById('image-input').click(); }
async function handleImageSelect(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image');
    if (file.size > 5 * 1024 * 1024) return alert('Image must be less than 5MB');
    
    const sb = document.getElementById('send-btn'); sb.disabled = true;
    try {
        const fd = new FormData(); fd.append('image', file);
        const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
        const result = await resp.json();
        if (result.success) { selectedImage = result.data.url; await sendMessage(); } else alert('Image upload failed');
    } catch (e) { alert('Upload failed.'); } finally { sb.disabled = false; event.target.value = ''; }
}

function showImagePreview(url) {
    document.getElementById('preview-image').src = url; document.getElementById('image-preview').style.display = 'flex';
    zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0; applyZoomTransform(); setupPinchZoom();
}
function closeImagePreview() { document.getElementById('image-preview').style.display = 'none'; zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0; applyZoomTransform(); }
function applyZoomTransform() { document.getElementById('preview-image').style.transform = `translate(${zoomTranslateX}px,${zoomTranslateY}px) scale(${zoomScale})`; }

function setupPinchZoom() {
    const container = document.getElementById('preview-image-container') || document.getElementById('image-preview');
    const img = document.getElementById('preview-image');
    let isDragging = false, dragStartX = 0, dragStartY = 0, startTX = 0, startTY = 0;
    container.ontouchstart = function(e) {
        if (e.touches.length === 2) { initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); initialScale = zoomScale; initialTranslateX = zoomTranslateX; initialTranslateY = zoomTranslateY; isDragging = false; }
        else if (e.touches.length === 1 && zoomScale > 1) { isDragging = true; dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY; startTX = zoomTranslateX; startTY = zoomTranslateY; }
    };
    container.ontouchmove = function(e) {
        if (e.touches.length === 2) { e.preventDefault(); const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomScale = Math.min(Math.max(initialScale * (dist / initialPinchDistance), 1), 5); zoomTranslateX = initialTranslateX; zoomTranslateY = initialTranslateY; applyZoomTransform(); }
        else if (e.touches.length === 1 && isDragging) { zoomTranslateX = startTX + (e.touches[0].clientX - dragStartX); zoomTranslateY = startTY + (e.touches[0].clientY - dragStartY); applyZoomTransform(); }
    };
    container.ontouchend = function(e) { if (e.touches.length === 0) { isDragging = false; if (zoomScale < 1) { zoomScale = 1; zoomTranslateX = 0; zoomTranslateY = 0; applyZoomTransform(); } } };
    document.getElementById('image-preview').addEventListener('click', function(e) { if (e.target === img && zoomScale <= 1.05) closeImagePreview(); });
}

// ==================== VOICE NOTES ====================
async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert('Voice recording not supported.');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' }); audioChunks = [];
        mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) audioChunks.push(e.data); });
        mediaRecorder.addEventListener('stop', uploadVoiceNote); mediaRecorder.start(); recordingStartTime = Date.now();
        document.getElementById('mic-btn').classList.add('recording'); document.getElementById('recording-timer').style.display = 'inline';
        recordingTimerInterval = setInterval(() => { const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000); document.getElementById('recording-timer').textContent = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`; }, 200);
    } catch (e) { alert('Please allow microphone access.'); }
}
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop());
        document.getElementById('mic-btn').classList.remove('recording'); document.getElementById('recording-timer').style.display = 'none';
        if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    }
}
async function uploadVoiceNote() {
    if (audioChunks.length === 0) return;
    const blob = new Blob(audioChunks, { type: 'audio/webm' }), dur = Math.floor((Date.now() - recordingStartTime) / 1000);
    if (dur < 1) return;
    const mid = db.collection('messages').doc().id, sref = storage.ref(`voice_notes/${mid}.webm`);
    try {
        const snap = await sref.put(blob), url = await snap.ref.getDownloadURL();
        const md = { senderId: auth.currentUser.uid, receiverId: selectedUserId, participants: [auth.currentUser.uid, selectedUserId], timestamp: firebase.firestore.FieldValue.serverTimestamp(), status: 'sent', audioUrl: url, audioDuration: dur };
        if (replyingTo) { md.replyTo = { messageId: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName }; cancelReply(); }
        await db.collection('messages').doc(mid).set(md); scrollChatToBottom();
    } catch (e) { alert('Failed to send voice note.'); }
    audioChunks = [];
}
function playVoiceNote(element, url) {
    const pb = element.querySelector('.voice-play-btn i');
    document.querySelectorAll('.voice-play-btn i').forEach(b => { if (b !== pb && b.classList.contains('fa-pause')) { b.classList.replace('fa-pause', 'fa-play'); } });
    const ea = document.querySelector('.voice-note-audio-active');
    if (ea && ea.parentElement === element) { ea.pause(); ea.remove(); pb.classList.replace('fa-pause', 'fa-play'); return; }
    if (ea) { ea.pause(); ea.remove(); }
    const audio = new Audio(url); audio.className = 'voice-note-audio-active'; element.appendChild(audio);
    pb.classList.replace('fa-play', 'fa-pause'); audio.play();
    audio.addEventListener('ended', () => { pb.classList.replace('fa-pause', 'fa-play'); audio.remove(); });
    audio.addEventListener('error', () => { pb.classList.replace('fa-pause', 'fa-play'); audio.remove(); alert('Failed to play.'); });
}

// ==================== PRESENCE ====================
async function updatePresence(online) {
    if (!currentUser) return;
    const now = Date.now(); if (now - lastPresenceWrite < PRESENCE_THROTTLE_MS && online) return;
    lastPresenceWrite = now;
    await db.collection('presence').doc(currentUser.uid).set({ online, lastActive: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
                se.className = 'chat-header-status'; const la = d.lastActive ? d.lastActive.toDate() : null;
                if (la) {
                    const diff = Date.now() - la.getTime();
                    if (diff < 60000) se.textContent = 'Last seen just now';
                    else if (diff < 3600000) se.textContent = `Last seen ${Math.floor(diff / 60000)} min ago`;
                    else if (diff < 86400000) se.textContent = `Last seen at ${la.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    else se.textContent = `Last seen ${la.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
                } else se.textContent = 'Offline';
            }
        } else { se.textContent = 'Offline'; se.className = 'chat-header-status'; }
    });
}
function setupPresenceEventHandlers() {
    document.addEventListener('visibilitychange', () => { if (currentUser) updatePresence(document.visibilityState === 'visible'); });
    window.addEventListener('beforeunload', () => { if (currentUser) updatePresence(false); });
}

// ==================== ONESIGNAL ====================
function setupOneSignalUser(uid) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
        try {
            if (!window._oneSignalInitialized) { await OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } }); window._oneSignalInitialized = true; }
            OneSignal.User.PushSubscription.addEventListener("change", async (event) => { const subId = event.current.id; if (subId) await db.collection('users').doc(uid).update({ oneSignalSubId: subId }).catch(()=>{}); });
            if (await OneSignal.Notifications.requestPermission()) {
                await OneSignal.login(uid); const subId = OneSignal.User.PushSubscription.id;
                if (subId) await db.collection('users').doc(uid).update({ oneSignalSubId: subId }).catch(()=>{});
            }
        } catch (e) {}
    });
}
async function sendDisguisedNotification() {
    if (!selectedUserId || !currentUser) return alert('Open a chat first.');
    const bb = document.getElementById('bell-btn'); bb.style.opacity = '0.5';
    try {
        const td = await db.collection('users').doc(selectedUserId).get(), tdata = td.data();
        const body = JSON.stringify({ app_id: ONESIGNAL_APP_ID, ...(tdata?.oneSignalSubId ? { include_subscription_ids: [tdata.oneSignalSubId] } : { include_aliases: { external_id: [selectedUserId] }, target_channel: 'push' }), headings: { en: 'Calculator Update' }, contents: { en: 'Use Calculator app for perfect calculations' }, data: { type: 'disguised_calculator' } });
        const resp = await fetch('https://corsproxy.io/?url=' + encodeURIComponent('https://onesignal.com/api/v1/notifications'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` }, body });
        const result = await resp.json();
        if (result.id && result.recipients > 0) { bb.style.color = '#4CAF50'; setTimeout(() => { bb.style.color = '#A8C7FA'; bb.style.opacity = '1'; }, 1500); } 
        else { alert(result.recipients === 0 ? '0 recipients' : 'Failed'); bb.style.opacity = '1'; }
    } catch (e) { alert('Failed.'); bb.style.opacity = '1'; }
}

// ==================== CHAT INFO PANEL ====================
function openChatInfoPanel() { if (!selectedUserId) return; document.getElementById('chat-info-panel').style.display = 'flex'; switchInfoTab('media'); loadSharedMedia(selectedUserId); }
function closeChatInfoPanel() { document.getElementById('chat-info-panel').style.display = 'none'; }
function switchInfoTab(tab) {
    document.querySelectorAll('.chat-info-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.chat-info-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.chat-info-tab[onclick="switchInfoTab('${tab}')"]`).classList.add('active'); document.getElementById(`info-${tab}`).classList.add('active');
}
function loadSharedMedia(ouid) {
    const images = [], links = [], docs = [];
    allMessagesMap.forEach(msg => {
        if (msg.imageUrl) images.push(msg.imageUrl);
        if (msg.text) { const found = msg.text.match(/(https?:\/\/[^\s]+)/g); if (found) found.forEach(u => links.push({ url: u, text: msg.text })); }
        if (msg.audioUrl) docs.push({ url: msg.audioUrl, name: 'Voice Note' });
    });
    document.getElementById('media-grid').innerHTML = images.length ? images.reverse().map(url => `<img src="${url}" onclick="showImagePreview('${url}')" loading="lazy">`).join('') : ''; document.getElementById('no-media-msg').style.display = images.length ? 'none' : 'block';
    document.getElementById('links-list').innerHTML = links.length ? links.reverse().map(l => `<div class="link-item" onclick="window.open('${l.url}','_blank')"><div class="link-title">${escapeHtml(l.text.substring(0, 60))}</div><div class="link-url">${escapeHtml(l.url)}</div></div>`).join('') : ''; document.getElementById('no-links-msg').style.display = links.length ? 'none' : 'block';
    document.getElementById('docs-list').innerHTML = docs.length ? docs.reverse().map(d => `<div class="link-item" onclick="window.open('${d.url}','_blank')"><div class="link-title">🎤 ${escapeHtml(d.name)}</div><div class="link-url">Tap to open</div></div>`).join('') : ''; document.getElementById('no-docs-msg').style.display = docs.length ? 'none' : 'block';
}

// ==================== CHAT SEARCH ====================
function toggleChatSearch() {
    const sb = document.getElementById('chat-search-bar');
    if (sb.style.display === 'flex') { sb.style.display = 'none'; document.getElementById('chat-search-input').value = ''; document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight')); }
    else { sb.style.display = 'flex'; document.getElementById('chat-search-input').focus(); document.getElementById('search-nav').style.display = 'none'; chatSearchResults = []; chatSearchIndex = 0; }
}
function searchInChat() {
    const q = document.getElementById('chat-search-input').value.trim().toLowerCase();
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    if (q.length < 2) { document.getElementById('search-nav').style.display = 'none'; return; }
    chatSearchResults = [...allMessagesMap.values()].filter(m => m.text?.toLowerCase().includes(q)).sort((a,b)=>b.timestamp-a.timestamp); // newest first
    if (chatSearchResults.length > 0) { document.getElementById('search-nav').style.display = 'flex'; chatSearchIndex = 0; scrollToSearchResult(0); }
    else { document.getElementById('search-nav').style.display = 'flex'; document.getElementById('search-count').textContent = '0/0'; }
}
function scrollToSearchResult(index) {
    if (index < 0 || index >= chatSearchResults.length) return;
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    const msgId = chatSearchResults[index].id, bubble = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (bubble) { bubble.classList.add('search-highlight'); bubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    document.getElementById('search-count').textContent = `${index + 1}/${chatSearchResults.length}`;
}
function navigateSearch(dir) { if (chatSearchResults.length === 0) return; chatSearchIndex = (chatSearchIndex + dir + chatSearchResults.length) % chatSearchResults.length; scrollToSearchResult(chatSearchIndex); }

// ==================== GIF PICKER ====================
function openGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'flex'; document.getElementById('gif-search-input').value = ''; document.getElementById('gif-grid').innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>'; document.getElementById('gif-search-input').focus(); }
function closeGifPicker() { document.getElementById('gif-picker-overlay').style.display = 'none'; }
async function searchGifs() {
    const q = document.getElementById('gif-search-input').value.trim(), grid = document.getElementById('gif-grid');
    if (q.length < 2) return grid.innerHTML = '<div class="gif-placeholder">Search for GIFs above</div>';
    grid.innerHTML = '<div class="loading-spinner"></div>';
    try {
        const resp = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`);
        const data = await resp.json();
        grid.innerHTML = data.data?.length ? data.data.map(g => `<img src="${g.images.fixed_height_downsampled.url}" onclick="sendGif('${g.images.fixed_height.url}')" loading="lazy">`).join('') : '<div class="gif-placeholder">No GIFs found.</div>';
    } catch (e) { grid.innerHTML = '<div class="gif-placeholder">Failed to load GIFs.</div>'; }
}
async function sendGif(url) { selectedImage = url; closeGifPicker(); await sendMessage(); }

// ==================== KEYBOARD & SCROLLING ====================
function applyKeyboardPadding() { if (!window.visualViewport) return; const cs = document.getElementById('chat-screen'); if (cs.style.display !== 'flex') return; const kh = window.innerHeight - window.visualViewport.height; cs.style.paddingBottom = kh > 100 ? kh + 'px' : '0px'; if (kh > 100) scrollChatToBottom(); }
function resetKeyboardPadding() { document.getElementById('chat-screen').style.paddingBottom = '0px'; }
function setupViewportHandler() { if (window.visualViewport) { window.visualViewport.addEventListener('resize', applyKeyboardPadding); window.visualViewport.addEventListener('scroll', applyKeyboardPadding); } }
function scrollChatToBottom() { const c = document.getElementById('messages-container'); c.scrollTop = c.scrollHeight; }
function scrollChatToBottomIfNear() { const c = document.getElementById('messages-container'); if (c.scrollHeight - c.scrollTop - c.clientHeight < 150) scrollChatToBottom(); }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ==================== AUTH STATE & INIT ====================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user; setupOneSignalUser(user.uid);
        db.collection('users').doc(user.uid).get().then(doc => { if (!doc.exists) db.collection('users').doc(user.uid).set({ name: user.displayName || user.email.split('@')[0], email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); });
        if (document.getElementById('auth-screen').style.display === 'block') showUsersList();
    } else {
        if (currentUser) updatePresence(false);
        currentUser = null; cleanupListeners(); chatListData.clear(); acceptedChats.clear(); pendingRequests.clear(); returnToCalculator();
    }
});

updateDisplay();
returnToCalculator();
setupPanicDetection();
setupViewportHandler();
setupPresenceEventHandlers();
document.getElementById('chat-input').addEventListener('focus', () => { setTimeout(() => { document.getElementById('chat-input').scrollIntoView({ behavior: 'smooth', block: 'end' }); applyKeyboardPadding(); }, 300); });
autoExpandTextarea();
