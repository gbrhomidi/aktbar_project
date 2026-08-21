/**
 * المنصة التعليمية الذكية - مدير الصوتيات المتكامل
 */
window.AudioManager = window.AudioManager || {};

(function(global) {
    'use strict';

    const AudioManager = {
        enabled: true,
        initCalled: false,
        isMuted: false,
        audioElements: {},
        audioContext: null,
        speechSynthesis: null,
        speaking: false,
        speechQueue: [],
        tickInterval: null,
        settings: {
            masterVolume: 1.0,
            effectsVolume: 0.8,
            speechVolume: 1.0,
            tickVolume: 0.15,
            duckLevel: 0.25,
            duckEnabled: true
        },

        soundList: [
            { name: 'correct', file: 'correct.mp3', volume: 0.8, category: 'feedback' },
            { name: 'wrong', file: 'wrong.mp3', volume: 0.8, category: 'feedback' },
            { name: 'timer-3', file: 'timer-3.mp3', volume: 0.7, category: 'warning' },
            { name: 'star', file: 'star.mp3', volume: 0.7, category: 'reward' },
            { name: 'challenge_start', file: 'challenge_start.mp3', volume: 0.8, category: 'event' },
            { name: 'round_complete', file: 'round_complete.mp3', volume: 0.9, category: 'event' },
            { name: 'game-over', file: 'game-over.mp3', volume: 0.9, category: 'event' },
            { name: 'tick', file: 'tick.mp3', volume: 0.6, category: 'timer' },
            { name: 'achievement', file: 'achievement.mp3', volume: 0.9, category: 'reward' },
            { name: 'button_click', file: 'button_click.mp3', volume: 0.5, category: 'ui' },
            { name: 'startup', file: 'startup.mp3', volume: 1.0, category: 'event' }
        ],

        init() {
            if (this.initCalled) return;
            this.initCalled = true;
            console.log('🎵 تهيئة مدير الصوتيات...');
            this.speechSynthesis = window.speechSynthesis;
            try {
                if (typeof Settings !== 'undefined' && Settings.data) {
                    this.isMuted = Settings.data.muteSound || false;
                }
            } catch (e) {
                this.isMuted = false;
            }
            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                if (window.AudioContext) {
                    this.audioContext = new AudioContext();
                }
            } catch (e) {
                console.warn('⚠️ AudioContext غير متاح');
            }
            this.loadAllSounds();
            this.setupAutoUnlock();
            setTimeout(() => {
                if (!this.isMuted) {
                    this.playStartup();
                }
            }, 200);
            console.log('✅ مدير الصوتيات جاهز');
        },

        loadAllSounds() {
            this.soundList.forEach(sound => {
                try {
                    const audio = new Audio();
                    audio.src = 'assets/sounds/' + sound.file;
                    audio.preload = 'auto';
                    audio.volume = sound.volume * this.settings.effectsVolume;
                    audio.muted = this.isMuted;
                    audio.onerror = () => {
                        console.warn(`⚠️ صوت غير متاح: ${sound.file}`);
                        this.audioElements[sound.name] = null;
                    };
                    this.audioElements[sound.name] = {
                        element: audio,
                        volume: sound.volume,
                        category: sound.category,
                        loaded: false
                    };
                    audio.addEventListener('canplaythrough', () => {
                        if (this.audioElements[sound.name]) {
                            this.audioElements[sound.name].loaded = true;
                        }
                    }, { once: true });
                } catch (e) {
                    console.warn(`⚠️ خطأ في تحميل الصوت ${sound.file}:`, e);
                    this.audioElements[sound.name] = null;
                }
            });
        },

        setupAutoUnlock() {
            const unlockAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('✅ AudioContext تم استئنافه');
                    });
                }
                Object.values(this.audioElements).forEach(item => {
                    if (item && item.element) {
                        const audio = item.element;
                        audio.play().then(() => {
                            audio.pause();
                            audio.currentTime = 0;
                        }).catch(() => {});
                    }
                });
                document.body.removeEventListener('click', unlockAudio);
                document.body.removeEventListener('touchstart', unlockAudio);
                document.body.removeEventListener('keydown', unlockAudio);
            };
            document.body.addEventListener('click', unlockAudio, { once: true });
            document.body.addEventListener('touchstart', unlockAudio, { once: true });
            document.body.addEventListener('keydown', unlockAudio, { once: true });
        },

        play(name, customVolume = null) {
            if (this.isMuted) return Promise.resolve();
            const soundItem = this.audioElements[name];
            if (!soundItem || !soundItem.element) {
                if (name === 'tick') {
                    this.playSyntheticTick();
                    return Promise.resolve();
                }
                return Promise.resolve();
            }
            const audio = soundItem.element;
            try {
                audio.pause();
                audio.currentTime = 0;
                let volume = customVolume !== null ? customVolume : soundItem.volume;
                volume *= this.settings.effectsVolume;
                if (this.settings.duckEnabled && this.speaking && soundItem.category !== 'ui') {
                    volume *= this.settings.duckLevel;
                }
                audio.volume = Math.min(1, volume);
                audio.muted = this.isMuted;
                return audio.play().catch((e) => {
                    if (e.name !== 'NotAllowedError') {
                        console.warn(`⚠️ خطأ في تشغيل ${name}:`, e.message);
                    }
                    return Promise.resolve();
                });
            } catch (e) {
                console.warn(`⚠️ خطأ في تشغيل ${name}:`, e);
                return Promise.resolve();
            }
        },

        playStartup() {
            console.log('🎬 تشغيل صوت البداية...');
            return this.play('startup', 1.0);
        },

        playSyntheticTick() {
            if (this.isMuted || !this.audioContext) return;
            try {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                const now = this.audioContext.currentTime;
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, now);
                oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.04);
                let tickVolume = this.settings.tickVolume;
                if (this.settings.duckEnabled && this.speaking) {
                    tickVolume *= this.settings.duckLevel;
                }
                gainNode.gain.setValueAtTime(tickVolume, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                oscillator.onended = () => {
                    oscillator.disconnect();
                    gainNode.disconnect();
                };
            } catch (e) {}
        },

        playAchievement() {
            this.play('achievement', 1.0);
        },

        playButtonClick() {
            this.play('button_click', 0.4);
        },

        startTick() {
            if (this.isMuted) return;
            this.stopTick();
            this.play('tick');
            this.tickInterval = setInterval(() => {
                if (!this.isMuted) {
                    this.play('tick');
                }
            }, 1000);
            console.log('⏱️ بدء التكة المستمرة');
        },

        stopTick() {
            if (this.tickInterval) {
                clearInterval(this.tickInterval);
                this.tickInterval = null;
            }
        },

        async waitForVoices() {
            return new Promise(resolve => {
                let voices = this.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    return resolve(voices);
                }
                this.speechSynthesis.onvoiceschanged = () => {
                    resolve(this.speechSynthesis.getVoices());
                };
                setTimeout(() => {
                    resolve(this.speechSynthesis.getVoices());
                }, 3000);
            });
        },

        async speakText(text, lang = null, rate = 0.95) {
            if (this.isMuted || !this.speechSynthesis || !text) {
                return Promise.resolve();
            }
            try {
                const voices = await this.waitForVoices();
                if (!lang) {
                    lang = this.detectLanguage(text);
                }
                let selectedVoice = null;
                if (lang === 'ar') {
                    selectedVoice = voices.find(v =>
                        v.lang.includes('ar') ||
                        v.lang.includes('ar-SA') ||
                        v.lang.includes('ar-EG')
                    );
                    if (!selectedVoice) {
                        selectedVoice = voices.find(v => v.lang.toLowerCase().includes('ar'));
                    }
                } else {
                    selectedVoice = voices.find(v =>
                        v.lang.includes('en-US') ||
                        v.lang.includes('en-GB')
                    );
                }
                if (!selectedVoice) {
                    selectedVoice = voices[0];
                }
                this.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice?.lang || (lang === 'ar' ? 'ar-SA' : 'en-US');
                utterance.rate = rate;
                utterance.pitch = 1.0;
                utterance.volume = this.settings.speechVolume;
                this.speaking = true;
                this.speechSynthesis.speak(utterance);
                return new Promise(resolve => {
                    utterance.onend = () => {
                        this.speaking = false;
                        this.processSpeechQueue();
                        resolve();
                    };
                    utterance.onerror = (e) => {
                        console.warn('⚠️ خطأ في النطق:', e.error);
                        this.speaking = false;
                        this.processSpeechQueue();
                        resolve();
                    };
                    const timeout = Math.max(10000, text.length * 100);
                    setTimeout(() => {
                        if (this.speaking) {
                            this.speechSynthesis.cancel();
                            this.speaking = false;
                            this.processSpeechQueue();
                            resolve();
                        }
                    }, timeout);
                });
            } catch (e) {
                console.warn('⚠️ خطأ في النطق الصوتي:', e);
                this.speaking = false;
                return Promise.resolve();
            }
        },

        detectLanguage(text) {
            if (!text) return 'ar';
            const arabicPattern = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
            if (arabicPattern.test(text)) {
                return 'ar';
            }
            return 'en';
        },

        queueSpeech(text, lang = null) {
            this.speechQueue.push({ text, lang });
            if (!this.speaking) {
                this.processSpeechQueue();
            }
        },

        async processSpeechQueue() {
            if (this.speechQueue.length === 0 || this.speaking) return;
            const item = this.speechQueue.shift();
            await this.speakText(item.text, item.lang);
        },

        stopSpeaking() {
            if (this.speechSynthesis) {
                this.speechSynthesis.cancel();
                this.speaking = false;
                this.speechQueue = [];
            }
        },

        isSpeaking() {
            return this.speaking;
        },

        setMute(mute) {
            this.isMuted = mute;
            Object.values(this.audioElements).forEach(item => {
                if (item && item.element) {
                    item.element.muted = mute;
                }
            });
            if (mute) {
                this.stopTick();
                this.stopSpeaking();
            }
            console.log(mute ? '🔇 تم كتم الصوت' : '🔊 تم تفعيل الصوت');
        },

        toggleMute() {
            this.setMute(!this.isMuted);
            return this.isMuted;
        },

        setMasterVolume(volume) {
            this.settings.masterVolume = Math.max(0, Math.min(1, volume));
            this.applyVolumeSettings();
        },

        setEffectsVolume(volume) {
            this.settings.effectsVolume = Math.max(0, Math.min(1, volume));
            this.applyVolumeSettings();
        },

        setSpeechVolume(volume) {
            this.settings.speechVolume = Math.max(0, Math.min(1, volume));
        },

        applyVolumeSettings() {
            Object.values(this.audioElements).forEach(item => {
                if (item && item.element) {
                    item.element.volume = item.volume * this.settings.effectsVolume * this.settings.masterVolume;
                }
            });
        },

        setDucking(enabled) {
            this.settings.duckEnabled = enabled;
        },

        stopAll() {
            Object.values(this.audioElements).forEach(item => {
                if (item && item.element) {
                    try {
                        item.element.pause();
                        item.element.currentTime = 0;
                    } catch (e) {}
                }
            });
            this.stopTick();
            this.stopSpeaking();
            if (this.audioContext && this.audioContext.state === 'running') {
                try {
                    this.audioContext.suspend();
                } catch (e) {}
            }
        },

        async resumeContext() {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (e) {}
            }
        },

        dispose() {
            this.stopAll();
            if (this.audioContext) {
                try {
                    this.audioContext.close();
                } catch (e) {}
                this.audioContext = null;
            }
            Object.values(this.audioElements).forEach(item => {
                if (item && item.element) {
                    item.element.src = '';
                    item.element.load();
                }
            });
            this.audioElements = {};
            this.initCalled = false;
        },

        getStatus() {
            return {
                isMuted: this.isMuted,
                speaking: this.speaking,
                tickActive: this.tickInterval !== null,
                audioContextState: this.audioContext ? this.audioContext.state : 'unavailable',
                loadedSounds: Object.entries(this.audioElements)
                    .filter(([_, item]) => item && item.loaded)
                    .map(([name]) => name),
                speechSynthesisAvailable: !!this.speechSynthesis
            };
        },

        isSoundAvailable(name) {
            const item = this.audioElements[name];
            return item && item.element && item.loaded;
        },

        getLoadedSounds() {
            return Object.entries(this.audioElements)
                .filter(([_, item]) => item && item.loaded)
                .map(([name]) => name);
        }
    };

    global.AudioManager = AudioManager;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => AudioManager.init(), 500);
        });
    } else {
        setTimeout(() => AudioManager.init(), 500);
    }

    console.log('🎵 مدير الصوتيات جاهز للتحميل');

})(window);