import React from 'react'
import { Link } from 'react-router-dom'

const HomePage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Connect Food Donors with
          <span className="text-blue-600"> People in Need</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Fast Help is a platform that bridges the gap between food donors and those who need help. 
          Join our community to make a difference in your neighborhood.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/donor-signup"
            className="btn-primary bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
          >
            🥘 Donate Food
          </Link>
          <button className="btn-secondary bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
            🙏 Request Help
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="card text-center p-6 bg-white rounded-lg shadow-md">
          <div className="text-4xl mb-4">🚚</div>
          <h3 className="text-xl font-semibold mb-2">Easy Pickup</h3>
          <p className="text-gray-600">Schedule convenient pickup times for your food donations</p>
        </div>
        <div className="card text-center p-6 bg-white rounded-lg shadow-md">
          <div className="text-4xl mb-4">🤝</div>
          <h3 className="text-xl font-semibold mb-2">Direct Connection</h3>
          <p className="text-gray-600">Connect directly with people in your community who need help</p>
        </div>
        <div className="card text-center p-6 bg-white rounded-lg shadow-md">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
          <p className="text-gray-600">Get instant notifications about donations and requests</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-50 rounded-lg p-8 mb-12">
        <div className="grid md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">1,234</div>
            <div className="text-gray-600">Meals Donated</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">567</div>
            <div className="text-gray-600">Active Donors</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">89</div>
            <div className="text-gray-600">Families Helped</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">24/7</div>
            <div className="text-gray-600">Support</div>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
            <h3 className="text-lg font-semibold mb-2">Sign Up</h3>
            <p className="text-gray-600">Create your account as a donor or someone who needs help</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
            <h3 className="text-lg font-semibold mb-2">Connect</h3>
            <p className="text-gray-600">Match with people in your area based on availability</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
            <h3 className="text-lg font-semibold mb-2">Help</h3>
            <p className="text-gray-600">Coordinate pickup and delivery to make a difference</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
