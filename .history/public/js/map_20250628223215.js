// Map functionality using Leaflet.js (free, open-source)
// Austin, TX coordinates and boundaries
const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 };
const AUSTIN_BOUNDS = {
    north: 30.5149,
    south: 30.0986,
    east: -97.5691,
    west: -97.9383
};

class FastHelpMap {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.donations = [];
        this.markers = [];
        this.userMarker = null;
        this.currentFilter = 'all';
        this.currentView = 'map';
        this.currentRadius = 3; // Default 3 miles for Austin
        this.isInitialized = false;
    }

    async init() {
        console.log('Initializing FastHelpMap for Austin, TX...');
        try {
            await this.initMap();
            this.setupViewControls();
            this.setupFilters();
            this.setupEventListeners();
            await this.getUserLocation();
            await this.loadDonations();
            this.isInitialized = true;
            console.log('FastHelpMap initialized successfully');
        } catch (error) {
            console.error('Error initializing FastHelpMap:', error);
        }
    }

    async initMap() {
        try {
            // Initialize the map centered on Austin, TX
            this.map = L.map('map').setView([AUSTIN_CENTER.lat, AUSTIN_CENTER.lng], 12);

            // Add OpenStreetMap tiles (free)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(this.map);

            // Add map controls
            this.map.zoomControl.setPosition('topright');

            // Set map bounds to Austin area
            const austinBounds = L.latLngBounds(
                [AUSTIN_BOUNDS.south, AUSTIN_BOUNDS.west],
                [AUSTIN_BOUNDS.north, AUSTIN_BOUNDS.east]
            );
            this.map.setMaxBounds(austinBounds);

            console.log('Map initialized successfully for Austin, TX');
        } catch (error) {
            console.error('Error initializing map:', error);
            throw error;
        }
    }

    async getUserLocation() {
        const locationText = document.getElementById('location-text');
        const enableLocationBtn = document.getElementById('enable-location');

        if (!navigator.geolocation) {
            if (locationText) {
                locationText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Geolocation not supported';
            }
            if (enableLocationBtn) {
                enableLocationBtn.style.display = 'none';
            }
            return;
        }

        return new Promise((resolve) => {
            if (locationText) {
                locationText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting your Austin location...';
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    // Check if user is within Austin bounds
                    if (this.isWithinAustin(lat, lng)) {
                        this.userLocation = { lat, lng };

                        // Center map on user location
                        if (this.map) {
                            this.map.setView([lat, lng], 14);
                        }

                        // Add user location marker
                        this.addUserLocationMarker();

                        if (locationText) {
                            locationText.innerHTML = '<i class="fas fa-check-circle"></i> Austin location found';
                        }
                        if (enableLocationBtn) {
                            enableLocationBtn.style.display = 'none';
                        }

                        console.log('User location obtained in Austin:', this.userLocation);
                    } else {
                        // User is outside Austin
                        if (locationText) {
                            locationText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Service only available in Austin, TX';
                        }
                        console.warn('User location outside Austin area:', { lat, lng });
                    }
                    resolve(this.userLocation);
                },
                (error) => {
                    console.error('Location error:', error);
                    if (locationText) {
                        locationText.innerHTML = '<i class="fas fa-exclamation-circle"></i> Location unavailable - showing Austin area';
                    }
                    if (enableLocationBtn) {
                        enableLocationBtn.style.display = 'inline-block';
                        enableLocationBtn.onclick = () => this.getUserLocation();
                    }
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
    }

    isWithinAustin(lat, lng) {
        return lat >= AUSTIN_BOUNDS.south && 
               lat <= AUSTIN_BOUNDS.north && 
               lng >= AUSTIN_BOUNDS.west && 
               lng <= AUSTIN_BOUNDS.east;
    }

    addUserLocationMarker() {
        if (!this.userLocation || !this.map) return;

        // Remove existing user marker
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<i class="fas fa-user-circle"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon: userIcon })
            .addTo(this.map)
            .bindPopup('<b>Your Location</b><br>You are here in Austin!');
    }

    async loadDonations() {
        try {
            const params = new URLSearchParams();
            if (this.userLocation) {
                params.append('lat', this.userLocation.lat);
                params.append('lng', this.userLocation.lng);
                params.append('radius', this.milesToKm(this.currentRadius)); // Convert miles to km for backend
            }

            const response = await fetch(`/api/donations?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const donations = await response.json();
            
            // Filter donations to Austin area only
            this.donations = donations.filter(donation => 
                this.isWithinAustin(parseFloat(donation.lat), parseFloat(donation.lng))
            );
            
            console.log(`Loaded ${this.donations.length} donations in Austin area`);
            
            if (this.currentView === 'map') {
                this.displayDonationsOnMap();
            } else {
                this.displayDonationsAsList();
            }
            
            this.updateStats();
        } catch (error) {
            console.error('Error loading donations:', error);
            this.showNotification('Error loading donations. Please refresh the page.', 'error');
        }
    }

    displayDonationsOnMap() {
        // Clear existing markers
        this.clearMarkers();

        // Filter donations based on current filter
        const filteredDonations = this.filterDonations(this.donations);

        // Add markers for each donation
        filteredDonations.forEach(donation => {
            const marker = this.createDonationMarker(donation);
            if (marker) {
                this.markers.push(marker);
                marker.addTo(this.map);
            }
        });

        console.log(`Displayed ${filteredDonations.length} donations on map`);
    }

    displayDonationsAsList() {
        const listContainer = document.getElementById('donations-list');
        if (!listContainer) return;

        const filteredDonations = this.filterDonations(this.donations);

        if (filteredDonations.length === 0) {
            listContainer.innerHTML = `
                <div class="no-donations">
                    <i class="fas fa-inbox"></i>
                    <h3>No donations found in Austin</h3>
                    <p>Try adjusting your filters or expanding your search radius.</p>
                </div>
            `;
            return;
        }

        const donationsHTML = filteredDonations.map(donation => {
            const distance = this.userLocation ? this.calculateDistanceMiles(
                this.userLocation.lat, this.userLocation.lng,
                parseFloat(donation.lat), parseFloat(donation.lng)
            ) : null;

            return `
                <div class="donation-item" data-id="${donation._id}">
                    ${donation.image ? `<img src="${donation.image}" alt="${donation.title}" class="donation-image">` : ''}
                    <div class="donation-content">
                        <div class="donation-header">
                            <h3>${donation.title}</h3>
                            <span class="donation-category">
                                <i class="${this.getCategoryIcon(donation.type)}"></i>
                                ${this.formatCategory(donation.type)}
                            </span>
                        </div>
                        <p class="donation-description">${donation.description}</p>
                        ${donation.dropoffInstructions ? 
                            `<div class="donation-instructions">
                                <i class="fas fa-info-circle"></i>
                                <strong>Pickup Instructions:</strong> ${donation.dropoffInstructions}
                            </div>` : ''
                        }
                        <div class="donation-meta">
                            <div class="donation-time">
                                <i class="fas fa-clock"></i>
                                ${this.getTimeAgo(new Date(donation.createdAt))}
                            </div>
                            ${distance ? 
                                `<div class="donation-distance">
                                    <i class="fas fa-route"></i>
                                    ${distance.toFixed(1)} miles away
                                </div>` : ''
                            }
                            ${donation.address ? 
                                `<div class="donation-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${donation.address}
                                </div>` : ''
                            }
                        </div>
                        <div class="donation-actions">
                            <button onclick="fastHelpMap.getDirections(${donation.lat}, ${donation.lng})" class="btn btn-primary">
                                <i class="fas fa-directions"></i>
                                Get Directions
                            </button>
                            <button onclick="fastHelpMap.showPickupModal('${donation._id}')" class="btn btn-success">
                                <i class="fas fa-hands-helping"></i>
                                Pick Up This Item
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = donationsHTML;
        console.log(`Displayed ${filteredDonations.length} donations in list`);
    }

    filterDonations(donations) {
        return donations.filter(donation => {
            if (this.currentFilter === 'all') return true;
            return donation.type === this.currentFilter;
        });
    }

    clearMarkers() {
        this.markers.forEach(marker => {
            if (this.map && this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
        this.markers = [];
    }

    createDonationMarker(donation) {
        if (!donation.lat || !donation.lng) {
            console.warn('Donation missing coordinates:', donation);
            return null;
        }

        const lat = parseFloat(donation.lat);
        const lng = parseFloat(donation.lng);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn('Invalid coordinates for donation:', donation);
            return null;
        }

        // Choose icon based on type
        const iconClass = this.getCategoryIcon(donation.type);
        const iconColor = this.getCategoryColor(donation.type);

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
        const marker = L.marker([lat, lng], { icon: customIcon });

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
        const distance = this.userLocation ? this.calculateDistanceMiles(
            this.userLocation.lat, this.userLocation.lng,
            parseFloat(donation.lat), parseFloat(donation.lng)
        ) : null;
        
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
                    ${distance ? 
                        `<div class="popup-distance">
                            <i class="fas fa-route"></i>
                            ${distance.toFixed(1)} miles away
                        </div>` : ''
                    }
                    ${donation.address ? 
                        `<div class="popup-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${donation.address}
                        </div>` : ''
                    }
                </div>
                <div class="popup-actions">
                    <button onclick="fastHelpMap.getDirections(${donation.lat}, ${donation.lng})" class="popup-btn primary">
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

    getCategoryColor(type) {
        const colors = {
            'cooked': '#10b981',
            'uncooked': '#f59e0b',
            'clothing': '#8b5cf6',
            'bedding': '#06b6d4',
            'comfort': '#ec4899',
            'other': '#4f46e5'
        };
        return colors[type] || '#4f46e5';
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

    setupViewControls() {
        const mapViewBtn = document.getElementById('map-view-btn');
        const listViewBtn = document.getElementById('list-view-btn');
        const mapContainer = document.getElementById('map-container');
        const listContainer = document.getElementById('list-container');
        const radiusSelect = document.getElementById('radius-select');

        // Update radius options to miles
        if (radiusSelect) {
            radiusSelect.innerHTML = `
                <option value="1">1 mile</option>
                <option value="3" selected>3 miles</option>
                <option value="5">5 miles</option>
                <option value="10">10 miles</option>
                <option value="25">25 miles</option>
            `;
        }

        if (mapViewBtn) {
            mapViewBtn.addEventListener('click', () => {
                this.currentView = 'map';
                mapViewBtn.classList.add('active');
                if (listViewBtn) listViewBtn.classList.remove('active');
                if (mapContainer) mapContainer.style.display = 'block';
                if (listContainer) listContainer.style.display = 'none';
                
                // Refresh map after showing
                if (this.map) {
                    setTimeout(() => {
                        this.map.invalidateSize();
                        this.displayDonationsOnMap();
                    }, 100);
                }
            });
        }

        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                this.currentView = 'list';
                listViewBtn.classList.add('active');
                if (mapViewBtn) mapViewBtn.classList.remove('active');
                if (mapContainer) mapContainer.style.display = 'none';
                if (listContainer) listContainer.style.display = 'block';
                this.displayDonationsAsList();
            });
        }

        if (radiusSelect) {
            radiusSelect.addEventListener('change', (e) => {
                this.currentRadius = parseInt(e.target.value);
                this.loadDonations();
            });
        }
    }

    setupFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons in the same container
                const container = btn.closest('.filter-controls');
                if (container) {
                    container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                }
                
                // Add active class to clicked button
                btn.classList.add('active');
                
                // Update current filter
                this.currentFilter = btn.dataset.filter;
                
                // Update display
                if (this.currentView === 'map') {
                    this.displayDonationsOnMap();
                } else {
                    this.displayDonationsAsList();
                }
            });
        });
    }

    setupEventListeners() {
        // Refresh donations every 30 seconds
        setInterval(() => {
            if (this.isInitialized) {
                this.loadDonations();
            }
        }, 30000);

        // Handle map clicks
        if (this.map) {
            this.map.on('click', (e) => {
                console.log('Map clicked at:', e.latlng);
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.map && this.currentView === 'map') {
                setTimeout(() => {
                    this.map.invalidateSize();
                }, 100);
            }
        });
    }

    updateStats() {
        const userCount = document.getElementById('user-count');
        const donationCount = document.getElementById('donation-count');
        const locationCount = document.getElementById('location-count');

        if (userCount) userCount.textContent = `${Math.floor(Math.random() * 1000) + 500}+`;
        if (donationCount) donationCount.textContent = `${this.donations.length + Math.floor(Math.random() * 50)}+`;
        if (locationCount) locationCount.textContent = `Austin, TX`;
    }

    // Convert miles to kilometers for backend API
    milesToKm(miles) {
        return miles * 1.60934;
    }

    calculateDistanceMiles(lat1, lng1, lat2, lng2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
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
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showPickupModal(donationId) {
        const donation = this.donations.find(d => d._id === donationId);
        if (!donation) {
            this.showNotification('Donation not found', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal pickup-modal">
                <div class="modal-header">
                    <h3>Confirm Pickup</h3>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="donation-summary">
                        <h4>${donation.title}</h4>
                        <p>${donation.description}</p>
                        ${donation.dropoffInstructions ? 
                            `<div class="pickup-instructions">
                                <i class="fas fa-info-circle"></i>
                                <strong>Pickup Instructions:</strong> ${donation.dropoffInstructions}
                            </div>` : ''
                        }
                    </div>
                    <form id="pickup-form">
                        <div class="form-group">
                            <label for="picker-name">Your Name *</label>
                            <input type="text" id="picker-name" name="pickerName" required>
                        </div>
                        <div class="form-group">
                            <label for="picker-email">Your Email *</label>
                            <input type="email" id="picker-email" name="pickerEmail" required>
                        </div>
                        <div class="form-group">
                            <label for="picker-phone">Your Phone</label>
                            <input type="tel" id="picker-phone" name="pickerPhone">
                        </div>
                        <div class="form-actions">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
                            <button type="submit" class="btn btn-success">Confirm Pickup</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle form submission
        const form = modal.querySelector('#pickup-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            this.confirmPickup(donationId, formData);
        });
    }

    async confirmPickup(donationId, formData) {
        try {
            const response = await fetch(`/api/donations/${donationId}/pickup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pickerName: formData.get('pickerName'),
                    pickerEmail: formData.get('pickerEmail'),
                    pickerPhone: formData.get('pickerPhone')
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Close modal
            const modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();

            // Show success message
            this.showNotification('Pickup confirmed! Check your email for confirmation details.', 'success');

            // Reload donations
            this.loadDonations();

        } catch (error) {
            console.error('Error confirming pickup:', error);
            this.showNotification('Error confirming pickup. Please try again.', 'error');
        }
    }

    getDirections(lat, lng) {
        if (!lat || !lng) {
            this.showNotification('Invalid location coordinates', 'error');
            return;
        }

        const destination = `${lat},${lng}`;
        
        // Try to use the user's current location as starting point
        if (this.userLocation) {
            const origin = `${this.userLocation.lat},${this.userLocation.lng}`;
            window.open(`https://www.google.com/maps/dir/${origin}/${destination}`, '_blank');
        } else {
            // Just show the destination
            window.open(`https://www.google.com/maps/search/?api=1&query=${destination}`, '_blank');
        }
    }
}

// Initialize the map when the page loads
let fastHelpMap = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing FastHelpMap...');
    // Wait a bit for the DOM to be fully ready
    setTimeout(() => {
        try {
            fastHelpMap = new FastHelpMap();
            fastHelpMap.init();
            // Make sure the map is available globally for onclick handlers
            window.fastHelpMap = fastHelpMap;
        } catch (error) {
            console.error('Error creating FastHelpMap:', error);
        }
    }, 500);
});

// Make sure the map is available globally
window.addEventListener('load', () => {
    if (fastHelpMap) {
        window.fastHelpMap = fastHelpMap;
    }
});
