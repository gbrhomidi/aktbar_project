/**
 * المنصة التعليمية الذكية - محرك اللعبة الرئيسي (مُعالَج بالكامل)
 */
window.Game = window.Game || {};

(function(global) {
    'use strict';

    // Helper for translations
    const t = (key, fallback) => {
        if (typeof I18n !== 'undefined' && I18n.t) return I18n.t(key, fallback);
        return fallback || key;
    };

    const Game = {
        state: {
            playing: false, paused: false, canAnswer: true, answered: false,
            mode: 'practice', questionIndex: 0, correct: 0, wrong: 0,
            totalCorrect: 0, totalWrong: 0, score: 0, stars: 0, totalStars: 0,
            timeLeft: 20, timeLimit: 20, questionsPerRound: 10,
            answerTimes: [], roundStartTime: 0, currentQuestion: null,
            timer: null, questions: [], pauseCount: 5, maxWrongAllowed: 0,
            isGameOver: false, totalTestTime: 0, testTimer: null, testTimeLeft: 0,
            userAnswers: [], testSubmitted: false, reviewData: null,
            selectedCategories: [], testPauseCount: 2, challengePauseCount: 2
        },
        elements: {},

        initCordovaEvents() {
            document.addEventListener('deviceready', function() {
                console.log('📱 Cordova device ready');
                if (window.StatusBar) StatusBar.hide();
                if (window.AndroidFullScreen) AndroidFullScreen.immersiveMode();
            }, false);
            document.addEventListener('pause', function() {
                if (Game.state.playing && !Game.state.paused) Game.togglePause();
            }, false);
            document.addEventListener('backbutton', function(e) {
                e.preventDefault();
                if (Game.state.playing) {
                    if (Game.state.mode === 'practice') { if (typeof UI !== 'undefined') UI.endChallenge(); }
                    else if (Game.state.mode === 'test') { if (typeof UI !== 'undefined') UI.endTest(); }
                } else { if (navigator.app) navigator.app.exitApp(); }
            }, false);
        },

        async startMode(mode, prefilteredQuestions) {
            this.resetState();
            this.state.mode = mode;

            let allQuestions = [];

            if (prefilteredQuestions && Array.isArray(prefilteredQuestions) && prefilteredQuestions.length > 0) {
                allQuestions = prefilteredQuestions;
            } else {
                try {
                    if (typeof DB !== 'undefined' && DB.questions) {
                        allQuestions = await DB.questions.toArray();
                    }
                } catch (e) {
                    console.error('Error loading questions from DB:', e);
                    allQuestions = [];
                }
            }

            if (allQuestions.length < 3) {
                const msg = t('no_questions', '⚠️ يجب إضافة 3 أسئلة على الأقل لبدء اللعبة');
                if (typeof UI !== 'undefined' && UI.showAlert) await UI.showAlert(msg, '⚠️');
                else alert(msg);
                return;
            }

            const settingsCount = (typeof Settings !== 'undefined' && Settings.data) ? (Settings.data.questionCount || 0) : 0;
            const maxAvailable = allQuestions.length;
            const count = settingsCount > 0 ? Math.min(settingsCount, maxAvailable) : maxAvailable;

            this.state.questions = this.shuffleArray([...allQuestions]).slice(0, count);
            this.state.questionsPerRound = count;
            this.state.timeLimit = (typeof Settings !== 'undefined' && Settings.data) ? (Settings.data.timePerQuestion || 15) : 15;
            this.state.maxWrongAllowed = (typeof Settings !== 'undefined' && Settings.data) ? (Settings.data.maxWrong || 0) : 0;
            this.state.totalTestTime = (typeof Settings !== 'undefined' && Settings.data) ? ((Settings.data.testDuration || 30) * 60) : 1800;
            this.state.pauseCount = 5;
            this.state.testPauseCount = 2;
            this.state.challengePauseCount = 2;
            this.state.playing = true;
            this.state.answered = false;
            this.state.canAnswer = true;
            this.state.paused = false;
            this.state.isGameOver = false;
            this.state.testSubmitted = false;
            this.state.userAnswers = [];
            this.state.reviewData = null;

            if (typeof UI !== 'undefined') {
                if (UI.updateTotalQuestions) UI.updateTotalQuestions(count);
                if (UI.updatePauseBadge) UI.updatePauseBadge(this.state.pauseCount);
                if (UI.updateScore) UI.updateScore(0, 0);
                if (UI.hidePauseHint) UI.hidePauseHint();
                if (UI.disableSidebar) UI.disableSidebar(true);
            }

            const homeScreen = document.getElementById('home-screen');
            const appContainer = document.getElementById('app-container');
            if (homeScreen) homeScreen.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');

            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();

            if (mode === 'test') this.startTestSession();
            else this.startPracticeSession();
        },

        resetState() {
            this.clearAllTimers();
            Object.assign(this.state, {
                playing: false, paused: false, canAnswer: true, answered: false,
                questionIndex: 0, correct: 0, wrong: 0, totalCorrect: 0, totalWrong: 0,
                score: 0, stars: 0, totalStars: 0, timeLeft: 20, questionsPerRound: 10,
                answerTimes: [], roundStartTime: 0, currentQuestion: null, timer: null,
                questions: [], pauseCount: 5, maxWrongAllowed: 0, isGameOver: false,
                totalTestTime: 0, testTimer: null, testTimeLeft: 0,
                userAnswers: [], testSubmitted: false, reviewData: null,
                selectedCategories: [], testPauseCount: 2, challengePauseCount: 2
            });
        },

        clearAllTimers() {
            if (this.state.timer) { clearInterval(this.state.timer); this.state.timer = null; }
            if (this.state.testTimer) { clearInterval(this.state.testTimer); this.state.testTimer = null; }
            if (typeof AudioManager !== 'undefined') AudioManager.stopTick?.();
        },

        startPracticeSession() {
            this.state.questionIndex = 0;
            this.state.correct = 0; this.state.wrong = 0;
            this.state.score = 0; this.state.stars = 0;
            this.state.playing = true; this.state.answered = false;
            this.state.canAnswer = true; this.state.paused = false;
            this.state.challengePauseCount = 2;
            this.restorePracticeUI();
            this.nextPracticeQuestion();
        },

        restorePracticeUI() {
            const gameWindow = document.getElementById('gameWindow');
            if (!gameWindow) return;

            gameWindow.innerHTML = `
                <div class="dashed-border-container">
                    <div class="top-panel">
                        <div class="stats-row">
                            <div class="stat-item score-box">🏆 <span id="score-display">0</span></div>
                            <div class="stat-item stars-box">⭐ <span id="stars-display">0</span></div>
                            <div class="stat-item questions-box"><span id="current-q">1</span>/<span id="total-q">10</span></div>
                        </div>
                    </div>
                    <div class="question-section">
                        <div class="q-wrapper">
                            <div id="question-text">${t('loading', 'جاري التحميل...')}</div>
                            <div id="question-media" class="question-media"></div>
                        </div>
                    </div>
                    <div class="answer-panel-header">
                        <button class="end-challenge-btn" id="end-challenge-btn" style="margin: 0; padding: 6px 10px; font-size: 0.75rem;" onclick="if(typeof UI !== 'undefined') UI.endChallenge()">${t('end_challenge', 'إنهاء التحدي')}</button>
                        <div class="select-answer-title">${t('select_answer', 'اختر الإجابة الصحيحة')}</div>
                        <div class="timer-end-wrapper">
                            <div class="timer-center" id="timer-center" onclick="window.Game && Game.togglePause()">
                                <div class="timer-circle" id="timerCircle">
                                    <div class="timer-inner">
                                        <span id="timerDisplay">20</span>
                                        <span class="timer-label">${t('seconds', 'ث')}</span>
                                    </div>
                                </div>
                                <div id="pause-hint" class="pause-hint hidden">${t('pause_hint', '⏸️ إنقر هنا لاستئناف')}</div>
                                <div id="pause-count-badge" class="pause-count-badge">5</div>
                            </div>
                        </div>
                    </div>
                    <div class="answers-grid-wrapper">
                        <div class="quiz-grid" id="quiz-grid"></div>
                    </div>
                </div>
            `;

            this.elements = {
                timerCircle: document.getElementById('timerCircle'),
                timerDisplay: document.getElementById('timerDisplay'),
                pauseHint: document.getElementById('pause-hint'),
                pauseCountBadge: document.getElementById('pause-count-badge')
            };

            if (typeof UI !== 'undefined' && UI.cacheElements) UI.cacheElements();
        },

        nextPracticeQuestion() {
            if (this.state.questionIndex >= this.state.questionsPerRound || !this.state.playing) {
                this.endPracticeRound();
                return;
            }
            const q = this.state.questions[this.state.questionIndex];
            if (!q) { this.endPracticeRound(); return; }

            this.state.questionIndex++;
            this.state.answered = false;
            this.state.canAnswer = true;
            this.state.timeLeft = this.state.timeLimit;
            this.state.currentQuestion = q;
            this.state.roundStartTime = Date.now();

            this.clearAllTimers();
            if (typeof UI !== 'undefined') {
                if (UI.clearFeedback) UI.clearFeedback();
                if (UI.updateQuestionNumber) UI.updateQuestionNumber(this.state.questionIndex, this.state.questionsPerRound);
            }

            this.showQuestionWithLayoutCheck(q);

            if (typeof UI !== 'undefined') {
                if (UI.updateTimer) UI.updateTimer(this.state.timeLeft, this.state.timeLimit);
                if (UI.setTimerPhase) UI.setTimerPhase(1);
                if (UI.hidePauseHint) UI.hidePauseHint();
            }

            this.startQuestionTimer();

            if (typeof AudioManager !== 'undefined' && !AudioManager.isMuted) {
                const lang = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data.language : 'ar';
                AudioManager.speakText?.(q.text, lang);
            }
        },

        showQuestionWithLayoutCheck(q) {
            const textEl = document.getElementById('question-text');
            const mediaDiv = document.getElementById('question-media');
            const grid = document.getElementById('quiz-grid');

            if (textEl) textEl.textContent = q.text || '';
            if (mediaDiv) mediaDiv.innerHTML = q.image ? `<img src="${q.image}" style="max-width:200px;border-radius:8px;">` : '';

            if (!grid) return;
            grid.innerHTML = '';

            const answers = this.shuffleAnswers(q.correct, q.wrongs || []);
            const hasLongAnswer = answers.some(ans => (ans || '').replace(/\s/g, '').length > 5);
            if (hasLongAnswer) grid.classList.add('single-column');
            else grid.classList.remove('single-column');

            answers.forEach(ans => {
                const btn = document.createElement('button');
                btn.className = 'answer-btn';
                btn.textContent = ans;
                btn.dataset.value = ans;
                const clickHandler = (e) => {
                    e.preventDefault();
                    if (Game.state.canAnswer && !Game.state.paused) Game.selectAnswer(ans, q.correct, btn);
                };
                btn.addEventListener('click', clickHandler);
                btn.addEventListener('touchstart', clickHandler, { passive: false });
                grid.appendChild(btn);
            });
        },

        shuffleAnswers(correct, wrongs) {
            let answers = [correct, ...(wrongs || []).slice(0, 3)];
            for (let i = answers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [answers[i], answers[j]] = [answers[j], answers[i]];
            }
            return answers;
        },

        startQuestionTimer() {
            this.clearAllTimers();
            this.state.timeLeft = this.state.timeLimit;
            if (typeof UI !== 'undefined' && UI.updateTimer) UI.updateTimer(this.state.timeLeft, this.state.timeLimit);
            if (typeof AudioManager !== 'undefined') AudioManager.startTick?.();

            const self = this;
            this.state.timer = setInterval(function() {
                if (self.state.paused || !self.state.playing || self.state.answered) return;
                self.state.timeLeft--;
                if (typeof UI !== 'undefined' && UI.updateTimer) UI.updateTimer(self.state.timeLeft, self.state.timeLimit);
                const ratio = self.state.timeLeft / self.state.timeLimit;
                if (typeof UI !== 'undefined' && UI.setTimerPhase) UI.setTimerPhase(ratio > 2/3 ? 1 : ratio > 1/3 ? 2 : 3);
                if (self.state.timeLeft === 3 && typeof AudioManager !== 'undefined') AudioManager.play?.('timer-3', 0.8);
                if (self.state.timeLeft <= 0) { self.clearAllTimers(); self.handleTimeout(); }
            }, 1000);
        },

        handleTimeout() {
            if (this.state.answered) return;
            this.state.answered = true;
            this.state.canAnswer = false;
            this.state.wrong++;
            this.state.totalWrong++;
            if (typeof AudioManager !== 'undefined') AudioManager.play?.('wrong');
            const correctAnswer = this.state.currentQuestion?.correct;
            if (correctAnswer) {
                const correctBtn = Array.from(document.querySelectorAll('.answer-btn')).find(b => b.dataset.value == correctAnswer);
                if (correctBtn && typeof UI !== 'undefined' && UI.flashWrong) UI.flashWrong(null, correctBtn);
            }
            if (this.checkGameOver()) return;
            this.proceedAfterAnswer();
        },

        selectAnswer(selected, correct, btn) {
            if (!this.state.canAnswer || this.state.answered || this.state.paused || !this.state.playing) return;
            this.state.answered = true;
            this.state.canAnswer = false;
            this.clearAllTimers();
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();

            const isCorrect = (selected == correct);
            const timeTaken = (Date.now() - this.state.roundStartTime) / 1000;
            this.state.answerTimes.push(timeTaken);

            try {
                if (isCorrect) {
                    if (typeof UI !== 'undefined' && UI.flashCorrect) UI.flashCorrect(btn);
                    if (typeof AudioManager !== 'undefined') AudioManager.play?.('correct');
                    this.state.correct++;
                    this.state.totalCorrect++;
                    const timeBonus = Math.max(0, this.state.timeLimit - timeTaken);
                    const starsEarned = Math.floor(timeBonus / 2);
                    if (starsEarned > 0) {
                        this.state.stars += starsEarned; this.state.totalStars += starsEarned;
                        if (typeof AudioManager !== 'undefined') AudioManager.play?.('star');
                        if (typeof UI !== 'undefined' && UI.showFloatingText) UI.showFloatingText(btn, '+' + starsEarned + '⭐');
                    }
                    this.state.score += 10 + (timeBonus * 2);
                    if (typeof UI !== 'undefined' && UI.showFloatingText) UI.showFloatingText(btn, '+10');
                } else {
                    const correctBtn = Array.from(document.querySelectorAll('.answer-btn')).find(b => b.dataset.value == correct);
                    if (typeof UI !== 'undefined' && UI.flashWrong) UI.flashWrong(btn, correctBtn);
                    if (typeof AudioManager !== 'undefined') AudioManager.play?.('wrong');
                    this.state.wrong++; this.state.totalWrong++;
                    if (this.checkGameOver()) return;
                }
                if (typeof UI !== 'undefined' && UI.updateScore) UI.updateScore(this.state.score, this.state.totalStars);
            } catch (e) { console.error('Error in answer effects:', e); }
            this.proceedAfterAnswer();
        },

        checkGameOver() {
            if (this.state.maxWrongAllowed > 0 && this.state.totalWrong >= this.state.maxWrongAllowed) {
                this.state.playing = false; this.state.isGameOver = true;
                this.clearAllTimers();
                if (typeof AudioManager !== 'undefined') { AudioManager.stopAll?.(); AudioManager.play?.('game-over'); }
                this.recordGameStats();
                if (typeof UI !== 'undefined' && UI.showFinalReport) {
                    UI.showFinalReport({ score: this.state.score, correct: this.state.totalCorrect, wrong: this.state.totalWrong, total: this.state.totalCorrect + this.state.totalWrong, stars: this.state.totalStars }, false);
                }
                if (this.state.totalCorrect > 0 && typeof confetti !== 'undefined') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                return true;
            }
            return false;
        },

        proceedAfterAnswer() {
            const self = this;
            setTimeout(() => {
                if (self.state.playing && !self.state.paused && self.state.mode === 'practice') self.nextPracticeQuestion();
            }, 1200);
        },

        endPracticeRound() {
            if (typeof AudioManager !== 'undefined') AudioManager.play?.('round_complete');
            this.recordGameStats();
            if (typeof UI !== 'undefined' && UI.showFinalReport) {
                UI.showFinalReport({ score: this.state.score, correct: this.state.totalCorrect, wrong: this.state.totalWrong, total: this.state.totalCorrect + this.state.totalWrong, stars: this.state.totalStars }, false);
            }
            this.state.playing = false;
            this.clearAllTimers();
            if (typeof UI !== 'undefined' && UI.disableSidebar) UI.disableSidebar(false);
            const accuracy = this.state.totalCorrect / (this.state.totalCorrect + this.state.totalWrong || 1);
            if (accuracy >= 0.8 && typeof confetti !== 'undefined') confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        },

        recordGameStats(modeOverride, scoreOverride, correctOverride, wrongOverride, totalOverride, starsOverride) {
            try {
                if (typeof PlayerStatsManager !== 'undefined' && PlayerStatsManager.recordGame) {
                    const mode = modeOverride || this.state.mode || 'practice';
                    const correct = correctOverride !== undefined ? correctOverride : (this.state.totalCorrect || 0);
                    const wrong = wrongOverride !== undefined ? wrongOverride : (this.state.totalWrong || 0);
                    const total = totalOverride !== undefined ? totalOverride : (this.state.questionsPerRound || 0);
                    const score = scoreOverride !== undefined ? scoreOverride : (this.state.score || 0);
                    const stars = starsOverride !== undefined ? starsOverride : (this.state.totalStars || 0);
                    PlayerStatsManager.recordGame({ mode, score, correct, wrong, total, stars });
                }
            } catch (e) { console.warn('⚠️ خطأ في تسجيل الإحصائيات:', e); }
        },

        // ======== TEST MODE ========
        startTestSession() {
            this.state.questionIndex = 0; this.state.correct = 0; this.state.wrong = 0;
            this.state.score = 0; this.state.stars = 0; this.state.playing = true;
            this.state.paused = false; this.state.testSubmitted = false;
            this.state.testPauseCount = 2;
            this.state.userAnswers = new Array(this.state.questions.length).fill(null);
            this.state.testTimeLeft = this.state.totalTestTime;
            this.renderTestSheet();
            this.startTestTimer();
        },

        renderTestSheet() {
            const gameWindow = document.getElementById('gameWindow');
            if (!gameWindow) return;

            const questionsHtml = this.state.questions.map((q, idx) => {
                const answers = Game.shuffleAnswers(q.correct, q.wrongs || []);
                const hasLongAnswers = answers.some(ans => (ans || '').length > 15);
                const gridStyle = hasLongAnswers ? 'grid-template-columns: 1fr; gap: 8px;' : 'grid-template-columns: 1fr 1fr; gap: 8px;';
                const btnStyle = hasLongAnswers ? 'font-size: 1.1rem; min-height: 48px; padding: 12px 14px; word-break: break-word; white-space: normal; height: auto; line-height: 1.3;' : 'font-size: 1.2rem; min-height: 50px; padding: 10px; word-break: break-word; white-space: normal; height: auto; line-height: 1.3;';
                const answersHtml = answers.map(ans => `<button class="answer-btn test-answer" data-q="${idx}" data-value="${Game.escapeHtml(ans)}" style="${btnStyle}">${Game.escapeHtml(ans)}</button>`).join('');
                return `
                    <div class="question-outlined-box">
                        <div class="question-text" style="font-weight: bold; color: var(--text-primary); margin-bottom: 10px;">
                            <span style="color: var(--accent);">${idx + 1}.</span> ${Game.escapeHtml(q.text)}
                            <span class="double-tap-hint" style="animation: pulse 2s infinite;">(${t('double_tap_hint', 'انقر مرتين للاختيار')})</span>
                        </div>
                        ${q.image ? '<img src="' + q.image + '" style="max-width: 200px; border-radius: 8px; margin: 10px 0;">' : ''}
                        <div class="answers-grid" style="display: grid; ${gridStyle}">
                            ${answersHtml}
                        </div>
                    </div>
                `;
            }).join('');

            gameWindow.innerHTML = `
                <div style="padding: 10px; color: white; height: 100%; display: flex; flex-direction: column;">
                    <div style="position: sticky; top: 0; z-index: 20; background: var(--bg); padding: 8px 12px; border-radius: 0 0 20px 20px; text-align: center; border-bottom: 2px solid var(--accent); margin-bottom: 10px;">
                        <div id="test-timer" style="font-size: 1.6rem; color: var(--accent); font-weight: 800; letter-spacing: 2px;">${t('time_remaining', 'الوقت المتبقي')}: ${Game.formatTime(this.state.testTimeLeft)}</div>
                    </div>
                    <div class="test-header" style="display: flex; justify-content: center; gap: 20px; margin-bottom: 15px;">
                        <button class="silver-btn" id="pause-test-btn">⏸️ ${t('pause_test', 'إيقاف مؤقت')}</button>
                        <button class="silver-btn" id="end-test-btn">✖️ ${t('end_test', 'إنهاء الاختبار')}</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding: 10px 5px; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior-y: contain; position: relative;" id="test-questions-container">
                        ${questionsHtml}
                    </div>
                </div>`;

            this.attachTestAnswerEvents();
            const pauseBtn = document.getElementById('pause-test-btn');
            const endBtn = document.getElementById('end-test-btn');
            if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTest());
            if (endBtn) endBtn.addEventListener('click', () => { if (typeof UI !== 'undefined') UI.endTest(); });
        },

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        attachTestAnswerEvents() {
            const self = this;
            let lastTapTime = 0;
            document.querySelectorAll('.test-answer').forEach(btn => {
                const clickHandler = function(e) {
                    e.preventDefault();
                    const now = Date.now();
                    if (now - lastTapTime < 400 && now - lastTapTime > 0) {
                        const qIdx = parseInt(btn.dataset.q);
                        const value = btn.dataset.value;
                        document.querySelectorAll('.test-answer[data-q="' + qIdx + '"]').forEach(b => {
                            b.style.border = '2px dashed rgba(0, 255, 255, 0.7)';
                            b.style.background = 'linear-gradient(145deg, #0f1a2f, #030712)';
                            b.style.transform = 'scale(1)';
                        });
                        btn.style.border = '2px solid var(--gold)';
                        btn.style.background = 'linear-gradient(145deg, rgba(255, 215, 0, 0.3), rgba(0, 0, 0, 0.6))';
                        btn.style.transform = 'scale(1.05)';
                        btn.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.3)';
                        self.state.userAnswers[qIdx] = value;
                        if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(t('answer_selected', '✓ تم اختيار الإجابة'), '✅');
                    }
                    lastTapTime = now;
                };
                btn.addEventListener('click', clickHandler);
                btn.addEventListener('touchstart', clickHandler, { passive: false });
            });
        },

        startTestTimer() {
            this.clearAllTimers();
            const self = this;
            this.state.testTimer = setInterval(() => {
                if (self.state.paused || self.state.testSubmitted) return;
                self.state.testTimeLeft--;
                const timerEl = document.getElementById('test-timer');
                if (timerEl) {
                    timerEl.textContent = t('time_remaining', 'الوقت المتبقي') + ': ' + self.formatTime(self.state.testTimeLeft);
                    if (self.state.testTimeLeft <= 60) { timerEl.style.color = '#ff4444'; timerEl.style.animation = 'pulse 1s infinite'; }
                    else if (self.state.testTimeLeft <= 300) timerEl.style.color = '#ffaa00';
                }
                if (self.state.testTimeLeft <= 0) { self.clearAllTimers(); self.submitTest(true); }
            }, 1000);
        },

        formatTime(seconds) {
            if (seconds < 0) seconds = 0;
            const m = Math.floor(seconds / 60), s = seconds % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        },

        submitTest(timeUp) {
            if (this.state.testSubmitted) return;
            this.state.testSubmitted = true;
            this.clearAllTimers();
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();
            if (timeUp) {
                const msg = t('time_up', '⏰ انتهى وقت الاختبار! سيتم تصحيح إجاباتك تلقائياً.');
                if (typeof UI !== 'undefined' && UI.showAlert) UI.showAlert(msg, '⏰');
                else alert(t('time_up_alert', 'انتهى وقت الاختبار!'));
            }

            let correct = 0;
            const total = this.state.questions.length;
            const review = [];
            this.state.questions.forEach((q, idx) => {
                const userAns = this.state.userAnswers[idx] || '';
                const isCorrect = userAns === q.correct;
                if (isCorrect) correct++;
                review.push({ question: q, userAnswer: userAns, correct: isCorrect });
            });

            this.state.correct = correct;
            this.state.wrong = total - correct;
            this.state.score = correct;
            this.state.stars = 0;
            this.state.reviewData = review;
            this.state.playing = false;

            this.recordGameStats('test', correct, correct, total - correct, total, 0);
            this.renderCorrectedSheet(review, correct, total);

            if (typeof UI !== 'undefined' && UI.showFinalReport) {
                UI.showFinalReport({ score: correct, stars: 0, correct: correct, wrong: total - correct, total: total }, true);
            }
            if (typeof UI !== 'undefined' && UI.disableSidebar) UI.disableSidebar(false);
            if (typeof AudioManager !== 'undefined') AudioManager.play?.(correct === total ? 'round_complete' : 'game-over');
            if (correct === total && typeof confetti !== 'undefined') confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
        },

        renderCorrectedSheet(review, correct, total) {
            const gameWindow = document.getElementById('gameWindow');
            if (!gameWindow) return;
            const percentage = Math.round((correct / total) * 100);
            const grade = percentage >= 90 ? t('grade_excellent', '🎖️ ممتاز') : percentage >= 75 ? t('grade_very_good', '🥇 جيد جداً') : percentage >= 50 ? t('grade_good', '🥈 جيد') : t('grade_review', '📚 يحتاج مراجعة');

            const reviewHtml = review.map((r, idx) => {
                const q = r.question;
                const allAnswers = [q.correct, ...(q.wrongs || [])];
                const answersHtml = allAnswers.map(ans => {
                    let style = 'display: inline-block; margin: 4px; padding: 8px 15px; border-radius: 8px; font-size: 1rem; word-break: break-word;';
                    if (ans === q.correct) style += ' background: rgba(22, 163, 74, 0.3); border: 2px solid #16a34a; color: #16a34a;';
                    if (ans === r.userAnswer && !r.correct) style += ' background: rgba(220, 38, 38, 0.3); border: 2px solid #dc2626; color: #fca5a5;';
                    if (ans !== q.correct && ans !== r.userAnswer) style += ' background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2);';
                    return '<span style="' + style + '">' + Game.escapeHtml(ans) + '</span>';
                }).join('');
                const noAnswerText = !r.userAnswer ? ' <small style="color: #888;">(' + t('no_answer', 'بدون إجابة') + ')</small>' : '';
                return '<div style="margin-bottom: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; border: 1px solid ' + (r.correct ? '#16a34a' : '#dc2626') + ';"><p style="font-weight: bold; color: white; margin-bottom: 8px;">' + (idx + 1) + '. ' + Game.escapeHtml(q.text) + '<span style="font-size: 1.3rem;">' + (r.correct ? '✅' : '❌') + '</span>' + noAnswerText + '</p>' + (q.image ? '<img src="' + q.image + '" style="max-width: 150px; border-radius: 8px; margin: 5px 0;">' : '') + '<div style="margin-top: 8px;">' + answersHtml + '</div></div>';
            }).join('');

            gameWindow.innerHTML = `
                <div style="padding: 10px; color: white; height: 100%; display: flex; flex-direction: column;">
                    <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary)); border-radius: 15px; margin-bottom: 15px; border: 1.5px solid var(--accent);">
                        <h2 style="color: var(--accent); margin: 0 0 5px 0;">📊 ${t('final_report', 'النتيجة النهائية')}</h2>
                        <div style="font-size: 2.5rem; font-weight: 900; color: var(--accent); text-shadow: 0 0 6px rgba(var(--accent-rgb), 0.12);">${correct} / ${total}</div>
                        <div style="font-size: 1.3rem; color: white; margin-top: 5px;">${grade}</div>
                        <div style="font-size: 1rem; color: #ccc; margin-top: 5px;">${t('percentage', 'النسبة')}: ${percentage}%</div>
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding: 5px; -webkit-overflow-scrolling: touch;">
                        <h3 style="color: var(--accent); margin-bottom: 15px;">📋 ${t('review_answers', 'مراجعة الإجابات')}</h3>
                        ${reviewHtml}
                    </div>
                    <!-- أزرار عائمة مرتفعة 2سم عن الحافة السفلية -->
                    <div style="position: sticky; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); padding: 16px 10px; margin-top: 10px; border-radius: 28px 28px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.4); margin-bottom: 20px;">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                            <button class="btn btn-primary" onclick="if(UI && UI.enableSidebarAfterReview) UI.enableSidebarAfterReview(); UI.goHome();" style="flex: 1; min-width: 140px; padding: 14px 20px; border-radius: 40px; font-size: 1rem;">🏠 ${t('back_home', 'رجوع')}</button>
                            <button class="btn btn-primary" onclick="if(UI && UI.enableSidebarAfterReview) UI.enableSidebarAfterReview(); Game.startMode('test');" style="flex: 1; min-width: 140px; padding: 14px 20px; border-radius: 40px; font-size: 1rem;">📝 ${t('new_test', 'اختبار جديد')}</button>
                        </div>
                    </div>
                </div>`;
        },

        showReview() {
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();
            if (this.state.reviewData && this.state.reviewData.length > 0) {
                this.renderCorrectedSheet(this.state.reviewData, this.state.correct, this.state.questions.length);
                const modal = document.getElementById('results-modal');
                if (modal) modal.classList.remove('active');
            }
        },

        togglePause() {
            if (!this.state.playing || this.state.mode === 'test') return;
            if (this.state.paused) {
                this.state.paused = false;
                if (typeof UI !== 'undefined' && UI.hidePauseHint) UI.hidePauseHint();
                if (!this.state.answered && this.state.mode === 'practice') this.startQuestionTimer();
            } else {
                if (this.state.pauseCount <= 0) return;
                this.state.pauseCount--;
                if (typeof UI !== 'undefined' && UI.updatePauseBadge) UI.updatePauseBadge(this.state.pauseCount);
                this.state.paused = true;
                this.clearAllTimers();
                if (typeof UI !== 'undefined' && UI.showPauseHint) UI.showPauseHint();
            }
        },

        pauseTest() {
            if (!this.state.playing || this.state.mode !== 'test') return;
            if (this.state.paused) {
                this.state.paused = false;
                this.startTestTimer();
                const overlay = document.getElementById('test-pause-overlay');
                if (overlay) overlay.remove();
                const container = document.getElementById('test-questions-container');
                if (container) container.style.filter = '';
                document.body.style.overflow = '';
                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('▶️ ' + t('test_resumed', 'تم استئناف الاختبار'), '⏯️');
            } else {
                if (this.state.testPauseCount <= 0) {
                    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('⚠️ ' + t('no_pause_remaining', 'لا توجد محاولات إيقاف مؤقت متبقية'), '⚠️');
                    return;
                }
                this.state.testPauseCount--;
                this.state.paused = true;
                this.clearAllTimers();

                let overlay = document.getElementById('test-pause-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'test-pause-overlay';
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.8);
                        backdrop-filter: blur(8px);
                        z-index: 1000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        flex-direction: column;
                        gap: 20px;
                    `;
                    const resumeBtn = document.createElement('button');
                    resumeBtn.textContent = '▶️ ' + t('resume_test', 'استئناف الاختبار');
                    resumeBtn.style.cssText = `
                        padding: 15px 30px;
                        font-size: 1.3rem;
                        font-weight: bold;
                        background: linear-gradient(135deg, var(--accent), var(--accent-light));
                        border: none;
                        border-radius: 50px;
                        color: #000;
                        cursor: pointer;
                        box-shadow: 0 0 20px rgba(0,0,0,0.5);
                        transition: transform 0.2s;
                    `;
                    resumeBtn.onmouseover = () => resumeBtn.style.transform = 'scale(1.05)';
                    resumeBtn.onmouseout = () => resumeBtn.style.transform = 'scale(1)';
                    resumeBtn.onclick = () => this.pauseTest();
                    overlay.appendChild(resumeBtn);
                    const info = document.createElement('div');
                    info.textContent = `⏸️ ${t('test_paused', 'الاختبار متوقف مؤقتاً')} (${t('remaining_attempts', 'محاولات متبقية')}: ${this.state.testPauseCount})`;
                    info.style.cssText = 'color: white; font-size: 1rem; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 20px;';
                    overlay.appendChild(info);
                    document.body.appendChild(overlay);
                }
                document.body.style.overflow = 'hidden';
                const container = document.getElementById('test-questions-container');
                if (container) container.style.filter = 'blur(4px)';

                if (typeof UI !== 'undefined') {
                    UI.showToast(`⏸️ ${t('test_paused', 'تم إيقاف الاختبار مؤقتاً')} (${t('remaining_attempts', 'محاولات متبقية')}: ${this.state.testPauseCount})`, '⏸️');
                    if (UI.updatePauseBadge) UI.updatePauseBadge(this.state.testPauseCount);
                }
            }
        },

        shuffleArray(arr) {
            const shuffled = [...arr];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        },

        quitGame() {
            this.state.playing = false;
            this.clearAllTimers();
            if (typeof AudioManager !== 'undefined') AudioManager.stopAll?.();
            if (typeof UI !== 'undefined' && UI.disableSidebar) UI.disableSidebar(false);
        },

        applySettings() {
            this.state.timeLimit = (typeof Settings !== 'undefined' && Settings.data) ? (Settings.data.timePerQuestion || 15) : 15;
            this.state.maxWrongAllowed = (typeof Settings !== 'undefined' && Settings.data) ? (Settings.data.maxWrong || 0) : 0;
            this.state.totalTestTime = (typeof Settings !== 'undefined' && Settings.data) ? ((Settings.data.testDuration || 30) * 60) : 1800;
            this.state.pauseCount = 5;
        }
    };

    global.Game = Game;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Game.initCordovaEvents());
    } else {
        Game.initCordovaEvents();
    }

})(window);