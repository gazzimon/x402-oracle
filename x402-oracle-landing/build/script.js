/**
 * x402-ORACLE LANDING PAGE
 * JavaScript Functionality
 */

// ========================================
// 1. Network Background Animation
// ========================================
class NetworkBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.connections = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.particleCount = 60;

        this.resize();
        this.createParticles();
        this.animate();

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                baseAlpha: Math.random() * 0.3 + 0.1
            });
        }
    }

    drawParticles() {
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;

            // Mouse interaction
            const dx = this.mouseX - particle.x;
            const dy = this.mouseY - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 150) {
                const force = (150 - distance) / 150;
                particle.x -= dx * force * 0.02;
                particle.y -= dy * force * 0.02;
            }

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 255, 157, ${particle.baseAlpha})`;
            this.ctx.fill();
        });
    }

    drawConnections() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = (1 - distance / 150) * 0.15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            }
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawParticles();
        this.drawConnections();
        requestAnimationFrame(() => this.animate());
    }
}

// ========================================
// 2. Scroll Reveal Animation
// ========================================
class ScrollReveal {
    constructor() {
        this.observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            this.observerOptions
        );
        this.init();
    }

    init() {
        // Add reveal class to elements
        const sections = document.querySelectorAll('.section-header, .problem-card, .feature-card, .arch-step, .usecase-card, .benefit-item, .powered-item');
        sections.forEach(section => {
            section.classList.add('reveal');
            this.observer.observe(section);
        });

        // Stagger animation for grids
        const grids = document.querySelectorAll('.features-grid, .usecases-grid');
        grids.forEach(grid => {
            const items = grid.children;
            Array.from(items).forEach((item, index) => {
                item.style.transitionDelay = `${index * 0.1}s`;
            });
        });
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }
}

// ========================================
// 3. JSON Typewriter Animation
// ========================================
class JSONTypewriter {
    constructor() {
        this.jsonData = {
            "fair_price": 1.0234,
            "confidence_score": 0.98,
            "max_safe_execution_size": 150000,
            "volatility_alert": false
        };
        this.codeElement = document.getElementById('json-code');
        this.isAnimated = false;
        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isAnimated) {
                    this.isAnimated = true;
                    this.typeJSON();
                }
            });
        }, { threshold: 0.5 });

        observer.observe(document.getElementById('json-output'));
    }

    typeJSON() {
        let index = 0;
        const jsonString = this.formatJSON();

        const type = () => {
            if (index < jsonString.length) {
                // Handle syntax highlighting
                const before = jsonString.substring(0, index);
                const char = jsonString.charAt(index);
                const after = jsonString.substring(index + 1);
                this.codeElement.innerHTML = this.highlightSyntax(before + char + after);
                index++;
                setTimeout(type, 15);
            }
        };

        type();
    }

    formatJSON() {
        const lines = [];
        lines.push('{');
        const keys = Object.keys(this.jsonData);

        keys.forEach((key, i) => {
            const value = this.jsonData[key];
            const formattedValue = typeof value === 'number' ? value : typeof value === 'boolean' ? value : `"${value}"`;
            const comma = i < keys.length - 1 ? ',' : '';
            lines.push(`  "${key}": ${formattedValue}${comma}`);
        });

        lines.push('}');
        return lines.join('\n');
    }

    highlightSyntax(text) {
        // Escape HTML
        let html = text.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');

        // Highlight keys
        html = html.replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:');

        // Highlight numbers
        html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');

        // Highlight booleans
        html = html.replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>');

        return html;
    }
}

// ========================================
// 4. Navigation Handler
// ========================================
class NavigationHandler {
    constructor() {
        this.navbar = document.getElementById('navbar');
        this.sections = document.querySelectorAll('section[id]');
        this.navLinks = document.querySelectorAll('.nav-links a');
        this.init();
    }

    init() {
        // Scroll effect
        window.addEventListener('scroll', () => this.handleScroll());

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => this.handleSmoothScroll(e));
        });

        // Active link highlighting
        this.updateActiveLink();
    }

    handleScroll() {
        // Navbar background on scroll
        if (window.scrollY > 50) {
            this.navbar.classList.add('scrolled');
        } else {
            this.navbar.classList.remove('scrolled');
        }

        // Update active section
        this.updateActiveLink();
    }

    handleSmoothScroll(e) {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const navHeight = this.navbar.offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }

    updateActiveLink() {
        const scrollPosition = window.scrollY + 100;

        this.sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                this.navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
}

// ========================================
// 5. Copy Button Handler
// ========================================
class CopyButtonHandler {
    constructor() {
        this.button = document.getElementById('copy-btn');
        this.jsonContent = this.getJSONContent();
        this.init();
    }

    getJSONContent() {
        return JSON.stringify({
            "fair_price": 1.0234,
            "confidence_score": 0.98,
            "max_safe_execution_size": 150000,
            "volatility_alert": false
        }, null, 2);
    }

    init() {
        this.button.addEventListener('click', () => this.handleCopy());
    }

    async handleCopy() {
        try {
            await navigator.clipboard.writeText(this.jsonContent);
            this.showCopiedState();
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = this.jsonContent;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showCopiedState();
        }
    }

    showCopiedState() {
        this.button.classList.add('copied');
        this.button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;

        setTimeout(() => {
            this.button.classList.remove('copied');
            this.button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
            `;
        }, 2000);
    }
}

// ========================================
// 6. Architecture Data Flow Animation
// ========================================
class ArchitectureFlow {
    constructor() {
        this.connectorLines = document.querySelectorAll('.connector-line');
        this.flowDots = document.querySelectorAll('.data-flow-dot');
        this.init();
    }

    init() {
        // Start animation when architecture section is visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.startAnimation();
                }
            });
        }, { threshold: 0.3 });

        const architectureSection = document.getElementById('architecture');
        if (architectureSection) {
            observer.observe(architectureSection);
        }
    }

    startAnimation() {
        // Add staggered animation delays to flow dots
        this.flowDots.forEach((dot, index) => {
            dot.style.animationDelay = `${index * 1.5}s`;
        });

        // Add pulsing animation to steps
        const steps = document.querySelectorAll('.arch-step');
        steps.forEach((step, index) => {
            step.style.animationDelay = `${index * 0.2}s`;
        });
    }
}

// ========================================
// 7. Hero Animation Controller
// ========================================
class HeroAnimation {
    constructor() {
        this.heroTitle = document.querySelector('.hero-wordmark') || document.querySelector('.title-line');
        this.heroSubtitle = document.querySelector('.title-subtitle');
        this.init();
    }

    init() {
        // Add entrance animations
        this.animateTitle();
        this.animateGraphic();
    }

    animateTitle() {
        const title = this.heroTitle;
        if (!title) {
            return;
        }
        // Title is already animated via CSS, but we can add JS effects
        title.style.opacity = '0';
        title.style.transform = 'translateY(30px)';

        setTimeout(() => {
            title.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            title.style.opacity = '1';
            title.style.transform = 'translateY(0)';
        }, 100);
    }

    animateGraphic() {
        const graphic = document.querySelector('.oracle-diagram');
        if (graphic) {
            graphic.style.opacity = '0';
            graphic.style.transform = 'scale(0.9)';

            setTimeout(() => {
                graphic.style.transition = 'opacity 1s ease, transform 1s ease';
                graphic.style.opacity = '0.4';
                graphic.style.transform = 'scale(1)';
            }, 500);
        }
    }
}

// ========================================
// 8. Feature Card Interaction
// ========================================
class FeatureCardInteraction {
    constructor() {
        this.cards = document.querySelectorAll('.feature-card');
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mouseenter', () => this.onEnter(card));
            card.addEventListener('mouseleave', () => this.onLeave(card));
        });
    }

    onEnter(card) {
        const feature = card.dataset.feature;
        card.style.transform = 'translateY(-8px)';
        card.style.boxShadow = '0 8px 32px rgba(0, 255, 157, 0.15)';
    }

    onLeave(card) {
        card.style.transform = '';
        card.style.boxShadow = '';
    }
}

// ========================================
// 9. Smooth Scroll Progress
// ========================================
class ScrollProgress {
    constructor() {
        this.progressBar = null;
        this.init();
    }

    init() {
        // Create progress bar
        const bar = document.createElement('div');
        bar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 2px;
            background: linear-gradient(90deg, #00ff9d, #3b82f6);
            z-index: 9999;
            transition: width 0.1s ease;
        `;
        document.body.appendChild(bar);
        this.progressBar = bar;

        window.addEventListener('scroll', () => this.updateProgress());
    }

    updateProgress() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        this.progressBar.style.width = `${progress}%`;
    }
}

// ========================================
// 10. Video Wall Sequencer
// ========================================
class VideoWall {
    constructor() {
        this.videos = Array.from(document.querySelectorAll('.video-wall video'));
        if (this.videos.length === 0) {
            return;
        }
        this.currentIndex = 0;
        this.gestureBound = false;
        this.setupVideos();
        this.bindEvents();
        this.playCurrent();
    }

    setupVideos() {
        this.videos.forEach((video, index) => {
            video.loop = false;
            video.muted = true;
            video.setAttribute('muted', '');
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('autoplay', '');
            video.defaultPlaybackRate = 3;
            video.playbackRate = 3;
            video.preload = 'auto';
        });
        this.videos.forEach(video => video.load());
    }

    bindEvents() {
        this.videos.forEach((video, index) => {
            video.addEventListener('ended', () => {
                if (index === this.currentIndex) {
                    this.next();
                }
            });
            video.addEventListener('canplay', () => {
                if (index === this.currentIndex && video.paused) {
                    video.play().catch(() => this.bindUserGesture());
                }
            });
            video.addEventListener('timeupdate', () => {
                if (index !== this.currentIndex) {
                    return;
                }
                if (video.duration && video.currentTime >= video.duration - 0.1) {
                    this.next();
                }
            });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAll();
            } else {
                this.playCurrent();
            }
        });

        window.addEventListener('click', () => {
            const current = this.videos[this.currentIndex];
            if (current && current.paused) {
                current.play().catch(() => {});
            }
        }, { once: true });
    }

    pauseAll() {
        this.videos.forEach(video => {
            video.pause();
            video.classList.remove('is-active');
        });
    }

    playCurrent() {
        this.videos.forEach((video, index) => {
            if (index === this.currentIndex) {
                video.preload = 'auto';
                video.classList.add('is-active');
                try {
                    video.currentTime = 0;
                } catch (error) {
                    // Ignore when metadata isn't ready yet.
                }
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => this.bindUserGesture());
                }
            } else {
                video.pause();
                video.classList.remove('is-active');
            }
        });
        this.primeNext();
    }

    bindUserGesture() {
        if (this.gestureBound) {
            return;
        }
        this.gestureBound = true;
        const resume = () => {
            const current = this.videos[this.currentIndex];
            if (current) {
                current.play().catch(() => {});
            }
        };
        window.addEventListener('pointerdown', resume, { once: true });
        window.addEventListener('touchstart', resume, { once: true });
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.videos.length;
        this.playCurrent();
    }

    primeNext() {
        if (this.videos.length < 2) {
            return;
        }
        const nextIndex = (this.currentIndex + 1) % this.videos.length;
        const nextVideo = this.videos[nextIndex];
        if (nextVideo) {
            nextVideo.preload = 'auto';
            nextVideo.load();
        }
    }
}

// ========================================
// Main Initialization
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    new NetworkBackground('network-canvas');
    new ScrollReveal();
    new JSONTypewriter();
    new NavigationHandler();
    new CopyButtonHandler();
    new ArchitectureFlow();
    new HeroAnimation();
    new FeatureCardInteraction();
    new ScrollProgress();
    new VideoWall();

    // Add loaded class to body for CSS animations
    document.body.classList.add('loaded');

    // Console welcome message
    console.log('%c x402-oracle ', 'background: #00ff9d; color: #0a0b0e; padding: 8px 16px; font-size: 14px; font-weight: bold;');
    console.log('%c Programmable Paid Oracles for Cronos ', 'color: #3b82f6; font-size: 12px;');
    console.log('%c Built with SEDA + x402 ', 'color: #8b5cf6; font-size: 12px;');
});

// ========================================
// Utility Functions
// ========================================

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
