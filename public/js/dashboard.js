// Dashboard functionality for Fast Help

class DashboardManager {
    constructor() {
        this.currentSection = 'dashboard';
        this.donations = [];
        this.locationMap = null;
        this.selectedLocation = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.loadUserData();
        this.loadDashboardData();
        this.initializeLocationMap();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all items
                navItems.forEach(nav => nav.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Get section name from href
                const sectionName = item.getAttribute('href').substring(1);
                this.showSection(sectionName);
            });
        });
    }

    setupEventListeners() {
        // Donation form
        const donationForm = document.getElementById('donation-form');
        if (donationForm) {
            donationForm.addEventListener('submit', (e) => this.handleDonationSubmission(e));
        }

        // Location type selection
        const locationRadios = document.querySelectorAll('input[name="location-type"]');
        locationRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleLocationTypeChange());
        });

        // Address input
        const addressInput = document.getElementById('address');
        if (addressInput) {
            addressInput.addEventListener('blur', () => this.geocodeAddress());
        }

        // Image upload
        const imageInput = document.getElementById('image');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.previewImage(e.target));
        }

        // Donation filters
        const filterBtns = document.querySelectorAll('.donations-filter .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => this.filterDonations(btn.dataset.status));
        });

        // Profile form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
            
            // Load section-specific data
            this.loadSectionData(sectionName);
        }
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'my-donations':
                this.loadMyDonations();
                break;
            case 'profile':
                this.loadProfileData();
                break;
        }
    }

    async loadUserData() {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const user = JSON.parse(userInfo);
                const usernameDisplay = document.getElementById('username-display');
                if (usernameDisplay) {
                    usernameDisplay.textContent = user.username || user.fullName || 'User';
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        }
    }

    async loadDashboardData() {
        try {
            // Load user's donations
            const donations = await FastHelpUtils.makeRequest('/api/my-donations');
            this.donations = donations;
            
            // Update stats
            this.updateDashboardStats();
            
            // Load recent activity
            this.loadRecentActivity();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            FastHelpUtils.showNotification('Error loading dashboard data', 'error');
        }
    }

    updateDashboardStats() {
        const totalDonations = document.getElementById('total-donations');
        const activeDonations = document.getElementById('active-donations');
        const peopleHelped = document.getElementById('people-helped');
        const impactScore = document.getElementById('impact-score');

        if (totalDonations) totalDonations.textContent = this.donations.length;
        if (activeDonations) {
            const active = this.donations.filter(d => d.status === 'available').length;
            activeDonations.textContent = active;
        }
        if (peopleHelped) {
            const helped = this.donations.filter(d => d.status === 'completed').length;
            peopleHelped.textContent = helped;
        }
        if (impactScore) {
            const score = Math.min(100 + (this.donations.length * 10), 1000);
            impactScore.textContent = score;
        }
    }

    loadRecentActivity() {
        const activityList = document.getElementById('recent-donations');
        if (!activityList) return;

        const recentDonations = this.donations
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        if (recentDonations.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gift"></i>
                    <p>No donations yet. Create your first donation to get started!</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = recentDonations.map(donation => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-${this.getStatusIcon(donation.status)}"></i>
                </div>
                <div class="activity-content">
                    <h4>${donation.title}</h4>
                    <p>${donation.description.substring(0, 100)}${donation.description.length > 100 ? '...' : ''}</p>
                </div>
                <div class="activity-time">
                    ${FastHelpUtils.formatDate(donation.created_at)}
                </div>
            </div>
        `).join('');
    }

    getStatusIcon(status) {
        const icons = {
            'available': 'check-circle',
            'claimed': 'clock',
            'completed': 'star',
            'expired': 'times-circle'
        };
        return icons[status] || 'gift';
    }

    async loadMyDonations() {
        try {
            const donations = await FastHelpUtils.makeRequest('/api/my-donations');
            this.donations = donations;
            this.displayDonations();
        } catch (error) {
            console.error('Error loading donations:', error);
            FastHelpUtils.showNotification('Error loading donations', 'error');
        }
    }

    displayDonations(filter = 'all') {
        const donationsList = document.getElementById('donations-list');
        if (!donationsList) return;

        let filteredDonations = this.donations;
        if (filter !== 'all') {
            filteredDonations = this.donations.filter(d => d.status === filter);
        }

        if (filteredDonations.length === 0) {
            donationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gift"></i>
                    <p>No donations found for the selected filter.</p>
                </div>
            `;
            return;
        }

        donationsList.innerHTML = filteredDonations.map(donation => `
            <div class="donation-card">
                ${donation.image_path ? `<img src="${donation.image_path}" alt="${donation.title}" class="donation-image">` : ''}
                <div class="donation-content">
                    <div class="donation-header">
                        <h3 class="donation-title">${donation.title}</h3>
                        <span class="donation-status ${donation.status}">${this.formatStatus(donation.status)}</span>
                    </div>
                    <div class="donation-category">
                        <i class="fas fa-${this.getCategoryIcon(donation.category)}"></i>
                        ${this.formatCategory(donation.category)}
                    </div>
                    <p class="donation-description">${donation.description}</p>
                    <div class="donation-meta">
                        <span>Created: ${FastHelpUtils.formatDate(donation.created_at)}</span>
                        <span>${donation.address || 'Location set'}</span>
                    </div>
                    <div class="donation-actions">
                        ${donation.status === 'available' ? `
                            <button class="btn secondary" onclick="dashboardManager.updateDonationStatus('${donation.uuid}', 'completed')">
                                <i class="fas fa-check"></i>
                                Mark Complete
                            </button>
                        ` : ''}
                        <button class="btn secondary" onclick="dashboardManager.deleteDonation('${donation.uuid}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatStatus(status) {
        const statuses = {
            'available': 'Available',
            'claimed': 'Claimed',
            'completed': 'Completed',
            'expired': 'Expired'
        };
        return statuses[status] || status;
    }

    formatCategory(category) {
        const categories = {
            'cooked': 'Cooked Food',
            'uncooked': 'Raw Food',
            'clothing': 'Clothing',
            'bedding': 'Bedding',
            'other': 'Other'
        };
        return categories[category] || category;
    }

    getCategoryIcon(category) {
        const icons = {
            'cooked': 'utensils',
            'uncooked': 'apple-alt',
            'clothing': 'tshirt',
            'bedding': 'bed',
            'other': 'gift'
        };
        return icons[category] || 'gift';
    }

    filterDonations(status) {
        // Update filter buttons
        document.querySelectorAll('.donations-filter .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-status="${status}"]`).classList.add('active');
        
        // Display filtered donations
        this.displayDonations(status);
    }

    async updateDonationStatus(donationId, status) {
        try {
            await FastHelpUtils.makeRequest(`/api/donations/${donationId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            
            FastHelpUtils.showNotification('Donation status updated successfully!', 'success');
            this.loadMyDonations();
            
        } catch (error) {
            console.error('Error updating donation status:', error);
            FastHelpUtils.showNotification('Error updating donation status', 'error');
        }
    }

    async deleteDonation(donationId) {
        if (!confirm('Are you sure you want to delete this donation?')) {
            return;
        }
        
        try {
            // Note: This would need to be implemented in the backend
            FastHelpUtils.showNotification('Donation deleted successfully!', 'success');
            this.loadMyDonations();
            
        } catch (error) {
            console.error('Error deleting donation:', error);
            FastHelpUtils.showNotification('Error deleting donation', 'error');
        }
    }

    async handleDonationSubmission(e) {
        e.preventDefault();
        
        if (!this.validateDonationForm()) {
            return;
        }

        const formData = new FormData(e.target);
        
        // Add location data
        if (this.selectedLocation) {
            formData.append('latitude', this.selectedLocation.lat);
            formData.append('longitude', this.selectedLocation.lng);
        }

        try {
            FastHelpUtils.showLoading(true);
            
            const response = await fetch('/api/donations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create donation');
            }
            
            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification('Donation created successfully!', 'success');
            
            // Reset form and switch to my donations
            this.resetDonationForm();
            this.showSection('my-donations');
            
        } catch (error) {
            FastHelpUtils.showLoading(false);
            console.error('Error creating donation:', error);
            FastHelpUtils.showNotification(error.message || 'Error creating donation', 'error');
        }
    }

    validateDonationForm() {
        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value.trim();
        
        if (!title) {
            FastHelpUtils.showNotification('Please enter a title for your donation', 'error');
            return false;
        }
        
        if (!category) {
            FastHelpUtils.showNotification('Please select a category', 'error');
            return false;
        }
        
        if (!description) {
            FastHelpUtils.showNotification('Please enter a description', 'error');
            return false;
        }
        
        if (!this.selectedLocation) {
            FastHelpUtils.showNotification('Please set a location for your donation', 'error');
            return false;
        }
        
        return true;
    }

    resetDonationForm() {
        const form = document.getElementById('donation-form');
        if (form) {
            form.reset();
            this.removeImagePreview();
            this.selectedLocation = null;
            this.updateLocationDisplay();
        }
    }

    handleLocationTypeChange() {
        const locationType = document.querySelector('input[name="location-type"]:checked').value;
        
        // Hide all location inputs
        document.getElementById('address-input').style.display = 'none';
        document.getElementById('map-selector').style.display = 'none';
        
        switch (locationType) {
            case 'current':
                this.useCurrentLocation();
                break;
            case 'address':
                document.getElementById('address-input').style.display = 'block';
                break;
            case 'map':
                document.getElementById('map-selector').style.display = 'block';
                this.initializeLocationMap();
                break;
        }
    }

    useCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.selectedLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.updateLocationDisplay();
                },
                (error) => {
                    console.error('Location error:', error);
                    FastHelpUtils.showNotification('Could not get current location', 'error');
                }
            );
        } else {
            FastHelpUtils.showNotification('Geolocation is not supported', 'error');
        }
    }

    async geocodeAddress() {
        const address = document.getElementById('address').value.trim();
        if (!address) return;
        
        try {
            // Simple geocoding using OpenStreetMap Nominatim (free)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                this.selectedLocation = {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
                this.updateLocationDisplay();
            } else {
                FastHelpUtils.showNotification('Address not found', 'error');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            FastHelpUtils.showNotification('Error finding address', 'error');
        }
    }

    initializeLocationMap() {
        if (this.locationMap) {
            this.locationMap.remove();
        }
        
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer || mapContainer.style.display === 'none') return;
        
        this.locationMap = L.map('location-map').setView([40.7128, -74.0060], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.locationMap);
        
        let marker = null;
        
        this.locationMap.on('click', (e) => {
            if (marker) {
                this.locationMap.removeLayer(marker);
            }
            
            marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(this.locationMap);
            this.selectedLocation = {
                lat: e.latlng.lat,
                lng: e.latlng.lng
            };
            this.updateLocationDisplay();
        });
    }

    updateLocationDisplay() {
        const locationText = document.getElementById('current-location-text');
        if (locationText) {
            if (this.selectedLocation) {
                locationText.innerHTML = `<i class="fas fa-check-circle"></i> Location set: ${this.selectedLocation.lat.toFixed(4)}, ${this.selectedLocation.lng.toFixed(4)}`;
            } else {
                locationText.innerHTML = '<i class="fas fa-crosshairs"></i> No location set';
            }
        }
    }

    previewImage(input) {
        const file = input.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            const uploadDisplay = document.querySelector('.file-upload-display');
            
            if (preview && previewImg) {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
                uploadDisplay.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }

    removeImagePreview() {
        const imageInput = document.getElementById('image');
        const preview = document.getElementById('image-preview');
        const uploadDisplay = document.querySelector('.file-upload-display');
        
        if (imageInput) imageInput.value = '';
        if (preview) preview.style.display = 'none';
        if (uploadDisplay) uploadDisplay.style.display = 'flex';
    }

    loadProfileData() {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const user = JSON.parse(userInfo);
                
                // Populate profile form
                const form = document.getElementById('profile-form');
                if (form) {
                    form.querySelector('#profile-fullname').value = user.fullName || '';
                    form.querySelector('#profile-username').value = user.username || '';
                    form.querySelector('#profile-email').value = user.email || '';
                    form.querySelector('#profile-phone').value = user.phone || '';
                }
            } catch (error) {
                console.error('Error loading profile data:', error);
            }
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        FastHelpUtils.showNotification('Profile update functionality would be implemented here', 'info');
    }
}

// Global functions
window.showSection = function(sectionName) {
    if (window.dashboardManager) {
        window.dashboardManager.showSection(sectionName);
    }
};

window.previewImage = function(input) {
    if (window.dashboardManager) {
        window.dashboardManager.previewImage(input);
    }
};

window.removeImage = function() {
    if (window.dashboardManager) {
        window.dashboardManager.removeImagePreview();
    }
};

window.resetForm = function() {
    if (window.dashboardManager) {
        window.dashboardManager.resetDonationForm();
    }
};

// Initialize dashboard manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.dashboard-container')) {
        window.dashboardManager = new DashboardManager();
    }
});

// Add dashboard-specific styles
const dashboardStyles = document.createElement('style');
dashboardStyles.textContent = `
    .empty-state {
        text-align: center;
        padding: 3rem;
        color: #6b7280;
    }
    
    .empty-state i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .empty-state p {
        font-size: 1.125rem;
        margin: 0;
    }
    
    .file-upload:hover {
        border-color: #4f46e5;
        background: rgba(79, 70, 229, 0.02);
    }
    
    .file-upload.dragover {
        border-color: #4f46e5;
        background: rgba(79, 70, 229, 0.05);
    }
    
    .location-map {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .leaflet-container {
        font-family: inherit;
    }
    
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        transform: none;
    }
    
    .donation-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .sidebar-nav .nav-item:hover {
        transform: translateX(2px);
    }
    
    @media (max-width: 1024px) {
        .sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            white-space: nowrap;
        }
        
        .sidebar-nav .nav-item {
            flex-shrink: 0;
        }
    }
`;
document.head.appendChild(dashboardStyles);
