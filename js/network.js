/**
 * NETWORK.JS - الإصدار المُعالَج والمُحسَّن
 * WebRTC + QR Signaling + Teacher/Student + Permissions + Sync
 *
 * التحسينات المضافة:
 * - Polyfill لـ crypto.randomUUID
 * - typeof guards لـ RTCPeerConnection, QRCode, DB, Settings, ErrorHandler, UI
 * - إكمال جميع catch blocks المفقودة
 * - استبدال localStorage بـ Store API بالكامل
 * - إضافة TURN servers (مجانية احتياطية)
 * - إضافة منطق إعادة اتصال بسيط (reconnection)
 * - معالجة آمنة للأخطاء عبر ErrorHandler
 */

window.Network = (() => {
    'use strict';

    // ========== Polyfill لـ crypto.randomUUID ==========
    if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
        crypto.randomUUID = function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };
    }

    // ========== إعدادات STUN/TURN ==========
    const CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // TURN servers مجانية (للاتصال عبر NAT)
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ],
        iceCandidatePoolSize: 10,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000
    };

    // ========== دوال مساعدة آمنة ==========
    function safeStore() {
        return (typeof Store !== 'undefined' && Store && typeof Store.get === 'function' && typeof Store.set === 'function') ? Store : null;
    }

    function safeUI() {
        return (typeof UI !== 'undefined' && UI && typeof UI.showToast === 'function') ? UI : null;
    }

    function safeErrorHandler() {
        return (typeof ErrorHandler !== 'undefined' && ErrorHandler && typeof ErrorHandler.log === 'function') ? ErrorHandler : null;
    }

    function safeSettings() {
        return (typeof Settings !== 'undefined' && Settings && Settings.data) ? Settings : null;
    }

    function safeDB() {
        return (typeof DB !== 'undefined' && DB && typeof DB.questions !== 'undefined') ? DB : null;
    }

    function safeRTCPeerConnection() {
        return (typeof RTCPeerConnection !== 'undefined') ? RTCPeerConnection : null;
    }

    function safeQRCode() {
        return (typeof QRCode !== 'undefined') ? QRCode : null;
    }

    function getDeviceName() {
        const store = safeStore();
        if (store) {
            return store.get('deviceName', `Device-${Math.floor(Math.random() * 9999)}`);
        }
        // Fallback (في حالة عدم وجود Store)
        try {
            const fallback = localStorage.getItem('deviceName');
            if (fallback) return fallback;
        } catch (e) {}
        return `Device-${Math.floor(Math.random() * 9999)}`;
    }

    function setDeviceName(name) {
        const store = safeStore();
        if (store) {
            store.set('deviceName', name);
        } else {
            try {
                localStorage.setItem('deviceName', name);
            } catch (e) {}
        }
    }

    function generateRoomId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function toast(msg, icon = '🌐') {
        const ui = safeUI();
        if (ui && ui.showToast) {
            ui.showToast(`${icon} ${msg}`);
        } else if (ui && ui.showAlert) {
            ui.showAlert(`${icon} ${msg}`, icon);
        } else {
            console.log(icon, msg);
        }
    }

    function logError(e, context) {
        const errHandler = safeErrorHandler();
        if (errHandler) {
            errHandler.log(e, context);
        } else {
            console.warn(`⚠️ [${context}]`, e);
        }
    }

    // ========== الحالة الداخلية ==========
    const state = {
        mode: null,
        roomId: null,
        deviceName: getDeviceName(),
        peers: new Map(),
        peerConnections: new Map(),
        dataChannels: new Map(),
        pendingOffers: new Map(),
        permissions: {},
        localPeerId: null,
        reconnectionTimer: null,
        connectionAttempts: 0
    };

    // ========== QR Encoding/Decoding ==========
    function encodeQR(data) {
        try {
            return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        } catch (e) {
            logError(e, 'network-encodeQR');
            return JSON.stringify(data);
        }
    }

    function decodeQR(encoded) {
        try {
            if (typeof encoded === 'object') return encoded;
            const str = encoded.trim();
            if (/^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0) {
                try {
                    return JSON.parse(decodeURIComponent(escape(atob(str))));
                } catch (e) {}
            }
            return JSON.parse(str);
        } catch (e) {
            logError(e, 'network-decodeQR');
            return null;
        }
    }

    function renderQR(containerId, data, options = {}) {
        const QR = safeQRCode();
        if (!QR) {
            console.warn('[Network] QRCode library not available');
            return;
        }
        const container = document.getElementById(containerId);
        if (!container) return;
        const { size = 220, colorDark = '#ffd700', colorLight = 'transparent' } = options;
        try {
            container.innerHTML = '';
            new QRCode(container, {
                text: encodeQR(data),
                width: size,
                height: size,
                colorDark,
                colorLight,
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) {
            logError(e, 'network-renderQR');
        }
    }

    // ========== WebRTC Core ==========
    function createPeerConnection(peerId) {
        const RTCPC = safeRTCPeerConnection();
        if (!RTCPC) {
            toast('متصفحك لا يدعم WebRTC', '❌');
            throw new Error('RTCPeerConnection not supported');
        }
        const pc = new RTCPC(CONFIG);

        pc.onconnectionstatechange = () => {
            const status = pc.connectionState;
            if (status === 'disconnected' || status === 'failed' || status === 'closed') {
                logError(new Error(`Connection ${status}`), `peer-${peerId}`);
                removePeer(peerId);
                if (state.mode === 'student' && state.connectionAttempts < CONFIG.reconnectionAttempts) {
                    scheduleReconnection();
                }
            } else if (status === 'connected') {
                state.connectionAttempts = 0;
                if (state.reconnectionTimer) {
                    clearTimeout(state.reconnectionTimer);
                    state.reconnectionTimer = null;
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) return;
            const desc = pc.localDescription;
            if (!desc) return;
            const payload = { type: desc.type, peerId, description: desc };
            try {
                if (desc.type === 'offer') {
                    renderQR('offer-qr-container', payload, { size: 220 });
                    const output = document.getElementById('offer-output');
                    if (output) output.value = JSON.stringify(desc);
                }
                if (desc.type === 'answer') {
                    renderQR('answer-qr-container', payload, { size: 220 });
                    const output = document.getElementById('answer-output');
                    if (output) output.value = JSON.stringify(desc);
                }
            } catch (e) {
                logError(e, 'network-icecandidate');
            }
        };

        state.peerConnections.set(peerId, pc);
        return pc;
    }

    function setupDataChannel(peerId, channel) {
        state.dataChannels.set(peerId, channel);

        channel.onopen = () => {
            toast(`تم اتصال ${peerId}`, '✅');
            try {
                channel.send(JSON.stringify({
                    type: 'handshake',
                    payload: { name: state.deviceName, id: peerId }
                }));
            } catch (e) {
                logError(e, 'network-handshake');
            }
        };

        channel.onclose = () => {
            removePeer(peerId);
        };

        channel.onerror = (e) => {
            logError(e, 'network-channel');
        };

        channel.onmessage = (event) => {
            handleIncomingMessage(peerId, event.data);
        };
    }

    // ========== إدارة الأقران ==========
    function addPeer(peerId, name = 'طالب') {
        if (state.peers.has(peerId)) {
            const existing = state.peers.get(peerId);
            existing.name = name || existing.name;
            state.peers.set(peerId, existing);
        } else {
            state.peers.set(peerId, {
                id: peerId,
                name: name || 'طالب',
                permissions: { canImport: false, canDeleteDB: false, canExport: false }
            });
        }
        renderPeers();
    }

    function updatePeerName(peerId, name) {
        const peer = state.peers.get(peerId);
        if (peer && name) {
            peer.name = name;
            state.peers.set(peerId, peer);
            renderPeers();
        }
    }

    function removePeer(peerId) {
        const pc = state.peerConnections.get(peerId);
        const dc = state.dataChannels.get(peerId);
        try { if (dc) dc.close(); } catch (e) {}
        try { if (pc) pc.close(); } catch (e) {}
        state.peers.delete(peerId);
        state.peerConnections.delete(peerId);
        state.dataChannels.delete(peerId);
        state.pendingOffers.delete(peerId);
        renderPeers();
    }

    function renderPeers() {
        const container = document.getElementById('connected-devices');
        if (!container) return;
        const peers = Array.from(state.peers.values());
        if (!peers.length) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:20px;">لا يوجد أجهزة متصلة</div>`;
            return;
        }
        let html = '';
        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];
            const importStyle = peer.permissions.canImport ? 'background:var(--success); color:#000;' : '';
            const deleteStyle = peer.permissions.canDeleteDB ? 'background:var(--success); color:#000;' : '';
            html += `
                <div class="peer-card" style="background:var(--surface); border-radius:12px; padding:10px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="peer-index" style="color:var(--accent); font-weight:bold;">#${i + 1}</span>
                        <span class="peer-name" style="margin-right:8px;">${escapeHtml(peer.name || 'Unknown')}</span>
                    </div>
                    <div class="peer-actions" style="display:flex; gap:8px;">
                        <button onclick="Network.togglePermission('${peer.id}','canImport')" style="${importStyle} padding:4px 8px; border-radius:8px; border:none; cursor:pointer;">Import</button>
                        <button onclick="Network.togglePermission('${peer.id}','canDeleteDB')" style="${deleteStyle} padding:4px 8px; border-radius:8px; border:none; cursor:pointer;">DeleteDB</button>
                        <button onclick="Network.kickPeer('${peer.id}')" style="background:rgba(255,71,87,0.2); padding:4px 8px; border-radius:8px; border:none; cursor:pointer;">طرد</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========== معالجة الرسائل ==========
    function handleIncomingMessage(peerId, raw) {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            logError(e, 'network-parse');
            return;
        }
        if (!data) return;
        switch (data.type) {
            case 'handshake':
                updatePeerName(peerId, data.payload?.name);
                break;
            case 'join':
                addPeer(peerId, data.name || 'طالب');
                break;
            case 'settings-sync':
                applyRemoteSettings(data.payload);
                break;
            case 'permissions-update':
                window.DevicePermissions = data.payload;
                toast('🔒 تم تحديث الأذونات', '🔒');
                break;
            case 'challenge-start':
                if (typeof Game !== 'undefined' && Game.startRemoteChallenge) {
                    Game.startRemoteChallenge(data.payload);
                } else {
                    toast('نظام اللعبة غير جاهز', '⚠️');
                }
                break;
            case 'kick':
                toast('تم طردك من قبل الأستاذ', '🚫');
                Network.close();
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    function applyRemoteSettings(settings) {
        const store = safeStore();
        if (store) {
            Object.entries(settings).forEach(([key, value]) => store.set(key, value));
        }
        const ui = safeUI();
        if (ui && ui.showToast) ui.showToast('تم مزامنة الإعدادات', '⚙️');
        // تحديث الإعدادات المحلية
        if (typeof Settings !== 'undefined' && Settings.data) {
            Object.assign(Settings.data, settings);
            Settings.save(true);
        }
    }

    // ========== منطق إعادة الاتصال ==========
    function scheduleReconnection() {
        if (state.reconnectionTimer) return;
        if (state.connectionAttempts >= CONFIG.reconnectionAttempts) {
            toast('فشل إعادة الاتصال بعد عدة محاولات', '❌');
            return;
        }
        state.connectionAttempts++;
        toast(`محاولة إعادة الاتصال (${state.connectionAttempts}/${CONFIG.reconnectionAttempts})...`, '🔄');
        state.reconnectionTimer = setTimeout(() => {
            state.reconnectionTimer = null;
            if (state.mode === 'student' && state.roomId) {
                // محاولة إعادة الاتصال كطالب
                Network.initStudentMode(state.roomId).catch(e => logError(e, 'reconnect'));
            }
        }, CONFIG.reconnectionDelay);
    }

    // ========== Offer / Answer ==========
    async function createOffer() {
        const peerId = generateRoomId();
        const pc = createPeerConnection(peerId);
        const dc = pc.createDataChannel('smartlearning', { ordered: true });
        setupDataChannel(peerId, dc);
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            state.pendingOffers.set(peerId, offer);
            return peerId;
        } catch (e) {
            logError(e, 'network-offer');
            toast('فشل إنشاء عرض الاتصال', '❌');
            throw e;
        }
    }

    async function acceptOffer(encodedOffer) {
        if (!encodedOffer || !encodedOffer.trim()) {
            toast('⚠️ يرجى لصق عرض (Offer) أولاً', '⚠️');
            return;
        }
        const payload = decodeQR(encodedOffer);
        if (!payload || payload.type !== 'offer') {
            toast('⚠️ العرض غير صالح أو تالف', '❌');
            return;
        }
        const peerId = payload.peerId || generateRoomId();
        const pc = createPeerConnection(peerId);
        pc.ondatachannel = (event) => {
            setupDataChannel(peerId, event.channel);
        };
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            addPeer(peerId, state.deviceName);
            toast('تم قبول العرض وإنشاء الإجابة', '✅');
            return peerId;
        } catch (e) {
            logError(e, 'network-accept-offer');
            toast('فشل معالجة العرض', '❌');
            throw e;
        }
    }

    async function acceptAnswer(encodedAnswer) {
        if (!encodedAnswer || !encodedAnswer.trim()) {
            toast('⚠️ يرجى لصق إجابة (Answer) أولاً', '⚠️');
            return;
        }
        const payload = decodeQR(encodedAnswer);
        if (!payload || payload.type !== 'answer') {
            toast('⚠️ الإجابة غير صالحة أو تالفة', '❌');
            return;
        }
        const peerId = payload.peerId;
        let pc = state.peerConnections.get(peerId);
        if (!pc) {
            const allPeers = Array.from(state.peerConnections.values());
            pc = allPeers[allPeers.length - 1];
        }
        if (!pc) {
            toast('لا يوجد اتصال معلق', '❌');
            return;
        }
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
            toast('تم الاتصال بنجاح', '🎉');
        } catch (e) {
            logError(e, 'network-accept-answer');
            toast('فشل قبول الإجابة', '❌');
            throw e;
        }
    }

    // ========== الإذن والبث ==========
    function sendPermissions(peerId) {
        const peer = state.peers.get(peerId);
        const dc = state.dataChannels.get(peerId);
        if (!peer || !dc || dc.readyState !== 'open') return;
        try {
            dc.send(JSON.stringify({
                type: 'permissions-update',
                payload: peer.permissions
            }));
        } catch (e) {
            logError(e, 'network-sendPermissions');
        }
    }

    function broadcast(type, payload) {
        const msg = JSON.stringify({ type, payload });
        state.dataChannels.forEach((dc, peerId) => {
            if (dc.readyState === 'open') {
                try {
                    dc.send(msg);
                } catch (e) {
                    logError(e, `network-broadcast-${peerId}`);
                }
            }
        });
    }

    // ========== الواجهة العامة ==========
    const Network = {
        init() {
            console.log('🌐 Unified Network Ready (مع TURN وإعادة اتصال)');
            this.updateDeviceDisplay();
        },

        initTeacherMode() {
            state.mode = 'teacher';
            state.roomId = generateRoomId();
            this.renderRoomInfo();
            this.generateRoomQR();
            toast('تم تشغيل وضع الأستاذ', '👨‍🏫');
            const ui = safeUI();
            if (ui && ui.openModal) ui.openModal('network-modal');
            const modeEl = document.getElementById('network-mode');
            if (modeEl) modeEl.textContent = 'Teacher';
        },

        initStudentMode(roomId = null) {
            state.mode = 'student';
            if (roomId) state.roomId = roomId;
            toast('تم تشغيل وضع الطالب', '👨‍🎓');
            const ui = safeUI();
            if (ui && ui.openModal) ui.openModal('network-join-modal');
        },

        renderRoomInfo() {
            const el = document.getElementById('network-room-id');
            if (el) el.textContent = state.roomId || '---';
        },

        generateRoomQR() {
            renderQR('qr-container', { type: 'room', roomId: state.roomId }, { size: 200 });
        },

        generateSignalQR(data, containerId) {
            renderQR(containerId, data, { size: 220 });
        },

        async createOffer() {
            return await createOffer();
        },

        async acceptOffer(encodedOffer) {
            return await acceptOffer(encodedOffer);
        },

        async acceptAnswer(encodedAnswer) {
            return await acceptAnswer(encodedAnswer);
        },

        broadcastSettings(settings) {
            broadcast('settings-sync', settings);
        },

        pushChallenge(mode, config) {
            broadcast('challenge-start', { mode, config });
        },

        togglePermission(peerId, key) {
            const peer = state.peers.get(peerId);
            if (!peer) return;
            peer.permissions[key] = !peer.permissions[key];
            sendPermissions(peerId);
            renderPeers();
        },

        kickPeer(peerId) {
            const dc = state.dataChannels.get(peerId);
            if (dc && dc.readyState === 'open') {
                try {
                    dc.send(JSON.stringify({ type: 'kick' }));
                } catch (e) {
                    logError(e, 'network-kick');
                }
            }
            removePeer(peerId);
            toast('تم طرد الجهاز', '👋');
        },

        renameDevice(name) {
            if (!name || !name.trim()) return;
            state.deviceName = name.trim();
            setDeviceName(state.deviceName);
            this.updateDeviceDisplay();
        },

        updateDeviceDisplay() {
            const el = document.getElementById('device-name-display');
            if (el) el.textContent = state.deviceName;
            const input = document.getElementById('device-name-input');
            if (input) input.value = state.deviceName;
        },

        getPeers() {
            return Array.from(state.peers.values());
        },

        close() {
            if (state.reconnectionTimer) {
                clearTimeout(state.reconnectionTimer);
                state.reconnectionTimer = null;
            }
            Array.from(state.peers.keys()).forEach(removePeer);
            state.mode = null;
            state.roomId = null;
            state.connectionAttempts = 0;
            toast('تم إغلاق الشبكة', '🔌');
        }
    };

    // تعريض الكائن العام
    window.Network = Network;
    window.DevicePermissions = {};

    // تهيئة تلقائية بعد تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Network.init());
    } else {
        Network.init();
    }

    return Network;
})();