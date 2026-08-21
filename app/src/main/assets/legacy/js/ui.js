/**
 * UI.js - Unified UI Controller (الحل النهائي - تم إصلاح QR و كيفية التصدير)
 */
window.UI = window.UI || {};

(function(global) {
    'use strict';

    const t = (key, fallback) => {
        if (typeof I18n !== 'undefined' && I18n.t) return I18n.t(key, fallback);
        return fallback || key;
    };

    const UI = {
        elements: {},
        pendingMode: null,
        selectedCategories: [],
        themeSelectContainer: null,
        currentEditId: null,
        _sidebarDisabled: false,
        _modalObservers: [],

        init() {
            console.log('🖥️ تهيئة واجهة المستخدم النهائية...');
            this.cacheElements();
            this.updateQuickStats();
            this.addDefaultQuestionsIfEmpty().then(() => {
                this.loadQuestionsList();
                this.refreshAllCategorySelects();
            });
            this.setupModalSidebarControl();
            this.bindEvents();
            console.log('✅ واجهة المستخدم جاهزة');
        },

        setupModalSidebarControl() {
            const targetModals = ['category-selection-modal', 'range-modal', 'results-modal'];
            
            this._modalObservers.forEach(obs => obs.disconnect());
            this._modalObservers = [];

            targetModals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (!modal) return;

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class') {
                            if (modal.classList.contains('active')) {
                                this.disableSidebar(true);
                            } else {
                                const anyActive = targetModals.some(id => {
                                    const m = document.getElementById(id);
                                    return m && m.classList.contains('active');
                                });
                                if (!anyActive) {
                                    this.disableSidebar(false);
                                }
                            }
                        }
                    });
                });
                observer.observe(modal, { attributes: true });
                this._modalObservers.push(observer);

                const closeHandler = () => {
                    setTimeout(() => {
                        const anyActive = targetModals.some(id => {
                            const m = document.getElementById(id);
                            return m && m.classList.contains('active');
                        });
                        if (!anyActive) {
                            this.disableSidebar(false);
                        }
                    }, 100);
                };
                modal.addEventListener('modal-closed', closeHandler);
                const closeBtns = modal.querySelectorAll('[data-close-modal]');
                closeBtns.forEach(btn => {
                    btn.addEventListener('click', closeHandler);
                });
            });
        },

        cacheElements() {
            this.elements = {
                homeScreen: document.getElementById('home-screen'),
                appContainer: document.getElementById('app-container'),
                gameWindow: document.getElementById('gameWindow'),
                categoryModal: document.getElementById('category-selection-modal'),
                categoryGrid: document.getElementById('category-selection-grid'),
                rangeModal: document.getElementById('range-modal'),
                manageModal: document.getElementById('manage-modal'),
                settingsModal: document.getElementById('settings-modal'),
                achievementsModal: document.getElementById('achievements-modal'),
                resultsModal: document.getElementById('results-modal'),
                aboutModal: document.getElementById('about-modal'),
                qrModal: document.getElementById('qr-modal'),
                questionFormModal: document.getElementById('question-form-modal'),
                howToImportModal: document.getElementById('how-to-import-modal'),
                exportGuideModal: document.getElementById('export-guide-modal'),
                questionsList: document.getElementById('questions-list'),
                categoryFilterSelect: document.getElementById('category-filter-select'),
                questionsCountText: document.getElementById('questions-count-text'),
                scoreDisplay: document.getElementById('score-display'),
                starsDisplay: document.getElementById('stars-display'),
                currentQ: document.getElementById('current-q'),
                totalQ: document.getElementById('total-q'),
                timerDisplay: document.getElementById('timerDisplay'),
                timerCircle: document.getElementById('timerCircle'),
                pauseHint: document.getElementById('pause-hint'),
                pauseCountBadge: document.getElementById('pause-count-badge'),
                quizGrid: document.getElementById('quiz-grid'),
                questionText: document.getElementById('question-text'),
                questionMedia: document.getElementById('question-media'),
            };
            this.themeSelectContainer = document.getElementById('theme-select-container');
        },

        bindEvents() {
            // الأزرار الرئيسية
            document.getElementById('btn-start-selected')?.addEventListener('click', () => this.confirmCategorySelection());
            document.getElementById('range-confirm')?.addEventListener('click', () => this.confirmRangeSelection());
            document.getElementById('confirm-add-category')?.addEventListener('click', () => this.addCategory());
            document.getElementById('save-question-btn')?.addEventListener('click', () => this.saveQuestion());
            document.getElementById('close-settings-btn')?.addEventListener('click', () => this.closeSettings());
            document.getElementById('export-backup-btn')?.addEventListener('click', () => this.exportBackup());
            document.getElementById('import-backup-btn')?.addEventListener('click', () => this.importBackup());
            document.getElementById('reset-db-btn')?.addEventListener('click', () => this.resetDatabase());
            document.getElementById('replay-btn')?.addEventListener('click', () => this.replayGame());
            document.getElementById('home-from-results-modal-btn')?.addEventListener('click', () => this.goHome());
            document.getElementById('review-answers-btn-modal')?.addEventListener('click', () => this.reviewAnswers());
            document.getElementById('download-qr-btn')?.addEventListener('click', () => this.downloadQR());
            document.getElementById('copy-prompt-btn')?.addEventListener('click', () => this.copyPrompt());
            document.getElementById('mute-sound-checkbox')?.addEventListener('change', (e) => this.toggleSound(e.target.checked));
            document.getElementById('dark-mode-checkbox')?.addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));
            document.getElementById('language-select')?.addEventListener('change', (e) => this.changeLanguage(e.target.value));
            document.getElementById('theme-select')?.addEventListener('change', (e) => this.changeTheme(e.target.value));
            document.getElementById('teacher-mode-btn')?.addEventListener('click', () => this.setNetworkMode('teacher'));
            document.getElementById('student-mode-btn')?.addEventListener('click', () => this.setNetworkMode('student'));
            document.getElementById('share-qr-settings')?.addEventListener('click', () => this.shareQRFromSettings());
            document.getElementById('device-name-input')?.addEventListener('change', (e) => this.setDeviceName(e.target.value));
            document.getElementById('q-image')?.addEventListener('change', (e) => this.previewImage(e));
            document.getElementById('category-filter-select')?.addEventListener('change', () => this.filterQuestions());

            // أزرار الشاشة الرئيسية
            document.getElementById('quick-challenge-btn')?.addEventListener('click', () => this.startQuickChallenge());
            document.getElementById('test-mode-btn')?.addEventListener('click', () => this.startTestMode());

            // القائمة الجانبية الرئيسية
            document.getElementById('sidebar-home')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.goHome()); });
            document.getElementById('sidebar-manage')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openManageModal()); });
            document.getElementById('sidebar-achievements')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openAchievementsModal()); });
            document.getElementById('sidebar-network')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openNetworkModal()); });
            document.getElementById('sidebar-settings')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openSettings()); });
            document.getElementById('sidebar-about')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openAboutModal()); });
            document.getElementById('sidebar-close')?.addEventListener('click', () => this.closeApp());

            // أزرار القائمة الجانبية في وضع الإدارة
            document.getElementById('sidebar-manage-home')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.goHome()); });
            document.getElementById('sidebar-manage-add-category')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.toggleAddCategory()); });
            document.getElementById('sidebar-manage-add-question')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.openQuestionForm()); });
            document.getElementById('sidebar-manage-how-to-export')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.showHowToExport()); });
            document.getElementById('sidebar-manage-export')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.exportQuestions()); });
            document.getElementById('sidebar-manage-how-to-import')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.showHowToImport()); });
            document.getElementById('sidebar-manage-import')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.showImportCategoryModal()); });
            document.getElementById('sidebar-manage-share-qr')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.shareQR()); });
            document.getElementById('sidebar-manage-init-db')?.addEventListener('click', () => { this.closeSidebarAndExecute(() => this.initDatabase()); });

            // الأزرار داخل مودال إدارة الأسئلة (للتوافق)
            document.getElementById('manage-export')?.addEventListener('click', () => this.exportQuestions());
            document.getElementById('manage-import')?.addEventListener('click', () => this.showImportCategoryModal());
            document.getElementById('manage-share-qr')?.addEventListener('click', () => this.shareQR());
            document.getElementById('manage-init-db')?.addEventListener('click', () => this.initDatabase());
            document.getElementById('manage-how-to-export')?.addEventListener('click', () => this.showHowToExport());
            document.getElementById('manage-how-to-import')?.addEventListener('click', () => this.showHowToImport());
        },

        closeSidebarAndExecute(callback) {
            window.closeSidebar();
            setTimeout(() => {
                if (callback) callback();
            }, 50);
        },

        // ========== إدارة القائمة الجانبية المحسنة ==========
        disableSidebar(disable) {
            const toggleBtn = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('sidebar');
            
            if (disable) {
                if (this._sidebarDisabled) return;
                this._sidebarDisabled = true;
                
                if (toggleBtn) {
                    toggleBtn.style.display = 'none';
                    toggleBtn.style.pointerEvents = 'none';
                }
                window.openSidebar = function() {};
                window.closeSidebar = function() {};
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    const overlay = document.getElementById('menu-overlay');
                    if (overlay) overlay.classList.remove('visible');
                    document.body.style.overflow = '';
                }
                document.body.classList.add('sidebar-disabled');
            } else {
                if (!this._sidebarDisabled) return;
                this._sidebarDisabled = false;
                
                if (toggleBtn) {
                    toggleBtn.style.display = '';
                    toggleBtn.style.pointerEvents = '';
                }
                const overlay = document.getElementById('menu-overlay');
                const toggle = document.getElementById('sidebarToggle');
                window.openSidebar = function() {
                    if (sidebar) sidebar.classList.add('open');
                    if (overlay) overlay.classList.add('visible');
                    if (toggle) toggle.classList.add('hidden');
                    document.body.style.overflow = 'hidden';
                };
                window.closeSidebar = function() {
                    if (sidebar) sidebar.classList.remove('open');
                    if (overlay) overlay.classList.remove('visible');
                    if (toggle) toggle.classList.remove('hidden');
                    document.body.style.overflow = '';
                };
                document.body.classList.remove('sidebar-disabled');
            }
        },

        openModalWithSidebarDisabled(modalId, callbackAfterClose = null) {
            this.disableSidebar(true);
            this.openModal(modalId);
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            if (modal._sidebarObserver) {
                modal._sidebarObserver.disconnect();
            }
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class' && !modal.classList.contains('active')) {
                        this.disableSidebar(false);
                        observer.disconnect();
                        if (callbackAfterClose) callbackAfterClose();
                    }
                });
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
            modal._sidebarObserver = observer;
        },

        updateSidebarForContext(context) {
            const sidebar = document.getElementById('sidebar');
            const standardBtns = document.querySelectorAll('.standard-sidebar-btn');
            const manageBtns = document.querySelectorAll('.manage-mode-btn');
            const toggleBtn = document.getElementById('sidebarToggle');
            if (!sidebar) return;
            switch(context) {
                case 'home':
                    standardBtns.forEach(btn => btn.classList.remove('hidden'));
                    manageBtns.forEach(btn => btn.classList.add('hidden'));
                    sidebar.classList.remove('manage-mode');
                    if (toggleBtn) toggleBtn.classList.remove('hidden');
                    this.disableSidebar(false);
                    break;
                case 'manage':
                    standardBtns.forEach(btn => btn.classList.add('hidden'));
                    manageBtns.forEach(btn => btn.classList.remove('hidden'));
                    sidebar.classList.add('manage-mode');
                    if (toggleBtn) toggleBtn.classList.remove('hidden');
                    this.disableSidebar(false);
                    break;
                case 'hidden':
                    window.closeSidebar();
                    if (toggleBtn) toggleBtn.classList.add('hidden');
                    this.disableSidebar(true);
                    break;
            }
        },

        goHome() {
            this.hideAllModals();
            this.elements.appContainer.classList.add('hidden');
            this.elements.homeScreen.classList.remove('hidden');
            if (typeof Game !== 'undefined' && Game.resetState) Game.resetState();
            this.updateSidebarForContext('home');
            this.updateQuickStats();
            window.closeSidebar();
        },

        hideAllModals() {
            document.querySelectorAll('.modal').forEach(m => {
                m.classList.remove('active');
                m.classList.remove('show');
            });
        },

        openModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('active');
                modal.classList.add('show');
                modal.style.display = '';
            }
        },

        // ========== طرق اللعبة ==========
        async startQuickChallenge() {
            await this.showCategorySelection('practice');
        },

        async startTestMode() {
            await this.showCategorySelection('test');
        },

        async showCategorySelection(mode) {
            this.pendingMode = mode;
            const categories = await CategoryManager.getCategories();
            const grid = this.elements.categoryGrid;
            grid.innerHTML = '';
            if (categories.length === 0) {
                grid.innerHTML = '<div class="text-center" style="color:var(--text-secondary);padding:20px;">' + (t('no_questions', 'لا توجد تصنيفات')) + '</div>';
            } else {
                for (const cat of categories) {
                    const card = document.createElement('div');
                    card.className = 'category-card';
                    card.dataset.category = cat.name;
                    let imageHtml = cat.image ? `<img src="${cat.image}" class="category-image" style="object-fit:cover;">` : `<div class="category-image" style="background:linear-gradient(135deg,var(--accent),var(--accent-light));display:flex;align-items:center;justify-content:center;font-size:2rem;">📁</div>`;
                    card.innerHTML = `${imageHtml}<div class="category-name">${cat.name}</div>`;
                    card.addEventListener('click', () => card.classList.toggle('selected'));
                    grid.appendChild(card);
                }
            }
            this.openModalWithSidebarDisabled('category-selection-modal');
        },

        async confirmCategorySelection() {
            const selected = Array.from(document.querySelectorAll('.category-card.selected')).map(c => c.dataset.category);
            if (selected.length === 0) {
                this.showToast(t('select_at_least_one', 'اختر تصنيفاً واحداً على الأقل'));
                return;
            }
            this.selectedCategories = selected;
            this.hideAllModals();
            this.openModalWithSidebarDisabled('range-modal');
        },

        async confirmRangeSelection() {
            const fromUnit = parseInt(document.getElementById('range-from-unit').textContent) || 1;
            const toUnit = parseInt(document.getElementById('range-to-unit').textContent) || 1;
            const fromLesson = parseInt(document.getElementById('range-from-lesson').textContent) || 1;
            const toLesson = parseInt(document.getElementById('range-to-lesson').textContent) || 1;
            this.hideAllModals();
            try {
                let questions = [];
                for (const cat of this.selectedCategories) {
                    const catQuestions = await DB.questions.where('category').equals(cat).toArray();
                    questions.push(...catQuestions);
                }
                questions = questions.filter(q => {
                    const unitOk = (q.unit || 1) >= fromUnit && (q.unit || 1) <= toUnit;
                    const lessonOk = (q.lesson || 1) >= fromLesson && (q.lesson || 1) <= toLesson;
                    return unitOk && lessonOk;
                });
                if (questions.length < 3) {
                    this.showAlert(t('no_questions', 'لا توجد أسئلة كافية في النطاق المحدد'), '⚠️');
                    this.disableSidebar(false);
                    return;
                }
                if (typeof Game !== 'undefined') Game.startMode(this.pendingMode, questions);
            } catch (e) {
                console.error(e);
                this.showToast('حدث خطأ');
                this.disableSidebar(false);
            }
        },

        // ========== إدارة الأسئلة ==========
        async openManageModal() {
            await this.loadCategoriesForFilter();
            await this.loadQuestionsList();
            this.openModal('manage-modal');
            this.updateSidebarForContext('manage');
            window.closeSidebar();
            this.disableSidebar(false);
        },

        async loadCategoriesForFilter() {
            const select = this.elements.categoryFilterSelect;
            const currentVal = select.value;
            select.innerHTML = '<option value="all">' + (t('all_categories', 'الكل')) + '</option>';
            const categories = await CategoryManager.getCategories();
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                select.appendChild(opt);
            });
            select.value = currentVal || 'all';
        },

        async loadQuestionsList() {
            const list = this.elements.questionsList;
            const filter = this.elements.categoryFilterSelect.value;
            try {
                let questions = await DB.questions.toArray();
                const total = questions.length;
                if (filter !== 'all') questions = questions.filter(q => q.category === filter);
                this.elements.questionsCountText.textContent = `المجموع: ${total} - المعروض: ${questions.length}`;
                list.innerHTML = '';
                if (questions.length === 0) {
                    list.innerHTML = `<div class="text-center" style="color:var(--text-secondary);padding:20px;"><div style="font-size:2rem;">📭</div><div data-i18n="no_questions">${t('no_questions', 'لا توجد أسئلة')}</div><button class="btn btn-small btn-primary" id="inline-add-question" style="margin-top:10px;" data-i18n="add_question">${t('add_question', '➕ إضافة سؤال جديد')}</button></div>`;
                    document.getElementById('inline-add-question')?.addEventListener('click', () => this.openQuestionForm());
                    return;
                }
                questions.forEach((q, idx) => {
                    const item = document.createElement('div');
                    item.className = 'question-item';
                    item.innerHTML = `
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;color:var(--accent);">${idx+1}. ${this.escapeHtml(q.text?.substring(0,50)||'')}...</div>
                            <div style="font-size:0.8rem;">✓ ${this.escapeHtml(q.correct)} | 📚 ${q.unit||1} | 📖 ${q.lesson||1} | 🏷️ ${this.escapeHtml(q.category||'عام')}</div>
                        </div>
                        <div><button class="btn btn-small btn-secondary" onclick="UI.editQuestion(${q.id})">✏️</button> <button class="btn btn-small btn-danger" onclick="UI.deleteQuestion(${q.id})">🗑️</button></div>
                    `;
                    list.appendChild(item);
                });
            } catch(e){ console.error(e); }
        },

        filterQuestions() { this.loadQuestionsList(); },

        toggleAddCategory() {
            const container = document.getElementById('add-category-container');
            if(container) container.classList.toggle('hidden');
            this.updateSidebarForContext('hidden');
            window.closeSidebar();
            document.getElementById('new-category-input')?.focus();
        },

        async addCategory() {
            const input = document.getElementById('new-category-input');
            const name = input.value.trim();
            if(!name) return;
            const id = await CategoryManager.addCategory(name);
            if(id){
                this.showToast(t('category_added', 'تم إضافة التصنيف'));
                input.value = '';
                this.toggleAddCategory();
                await this.loadCategoriesForFilter();
                await this.refreshAllCategorySelects();
            }
            this.hideAllModals();
            this.openManageModal();
        },

        openQuestionForm(editId = null) {
            this.currentEditId = editId;
            this.populateCategorySelect();
            if(editId) this.loadQuestionForEdit(editId);
            else {
                document.getElementById('q-text').value = '';
                document.getElementById('q-correct').value = '';
                document.querySelectorAll('.wrong-answer').forEach(w => w.value = '');
                document.getElementById('q-unit').value = 1;
                document.getElementById('q-lesson').value = 1;
                document.getElementById('q-difficulty').value = 'B';
                document.getElementById('image-preview').innerHTML = '';
                document.getElementById('q-image').value = '';
            }
            const title = document.getElementById('question-form-title');
            if(title) title.textContent = editId ? '✏️ تعديل السؤال' : '📝 سؤال جديد';
            this.openModalWithSidebarDisabled('question-form-modal', () => this.openManageModal());
            this.updateSidebarForContext('hidden');
            window.closeSidebar();
        },

        async loadQuestionForEdit(id) {
            try {
                const q = await DB.questions.get(id);
                if(!q) return;
                document.getElementById('q-text').value = q.text;
                document.getElementById('q-correct').value = q.correct;
                const wrongs = document.querySelectorAll('.wrong-answer');
                if(q.wrongs) q.wrongs.forEach((w,i)=>{ if(wrongs[i]) wrongs[i].value = w; });
                document.getElementById('q-unit').value = q.unit||1;
                document.getElementById('q-lesson').value = q.lesson||1;
                document.getElementById('q-difficulty').value = q.difficulty||'B';
                const catSelect = document.getElementById('q-category');
                if(q.category){
                    let exists = false;
                    for(let i=0;i<catSelect.options.length;i++) if(catSelect.options[i].value === q.category) exists=true;
                    if(!exists){
                        const opt = document.createElement('option');
                        opt.value = q.category;
                        opt.textContent = q.category;
                        catSelect.appendChild(opt);
                    }
                    catSelect.value = q.category;
                }
                if(q.image) document.getElementById('image-preview').innerHTML = `<img src="${q.image}" style="max-width:200px;border-radius:8px;">`;
                else document.getElementById('image-preview').innerHTML = '';
            } catch(e){ console.error(e); }
        },

        async populateCategorySelect() {
            const select = document.getElementById('q-category');
            select.innerHTML = '<option value="">' + (t('select_category', 'اختر التصنيف...')) + '</option>';
            const categories = await CategoryManager.getCategories();
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                select.appendChild(opt);
            });
        },

        async saveQuestion() {
            const text = document.getElementById('q-text').value.trim();
            const correct = document.getElementById('q-correct').value.trim();
            const wrongs = Array.from(document.querySelectorAll('.wrong-answer')).map(i=>i.value.trim()).filter(v=>v);
            let category = document.getElementById('q-category').value;
            const unit = parseInt(document.getElementById('q-unit').value)||1;
            const lesson = parseInt(document.getElementById('q-lesson').value)||1;
            const difficulty = document.getElementById('q-difficulty').value;
            if(!text || !correct || wrongs.length<3){ this.showToast(t('fill_all_fields', 'يرجى ملء جميع الحقول')); return; }
            const categories = await CategoryManager.getCategories();
            const catExists = categories.some(c=>c.name===category);
            if(!catExists && category && category!==''){
                await CategoryManager.addCategory(category);
                await this.refreshAllCategorySelects();
                this.showToast(`${t('category_added_auto', 'تم إضافة التصنيف')} "${category}" ${t('automatically', 'تلقائياً')}`);
            }
            let imageData = null;
            const file = document.getElementById('q-image').files[0];
            if(file){
                imageData = await new Promise(resolve=>{
                    const reader = new FileReader();
                    reader.onload = e=>resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
            try {
                if(this.currentEditId){
                    await DB.questions.update(this.currentEditId, { text, correct, wrongs, category: category||'عام', unit, lesson, difficulty, image: imageData||null, updatedAt: Date.now() });
                    this.showToast('✅ ' + t('question_updated', 'تم تحديث السؤال'));
                } else {
                    await DB.questions.add({ text, correct, wrongs, category: category||'عام', unit, lesson, difficulty, image: imageData||null, order: Date.now() });
                    this.showToast(t('question_added', 'تم إضافة السؤال'));
                }
                this.hideAllModals();
                await this.loadQuestionsList();
                this.updateQuickStats();
                this.currentEditId = null;
                this.openManageModal();
            } catch(e){ this.showToast(t('save_error', 'خطأ في الحفظ')); }
        },

        async deleteQuestion(id){
            if(!confirm(t('confirm_delete', 'هل أنت متأكد؟'))) return;
            await DB.questions.delete(id);
            this.showToast(t('question_deleted', 'تم الحذف'));
            await this.loadQuestionsList();
            this.updateQuickStats();
        },

        editQuestion(id){ this.openQuestionForm(id); },

        // ========== استيراد وتصدير ==========
        exportQuestions() {
            const filter = this.elements.categoryFilterSelect?.value;
            if(filter && filter !== 'all') this.exportQuestionsByCategory(filter);
            else if(typeof DBBackup !== 'undefined') DBBackup.exportQuestions();
            else this.showToast('❌ ' + t('export_unavailable', 'التصدير غير متوفر'));
            this.updateSidebarForContext('hidden');
            window.closeSidebar();
        },

        async exportQuestionsByCategory(categoryName){
            const questions = await DB.questions.where('category').equals(categoryName).toArray();
            if(!questions.length){ this.showToast(`⚠️ ${t('no_questions_in_category', 'لا توجد أسئلة في')} "${categoryName}"`); return; }
            const data = { version:3, exportedAt:new Date().toISOString(), category:categoryName, count:questions.length, questions: questions.map(q=>({ text:q.text, correct:q.correct, wrongs:q.wrongs, category:q.category, unit:q.unit||1, lesson:q.lesson||1, difficulty:q.difficulty||'B', image:q.image||null })) };
            const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `questions_${categoryName}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            this.showToast(`✅ ${t('exported_count', 'تم تصدير')} ${questions.length} ${t('questions', 'سؤال')}`);
        },

        exportBackup(){ this.exportQuestions(); },
        importBackup(){ document.getElementById('restore-file')?.click(); },
        resetDatabase(){ if(typeof safeResetDatabase === 'function') safeResetDatabase(); },
        initDatabase(){ if(typeof safeResetDatabase === 'function') safeResetDatabase(); else if(confirm(t('init_db_confirm', 'تهيئة قاعدة البيانات؟'))) DB.questions.clear().then(()=>{ this.showToast(t('init_done', 'تم التهيئة')); this.loadQuestionsList(); this.updateQuickStats(); }); },

        showImportCategoryModal() {
            const modalId = 'import-category-modal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width:400px;">
                        <div class="modal-header"><h2 class="modal-title" data-i18n="select_category">📂 ${t('select_category', 'اختيار التصنيف')}</h2><button class="close-btn" data-close-modal="${modalId}">×</button></div>
                        <div class="modal-body">
                            <div class="form-group"><label data-i18n="target_category">🏷️ ${t('target_category', 'التصنيف المستهدف')}:</label><select id="import-category-select" class="form-control"><option value="">-- ${t('select', 'اختر')} --</option><option value="NEW">➕ ${t('new_category', 'تصنيف جديد...')}</option></select></div>
                            <div id="new-cat-container" class="form-group hidden"><label data-i18n="new_category_name">✏️ ${t('new_category_name', 'اسم جديد')}:</label><input type="text" id="import-new-category" class="form-control"></div>
                            <div class="form-group"><label><input type="checkbox" id="keep-original-category"> <span data-i18n="use_original_category">${t('use_original_category', 'استخدام التصنيف الأصلي من الملف')}</span></label></div>
                        </div>
                        <div class="category-actions"><button class="btn btn-primary" id="confirm-import-category" data-i18n="import_text">📥 ${t('import_text', 'استيراد')}</button><button class="btn btn-secondary" data-close-modal="${modalId}" data-i18n="cancel">${t('cancel', 'إلغاء')}</button></div>
                    </div>`;
                document.body.appendChild(modal);
                modal.querySelectorAll('[data-close-modal]').forEach(btn=> btn.addEventListener('click',()=> modal.classList.remove('active')));
                const catSelect = modal.querySelector('#import-category-select');
                const newCatDiv = modal.querySelector('#new-cat-container');
                const keepOriginal = modal.querySelector('#keep-original-category');
                keepOriginal.checked = false;
                catSelect.addEventListener('change',()=>{ if(catSelect.value==='NEW') newCatDiv.classList.remove('hidden'); else newCatDiv.classList.add('hidden'); });
                keepOriginal.addEventListener('change',()=>{ catSelect.disabled = keepOriginal.checked; if(keepOriginal.checked) newCatDiv.classList.add('hidden'); });
            }
            const catSelect = modal.querySelector('#import-category-select');
            CategoryManager.getCategories().then(cats=>{
                catSelect.innerHTML = '<option value="">-- ' + t('select', 'اختر') + ' --</option>' + cats.map(c=>`<option value="${this.escapeHtml(c.name)}">📁 ${this.escapeHtml(c.name)}</option>`).join('') + '<option value="NEW">➕ ' + t('new_category', 'تصنيف جديد...') + '</option>';
            });
            this.openModalWithSidebarDisabled(modalId, () => this.openManageModal());
            const confirmBtn = modal.querySelector('#confirm-import-category');
            confirmBtn.onclick = async () => {
                const keep = modal.querySelector('#keep-original-category').checked;
                let target = null;
                if(!keep){
                    const val = modal.querySelector('#import-category-select').value;
                    if(val === 'NEW'){
                        const newName = modal.querySelector('#import-new-category').value.trim();
                        if(!newName){ this.showToast(t('enter_category_name', 'أدخل اسم التصنيف')); return; }
                        const added = await CategoryManager.addCategory(newName);
                        if(!added){ this.showToast(t('add_failed', 'فشل الإضافة')); return; }
                        target = newName;
                    } else if(val) target = val;
                    else { this.showToast(t('select_category', 'اختر تصنيفاً')); return; }
                }
                modal.classList.remove('active');
                await this.performImport(target);
                this.disableSidebar(false);
            };
        },

        async performImport(targetCategory){
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.txt';
            input.onchange = async e => {
                const file = e.target.files[0];
                if(!file) return;
                let count = 0;
                try {
                    if(typeof DBBackup !== 'undefined') count = await DBBackup.importQuestions(file, targetCategory);
                    else this.showToast(t('import_unavailable', 'الاستيراد غير متوفر'));
                } catch(err){ this.showToast(t('import_failed', 'فشل الاستيراد') + ': '+err.message); return; }
                if(count>0){
                    this.elements.categoryFilterSelect.value = 'all';
                    await this.loadQuestionsList();
                    await this.refreshAllCategorySelects();
                    this.updateQuickStats();
                    this.showToast(`✅ ${t('imported_count', 'استيراد')} ${count} ${t('questions', 'سؤال')}`);
                } else this.showToast('⚠️ ' + t('no_questions_imported', 'لم يتم استيراد أي سؤال'));
                this.openManageModal();
            };
            input.click();
        },

        // ========== إعدادات ==========
        openSettings() {
            document.querySelectorAll('.group-content').forEach(c=>c.classList.remove('open'));
            document.querySelectorAll('.group-header').forEach(h=>h.classList.remove('open'));
            this.loadSettingsUI();
            this.openModal('settings-modal');
            this.updateSidebarForContext('hidden');
        },

        loadSettingsUI(){
            const s = Settings.data || {};
            document.getElementById('time-per-question-display').textContent = s.timePerQuestion||15;
            document.getElementById('question-count-display').textContent = s.questionCount||10;
            document.getElementById('test-duration-display').textContent = s.testDuration||30;
            document.getElementById('max-wrong-select').value = s.maxWrong||0;
            document.getElementById('mute-sound-checkbox').checked = s.muteSound||false;
            document.getElementById('dark-mode-checkbox').checked = s.darkMode!==false;
            document.getElementById('language-select').value = s.language||'ar';
            document.getElementById('theme-select').value = s.theme||'blue-gold';
            document.getElementById('device-name-input').value = s.deviceName||'';
            if(typeof ThemeManager !== 'undefined') ThemeManager.setTheme(s.theme||'blue-gold');
            document.querySelectorAll('.difficulty-card').forEach(c=>c.classList.remove('active'));
            const diff = document.querySelector(`[data-difficulty="${s.questionDifficulty||'B'}"]`);
            if(diff) diff.classList.add('active');
            if(this.themeSelectContainer){
                const isDark = typeof ThemeManager !== 'undefined' && ThemeManager.isDarkMode();
                this.themeSelectContainer.style.display = isDark ? 'flex' : 'none';
            }
        },

        closeSettings(){
            Settings.syncFromUI();
            Settings.save();
            this.hideAllModals();
            this.goHome();
        },

        toggleSound(muted){ if(typeof AudioManager !== 'undefined') AudioManager.setMute(muted); Settings.data.muteSound=muted; Settings.save(true); },
        toggleDarkMode(enabled){ if(typeof ThemeManager !== 'undefined') ThemeManager.setDarkMode(enabled); else document.body.classList.toggle('light-mode',!enabled); Settings.data.darkMode=enabled; Settings.save(true); if(this.themeSelectContainer) this.themeSelectContainer.style.display = enabled ? 'flex' : 'none'; },
        changeLanguage(lang){ if(typeof I18n !== 'undefined') I18n.setLanguage(lang); Settings.data.language=lang; Settings.save(true); },
        changeTheme(theme){ if(typeof ThemeManager !== 'undefined') ThemeManager.setTheme(theme); else document.body.setAttribute('data-theme',theme); Settings.data.theme=theme; Settings.save(true); },
        openNetworkModal(){ this.openModal('settings-modal'); document.getElementById('network-group')?.classList.add('open'); this.updateSidebarForContext('hidden'); },
        setNetworkMode(mode){ if(typeof Network !== 'undefined'){ if(mode==='teacher') Network.initTeacherMode(); else if(mode==='student') Network.initStudentMode(); } },
        setDeviceName(name){ if(typeof Network !== 'undefined') Network.renameDevice(name); Settings.data.deviceName=name; Settings.save(true); },

        openAchievementsModal(){
            if(typeof Achievements !== 'undefined') Achievements.init().then(()=>Achievements.render('achievements-content'));
            this.openModal('achievements-modal');
            this.updateSidebarForContext('hidden');
        },

        openAboutModal(){ this.openModal('about-modal'); this.updateSidebarForContext('hidden'); },

        // ========== كيفية التصدير و QR (تم الإصلاح) ==========
        showHowToExport() {
            console.log('🔘 فتح مودال كيفية التصدير');
            const modal = document.getElementById('export-guide-modal');
            if (!modal) {
                console.error('❌ export-guide-modal غير موجود في DOM');
                this.showToast('❌ ' + t('modal_not_found', 'عذراً، مودال الإرشادات غير موجود'), '⚠️');
                return;
            }
            window.closeSidebar();
            this.updateSidebarForContext('hidden');
            this.openModalWithSidebarDisabled('export-guide-modal', () => this.openManageModal());
        },

        closeExportGuide() {
            const modal = document.getElementById('export-guide-modal');
            if(modal) modal.classList.remove('active');
            this.disableSidebar(false);
        },

        shareQR() {
            console.log('🔘 فتح مشاركة QR');
            const modal = document.getElementById('qr-modal');
            if (!modal) {
                console.error('❌ qr-modal غير موجود');
                this.showToast('❌ ' + t('qr_modal_not_found', 'عذراً، مودال QR غير موجود'), '⚠️');
                return;
            }
            window.closeSidebar();
            this.updateSidebarForContext('hidden');
            this.openModalWithSidebarDisabled('qr-modal', () => this.openManageModal());
            setTimeout(() => {
                this.generateQRForSelectedCategory();
            }, 200);
        },

        shareQRFromSettings(){ this.shareQR(); },

        async generateQRForSelectedCategory() {
            const container = document.getElementById('qrcode-container');
            const preview = document.getElementById('qr-data-preview');
            if (!container) {
                console.error('qrcode-container not found');
                this.showToast('❌ ' + t('qr_container_not_found', 'عنصر عرض QR غير موجود'), '⚠️');
                return;
            }
            try {
                container.innerHTML = '';
                if (preview) preview.textContent = '';

                const filter = this.elements.categoryFilterSelect?.value;
                let questions;
                if (filter && filter !== 'all') {
                    questions = await DB.questions.where('category').equals(filter).toArray();
                    if (!questions.length) {
                        this.showToast(`⚠️ ${t('no_questions_in_category', 'لا توجد أسئلة في تصنيف')} "${filter}"`);
                        return;
                    }
                } else {
                    questions = await DB.questions.toArray();
                    if (!questions.length) {
                        this.showToast('⚠️ ' + t('no_questions_to_share', 'لا توجد أسئلة للمشاركة'));
                        return;
                    }
                }

                const MAX_QR_QUESTIONS = 30;
                let processedQuestions = questions;
                if (processedQuestions.length > MAX_QR_QUESTIONS) {
                    processedQuestions = processedQuestions.slice(0, MAX_QR_QUESTIONS);
                    this.showToast(`⚠️ ${t('data_truncated', 'تم اقتصار البيانات على أول')} ${MAX_QR_QUESTIONS} ${t('questions', 'سؤالاً')}`, '⚠️');
                }

                const compactData = {
                    v: 3,
                    t: Date.now(),
                    c: processedQuestions.length,
                    q: processedQuestions.map(q => ({
                        t: (q.text || '').substring(0, 120),
                        a: (q.correct || '').substring(0, 60),
                        w: (q.wrongs || []).map(w => (w || '').substring(0, 60)),
                        cat: (q.category || '').substring(0, 30),
                        u: q.unit || 1,
                        l: q.lesson || 1,
                        d: q.difficulty || 'B'
                    }))
                };

                let json = JSON.stringify(compactData);
                console.log(`حجم البيانات: ${json.length} حرف`);

                if (json.length > 1800) {
                    const superCompact = {
                        v: 3,
                        t: Date.now(),
                        c: processedQuestions.length,
                        q: processedQuestions.map(q => ({
                            t: (q.text || '').substring(0, 80),
                            a: (q.correct || '').substring(0, 40),
                            w: (q.wrongs || []).map(w => (w || '').substring(0, 40)),
                            cat: (q.category || '').substring(0, 20),
                            u: q.unit || 1,
                            l: q.lesson || 1,
                            d: (q.difficulty || 'B')[0]
                        }))
                    };
                    json = JSON.stringify(superCompact);
                    console.log(`حجم البيانات بعد الضغط الإضافي: ${json.length} حرف`);
                }

                if (json.length > 2000) {
                    container.innerHTML = '<div style="color:red;text-align:center;">⚠️ ' + t('data_too_large', 'البيانات كبيرة جداً') + '<br>' + t('select_smaller_category', 'اختر تصنيفاً أقل عدداً من الأسئلة') + '</div>';
                    this.showToast('⚠️ ' + t('data_too_large_for_qr', 'البيانات كبيرة جداً لإنشاء QR، اختر تصنيفاً أصغر'), '⚠️');
                    return;
                }

                if (preview) preview.textContent = json.substring(0, 100) + '...';

                if (typeof QRCode === 'undefined') {
                    container.innerHTML = '<div style="color:red;text-align:center;">❌ ' + t('qr_lib_not_available', 'مكتبة QR غير متوفرة') + '<br>' + t('check_internet', 'يرجى التحقق من الاتصال بالإنترنت') + '</div>';
                    this.showToast('❌ ' + t('qr_lib_not_loaded', 'مكتبة QR غير محملة'), '⚠️');
                    return;
                }

                try {
                    new QRCode(container, {
                        text: json,
                        width: 220,
                        height: 220,
                        colorDark: '#ffd700',
                        colorLight: 'transparent',
                        correctLevel: QRCode.CorrectLevel.L
                    });
                    this.showToast(`✅ ${t('qr_created_for', 'تم إنشاء رمز QR لـ')} ${processedQuestions.length} ${t('questions', 'سؤال')}`);
                } catch (qrErr) {
                    console.error('QRCode instantiation error:', qrErr);
                    container.innerHTML = '<div style="color:red;text-align:center;">❌ ' + t('qr_draw_failed', 'فشل رسم QR') + '<br>' + t('try_smaller_category', 'حاول تصنيفاً أصغر') + '</div>';
                    this.showToast('❌ ' + t('qr_draw_failed', 'فشل رسم QR، حاول تصنيفاً أصغر'), '⚠️');
                }
            } catch (e) {
                console.error('QR generation error:', e);
                this.showToast('❌ ' + t('qr_generation_failed', 'فشل إنشاء رمز QR') + ': ' + (e.message || t('unknown_error', 'خطأ غير معروف')), '❌');
                container.innerHTML = '<div style="color:red;text-align:center;">' + t('qr_generation_failed', 'فشل إنشاء QR') + '<br>' + t('try_again', 'يرجى المحاولة مرة أخرى') + '</div>';
            }
        },

        generateQR(){ this.generateQRForSelectedCategory(); },

        downloadQR(){ 
            const canvas = document.querySelector('#qrcode-container canvas'); 
            if(canvas){ 
                const a=document.createElement('a'); 
                a.download='smart-learning-qr.png'; 
                a.href=canvas.toDataURL(); 
                a.click(); 
            } else {
                this.showToast('❌ ' + t('no_qr_to_download', 'لا يوجد رمز QR لتحميله'), '⚠️');
            }
        },

        showHowToImport(){ this.openModalWithSidebarDisabled('how-to-import-modal', () => this.openManageModal()); this.updateSidebarForContext('hidden'); window.closeSidebar(); },

        copyPrompt(){
            const promptText = document.getElementById('prompt-text');
            if (!promptText) {
                this.showToast('❌ ' + t('prompt_not_found', 'لم يتم العثور على نص البرومبت'), '⚠️');
                return;
            }
            let text = '';
            if (promptText.tagName === 'PRE' || promptText.tagName === 'CODE') {
                text = promptText.textContent || promptText.innerText;
            } else {
                text = promptText.value || promptText.textContent || promptText.innerText;
            }
            if (!text) {
                this.showToast('❌ ' + t('text_empty', 'النص فارغ'), '⚠️');
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    this.showToast('✅ ' + t('prompt_copied', 'تم نسخ البرومبت إلى الحافظة'), '📋');
                }).catch(() => {
                    this.fallbackCopyText(text);
                });
            } else {
                this.fallbackCopyText(text);
            }
        },

        fallbackCopyText(text){
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                this.showToast('✅ ' + t('prompt_copied_fallback', 'تم نسخ البرومبت (طريقة احتياطية)'), '📋');
            } catch (err) {
                this.showToast('❌ ' + t('copy_failed', 'فشل النسخ') + ': ' + err.message, '⚠️');
            }
            document.body.removeChild(textarea);
        },

        // ========== النتائج والألعاب ==========
        showFinalReport(data, isTest=false){
            document.getElementById('final-score').textContent = Math.floor(data.score||0);
            document.getElementById('final-stars').textContent = Math.floor(data.stars||0);
            document.getElementById('final-questions').textContent = `${data.correct||0}/${data.total||0}`;
            document.getElementById('final-wrong-clicks').textContent = Math.floor(data.wrong||0);
            document.getElementById('final-correct').textContent = Math.floor(data.correct||0);
            const pct = data.total>0 ? Math.round((data.correct/data.total)*100) : 0;
            let msg = pct>=90? t('excellent', 'ممتاز! 🥰') : pct>=75? t('very_good', 'جيد جداً! 👍') : pct>=50? t('good', 'جيد! استمر في التعلم 📚') : t('try_again', 'لا بأس! حاول مجدداً 💪');
            let emoji = pct>=90? '🏆' : pct>=75? '🥇' : pct>=50? '🥈' : '📚';
            document.getElementById('result-message').textContent = msg;
            document.getElementById('result-emoji').textContent = emoji;
            document.getElementById('review-answers-btn-modal')?.classList.toggle('hidden', !isTest);
            this.openModal('results-modal');
        },

        replayGame(){ this.hideAllModals(); if(typeof Game !== 'undefined') Game.startMode(Game.state.mode); },
        
        reviewAnswers(){ 
            this.hideAllModals(); 
            if(typeof Game !== 'undefined' && Game.showReview) {
                this.disableSidebar(true);
                Game.showReview(); 
            }
        },

        enableSidebarAfterReview() {
            this.disableSidebar(false);
        },

        updateScore(score,stars){ if(this.elements.scoreDisplay) this.elements.scoreDisplay.textContent=Math.floor(score||0); if(this.elements.starsDisplay) this.elements.starsDisplay.textContent=Math.floor(stars||0); },
        updateQuestionNumber(current,total){ if(this.elements.currentQ) this.elements.currentQ.textContent=current; if(this.elements.totalQ) this.elements.totalQ.textContent=total; },
        updateTotalQuestions(total){ if(this.elements.totalQ) this.elements.totalQ.textContent=total; },
        updateTimer(timeLeft,timeLimit){ if(this.elements.timerDisplay) this.elements.timerDisplay.textContent=timeLeft; if(this.elements.timerCircle){ const deg=(timeLeft/timeLimit)*360; this.elements.timerCircle.style.background=`conic-gradient(var(--accent) ${deg}deg, var(--bg-tertiary) 0deg)`; } },
        setTimerPhase(phase){ if(!this.elements.timerCircle) return; this.elements.timerCircle.classList.remove('phase-1','phase-2','phase-3'); if(phase===1) this.elements.timerCircle.classList.add('phase-1'); else if(phase===2) this.elements.timerCircle.classList.add('phase-2'); else if(phase===3) this.elements.timerCircle.classList.add('phase-3'); },
        updatePauseBadge(count){ if(this.elements.pauseCountBadge){ this.elements.pauseCountBadge.textContent=count; this.elements.pauseCountBadge.style.display=count>0?'flex':'none'; } },
        hidePauseHint(){ if(this.elements.pauseHint) this.elements.pauseHint.classList.add('hidden'); },
        showPauseHint(){ if(this.elements.pauseHint) this.elements.pauseHint.classList.remove('hidden'); },
        flashCorrect(btn){ if(btn){ btn.classList.add('correct'); setTimeout(()=>btn.classList.remove('correct'),1000); } },
        flashWrong(btn,correctBtn){ if(btn){ btn.classList.add('wrong'); setTimeout(()=>btn.classList.remove('wrong'),1000); } if(correctBtn){ correctBtn.classList.add('show-correct'); setTimeout(()=>correctBtn.classList.remove('show-correct'),1500); } },
        clearFeedback(){ document.querySelectorAll('.answer-btn').forEach(btn=>btn.classList.remove('correct','wrong','show-correct')); },
        showFloatingText(el,text){ const rect=el.getBoundingClientRect(); const div=document.createElement('div'); div.textContent=text; div.style.cssText=`position:fixed; left:${rect.left+rect.width/2}px; top:${rect.top}px; transform:translate(-50%,0); color:var(--accent); font-weight:900; font-size:1.5rem; pointer-events:none; z-index:9999; animation:floatUp 1s ease-out forwards; text-shadow:0 0 10px black;`; document.body.appendChild(div); setTimeout(()=>div.remove(),1000); },

        async updateQuickStats(){
            try {
                if(typeof PlayerStatsManager !== 'undefined'){
                    const stats = await PlayerStatsManager.getStats();
                    document.getElementById('stat-games').textContent = (stats.totalChallenges||0)+(stats.totalTests||0);
                    document.getElementById('stat-correct').textContent = Math.floor(stats.totalCorrect||0);
                    document.getElementById('stat-score').textContent = Math.floor(stats.totalScore||0);
                    document.getElementById('bank-stars').textContent = Math.floor(stats.totalStars||0);
                    document.getElementById('bank-trophy').textContent = Math.floor(stats.totalScore||0);
                }
                const count = await DB.questions.count();
                document.getElementById('bank-questions-count').textContent = count;
            } catch(e){ console.warn(e); }
        },

        async addDefaultQuestionsIfEmpty(){
            const count = await DB.questions.count();
            if(count===0){
                const defaults = [
                    { text:'كم عدد قارات العالم؟', correct:'7', wrongs:['5','6','8'], category:'جغرافيا', unit:1, lesson:1, difficulty:'A' },
                    { text:'ما عاصمة فرنسا؟', correct:'باريس', wrongs:['لندن','برلين','مدريد'], category:'جغرافيا', unit:1, lesson:2, difficulty:'A' },
                    { text:'مؤسس مايكروسوفت؟', correct:'بيل غيتس', wrongs:['ستيف جوبز','مارك زوكربيرغ','جيف بيزوس'], category:'تقنية', unit:2, lesson:1, difficulty:'B' }
                ];
                for(let i=0;i<defaults.length;i++){
                    await DB.questions.add({...defaults[i], order:Date.now()+i});
                    const exists = await DB.categories.where('name').equalsIgnoreCase(defaults[i].category).count();
                    if(exists===0) await DB.categories.add({ name:defaults[i].category, createdAt:new Date().toISOString() });
                }
                await this.refreshAllCategorySelects();
            }
        },

        async refreshAllCategorySelects(){
            const cats = await CategoryManager.getCategories();
            const filterSelect = document.getElementById('category-filter-select');
            const formSelect = document.getElementById('q-category');
            const options = '<option value="all">'+(t('all_categories', 'الكل'))+'</option>' + cats.map(c=>`<option value="${this.escapeHtml(c.name)}">📁 ${this.escapeHtml(c.name)}</option>`).join('');
            if(filterSelect){
                const cur = filterSelect.value;
                filterSelect.innerHTML = options;
                if(cur && cats.some(c=>c.name===cur)) filterSelect.value = cur;
                else filterSelect.value = 'all';
            }
            if(formSelect){
                formSelect.innerHTML = '<option value="">'+(t('select_category', 'اختر التصنيف...'))+'</option>' + cats.map(c=>`<option value="${this.escapeHtml(c.name)}">📁 ${this.escapeHtml(c.name)}</option>`).join('');
            }
        },

        showToast(msg,icon=''){ const t=document.createElement('div'); t.className='app-toast'; t.innerHTML=`${icon?icon+' ':''}${msg}`; document.body.appendChild(t); setTimeout(()=>{ t.classList.add('hide'); setTimeout(()=>t.remove(),350); },2700); },
        async showAlert(msg,icon='⚠️'){ return new Promise(r=>{ const ov=document.createElement('div'); ov.className='app-alert-overlay'; ov.innerHTML=`<div class="app-alert-box"><div class="alert-icon">${icon}</div><div class="alert-text">${msg}</div><button class="alert-btn" id="alert-ok">${t('ok', 'موافق')}</button></div>`; document.body.appendChild(ov); ov.querySelector('#alert-ok').addEventListener('click',()=>{ ov.remove(); r(true); }); }); },
        async showConfirm(msg,icon='❓'){ return new Promise(r=>{ const ov=document.createElement('div'); ov.className='app-alert-overlay'; ov.innerHTML=`<div class="app-alert-box"><div class="alert-icon">${icon}</div><div class="alert-text">${msg}</div><div class="alert-buttons-row"><button class="alert-btn alert-btn-secondary" id="alert-cancel">${t('cancel', 'إلغاء')}</button><button class="alert-btn" id="alert-ok">${t('confirm', 'تأكيد')}</button></div></div>`; document.body.appendChild(ov); ov.querySelector('#alert-ok').addEventListener('click',()=>{ ov.remove(); r(true); }); ov.querySelector('#alert-cancel').addEventListener('click',()=>{ ov.remove(); r(false); }); }); },
        escapeHtml(str){ if(!str) return ''; const div=document.createElement('div'); div.textContent=str; return div.innerHTML; },
        previewImage(e){ const file=e.target.files[0]; if(file){ const reader=new FileReader(); reader.onload=ev=>{ document.getElementById('image-preview').innerHTML=`<img src="${ev.target.result}" style="max-width:200px;border-radius:8px;">`; }; reader.readAsDataURL(file); } },
        endChallenge(){ if(typeof Game !== 'undefined') Game.endPracticeRound(); },
        endTest(){ if(typeof Game !== 'undefined') Game.submitTest(false); },
        pauseTest(){ if(typeof Game !== 'undefined') Game.pauseTest(); },
        closeApp(){ if(confirm(t('close_app_confirm', 'هل تريد إغلاق التطبيق؟'))) window.location.href='about:blank'; }
    };

    global.UI = UI;
    UI.cacheElements();
    UI.bindEvents();
})(window);
