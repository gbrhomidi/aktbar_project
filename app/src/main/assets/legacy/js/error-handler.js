// ==================== ERROR-HANDLER.JS (مُحسّن ومُعالَج) ====================
window.ErrorHandler = (function() {
    'use strict';

    let errorListener = null;
    let rejectionListener = null;

    function safeConsoleError(message, error) {
        if (typeof console !== 'undefined' && console.error) {
            console.error(message, error);
        } else {
            try {
                if (typeof alert === 'function') {
                    alert(message + ' ' + (error?.message || error));
                }
            } catch (e) {}
        }
    }

    function showUserMessage(context) {
        try {
            if (typeof window.UI !== 'undefined' && window.UI && typeof window.UI.showToast === 'function') {
                window.UI.showToast(`حدث خطأ في ${context}`);
            } else if (typeof window.UI !== 'undefined' && window.UI && typeof window.UI.showAlert === 'function') {
                window.UI.showAlert(`حدث خطأ في ${context}`, '❌');
            } else {
                if (typeof alert === 'function') {
                    alert(`⚠️ حدث خطأ في ${context}`);
                }
            }
        } catch (e) {
            safeConsoleError('Error while showing user message:', e);
        }
    }

    const ErrorHandler = {
        capture(error, context = 'unknown') {
            safeConsoleError(`❌ [${context}]`, error);
            showUserMessage(context);
        },

        log(error, context = 'unknown') {
            this.capture(error, context);
        },

        init() {
            this.removeListeners();

            errorListener = (event) => {
                this.capture(event.error || event.message, 'runtime');
            };

            rejectionListener = (event) => {
                this.capture(event.reason, 'promise');
            };

            window.addEventListener('error', errorListener);
            window.addEventListener('unhandledrejection', rejectionListener);
        },

        removeListeners() {
            if (errorListener) {
                window.removeEventListener('error', errorListener);
                errorListener = null;
            }
            if (rejectionListener) {
                window.removeEventListener('unhandledrejection', rejectionListener);
                rejectionListener = null;
            }
        }
    };

    window.onerror = (message, source, lineno, colno, error) => {
        ErrorHandler.capture(error || message, 'global');
        return true;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ErrorHandler.init());
    } else {
        ErrorHandler.init();
    }

    return ErrorHandler;
})();
