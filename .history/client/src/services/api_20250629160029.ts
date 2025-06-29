import axios from 'axios'

const API_BASE_URL = import.meta.env.PROD 
  ? '' // In production, API calls will be relative to the same domain
  : 'http://localhost:3000' // In development, backend runs on port 3000

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  
  register: (userData: { name: string; email: string; phone: string; address: string; userType: string }) =>
    api.post('/api/auth/register', userData),
  
  logout: () => api.post('/api/auth/logout'),
}

export const donationAPI = {
  getDonations: () => api.get('/api/donations'),
  
  createDonation: (donation: { foodType: string; quantity: string; pickupTime: string; description?: string }) =>
    api.post('/api/donations', donation),
  
  updateDonation: (id: string, updates: any) =>
    api.put(`/api/donations/${id}`, updates),
  
  deleteDonation: (id: string) =>
    api.delete(`/api/donations/${id}`),
}

export const adminAPI = {
  getStats: () => api.get('/api/admin/stats'),
  
  getUsers: () => api.get('/api/admin/users'),
  
  updateUserStatus: (userId: string, status: string) =>
    api.put(`/api/admin/users/${userId}/status`, { status }),
  
  getDonationHistory: () => api.get('/api/admin/donations'),
}

export const userAPI = {
  getProfile: () => api.get('/api/user/profile'),
  
  updateProfile: (updates: any) =>
    api.put('/api/user/profile', updates),
}

export default api
