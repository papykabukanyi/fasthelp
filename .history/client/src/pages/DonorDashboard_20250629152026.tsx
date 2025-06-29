import React, { useState, useEffect } from 'react'

interface Donation {
  id: string
  foodType: string
  quantity: string
  pickupTime: string
  status: 'pending' | 'confirmed' | 'completed'
  recipient?: string
}

const DonorDashboard: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDonation, setNewDonation] = useState({
    foodType: '',
    quantity: '',
    pickupTime: '',
    description: ''
  })

  useEffect(() => {
    fetchDonations()
  }, [])

  const fetchDonations = async () => {
    try {
      const response = await fetch('/api/donations')
      if (response.ok) {
        const data = await response.json()
        setDonations(data)
      }
    } catch (error) {
      console.error('Error fetching donations:', error)
    }
  }

  const handleSubmitDonation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newDonation),
      })
      
      if (response.ok) {
        setShowAddForm(false)
        setNewDonation({ foodType: '', quantity: '', pickupTime: '', description: '' })
        fetchDonations()
      }
    } catch (error) {
      console.error('Error adding donation:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Donor Dashboard</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          + Add Donation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📦</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Donations</p>
              <p className="text-2xl font-bold text-gray-900">{donations.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {donations.filter(d => d.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {donations.filter(d => d.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">🤝</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Families Helped</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>
      </div>

      {/* Donations List */}
      <div className="card bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Recent Donations</h2>
        </div>
        <div className="p-6">
          {donations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No donations yet. Add your first donation!</p>
          ) : (
            <div className="space-y-4">
              {donations.map((donation) => (
                <div key={donation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{donation.foodType}</h3>
                      <p className="text-sm text-gray-600">Quantity: {donation.quantity}</p>
                      <p className="text-sm text-gray-600">Pickup: {donation.pickupTime}</p>
                      {donation.recipient && (
                        <p className="text-sm text-gray-600">Recipient: {donation.recipient}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(donation.status)}`}>
                      {donation.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Donation Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">Add New Donation</h2>
            <form onSubmit={handleSubmitDonation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Food Type
                </label>
                <input
                  type="text"
                  value={newDonation.foodType}
                  onChange={(e) => setNewDonation(prev => ({ ...prev, foodType: e.target.value }))}
                  required
                  className="input-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="text"
                  value={newDonation.quantity}
                  onChange={(e) => setNewDonation(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                  className="input-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Pickup Time
                </label>
                <input
                  type="datetime-local"
                  value={newDonation.pickupTime}
                  onChange={(e) => setNewDonation(prev => ({ ...prev, pickupTime: e.target.value }))}
                  required
                  className="input-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newDonation.description}
                  onChange={(e) => setNewDonation(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold transition-colors"
                >
                  Add Donation
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 btn-secondary bg-gray-500 hover:bg-gray-700 text-white py-2 rounded-md font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DonorDashboard
