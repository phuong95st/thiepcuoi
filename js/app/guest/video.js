import { progress } from './progress.js';
import { util } from '../../common/util.js';

export const video = (() => {

    /**
     * @returns {Promise<void>}
     */
    const load = () => {
        const wrap = document.getElementById('video-love-stroy');
        if (!wrap || !wrap.hasAttribute('data-src')) {
            wrap?.remove();
            progress.complete('video', true);
            return Promise.resolve();
        }

        const src = wrap.getAttribute('data-src');
        if (!src) {
            progress.complete('video', true);
            return Promise.resolve();
        }

        const videoUrl = util.resolveUrl(src);
        const posterUrl = util.resolveUrl('./assets/images/video-thumbnail.webp');
        const isInApp = util.isInAppBrowser();
        let finished = false;

        /**
         * @returns {void}
         */
        const markReady = () => {
            if (finished) {
                return;
            }
            finished = true;
            progress.complete('video');
            document.getElementById('video-love-stroy-loading')?.remove();
        };

        const vid = document.createElement('video');
        vid.className = wrap.getAttribute('data-vid-class') || 'w-100 rounded-4 shadow-sm m-0 p-0';
        vid.controls = true;
        vid.playsInline = true;
        vid.setAttribute('playsinline', '');
        vid.setAttribute('webkit-playsinline', '');
        vid.setAttribute('x5-playsinline', '');
        vid.setAttribute('x5-video-player-type', 'h5');
        vid.poster = posterUrl;

        if (isInApp) {
            vid.preload = 'none';
            vid.autoplay = false;
            vid.loop = false;
            vid.muted = false;
        } else {
            vid.preload = 'metadata';
            vid.loop = true;
            vid.muted = true;
            vid.autoplay = true;
            vid.src = videoUrl;
        }

        /**
         * Must run synchronously inside a user click/touch handler (Zalo WebView).
         * @returns {void}
         */
        const playFromGesture = () => {
            if (!vid.getAttribute('data-src-applied')) {
                vid.src = videoUrl;
                vid.setAttribute('data-src-applied', videoUrl);
                vid.load();
            }

            const attempt = vid.play();
            if (attempt && typeof attempt.then === 'function') {
                attempt.catch(() => {
                    vid.muted = true;
                    vid.play().catch(() => null);
                });
            }
        };

        /**
         * @returns {HTMLButtonElement}
         */
        const createPlayOverlay = () => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-light border-0 rounded-circle shadow position-absolute top-50 start-50 translate-middle z-3 d-flex justify-content-center align-items-center';
            btn.style.width = '4.2rem';
            btn.style.height = '4.2rem';
            btn.setAttribute('aria-label', 'Phát video');
            btn.innerHTML = '<i class="fa-solid fa-play fa-lg text-danger ms-1"></i>';

            btn.addEventListener('click', () => {
                btn.remove();
                playFromGesture();
            });

            return btn;
        };

        wrap.appendChild(vid);

        window.setTimeout(() => markReady(), isInApp ? 4000 : 12000);

        vid.addEventListener('loadedmetadata', markReady, { once: true });
        vid.addEventListener('loadeddata', markReady, { once: true });
        vid.addEventListener('error', markReady, { once: true });

        if (vid.readyState >= 1) {
            markReady();
        }

        if (isInApp) {
            wrap.appendChild(createPlayOverlay());
            return Promise.resolve();
        }

        const observer = new IntersectionObserver((es) => {
            es.forEach((e) => {
                if (e.isIntersecting) {
                    vid.play().catch(() => null);
                } else if (!vid.paused) {
                    vid.pause();
                }
            });
        }, { threshold: 0.25 });

        observer.observe(vid);
        vid.play().catch(() => null);

        return Promise.resolve();
    };

    /**
     * @returns {object}
     */
    const init = () => {
        progress.add();

        return {
            load,
        };
    };

    return {
        init,
    };
})();
