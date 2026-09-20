import { progress } from './progress.js';

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

        const vid = document.createElement('video');
        vid.className = wrap.getAttribute('data-vid-class') || 'w-100 rounded-4 shadow-sm m-0 p-0';
        vid.controls = true;
        vid.playsInline = true;
        vid.loop = true;
        vid.muted = true;
        vid.autoplay = true;
        vid.preload = 'metadata';
        vid.poster = './assets/images/video-thumbnail.webp';
        vid.src = src;

        // Auto-play when visible, pause when hidden
        const observer = new IntersectionObserver((es) => {
            es.forEach((e) => {
                if (e.isIntersecting) {
                    vid.play().catch(() => null);
                } else if (!vid.paused) {
                    vid.pause();
                }
            });
        }, { threshold: 0.25 });

        wrap.appendChild(vid);
        observer.observe(vid);

        const onReady = () => {
            progress.complete('video');
            document.getElementById('video-love-stroy-loading')?.remove();
            // Try to autoplay; browsers require muted for autoplay
            vid.play().catch(() => null);
        };

        vid.addEventListener('loadedmetadata', onReady, { once: true });
        vid.addEventListener('canplay', onReady, { once: true });
        vid.addEventListener('error', () => {
            progress.complete('video');
            document.getElementById('video-love-stroy-loading')?.remove();
        }, { once: true });

        if (vid.readyState >= 1) {
            onReady();
        }

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