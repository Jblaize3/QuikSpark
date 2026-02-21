// QuikSpark Collaboration Request Modal
// Beautiful modal for sending collaboration requests

class CollabRequestModal {
    constructor() {
        this.modal = null;
        this.currentUserId = null;
        this.portfolioItemId = null;
        this.portfolioItemTitle = null;
        this.init();
    }

    init() {
        // Create modal HTML
        this.modal = document.createElement('div');
        this.modal.className = 'collab-modal-overlay';
        this.modal.innerHTML = `
            <div class="collab-modal">
                <div class="collab-modal-header">
                    <h2>🤝 Request to Collaborate</h2>
                    <button class="collab-modal-close" onclick="collabModal.close()">&times;</button>
                </div>
                
                <div class="collab-modal-context" id="collab-context"></div>
                
                <form class="collab-modal-form" id="collab-form">
                    <div class="form-group">
                        <label for="collab-message">
                            What are you building? Why collaborate? <span class="required">*</span>
                        </label>
                        <textarea 
                            id="collab-message" 
                            name="message" 
                            required 
                            maxlength="500" 
                            rows="4"
                            placeholder="I'm building a fitness app and love your UI design work. Would you be interested in collaborating on the interface?"
                        ></textarea>
                        <div class="char-count">
                            <span id="char-counter">0</span> / 500
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="collab-need">What do you need? (optional)</label>
                        <select id="collab-need" name="need">
                            <option value="">Select...</option>
                            <option value="design">🎨 Design</option>
                            <option value="pm">📊 Product/Strategy</option>
                            <option value="engineering">💻 Engineering</option>
                            <option value="marketing">📣 Marketing</option>
                            <option value="other">🔧 Other</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="collab-timeline">Timeline? (optional)</label>
                        <select id="collab-timeline" name="timeline">
                            <option value="">Select...</option>
                            <option value="asap">⚡ ASAP</option>
                            <option value="1-2-weeks">📅 1-2 weeks</option>
                            <option value="1-month">📆 1 month</option>
                            <option value="flexible">🕐 Flexible</option>
                        </select>
                    </div>

                    <div class="collab-modal-actions">
                        <button type="button" class="btn-secondary" onclick="collabModal.close()">Cancel</button>
                        <button type="submit" class="btn-primary">Send Request</button>
                    </div>
                </form>
            </div>
        `;

        // Add to body
        document.body.appendChild(this.modal);

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Character counter
        const messageInput = this.modal.querySelector('#collab-message');
        const charCounter = this.modal.querySelector('#char-counter');
        
        messageInput.addEventListener('input', () => {
            charCounter.textContent = messageInput.value.length;
        });

        // Form submission
        const form = this.modal.querySelector('#collab-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }

    open(toUserId, portfolioItemId = null, portfolioItemTitle = null) {
        const currentUserId = localStorage.getItem('currentUserId');
        
        if (!currentUserId) {
            if (window.notify) {
                notify.warning('Please create a profile first!');
            }
            setTimeout(() => window.location.href = '/profile-setup.html', 2000);
            return;
        }

        if (currentUserId === toUserId) {
            if (window.notify) {
                notify.info("This is your own profile!");
            }
            return;
        }

        this.currentUserId = toUserId;
        this.portfolioItemId = portfolioItemId;
        this.portfolioItemTitle = portfolioItemTitle;

        // Show context if portfolio item specified
        const contextDiv = this.modal.querySelector('#collab-context');
        if (portfolioItemTitle) {
            contextDiv.innerHTML = `
                <div class="collab-context-item">
                    <span class="context-label">Regarding:</span>
                    <span class="context-value">💼 ${portfolioItemTitle}</span>
                </div>
            `;
            contextDiv.style.display = 'block';
        } else {
            contextDiv.style.display = 'none';
        }

        // Reset form
        this.modal.querySelector('#collab-form').reset();
        this.modal.querySelector('#char-counter').textContent = '0';

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus on message field
        setTimeout(() => {
            this.modal.querySelector('#collab-message').focus();
        }, 100);
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentUserId = null;
        this.portfolioItemId = null;
        this.portfolioItemTitle = null;
    }

    async handleSubmit() {
        const fromUserId = localStorage.getItem('currentUserId');
        const message = this.modal.querySelector('#collab-message').value.trim();
        const need = this.modal.querySelector('#collab-need').value;
        const timeline = this.modal.querySelector('#collab-timeline').value;

        if (!message) {
            if (window.notify) {
                notify.error('Please write a message');
            }
            return;
        }

        // Disable submit button
        const submitBtn = this.modal.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/api/collab/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUserId,
                    toUserId: this.currentUserId,
                    portfolioItemId: this.portfolioItemId,
                    message,
                    need: need || null,
                    timeline: timeline || null
                })
            });

            const result = await response.json();

            if (response.ok) {
                if (window.notify) {
                    notify.success('🚀 Request sent! They\'ll be notified.');
                }
                this.close();
            } else {
                if (window.notify) {
                    notify.error(result.message || 'Failed to send request');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }

        } catch (error) {
            console.error('Error sending collab request:', error);
            if (window.notify) {
                notify.error('Failed to send request');
            }
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// Global instance
window.collabModal = new CollabRequestModal();
