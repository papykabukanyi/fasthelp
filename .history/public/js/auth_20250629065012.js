// Authentication functionality for Fast Help

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
        this.setupPasswordStrength();
    }

    checkExistingAuth() {
        // Check if user is already logged in
        const token = localStorage.getItem('authToken');
        if (token) {
            // Verify token is still valid
            this.verifyToken(token);
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/api/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Token is valid, user is logged in
                this.handleAuthSuccess(data);
            } else {
                // Token is invalid, remove it
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        }
    }

    setupEventListeners() {
        // Registration form
        const registrationForm = document.getElementById('registration-form');
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }

        // Login form
        const loginForm = document.getElementById('login-form-element');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Notification subscription form
        const notificationForm = document.getElementById('notification-form');
        if (notificationForm) {
            notificationForm.addEventListener('submit', (e) => this.handleNotificationSubscription(e));
        }

        // Password confirmation
        const confirmPassword = document.getElementById('confirmPassword');
        if (confirmPassword) {
            confirmPassword.addEventListener('blur', () => this.validatePasswordMatch());
        }

        // Form validation
        this.setupFormValidation();
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('password');
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (passwordInput && strengthFill && strengthText) {
            passwordInput.addEventListener('input', () => {
                const password = passwordInput.value;
                const strength = FastHelpUtils.getPasswordStrength(password);
                
                strengthFill.style.width = strength.percentage + '%';
                strengthFill.className = `strength-fill ${strength.level}`;
                
                if (password.length === 0) {
                    strengthText.textContent = 'Enter password';
                    strengthFill.style.width = '0%';
                } else {
                    strengthText.textContent = `Password strength: ${strength.level}`;
                }
            });
        }
    }

    setupFormValidation() {
        // Real-time email validation
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const email = emailInput.value.trim();
                if (email && !FastHelpUtils.validateEmail(email)) {
                    this.showFieldError(emailInput, 'Please enter a valid email address');
                } else {
                    this.clearFieldError(emailInput);
                }
            });
        }

        // Username validation
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.addEventListener('blur', () => {
                const username = usernameInput.value.trim();
                if (username && username.length < 3) {
                    this.showFieldError(usernameInput, 'Username must be at least 3 characters');
                } else if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
                    this.showFieldError(usernameInput, 'Username can only contain letters, numbers, and underscores');
                } else {
                    this.clearFieldError(usernameInput);
                }
            });
        }

        // Phone validation
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => {
                const phone = phoneInput.value.trim();
                if (phone && !/^\+?[\d\s\-\(\)]+$/.test(phone)) {
                    this.showFieldError(phoneInput, 'Please enter a valid phone number');
                } else {
                    this.clearFieldError(phoneInput);
                }
            });
        }
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        field.parentNode.appendChild(errorDiv);
        field.classList.add('error');
    }

    clearFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        field.classList.remove('error');
    }

    validatePasswordMatch() {
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (password && confirmPassword) {
            if (confirmPassword.value && password.value !== confirmPassword.value) {
                this.showFieldError(confirmPassword, 'Passwords do not match');
                return false;
            } else {
                this.clearFieldError(confirmPassword);
                return true;
            }
        }
        return true;
    }

    async handleRegistration(e) {
        e.preventDefault();
        
        if (!this.validateRegistrationForm()) {
            return;
        }

        const formData = new FormData(e.target);
        const data = {
            fullName: formData.get('fullName'),
            username: formData.get('username'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            password: formData.get('password')
        };

        try {
            FastHelpUtils.showLoading(true);
            
            const response = await FastHelpUtils.makeRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            FastHelpUtils.showLoading(false);
            this.showSuccessMessage(response.message);
            
        } catch (error) {
            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification(error.message || 'Registration failed', 'error');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            FastHelpUtils.showLoading(true);
            
            const response = await FastHelpUtils.makeRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            FastHelpUtils.showLoading(false);
            
            // Store auth token and user info
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userInfo', JSON.stringify(response.user));
            
            FastHelpUtils.showNotification('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = '/donor-dashboard';
            }, 1000);
            
        } catch (error) {
            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification(error.message || 'Login failed', 'error');
        }
    }

    validateRegistrationForm() {
        const form = document.getElementById('registration-form');
        if (!form) return false;

        let isValid = true;
        
        // Get form elements
        const fullName = document.getElementById('fullName');
        const username = document.getElementById('username');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        const terms = document.getElementById('terms');

        // Clear previous errors
        form.querySelectorAll('.field-error').forEach(error => error.remove());
        form.querySelectorAll('.error').forEach(field => field.classList.remove('error'));

        // Validate full name
        if (!fullName.value.trim()) {
            this.showFieldError(fullName, 'Full name is required');
            isValid = false;
        }

        // Validate username
        if (!username.value.trim()) {
            this.showFieldError(username, 'Username is required');
            isValid = false;
        } else if (username.value.trim().length < 3) {
            this.showFieldError(username, 'Username must be at least 3 characters');
            isValid = false;
        } else if (!/^[a-zA-Z0-9_]+$/.test(username.value.trim())) {
            this.showFieldError(username, 'Username can only contain letters, numbers, and underscores');
            isValid = false;
        }

        // Validate email
        if (!email.value.trim()) {
            this.showFieldError(email, 'Email is required');
            isValid = false;
        } else if (!FastHelpUtils.validateEmail(email.value.trim())) {
            this.showFieldError(email, 'Please enter a valid email address');
            isValid = false;
        }

        // Validate password
        if (!password.value) {
            this.showFieldError(password, 'Password is required');
            isValid = false;
        } else if (!FastHelpUtils.validatePassword(password.value)) {
            this.showFieldError(password, 'Password must be at least 8 characters with uppercase, lowercase, and number');
            isValid = false;
        }

        // Validate password confirmation
        if (!confirmPassword.value) {
            this.showFieldError(confirmPassword, 'Please confirm your password');
            isValid = false;
        } else if (password.value !== confirmPassword.value) {
            this.showFieldError(confirmPassword, 'Passwords do not match');
            isValid = false;
        }

        // Validate terms
        if (!terms.checked) {
            FastHelpUtils.showNotification('Please accept the Terms of Service and Privacy Policy', 'error');
            isValid = false;
        }

        return isValid;
    }

    showSuccessMessage(message) {
        // Hide forms
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'none';
        
        // Show success message
        const successDiv = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        
        if (successDiv && successText) {
            successText.textContent = message;
            successDiv.style.display = 'block';
            
            // Auto-scroll to success message
            successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async handleNotificationSubscription(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        
        if (!FastHelpUtils.validateEmail(email)) {
            FastHelpUtils.showNotification('Please enter a valid email address', 'error');
            return;
        }

        try {
            FastHelpUtils.showLoading(true);
            
            const response = await FastHelpUtils.makeRequest('/api/subscribe-notifications', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification('Successfully subscribed to notifications! 🎉', 'success');
            
            // Hide notification subscription form
            document.getElementById('notification-subscription').style.display = 'none';
            
        } catch (error) {
            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification(error.message || 'Failed to subscribe to notifications', 'error');
        }
    }
}


// Form switching functions
function showLogin() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('success-message').style.display = 'none';
    document.getElementById('notification-subscription').style.display = 'none';
}

function showRegister() {
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
    document.getElementById('notification-subscription').style.display = 'none';
}

function subscribeToNotifications() {
    document.getElementById('notification-subscription').style.display = 'block';
    document.getElementById('notification-subscription').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
    
    // Pre-fill email if available from registration
    const registrationEmail = document.getElementById('email');
    const notificationEmail = document.getElementById('notificationEmail');
    if (registrationEmail && notificationEmail && registrationEmail.value) {
        notificationEmail.value = registrationEmail.value;
    }
}

function hideNotificationSubscription() {
    document.getElementById('notification-subscription').style.display = 'none';
}

// Terms and Privacy functions
function showTerms() {
    FastHelpUtils.showNotification('Terms of Service would be displayed here in a real implementation.', 'info');
}

function showPrivacy() {
    FastHelpUtils.showNotification('Privacy Policy would be displayed here in a real implementation.', 'info');
}

// Initialize authentication manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('registration-form') || document.getElementById('login-form-element')) {
        window.authManager = new AuthManager();
    }
});

// Add custom styles for form validation
const authStyles = document.createElement('style');
authStyles.textContent = `
    .field-error {
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .form-group input.error,
    .form-group select.error {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
    
    .form-group input.error:focus,
    .form-group select.error:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
    
    .auth-form {
        transition: all 0.3s ease;
    }
    
    .success-card {
        animation: fadeInScale 0.5s ease-out;
    }
    
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    .strength-fill.weak {
        background: #ef4444;
    }
    
    .strength-fill.medium {
        background: #f59e0b;
    }
    
    .strength-fill.strong {
        background: #10b981;
    }
    
    button[type="submit"]:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .checkbox-label:hover .checkmark {
        border-color: #4f46e5;
    }
    
    .form-group input:focus + .password-strength .strength-bar {
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }
`;
document.head.appendChild(authStyles);

// Export functions for global use
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showTerms = showTerms;
window.showPrivacy = showPrivacy;
window.subscribeToNotifications = subscribeToNotifications;
window.hideNotificationSubscription = hideNotificationSubscription;
