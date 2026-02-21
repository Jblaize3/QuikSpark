// QuikSpark Portfolio Lightbox System
// Handles images, videos, and link previews

class PortfolioLightbox {
    constructor() {
        this.currentIndex = 0;
        this.items = [];
        this.init();
    }

    init() {
        // Create lightbox container
        const lightboxHTML = `
            <div id="portfolio-lightbox" class="lightbox-overlay">
                <div class="lightbox-container">
                    <!-- Close button -->
                    <button class="lightbox-close" onclick="portfolioLightbox.close()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <!-- Navigation arrows -->
                    <button class="lightbox-nav lightbox-prev" onclick="portfolioLightbox.prev()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <button class="lightbox-nav lightbox-next" onclick="portfolioLightbox.next()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>

                    <!-- Content area -->
                    <div class="lightbox-content" id="lightbox-content"></div>

                    <!-- Counter -->
                    <div class="lightbox-counter" id="lightbox-counter"></div>

                    <!-- Item info -->
                    <div class="lightbox-info" id="lightbox-info"></div>
                </div>
            </div>
        `;

        if (!document.getElementById('portfolio-lightbox')) {
            document.body.insertAdjacentHTML('beforeend', lightboxHTML);
            this.addStyles();
            this.addEventListeners();
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .lightbox-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(10px);
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .lightbox-overlay.active {
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
            }

            .lightbox-container {
                position: relative;
                width: 90%;
                height: 90%;
                max-width: 1400px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .lightbox-content {
                max-width: 100%;
                max-height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                transform: scale(0.9);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .lightbox-overlay.active .lightbox-content {
                transform: scale(1);
                opacity: 1;
            }

            .lightbox-content img {
                max-width: 100%;
                max-height: 85vh;
                object-fit: contain;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }

            .lightbox-content video {
                max-width: 100%;
                max-height: 85vh;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }

            .lightbox-close {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 48px;
                height: 48px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                z-index: 10;
            }

            .lightbox-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }

            .lightbox-nav {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                width: 48px;
                height: 48px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                opacity: 0;
                z-index: 10;
            }

            .lightbox-overlay.active .lightbox-nav {
                opacity: 1;
            }

            .lightbox-prev {
                left: 20px;
            }

            .lightbox-next {
                right: 20px;
            }

            .lightbox-nav:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-50%) scale(1.1);
            }

            .lightbox-nav:disabled {
                opacity: 0.3;
                cursor: not-allowed;
            }

            .lightbox-counter {
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 20px;
                padding: 8px 16px;
                color: white;
                font-size: 14px;
                font-weight: 600;
            }

            .lightbox-info {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 12px 20px;
                color: white;
                font-size: 14px;
                max-width: 80%;
                text-align: center;
            }

            .link-preview-card {
                background: rgba(26, 26, 46, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                padding: 40px;
                max-width: 600px;
                color: white;
            }

            .link-preview-header {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
            }

            .link-preview-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                background: linear-gradient(135deg, #5820F7 0%, #7c3aed 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }

            .link-preview-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 8px;
            }

            .link-preview-url {
                color: #C2CAF3;
                font-size: 0.9rem;
                word-break: break-all;
            }

            .link-preview-description {
                color: rgba(255, 255, 255, 0.8);
                line-height: 1.6;
                margin-bottom: 20px;
            }

            .link-preview-action {
                padding: 12px 24px;
                background: linear-gradient(135deg, #5820F7 0%, #7c3aed 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                width: 100%;
            }

            .link-preview-action:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(88, 32, 247, 0.5);
            }

            @media (max-width: 768px) {
                .lightbox-container {
                    width: 95%;
                    height: 95%;
                }

                .lightbox-content img,
                .lightbox-content video {
                    max-height: 75vh;
                }

                .lightbox-nav {
                    width: 40px;
                    height: 40px;
                }

                .lightbox-prev {
                    left: 10px;
                }

                .lightbox-next {
                    right: 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    addEventListeners() {
        // Close on overlay click
        document.getElementById('portfolio-lightbox').addEventListener('click', (e) => {
            if (e.target.id === 'portfolio-lightbox') {
                this.close();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('portfolio-lightbox').classList.contains('active')) return;
            
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
    }

    open(items, startIndex = 0) {
        this.items = items;
        this.currentIndex = startIndex;
        this.render();
        
        const overlay = document.getElementById('portfolio-lightbox');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        const overlay = document.getElementById('portfolio-lightbox');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        // Stop any playing videos
        const video = overlay.querySelector('video');
        if (video) video.pause();
    }

    next() {
        if (this.currentIndex < this.items.length - 1) {
            this.currentIndex++;
            this.render();
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.render();
        }
    }

    render() {
        const item = this.items[this.currentIndex];
        const content = document.getElementById('lightbox-content');
        const counter = document.getElementById('lightbox-counter');
        const info = document.getElementById('lightbox-info');

        // Update counter
        counter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;

        // Update navigation buttons
        document.querySelector('.lightbox-prev').disabled = this.currentIndex === 0;
        document.querySelector('.lightbox-next').disabled = this.currentIndex === this.items.length - 1;

        // Render content based on type
        if (item.type === 'image') {
            content.innerHTML = `<img src="${item.url}" alt="${item.title || 'Portfolio item'}">`;
            info.textContent = item.title || 'Portfolio image';
        } else if (item.type === 'video') {
            content.innerHTML = `
                <video controls autoplay>
                    <source src="${item.url}" type="video/mp4">
                    Your browser doesn't support video playback.
                </video>
            `;
            info.textContent = item.title || 'Portfolio video';
        } else if (item.type === 'link') {
            content.innerHTML = this.renderLinkPreview(item);
            info.textContent = '';
        }
    }

    renderLinkPreview(item) {
        const domain = new URL(item.url).hostname.replace('www.', '');
        const icons = {
            'figma.com': '🎨',
            'notion.so': '📝',
            'github.com': '💻',
            'behance.net': '🎭',
            'dribbble.com': '🏀',
            'youtube.com': '📺',
            'vimeo.com': '🎬'
        };
        
        const icon = icons[domain] || '🔗';

        return `
            <div class="link-preview-card">
                <div class="link-preview-header">
                    <div class="link-preview-icon">${icon}</div>
                    <div>
                        <div class="link-preview-title">${item.title || 'External Link'}</div>
                        <div class="link-preview-url">${domain}</div>
                    </div>
                </div>
                ${item.description ? `<div class="link-preview-description">${item.description}</div>` : ''}
                <button class="link-preview-action" onclick="window.open('${item.url}', '_blank')">
                    Open in New Tab →
                </button>
            </div>
        `;
    }
}

// Initialize globally
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.portfolioLightbox = new PortfolioLightbox();
    });
} else {
    window.portfolioLightbox = new PortfolioLightbox();
}

// Helper function to detect file type
window.getPortfolioItemType = function(url, filename) {
    const imageExts = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    const videoExts = /\.(mp4|mov|webm|avi)$/i;
    
    if (imageExts.test(filename) || imageExts.test(url)) return 'image';
    if (videoExts.test(filename) || videoExts.test(url)) return 'video';
    if (url && url.startsWith('http')) return 'link';
    return 'file';
};
