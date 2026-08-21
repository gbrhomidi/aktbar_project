/* ==================== QUESTION VALIDATOR (محسن ومطور بالكامل) ==================== */
/**
 * Validates question data structure before database insertion
 * يدعم تنسيقات متعددة للأسئلة:
 * - 1- [نص السؤال]
 * - 1. [نص السؤال]
 * - 1 - [نص السؤال]
 * 
 * يدعم الترميز العربي UTF-8 بالكامل
 * مع تحسين معالجة الأخطاء ومرونة التحليل
 */

window.QuestionValidator = (function() {
    'use strict';

    // ========== القواعد الأساسية للتحقق ==========
    const RULES = {
        text: (q) => {
            try {
                return typeof q.text === 'string' && q.text.trim().length > 0;
            } catch (e) { return false; }
        },
        correct: (q) => {
            try {
                return typeof q.correct === 'string' && q.correct.trim().length > 0;
            } catch (e) { return false; }
        },
        wrongs: (q) => {
            try {
                return Array.isArray(q.wrongs) && q.wrongs.length >= 3 &&
                       q.wrongs.slice(0, 3).every(w => typeof w === 'string' && w.trim().length > 0);
            } catch (e) { return false; }
        },
        difficulty: (q) => {
            try {
                return ['A', 'B', 'C', 'D'].includes((q.difficulty || 'B').toUpperCase());
            } catch (e) { return false; }
        },
        unit: (q) => {
            try {
                return typeof (q.unit || 1) === 'number' && q.unit >= 1 && q.unit <= 20;
            } catch (e) { return false; }
        },
        lesson: (q) => {
            try {
                return typeof (q.lesson || 1) === 'number' && q.lesson >= 1 && q.lesson <= 50;
            } catch (e) { return false; }
        }
    };

    const QuestionValidator = {
        /**
         * التحقق من صحة سؤال واحد
         * @param {Object} question - كائن السؤال
         * @returns {boolean}
         */
        validate: function(question) {
            try {
                if (!question || typeof question !== 'object') return false;

                let allValid = true;
                for (const [field, rule] of Object.entries(RULES)) {
                    if (!rule(question)) {
                        allValid = false;
                        break;
                    }
                }

                if (allValid) {
                    try {
                        const allAnswers = [question.correct, ...question.wrongs.slice(0, 3)];
                        const uniqueAnswers = new Set(allAnswers.map(a => a.trim().toLowerCase()));
                        if (uniqueAnswers.size !== 4) {
                            return false;
                        }
                    } catch (e) {
                        return false;
                    }
                }
                return allValid;
            } catch (e) {
                console.warn('[QuestionValidator] validate error:', e);
                return false;
            }
        },

        /**
         * تصفية قائمة الأسئلة وإرجاع الصالحة فقط
         * @param {Array} questions - قائمة الأسئلة
         * @returns {Array}
         */
        filterValid: function(questions) {
            try {
                if (!Array.isArray(questions)) return [];
                const valid = questions.filter(q => this.validate(q));
                if (valid.length !== questions.length) {
                    console.warn(`⚠️ QuestionValidator: Filtered out ${questions.length - valid.length} invalid questions`);
                }
                return valid;
            } catch (e) {
                console.error('[QuestionValidator] filterValid error:', e);
                return [];
            }
        },

        /**
         * تنظيف بيانات السؤال وإرجاع كائن آمن
         * @param {Object} question - السؤال الأصلي
         * @returns {Object}
         */
        sanitize: function(question) {
            try {
                if (!question || typeof question !== 'object') {
                    return this._getEmptyQuestion();
                }
                const sanitized = {
                    text: String(question.text || '').trim(),
                    correct: String(question.correct || '').trim(),
                    wrongs: Array.isArray(question.wrongs) ? question.wrongs.map(w => String(w).trim()).slice(0, 3) : ['', '', ''],
                    difficulty: String(question.difficulty || 'B').toUpperCase(),
                    unit: Number(question.unit) || 1,
                    lesson: Number(question.lesson) || 1,
                    category: String(question.category || 'عام').trim(),
                    order: Number(question.order) || Date.now()
                };
                if (sanitized.unit < 1) sanitized.unit = 1;
                if (sanitized.unit > 20) sanitized.unit = 20;
                if (sanitized.lesson < 1) sanitized.lesson = 1;
                if (sanitized.lesson > 50) sanitized.lesson = 50;
                if (!['A', 'B', 'C', 'D'].includes(sanitized.difficulty)) {
                    sanitized.difficulty = 'B';
                }
                while (sanitized.wrongs.length < 3) sanitized.wrongs.push('');
                return sanitized;
            } catch (e) {
                console.warn('[QuestionValidator] sanitize error:', e);
                return this._getEmptyQuestion();
            }
        },

        /**
         * تحليل كتلة نصية واحدة واستخراج سؤال منها (نسخة محسنة)
         * @param {string} block - كتلة النص
         * @returns {Object|null}
         */
        parseBlock: function(block) {
            try {
                if (!block || typeof block !== 'string') return null;

                // استخراج نص السؤال (يدعم - و . بعد الرقم)
                const questionMatch = block.match(/^\d+\s*[-.]\s*\[(.*?)\]/s);
                if (!questionMatch) return null;

                // استخراج الإجابات الخاطئة
                let wrongMatch = block.match(/إجابات خاطئة\s*\[(.*?)\]\s*[،,]\s*\[(.*?)\]\s*[،,]\s*\[(.*?)\]/);
                if (!wrongMatch) {
                    // محاولة بديلة: البحث عن ثلاثة أقواس بعد "إجابات خاطئة"
                    const wrongsTemp = block.match(/إجابات خاطئة\s*\[(.*?)\].*?\[(.*?)\].*?\[(.*?)\]/s);
                    if (wrongsTemp && wrongsTemp.length >= 4) {
                        wrongMatch = wrongsTemp;
                    }
                }
                if (!wrongMatch) return null;

                // استخراج الإجابة الصحيحة
                let correctMatch = block.match(/الإجابة الصحيحة\s*\[(.*?)\]/);
                if (!correctMatch) return null;
                let correct = correctMatch[1].trim().replace(/[،,]$/, '');

                // استخراج الوحدة والدرس والصعوبة والتصنيف
                const unitMatch = block.match(/وحدة السؤال\s*\[\s*(\d+)\s*\]/);
                const lessonMatch = block.match(/درس السؤال\s*\[\s*(\d+)\s*\]/);
                const difficultyMatch = block.match(/درجة الصعوبة\s*\[\s*([ABCD])\s*\]/i);
                const categoryMatch = block.match(/التصنيف\s*\[(.*?)\]/);

                const question = {
                    text: questionMatch[1].trim(),
                    wrongs: [wrongMatch[1].trim(), wrongMatch[2].trim(), wrongMatch[3].trim()],
                    correct: correct,
                    unit: unitMatch ? parseInt(unitMatch[1]) : 1,
                    lesson: lessonMatch ? parseInt(lessonMatch[1]) : 1,
                    difficulty: difficultyMatch ? difficultyMatch[1].toUpperCase() : 'B',
                    category: categoryMatch ? categoryMatch[1].trim() : 'عام'
                };

                if (!question.text || !question.correct) return null;
                if (question.wrongs.some(w => !w)) return null;
                return question;
            } catch (e) {
                console.warn('[QuestionValidator] parseBlock error:', e);
                return null;
            }
        },

        /**
         * تحليل نص كامل واستخراج جميع الأسئلة (محسن لاستخراج الكل)
         * @param {string} text - النص الكامل
         * @returns {Array}
         */
        parseText: function(text) {
            try {
                if (!text || typeof text !== 'string') return [];

                // نمط للبحث عن بداية كل سؤال: رقم ثم (- أو .) ثم مسافة اختيارية ثم [
                const startPattern = /(\d+\s*[-.]\s*\[)/g;
                const matches = [];
                let match;
                while ((match = startPattern.exec(text)) !== null) {
                    matches.push({ index: match.index, length: match[0].length });
                }

                if (matches.length === 0) return [];

                const blocks = [];
                for (let i = 0; i < matches.length; i++) {
                    const start = matches[i].index;
                    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
                    const block = text.substring(start, end).trim();
                    if (block) blocks.push(block);
                }

                const questions = [];
                for (const block of blocks) {
                    try {
                        const q = this.parseBlock(block);
                        if (q && this.validate(q)) {
                            questions.push(this.sanitize(q));
                        } else {
                            console.warn('[QuestionValidator] Skipping invalid block:', block.substring(0, 100));
                        }
                    } catch (e) {
                        console.warn('[QuestionValidator] Parse error in block:', e.message);
                    }
                }

                console.log(`📄 QuestionValidator: تم استخراج ${questions.length} سؤال صالح من ${blocks.length} كتلة`);
                return questions;
            } catch (e) {
                console.error('[QuestionValidator] parseText error:', e);
                return [];
            }
        },

        _getEmptyQuestion: function() {
            return {
                text: '',
                correct: '',
                wrongs: ['', '', ''],
                difficulty: 'B',
                unit: 1,
                lesson: 1,
                category: 'عام',
                order: Date.now()
            };
        },

        isValidFormat: function(text) {
            try {
                if (!text || typeof text !== 'string') return false;
                return /^\d+\s*[-.]\s*\[/.test(text) && 
                       /إجابات خاطئة\s*\[.*?\]\s*[،,]\s*\[.*?\]\s*[،,]\s*\[.*?\]/.test(text) &&
                       /الإجابة الصحيحة\s*\[.*?\]/.test(text);
            } catch (e) {
                return false;
            }
        },

        fixEncoding: function(text) {
            if (!text || typeof text !== 'string') return '';
            return text
                .replace(/Ã©/g, 'é')
                .replace(/Ã¨/g, 'è')
                .replace(/Ãª/g, 'ê')
                .replace(/Ã®/g, 'î')
                .replace(/Ã§/g, 'ç')
                .replace(/â€‹/g, '')
                .replace(/â€/g, '')
                .replace(/â/g, '"')
                .replace(/â/g, '"')
                .replace(/â/g, "'")
                .replace(/â/g, '-')
                .trim();
        },

        normalizeText: function(text) {
            if (!text || typeof text !== 'string') return '';
            return text
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[،,]+/g, '،')
                .trim();
        },

        parseWithAutoFix: function(text) {
            let fixed = this.fixEncoding(text);
            fixed = this.normalizeText(fixed);
            return this.parseText(fixed);
        }
    };

    return QuestionValidator;
})();