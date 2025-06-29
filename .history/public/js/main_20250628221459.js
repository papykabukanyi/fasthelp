// Main JavaScript functionality for Fast Help

// Dark mode functionality
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeButton();
        this.setupThemeToggle();
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateThemeButton();
    }

    updateThemeButton() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }
}

// Mobile menu functionality
function toggleMobileMenu() {
    const header = document.querySelector('.header');
    if (header) {
        header.classList.toggle('mobile-menu-open');
    }
}

// Donation modal functionality
function openDonateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal donate-modal">
            <div class="modal-header">
                <h3>Support Fast Help</h3>
                <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>Fast Help is a community-driven platform that connects generous donors with those in need.</p>
                <p>While we don't accept monetary donations directly, you can support us by:</p>
                <ul>
                    <li>Sharing food and essential items with your community</li>
                    <li>Spreading the word about Fast Help</li>
                    <li>Volunteering to help maintain the platform</li>
                </ul>
                <div class="modal-actions">
                    <a href="/donor-signup" class="btn btn-primary">Become a Donor</a>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Global utilities and common functions
class FastHelpUtils {
    static showLoading(show = true) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    static showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
        
        return notification;
    }

    static formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return date.toLocaleDateString();
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static validatePassword(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return re.test(password);
    }

    static getPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[@$!%*?&]/.test(password)) strength++;
        
        if (strength < 3) return { level: 'weak', percentage: 25 };
        if (strength < 4) return { level: 'medium', percentage: 60 };
        return { level: 'strong', percentage: 100 };
    }

    static async makeRequest(url, options = {}) {
        const token = localStorage.getItem('authToken');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('Request error:', error);
            throw error;
        }
    }
}

// Modal functionality
function openDonateModal() {
    const modal = document.getElementById('donate-modal');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
}

function closeDonateModal() {
    const modal = document.getElementById('donate-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

function donate(amount) {
    FastHelpUtils.showNotification(
        `Thank you for your ${amount}$ donation! In a real implementation, this would process the payment.`,
        'success'
    );
    closeDonateModal();
}

function donateCustom() {
    const amountInput = document.getElementById('custom-amount');
    const amount = parseFloat(amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        FastHelpUtils.showNotification('Please enter a valid donation amount.', 'error');
        return;
    }
    
    donate(amount);
    amountInput.value = '';
}

// Mobile menu functionality
function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.classList.toggle('mobile-open');
    }
}

// User menu functionality
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.querySelector('.user-menu');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userMenu && userDropdown && !userMenu.contains(e.target)) {
        userDropdown.classList.remove('show');
    }
});

// Authentication functions
async function logout() {
    try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        FastHelpUtils.showNotification('Logged out successfully!', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        FastHelpUtils.showNotification('Error during logout.', 'error');
    }
}

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('userInfo');
    
    if (token && userInfo) {
        try {
            const user = JSON.parse(userInfo);
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = user.username || user.fullName || 'User';
            }
            return true;
        } catch (error) {
            console.error('Error parsing user info:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
        }
    }
    
    return false;
}

// Redirect to login if not authenticated (for protected pages)
function requireAuth() {
    if (!checkAuth()) {
        FastHelpUtils.showNotification('Please log in to access this page.', 'warning');
        setTimeout(() => {
            window.location.href = '/donor-signup';
        }, 1000);
        return false;
    }
    return true;
}

// Initialize page-specific functionality
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    new ThemeManager();
    
    // Check if we're on a protected page
    const protectedPages = ['/donor-dashboard'];
    const currentPath = window.location.pathname;
    
    if (protectedPages.some(path => currentPath.includes(path))) {
        if (!requireAuth()) {
            return;
        }
    }
    
    // Initialize authentication status
    checkAuth();
    
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add loading states to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                
                // Re-enable after 5 seconds (fallback)
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }, 5000);
            }
        });
    });
    
    // Add hover effects to cards
    document.querySelectorAll('.benefit-card, .stat-card, .donation-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Initialize tooltips (simple implementation)
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('data-tooltip');
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });
    
    // Add intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.stat, .step, .benefit-card').forEach(el => {
        observer.observe(el);
    });
    
    // Initialize counter animations
    animateCounters();
});

// Handle page load events
window.addEventListener('load', () => {
    // Start counter animations if they exist
    const counters = document.querySelectorAll('.stat h3');
    if (counters.length > 0) {
        animateCounters();
    }
});

// Counter animation function
function animateCounters() {
    const counters = document.querySelectorAll('#user-count, #donation-count, #location-count');
    
    counters.forEach(counter => {
        const target = parseInt(counter.textContent.replace(/\D/g, ''));
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                counter.textContent = target + '+';
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current) + '+';
            }
        }, 20);
    });
}

// Add custom styles for animations and tooltips
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    .tooltip {
        position: absolute;
        background: #1f2937;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        white-space: nowrap;
    }
    
    .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: #1f2937;
    }
    
    .animate-in {
        animation: fadeInUp 0.6s ease-out forwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .mobile-open {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border-top: 1px solid #e5e7eb;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
    }
    
    .mobile-open .nav-link,
    .mobile-open .donor-btn,
    .mobile-open .donate-btn {
        padding: 1rem;
        border-bottom: 1px solid #f3f4f6;
        justify-content: center;
    }
    
    @media (max-width: 768px) {
        .nav-menu {
            display: none;
        }
        
        .mobile-menu-toggle {
            display: block !important;
        }
    }
`;
document.head.appendChild(animationStyles);

// Export utilities for use in other modules
window.FastHelpUtils = FastHelpUtils;
window.openDonateModal = openDonateModal;
window.closeDonateModal = closeDonateModal;
window.donate = donate;
window.donateCustom = donateCustom;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleUserMenu = toggleUserMenu;
window.logout = logout;
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
