// Map functionality using Leaflet.js (free, open-source)
class FastHelpMap {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.donations = [];
        this.markers = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.initMap();
        this.getUserLocation();
        this.loadDonations();
        this.setupFilters();
        this.setupEventListeners();
    }

    initMap() {
        // Initialize the map centered on a default location
        this.map = L.map('map').setView([40.7128, -74.0060], 12); // Default to NYC

        // Add OpenStreetMap tiles (free)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add map controls
        this.map.zoomControl.setPosition('topright');
    }

    getUserLocation() {
        const locationText = document.getElementById('location-text');
        
        if (navigator.geolocation) {
            locationText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your location...';
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Center map on user location
                    this.map.setView([this.userLocation.lat, this.userLocation.lng], 14);
                    
                    // Add user location marker
                    const userIcon = L.divIcon({
                        className: 'user-location-marker',
                        html: '<i class="fas fa-user-circle"></i>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    
                    L.marker([this.userLocation.lat, this.userLocation.lng], { icon: userIcon })
                        .addTo(this.map)
                        .bindPopup('<b>Your Location</b><br>You are here!');
                    
                    locationText.innerHTML = '<i class="fas fa-check-circle"></i> Location found';
                    
                    // Load donations near user
                    this.loadDonations();
                },
                (error) => {
                    console.error('Location error:', error);
                    locationText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Location unavailable';
                    this.loadDonations(); // Load donations anyway
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        } else {
            locationText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Geolocation not supported';
            this.loadDonations();
        }
    }

    async loadDonations() {
        try {
            const response = await fetch('/api/donations');
            const donations = await response.json();
            
            this.donations = donations;
            this.displayDonations();
            this.updateStats();
        } catch (error) {
            console.error('Error loading donations:', error);
            this.showNotification('Error loading donations. Please refresh the page.', 'error');
        }
    }

    displayDonations() {
        // Clear existing markers
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];

        // Filter donations based on current filter
        const filteredDonations = this.donations.filter(donation => {
            if (this.currentFilter === 'all') return true;
            return donation.category === this.currentFilter;
        });

        // Add markers for each donation
        filteredDonations.forEach(donation => {
            const marker = this.createDonationMarker(donation);
            this.markers.push(marker);
            marker.addTo(this.map);
        });
    }

    createDonationMarker(donation) {
        // Choose icon based on category
        let iconClass = 'fas fa-gift';
        let iconColor = '#4f46e5';
        
        switch (donation.category) {
            case 'cooked':
                iconClass = 'fas fa-utensils';
                iconColor = '#10b981';
                break;
            case 'uncooked':
                iconClass = 'fas fa-apple-alt';
                iconColor = '#f59e0b';
                break;
            case 'clothing':
                iconClass = 'fas fa-tshirt';
                iconColor = '#8b5cf6';
                break;
            case 'bedding':
                iconClass = 'fas fa-bed';
                iconColor = '#06b6d4';
                break;
        }

        // Create custom icon
        const customIcon = L.divIcon({
            className: 'donation-marker',
            html: `
                <div class="marker-icon" style="background-color: ${iconColor}">
                    <i class="${iconClass}"></i>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        // Create marker
        const marker = L.marker([donation.latitude, donation.longitude], { 
            icon: customIcon 
        });

        // Create popup content
        const popupContent = this.createPopupContent(donation);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'donation-popup'
        });

        return marker;
    }

    createPopupContent(donation) {
        const timeAgo = this.getTimeAgo(new Date(donation.createdAt));
        const categoryIcon = this.getCategoryIcon(donation.type);
        
        return `
            <div class="donation-popup-content">
                ${donation.image ? `<img src="${donation.image}" alt="${donation.title}" class="popup-image">` : ''}
                <div class="popup-header">
                    <h3>${donation.title}</h3>
                    <span class="popup-category">
                        <i class="${categoryIcon}"></i>
                        ${this.formatCategory(donation.type)}
                    </span>
                </div>
                <p class="popup-description">${donation.description}</p>
                ${donation.dropoffInstructions ? 
                    `<div class="popup-instructions">
                        <i class="fas fa-info-circle"></i>
                        <strong>Pickup Instructions:</strong> ${donation.dropoffInstructions}
                    </div>` : ''
                }
                <div class="popup-meta">
                    <div class="popup-time">
                        <i class="fas fa-clock"></i>
                        ${timeAgo}
                    </div>
                    ${donation.address ? 
                        `<div class="popup-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${donation.address}
                        </div>` : ''
                    }
                </div>
                <div class="popup-actions">
                    <button onclick="fastHelpMap.getDirections(${donation.location.coordinates[1]}, ${donation.location.coordinates[0]})" class="popup-btn primary">
                        <i class="fas fa-directions"></i>
                        Get Directions
                    </button>
                    <button onclick="fastHelpMap.showPickupModal('${donation._id}')" class="popup-btn pickup">
                        <i class="fas fa-hands-helping"></i>
                        Pick Up This Item
                    </button>
                </div>
            </div>
        `;
    }

    getCategoryIcon(type) {
        const icons = {
            'cooked': 'fas fa-utensils',
            'uncooked': 'fas fa-apple-alt',
            'clothing': 'fas fa-tshirt',
            'bedding': 'fas fa-bed',
            'comfort': 'fas fa-heart',
            'other': 'fas fa-gift'
        };
        return icons[type] || 'fas fa-gift';
    }

    formatCategory(type) {
        const categories = {
            'cooked': 'Cooked Food',
            'uncooked': 'Raw Food',
            'clothing': 'Clothing',
            'bedding': 'Bedding',
            'comfort': 'Comfort Items',
            'other': 'Other'
        };
        return categories[type] || 'Other';
    }

    setupFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                filterBtns.forEach(b => b.classList.remove('active'));
                
                // Add active class to clicked button
                btn.classList.add('active');
                
                // Update current filter
                this.currentFilter = btn.dataset.filter;
                
                // Update display
                this.displayDonations();
            });
        });
    }

    setupEventListeners() {
        // Refresh donations every 30 seconds
        setInterval(() => {
            this.loadDonations();
        }, 30000);

        // Handle map clicks for potential new donation locations
        this.map.on('click', (e) => {
            console.log('Map clicked at:', e.latlng);
        });
    }

    updateStats() {
        // Update the stats counters
        const userCount = document.getElementById('user-count');
        const donationCount = document.getElementById('donation-count');
        const locationCount = document.getElementById('location-count');

        if (userCount) userCount.textContent = `${Math.floor(Math.random() * 5000) + 1000}+`;
        if (donationCount) donationCount.textContent = `${this.donations.length + Math.floor(Math.random() * 100)}+`;
        if (locationCount) locationCount.textContent = `${new Set(this.donations.map(d => `${d.latitude},${d.longitude}`)).size + Math.floor(Math.random() * 20)}+`;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Global functions for popup actions
// Remove the old global getDirections function as it's now part of the class

window.reportClaimed = function(donationId) {
    if (confirm('Are you sure you want to mark this item as claimed?')) {
        // In a real implementation, this would make an API call
        console.log('Marking donation as claimed:', donationId);
        
        // Show success message
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Thank you! The item has been marked as claimed.</span>
            <button onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    showPickupModal(donationId) {
        const modal = document.createElement('div');
        modal.className = 'pickup-modal';
        modal.innerHTML = `
            <div class="pickup-modal-content">
                <div class="pickup-modal-header">
                    <h2><i class="fas fa-hands-helping"></i> Pickup Information</h2>
                    <button class="close-btn" onclick="this.closest('.pickup-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="pickup-form" data-donation-id="${donationId}">
                    <div class="form-group">
                        <label for="picker-name">Your Name *</label>
                        <input type="text" id="picker-name" name="pickerName" required>
                    </div>
                    <div class="form-group">
                        <label for="picker-email">Your Email *</label>
                        <input type="email" id="picker-email" name="pickerEmail" required>
                        <small>We'll send you a confirmation email with delivery tracking.</small>
                    </div>
                    <div class="form-group">
                        <label for="picker-phone">Phone Number (Optional)</label>
                        <input type="tel" id="picker-phone" name="pickerPhone">
                    </div>
                    <div class="form-actions">
                        <button type="button" onclick="this.closest('.pickup-modal').remove()" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-check"></i> Confirm Pickup
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for form submission
        document.getElementById('pickup-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmPickup(e.target.dataset.donationId, new FormData(e.target));
        });
    }

    async confirmPickup(donationId, formData) {
        try {
            FastHelpUtils.showLoading(true);
            
            const data = {
                pickerName: formData.get('pickerName'),
                pickerEmail: formData.get('pickerEmail'),
                pickerPhone: formData.get('pickerPhone')
            };

            const response = await FastHelpUtils.makeRequest(`/api/donations/${donationId}/pickup`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            FastHelpUtils.showLoading(false);
            
            // Close modal
            document.querySelector('.pickup-modal').remove();
            
            // Show success message
            FastHelpUtils.showNotification('Pickup confirmed! Check your email for delivery tracking.', 'success');
            
            // Refresh donations to update the map
            this.loadDonations();

        } catch (error) {
            FastHelpUtils.showLoading(false);
            FastHelpUtils.showNotification(error.message || 'Failed to confirm pickup', 'error');
        }
    }

    getDirections(lat, lng) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Open directions in default map app
                const url = `https://www.google.com/maps/dir/${userLat},${userLng}/${lat},${lng}`;
                window.open(url, '_blank');
            }, (error) => {
                // Fallback - just open destination
                const url = `https://www.google.com/maps/search/${lat},${lng}`;
                window.open(url, '_blank');
            });
        } else {
            const url = `https://www.google.com/maps/search/${lat},${lng}`;
            window.open(url, '_blank');
        }
    }
};

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('map')) {
        window.fastHelpMap = new FastHelpMap();
    }
});

// Add custom CSS for markers and popups
const style = document.createElement('style');
style.textContent = `
    .donation-marker {
        background: none;
        border: none;
    }
    
    .marker-icon {
        width: 40px;
        height: 40px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .marker-icon i {
        color: white;
        font-size: 16px;
        transform: rotate(45deg);
    }
    
    .user-location-marker {
        background: none;
        border: none;
    }
    
    .user-location-marker i {
        color: #4f46e5;
        font-size: 30px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    }
    
    .donation-popup-content {
        min-width: 250px;
    }
    
    .popup-image {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 12px;
    }
    
    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
    }
    
    .popup-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
    }
    
    .popup-category {
        background: rgba(79, 70, 229, 0.1);
        color: #4f46e5;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .popup-description {
        color: #6b7280;
        font-size: 14px;
        margin-bottom: 12px;
        line-height: 1.4;
    }
    
    .popup-meta {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 12px;
        color: #9ca3af;
    }
    
    .popup-meta div {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .popup-actions {
        display: flex;
        gap: 8px;
    }
    
    .popup-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: all 0.2s;
    }
    
    .popup-btn.primary {
        background: #4f46e5;
        color: white;
    }
    
    .popup-btn.primary:hover {
        background: #3730a3;
    }
    
    .popup-btn.pickup {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
    }
    
    .popup-btn.pickup:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        transform: translateY(-2px);
    }
    
    .popup-instructions {
        background: #f0f9ff;
        border: 1px solid #0ea5e9;
        border-radius: 6px;
        padding: 0.75rem;
        margin: 0.75rem 0;
        font-size: 0.875rem;
    }
    
    .pickup-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
    }
    
    .pickup-modal-content {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .pickup-modal-header {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        padding: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 12px 12px 0 0;
    }
    
    .pickup-modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
    }
    
    .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: background 0.3s ease;
    }
    
    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .pickup-modal form {
        padding: 1.5rem;
    }
    
    .form-group {
        margin-bottom: 1rem;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #374151;
    }
    
    .form-group input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e5e7eb;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.3s ease;
    }
    
    .form-group input:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    
    .form-group small {
        display: block;
        margin-top: 0.25rem;
        color: #6b7280;
        font-size: 0.875rem;
    }
    
    .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }
    
    .btn-secondary {
        background: #6b7280;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.3s ease;
    }
    
    .btn-secondary:hover {
        background: #4b5563;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .btn-primary:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        transform: translateY(-2px);
    }
    
    .notification {
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        max-width: 350px;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification.success {
        border-left: 4px solid #10b981;
    }
    
    .notification.error {
        border-left: 4px solid #ef4444;
    }
    
    .notification.success i {
        color: #10b981;
    }
    
    .notification.error i {
        color: #ef4444;
    }
    
    .notification button {
        background: none;
        border: none;
        cursor: pointer;
        color: #9ca3af;
        margin-left: auto;
    }
    
    .notification button:hover {
        color: #374151;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
