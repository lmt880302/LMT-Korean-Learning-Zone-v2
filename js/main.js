// js/main.js
// 韓語學習網 全域 JavaScript - 高級優化版

/**
 * @file 全域 JavaScript 檔案，負責網站的通用互動功能。
 * @version 2.3.0
 */

// ============================================================================
// 1. 應用程式設定 (凍結以防止意外修改)
// ============================================================================
const AppConfig = Object.freeze({
    // 導航高亮
    HIGHLIGHT_ACTIVE_NAV: true,

    // 平滑捲動
    ENABLE_SMOOTH_SCROLL: true,

    // 回到頂部按鈕
    ENABLE_BACK_TO_TOP: true,
    BACK_TO_TOP_DEFAULTS: {
        thresholdPx: 300,
        buttonClasses: 'fixed bottom-8 right-8 bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-full shadow-lg transition-opacity duration-300 opacity-0 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 print:hidden',
        svgIcon: `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            </svg>
            <span class="sr-only">回到頂部</span>
        `,
        ariaLabel: '回到頂部',
        scrollThrottleLimit: 150,
    },

    // 閱讀進度條
    ENABLE_READING_PROGRESS: true,
    READING_PROGRESS_COLOR: 'linear-gradient(90deg, #c9a96e, #dbb87a)',

    // 鍵盤快捷鍵
    ENABLE_KEYBOARD_SHORTCUTS: true,
    KEYBOARD_SHORTCUTS: {
        FLASHCARDS: 'k',      // Ctrl+K 跳轉閃卡
        HELP: '?',            // 顯示幫助提示
    },

    // 版本
    version: '2.3.0',
});

// ============================================================================
// 2. 工具函數
// ============================================================================

/**
 * 函數節流 (Throttle)
 * @param {Function} func - 要節流的函式。
 * @param {number} limit - 時間間隔 (毫秒)。
 * @returns {Function} - 經過節流處理的函式。
 */
function throttle(func, limit) {
    let inThrottle = false;
    let lastArgs = null;
    let lastThis = null;
    let timerId = null;

    return function (...args) {
        if (inThrottle) {
            // 儲存最近的調用，以便在 throttle 結束後執行 trailing edge
            lastArgs = args;
            lastThis = this;
            return;
        }

        // 首次執行 (leading edge)
        func.apply(this, args);
        inThrottle = true;

        const reset = () => {
            inThrottle = false;
            if (lastArgs !== null) {
                // 執行 trailing edge 調用
                const tempArgs = lastArgs;
                const tempThis = lastThis;
                lastArgs = null;
                lastThis = null;
                func.apply(tempThis, tempArgs);
                // 重新設定計時器以繼續節流 (實務上這樣做可能導致連續執行，此處簡化)
                // 更嚴謹的做法：在此處重新設定 reset 計時器，但我們簡單使用 trailing 只執行一次
                // 因此清空後不重新啟動計時器，下一次觸發會重新開始 leading edge
            }
        };

        clearTimeout(timerId);
        timerId = setTimeout(reset, limit);
    };
}

// ============================================================================
// 3. 閱讀進度條 (新增)
// ============================================================================
class ReadingProgress {
    /**
     * @param {string} [color] - 進度條的漸層顏色
     */
    constructor(color = AppConfig.READING_PROGRESS_COLOR) {
        this.color = color;
        this.bar = null;
        this._init();
    }

    _init() {
        this.bar = document.createElement('div');
        this.bar.style.cssText = `
            position: fixed;
            top: 56px; /* 導航列高度，請依實際調整 */
            left: 0;
            height: 2px;
            background: ${this.color};
            width: 0%;
            z-index: 49;
            transition: width 0.1s ease;
            box-shadow: 0 0 12px rgba(201, 169, 110, 0.2);
        `;
        document.body.prepend(this.bar);

        // 節流更新
        const updateProgress = throttle(() => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            this.bar.style.width = Math.min(progress, 100) + '%';
        }, 50);

        window.addEventListener('scroll', updateProgress, { passive: true });
        // 初次計算
        updateProgress();
    }

    /** 手動更新進度（例如頁面內容動態載入後） */
    update() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        this.bar.style.width = Math.min(progress, 100) + '%';
    }
}

// ============================================================================
// 4. 回到頂部按鈕 (優化 IntersectionObserver 邏輯)
// ============================================================================
class BackToTopButton {
    constructor(options = {}) {
        this.config = { ...AppConfig.BACK_TO_TOP_DEFAULTS, ...options };
        this.element = null;
        this.scrollTriggerElement = null;
        this._init();
    }

    _createButton() {
        const button = document.createElement('button');
        button.innerHTML = this.config.svgIcon;
        button.className = this.config.buttonClasses;
        button.style.zIndex = '1000';
        button.setAttribute('aria-label', this.config.ariaLabel);
        button.setAttribute('type', 'button');
        button.setAttribute('aria-hidden', 'true');
        button.style.visibility = 'hidden';
        return button;
    }

    _createScrollTrigger() {
        this.scrollTriggerElement = document.createElement('div');
        this.scrollTriggerElement.style.position = 'absolute';
        this.scrollTriggerElement.style.height = '1px';
        this.scrollTriggerElement.style.width = '1px';
        this.scrollTriggerElement.style.top = `${this.config.thresholdPx}px`;
        this.scrollTriggerElement.style.left = '0';
        this.scrollTriggerElement.style.pointerEvents = 'none';
        document.body.prepend(this.scrollTriggerElement);
    }

    _updateVisibility(isVisible) {
        this.element.classList.toggle('opacity-100', isVisible);
        this.element.classList.toggle('opacity-0', !isVisible);
        this.element.style.visibility = isVisible ? 'visible' : 'hidden';
        this.element.setAttribute('aria-hidden', String(!isVisible));
    }

    _setupVisibilityObserver() {
        if (!('IntersectionObserver' in window)) {
            console.warn('BackToTopButton: IntersectionObserver not supported. Fallback to scroll listener.');
            this._setupLegacyScrollListener();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                // 當觸發元素完全離開視窗頂部時顯示按鈕
                const shouldShow = !entry.isIntersecting && entry.boundingClientRect.top < 0;
                this._updateVisibility(shouldShow);
            },
            { root: null, rootMargin: '0px', threshold: 0 }
        );
        observer.observe(this.scrollTriggerElement);
    }

    _setupLegacyScrollListener() {
        const throttled = throttle(() => {
            const isVisible = window.scrollY > this.config.thresholdPx;
            this._updateVisibility(isVisible);
        }, this.config.scrollThrottleLimit);
        window.addEventListener('scroll', throttled, { passive: true });
    }

    _scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.element.blur();
    }

    _init() {
        this.element = this._createButton();
        document.body.appendChild(this.element);

        if (this.config.thresholdPx > 0) {
            this._createScrollTrigger();
            this._setupVisibilityObserver();
        } else {
            // threshold 為 0 或負數時，始終顯示
            this._updateVisibility(true);
        }

        this.element.addEventListener('click', () => this._scrollToTop());
    }
}

// ============================================================================
// 5. 導航高亮 (改用 data-page 屬性)
// ============================================================================
function highlightActiveNavLink() {
    // 從 body 的 data-page 屬性讀取當前頁面識別碼
    const currentPage = document.body.dataset.page;
    if (!currentPage) {
        // 若未設置，則回退到舊的 URL 比對方式
        fallbackHighlightByURL();
        return;
    }

    const navLinks = document.querySelectorAll('header nav a[data-page]');
    navLinks.forEach(link => {
        const isActive = link.dataset.page === currentPage;
        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

/**
 * 舊版 URL 比對的備援方案 (保留原邏輯)
 */
function fallbackHighlightByURL() {
    const navLinks = document.querySelectorAll('header nav a[href]');
    if (!navLinks.length) return;

    const currentLocation = new URL(window.location.href);
    const currentPathname = normalizePathForComparison(currentLocation.pathname);

    navLinks.forEach(link => {
        const linkUrl = new URL(link.href);
        const linkPathname = normalizePathForComparison(linkUrl.pathname);
        const isActive = linkPathname === currentPathname;

        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

/**
 * 標準化路徑，將資料夾結尾補上 index.html (與原邏輯相同)
 */
function normalizePathForComparison(path) {
    if (path.endsWith('/')) {
        return path + 'index.html';
    }
    return path;
}

// ============================================================================
// 6. 平滑捲動 (保留原功能)
// ============================================================================
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.length > 1 && href.startsWith('#')) {
                try {
                    const target = document.querySelector(href);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } catch (_) {
                    // ignore invalid selector
                }
            }
        });
    });
}

// ============================================================================
// 7. 鍵盤快捷鍵 (新增)
// ============================================================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 忽略輸入框、文字區域中的快捷鍵
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;

        // Ctrl+K → 跳轉到閃卡頁
        if (ctrl && e.key === AppConfig.KEYBOARD_SHORTCUTS.FLASHCARDS) {
            e.preventDefault();
            window.location.href = '/vocabulary/flashcards.html';
            return;
        }

        // 按 ? 顯示幫助提示
        if (e.key === AppConfig.KEYBOARD_SHORTCUTS.HELP) {
            e.preventDefault();
            const msg = '⌨️ 快捷鍵幫助:\n' +
                'Ctrl+K  → 前往閃卡練習\n' +
                '?       → 顯示此幫助';
            alert(msg);
        }
    });
}

// ============================================================================
// 8. 主初始化函數
// ============================================================================
function initializeGlobalScripts() {
    console.log(`main.js v${AppConfig.version} loaded — 韓語學習網初始化`);

    if (AppConfig.HIGHLIGHT_ACTIVE_NAV) {
        highlightActiveNavLink();
    }

    if (AppConfig.ENABLE_SMOOTH_SCROLL) {
        setupSmoothScrolling();
    }

    if (AppConfig.ENABLE_BACK_TO_TOP) {
        new BackToTopButton({ thresholdPx: AppConfig.BACK_TO_TOP_DEFAULTS.thresholdPx });
    }

    if (AppConfig.ENABLE_READING_PROGRESS) {
        new ReadingProgress();
    }

    if (AppConfig.ENABLE_KEYBOARD_SHORTCUTS) {
        setupKeyboardShortcuts();
    }

    console.log('main.js 初始化完成。');
}

// ============================================================================
// 9. 啟動
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalScripts);
} else {
    initializeGlobalScripts();
}