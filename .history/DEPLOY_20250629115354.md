# Fast Help - Railway Deployment Guide

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/)

## 🚀 Quick Deploy on Railway

### Prerequisites
- Railway account
- Redis database (Railway provides Redis add-on)

### One-Click Deploy
1. Click the "Deploy on Railway" button above
2. Connect your GitHub account
3. Set the required environment variables (see below)
4. Deploy!

### Manual Deployment Steps

#### 1. Create New Railway Project
```bash
railway login
railway init
```

#### 2. Add Redis Database
```bash
railway add redis
```

#### 3. Set Environment Variables
Set these in your Railway project dashboard:

**Required:**
- `REDIS_URL` - Automatically set by Railway Redis addon
- `JWT_SECRET` - Generate a secure random string (32+ characters)

**Optional:**
- `ADMIN_EMAIL` - Default: admin@fasthelp.com
- `ADMIN_PASSWORD` - Default: admin123 (CHANGE THIS!)
- `EMAIL_FROM` - Your sender email address
- `NODE_ENV` - Set to "production"

#### 4. Deploy
```bash
railway up
```

## 🔧 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://user:pass@host:port` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key-here` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `ADMIN_EMAIL` | Default admin email | `admin@fasthelp.com` |
| `ADMIN_PASSWORD` | Default admin password | `admin123` |
| `EMAIL_FROM` | Sender email address | `noreply@fasthelp.com` |

## 🏥 Health Checks

The application provides health check endpoints:
- `/health` - Basic server health
- `/api/health` - Detailed health with Redis status

Railway will automatically use `/health` for monitoring.

## 🔒 Security Checklist

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Change default admin password
- [ ] Configure proper `EMAIL_FROM` address
- [ ] Set `NODE_ENV=production`
- [ ] Review Redis connection security

## 📁 File Structure

```
fasthelp/
├── server.js              # Main server file
├── package.json           # Dependencies
├── railway.json          # Railway configuration
├── nixpacks.toml         # Build configuration
├── .env.example          # Environment variables template
├── public/               # Static files
│   ├── index.html
│   ├── admin.html
│   ├── donor-signup.html
│   ├── donor-dashboard.html
│   ├── 404.html
│   ├── css/
│   ├── js/
│   └── uploads/
└── email-templates/      # Email templates
```

## 🚀 Post-Deployment Steps

1. **Access Admin Panel**: Visit `/admin` and login with admin credentials
2. **Configure SMTP**: Set up email settings in admin panel
3. **Test Registration**: Create a test user account
4. **Change Admin Password**: Update default credentials
5. **Test Map Functionality**: Verify location services work
6. **Create Test Donation**: Test the full flow

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
- Check Redis connection (`REDIS_URL`)
- Verify environment variables are set
- Check Railway logs

**Admin can't login:**
- Verify admin credentials
- Check if default admin was created (see logs)

**Map not loading:**
- Check browser console for errors
- Verify geolocation permissions

**Emails not sending:**
- Configure SMTP settings in admin panel
- Check email credentials

### Logs
View logs in Railway dashboard or use:
```bash
railway logs
```

## 📊 Monitoring

Railway provides built-in monitoring. The app includes:
- Health check endpoints
- Structured logging in production
- Error handling and reporting

## 🔄 Updates

To update your deployment:
1. Push changes to your GitHub repository
2. Railway will automatically redeploy
3. Or use: `railway up`

## 📞 Support

- Check Railway logs for errors
- Review health check endpoints
- Ensure all environment variables are set
- Verify Redis connectivity

## 🌟 Features

- ✅ User registration with admin approval
- ✅ Interactive map with Austin-only service area
- ✅ Dark mode support
- ✅ Email notifications
- ✅ Mobile responsive design
- ✅ Real-time donation updates
- ✅ Admin dashboard for user/donation management
- ✅ File upload for donation photos
- ✅ Donation status tracking

---

**Made with ❤️ for the Austin community**
