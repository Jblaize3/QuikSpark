// QuikSpark Toast Notification System
// Beautiful notifications that match the brand aesthetic

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(message, type = 'success', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.success}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return notification;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
    window.notify = new NotificationSystem();
});
} else {
    // DOM is already ready
    window.notify = new NotificationSystem();
}

// Add styles to page
const style = document.createElement('style');
style.textContent = `
    #notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
    }

    .notification {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 18px 22px;
        background: rgba(26, 26, 46, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
        transform: translateX(450px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        min-width: 320px;
        position: relative;
        overflow: hidden;
    }

    .notification::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(135deg, #5820F7 0%, #7c3aed 100%);
    }

    .notification.notification-error::before {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }

    .notification.notification-warning::before {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }

    .notification.notification-info::before {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }

    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }

    .notification.hide {
        transform: translateX(450px);
        opacity: 0;
    }

    .notification-icon {
        font-size: 24px;
        flex-shrink: 0;
        animation: iconPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes iconPop {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }

    .notification-content {
        flex: 1;
        color: #ffffff;
    }

    .notification-message {
        font-size: 15px;
        font-weight: 500;
        line-height: 1.4;
    }

    .notification-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .notification-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
        #notification-container {
            left: 20px;
            right: 20px;
            max-width: none;
        }

        .notification {
            min-width: auto;
        }
    }
`;
document.head.appendChild(style);