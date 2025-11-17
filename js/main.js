(function () {
    // Simple HTML partial include: elements with [data-include] will fetch and inject
    async function includePartials() {
        const nodes = document.querySelectorAll('[data-include]');
        await Promise.all(
            Array.from(nodes).map(async (node) => {
                const url = node.getAttribute('data-include');
                if (!url) return;
                try {
                    const res = await fetch(url, { cache: 'no-cache' });
                    const html = await res.text();
                    node.innerHTML = html;
                } catch (e) {
                    console.error('Include failed:', url, e);
                }
            })
        );
    }

    function initTheme() {
        const saved = localStorage.getItem('theme');
        // Set dark mode as default regardless of system preference
        const apply = (theme) => {
            document.documentElement.classList.toggle('theme-dark', theme === 'dark');
            localStorage.setItem('theme', theme);
        };
        // Default to 'dark' if no saved preference exists
        apply(saved || 'dark');

        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.matches('[data-toggle-theme]')) {
                const isDark = document.documentElement.classList.contains('theme-dark');
                apply(isDark ? 'light' : 'dark');
            }
        });
    }

    function initMobileMenu() {
        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.matches('[data-toggle-menu]')) {
                const links = document.querySelector('.nav-links');
                if (links) links.classList.toggle('open');
            }
            // Close menu after tapping a link (useful on mobile)
            if (t && t.closest && t.closest('.nav-links a')) {
                const links = document.querySelector('.nav-links');
                if (links && links.classList.contains('open')) links.classList.remove('open');
            }
        });
    }

    function initUniversalLightbox() {
        // Create a universal lightbox with nav and caption
        let lightbox = document.getElementById('universal-lightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'universal-lightbox';
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `
                <a href="#" class="close" aria-label="Close">×</a>
                <img src="" alt="">
                <div class="nav">
                    <a href="#" class="prev" aria-label="Previous">‹</a>
                    <a href="#" class="next" aria-label="Next">›</a>
                </div>
                <div class="caption"></div>
            `;
            document.body.appendChild(lightbox);
        }

        const imgEl = lightbox.querySelector('img');
        const captionEl = lightbox.querySelector('.caption');
        const btnPrev = lightbox.querySelector('.prev');
        const btnNext = lightbox.querySelector('.next');
        const btnClose = lightbox.querySelector('.close');

        // Build a list of gallery items (src + caption) within an optional root container
        function collectGalleryItems(rootEl) {
            const scope = rootEl || document;
            const figures = Array.from(scope.querySelectorAll('.gallery figure'));
            if (figures.length) {
                return figures.map((fig) => {
                    const img = fig.querySelector('img');
                    const cap = fig.querySelector('figcaption');
                    return { el: img, src: img?.getAttribute('src'), alt: img?.getAttribute('alt') || '', caption: cap?.textContent?.trim() || img?.getAttribute('alt') || '' };
                }).filter(x => !!x.src);
            }
            // Fallback to any images inside .gallery
            const imgs = Array.from(scope.querySelectorAll('.gallery a img, .gallery img'));
            return imgs.map((img) => ({ el: img, src: img.getAttribute('src'), alt: img.getAttribute('alt') || '', caption: img.getAttribute('alt') || '' })).filter(x => !!x.src);
        }

        // Default to research media gallery if present
        let items = collectGalleryItems(document.querySelector('.media-gallery'));
        let current = -1;

        function show(index, withFade = false) {
            if (!items.length) return;
            // wrap around
            if (index < 0) index = items.length - 1;
            if (index >= items.length) index = 0;
            current = index;
            const it = items[current];
            const apply = () => {
                imgEl.src = it.src;
                imgEl.alt = it.alt || '';
                captionEl.textContent = it.caption || '';
                lightbox.style.display = 'flex';
            };
            if (withFade) {
                imgEl.style.opacity = '0';
                // Preload image before fade-in
                const pre = new Image();
                pre.onload = () => {
                    apply();
                    // allow next frame to apply opacity
                    requestAnimationFrame(() => { imgEl.style.opacity = '1'; });
                };
                pre.src = it.src;
            } else {
                apply();
                imgEl.style.opacity = '1';
            }
        }

        // Open on click of gallery images
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            // Research media gallery click
            if (target.matches('.media-gallery .gallery img') && !target.closest('.lightbox')) {
                e.preventDefault();
                const root = target.closest('.media-gallery');
                items = collectGalleryItems(root);
                const idx = items.findIndex((x) => x.el === target);
                show(idx >= 0 ? idx : 0);
            }
            // Development images (project pages) click
            if (target.matches('#dev-images .gallery img') && !target.closest('.lightbox')) {
                e.preventDefault();
                const root = target.closest('#dev-images');
                items = collectGalleryItems(root);
                const idx = items.findIndex((x) => x.el === target);
                show(idx >= 0 ? idx : 0);
            }
        });

        // Close lightbox
        btnClose.addEventListener('click', (e) => {
            e.preventDefault();
            lightbox.style.display = 'none';
        });

        // Background click closes
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                lightbox.style.display = 'none';
            }
        });

        // Navigation
        btnPrev.addEventListener('click', (e) => { e.preventDefault(); if (current !== -1) show(current - 1, true); });
        btnNext.addEventListener('click', (e) => { e.preventDefault(); if (current !== -1) show(current + 1, true); });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display === 'flex') {
                if (e.key === 'Escape') { lightbox.style.display = 'none'; stopSlideshow(); }
                if (e.key === 'ArrowLeft') show(current - 1, true);
                if (e.key === 'ArrowRight') show(current + 1, true);
            }
        });

        // Slideshow controls
        let slideTimer = null;
        function stopSlideshow() {
            if (slideTimer) {
                clearInterval(slideTimer);
                slideTimer = null;
            }
        }
        function startSlideshow() {
            const root = document.querySelector('.media-gallery');
            items = collectGalleryItems(root);
            if (!items.length) return;
            // Start from first item if none active
            const startIndex = current >= 0 ? current : 0;
            show(startIndex, true);
            stopSlideshow();
            slideTimer = setInterval(() => {
                if (lightbox.style.display !== 'flex') { stopSlideshow(); return; }
                show(current + 1, true);
            }, 3500);
        }

        // Bind slideshow start button
        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.matches('[data-slideshow="start"]')) {
                e.preventDefault();
                startSlideshow();
            }
        });

        // Stop slideshow when closing
        btnClose.addEventListener('click', () => stopSlideshow());
        lightbox.addEventListener('click', (e) => { if (e.target === lightbox) stopSlideshow(); });
    }

    // Initialize after partials load so header elements exist
    window.addEventListener('DOMContentLoaded', async () => {
        await includePartials();

        // Footer: ensure dynamic year is applied (scripts inside injected HTML won't run)
        try {
            const yearSpan = document.getElementById('footer-year');
            if (yearSpan) yearSpan.textContent = new Date().getFullYear();
        } catch (_) { }

        // Footer: force columns and all footer elements to be visible
        try {
            // Force footer columns to display as grid
            document.querySelectorAll('.site-footer__cols').forEach((el) => {
                el.style.display = 'grid';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.width = '100%';
            });

            // Ensure footer columns are visible
            document.querySelectorAll('.site-footer__col').forEach((el) => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
            });

            // Ensure footer links are visible
            document.querySelectorAll('.site-footer__links').forEach((el) => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
            });

            // Ensure footer headings are visible
            document.querySelectorAll('.site-footer__heading').forEach((el) => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
            });

            // Ensure footer bottom is visible
            document.querySelectorAll('.site-footer__bottom').forEach((el) => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
            });
        } catch (_) { }

        initTheme();
        initMobileMenu();
        initUniversalLightbox();

        // Highlight active nav link based on current path
        try {
            const path = location.pathname.split('/').pop() || 'index.html';
            const links = document.querySelectorAll('.nav-links a');
            links.forEach((a) => {
                const href = a.getAttribute('href');
                if (!href) return;
                // Match index on root as well
                const isHome = (path === '' || path === 'index.html') && href.endsWith('index.html');
                if (isHome || href.endsWith(path)) {
                    a.classList.add('active');
                }
            });
        } catch (_) { }
    });
})();


