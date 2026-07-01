/* ==================== CONSTANTS.JS ==================== */
window.Constants = (function() {
    'use strict';

    const STORAGE_KEYS = {
        THEME: 'theme',
        LANGUAGE: 'language',
        DARK_MODE: 'dark_mode',
        MUTE_SOUND: 'mute_sound',
        SOUND_ENABLED: 'sound_enabled',
        TIME_PER_QUESTION: 'time_per_question',
        QUESTION_COUNT: 'question_count',
        MAX_WRONG: 'max_wrong',
        TEST_DURATION: 'test_duration',
        DIFFICULTY: 'question_difficulty',
        FROM_UNIT: 'from_unit',
        TO_UNIT: 'to_unit',
        FROM_LESSON: 'from_lesson',
        TO_LESSON: 'to_lesson',
        APP_VERSION: 'app_version',
        DEVICE_NAME: 'device_name'
    };

    const DIFFICULTY = {
        EASY: 'A',
        MEDIUM: 'B',
        HARD: 'C',
        EXPERT: 'D'
    };

    const SOUND_NAMES = {
        CORRECT: 'correct',
        WRONG: 'wrong',
        STAR: 'star',
        TIMER_TICK: 'tick',
        TIMER_WARNING: 'timer_3',
        ROUND_COMPLETE: 'round_complete',
        GAME_OVER: 'game_over',
        BUTTON_CLICK: 'button_click',
        ACHIEVEMENT: 'achievement',
        STARTUP: 'startup',
        CHALLENGE_START: 'challenge_start'
    };

    const DEFAULT_SETTINGS = {
        [STORAGE_KEYS.TIME_PER_QUESTION]: 15,
        [STORAGE_KEYS.QUESTION_COUNT]: 10,
        [STORAGE_KEYS.MAX_WRONG]: 3,
        [STORAGE_KEYS.TEST_DURATION]: 30,
        [STORAGE_KEYS.MUTE_SOUND]: false,
        [STORAGE_KEYS.SOUND_ENABLED]: true,
        [STORAGE_KEYS.DARK_MODE]: true,
        [STORAGE_KEYS.LANGUAGE]: 'ar',
        [STORAGE_KEYS.THEME]: 'blue-gold',
        [STORAGE_KEYS.DIFFICULTY]: DIFFICULTY.MEDIUM,
        [STORAGE_KEYS.FROM_UNIT]: 1,
        [STORAGE_KEYS.TO_UNIT]: 1,
        [STORAGE_KEYS.FROM_LESSON]: 1,
        [STORAGE_KEYS.TO_LESSON]: 6,
        [STORAGE_KEYS.DEVICE_NAME]: `Device-${Math.floor(Math.random() * 9999)}`
    };

    const AVAILABLE_THEMES = [
        'blue-gold', 'emerald-gold', 'ruby-gold', 'amethyst-gold',
        'charcoal-gold', 'ocean-gold', 'sunset-gold', 'forest-gold',
        'midnight-gold', 'rose-gold', 'neon-gold', 'cosmic-gold'
    ];

    return {
        STORAGE_KEYS,
        DIFFICULTY,
        SOUND_NAMES,
        DEFAULT_SETTINGS,
        AVAILABLE_THEMES
    };
})();
