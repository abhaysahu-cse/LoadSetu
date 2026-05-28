# LoadSetu - AI-Powered Logistics Matching Platform

LoadSetu is an intelligent logistics platform that uses AI/ML to match available trucks with freight loads, optimizing empty kilometers and maximizing fleet utilization.

## 🚀 Features

- **AI-Powered Matching**: Machine learning algorithms match trucks with optimal loads based on location, capacity, and route efficiency
- **Real-Time Tracking**: Live truck location tracking and load status monitoring
- **Multi-Role Support**: Separate interfaces for Shippers, Fleet Owners, and Administrators
- **Bulk Load Management**: CSV upload for bulk load creation with validation
- **Analytics Dashboard**: Comprehensive analytics for earnings, routes, and performance metrics
- **Payment Integration**: Razorpay integration for secure payment processing
- **WhatsApp Notifications**: Automated notifications via Twilio and Meta WhatsApp Business API

## 🏗️ Architecture

### Microservices
- **Backend (Spring Boot)**: Core business logic, authentication, and data management
- **ML Engine (FastAPI)**: AI/ML matching algorithms and predictive analytics
- **Web Frontend (Next.js)**: Responsive web application for shippers and fleet owners
- **Admin Dashboard (Next.js)**: Administrative interface for system monitoring
- **Mobile App (React Native)**: Driver mobile application

### Infrastructure
- **Database**: PostgreSQL with Flyway migrations
- **Cache**: Redis for session management and caching
- **Message Queue**: Apache Kafka for event streaming
- **Reverse Proxy**: Nginx for load balancing and SSL termination

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Java 21+ (for local development)
- Python 3.11+ (for local development)

## 🔧 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/abhaysahu-cse/LoadSetu.git
cd LoadSetu
```

### 2. Configure Environment
```bash
cp .env.production.example .env.production
# Edit .env.production with your configuration
```

### 3. Start Services
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 4. Verify Deployment
```bash
# Check all services are healthy
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# Access services
# Web App: http://localhost:3000
# Backend API: http://localhost:8080
# ML Engine: http://localhost:8000
# Admin Dashboard: http://localhost:3001
```

## 🗄️ Database Setup

The application uses Flyway for database migrations. Migrations run automatically on startup.

### Manual Migration (if needed)
```bash
docker exec -it loadsetu-backend sh
./mvnw flyway:migrate
```

### Seed Demo Data
Demo data is automatically seeded via migration `V5__seed_demo_loads_mp.sql` which creates 100 sample loads from Madhya Pradesh cities.

## 📊 Service Endpoints

| Service | Port | Health Check |
|---------|------|--------------|
| Web Frontend | 3000 | http://localhost:3000/api/health |
| Backend API | 8080 | http://localhost:8080/actuator/health |
| ML Engine | 8000 | http://localhost:8000/health |
| Admin Dashboard | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |
| Kafka | 9092 | - |

## 🔐 Default Credentials

**Demo Shipper Account:**
- Phone: +919999999999
- Password: Test@123

**Demo Fleet Owner Account:**
- Phone: +910000000000
- Password: Test@123

## 🛠️ Development

### Backend (Spring Boot)
```bash
cd vahansync-core-backend/vahansync
./mvnw spring-boot:run
```

### ML Engine (FastAPI)
```bash
cd ml-engine
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Web Frontend (Next.js)
```bash
cd loadsetu-web
npm install
npm run dev
```

### Admin Dashboard
```bash
cd admin-dashboard
npm install
npm run dev
```

## 📦 Project Structure

```
LoadSetu/
├── vahansync-core-backend/     # Spring Boot backend
│   └── vahansync/
│       ├── src/main/java/      # Java source code
│       └── src/main/resources/ # Configuration & migrations
├── ml-engine/                  # FastAPI ML service
│   ├── main.py                 # FastAPI application
│   └── requirements.txt        # Python dependencies
├── loadsetu-web/               # Next.js web frontend
│   ├── src/app/                # App router pages
│   ├── src/components/         # React components
│   └── src/lib/                # API clients & utilities
├── admin-dashboard/            # Admin interface
├── loadsetu-driver/            # React Native mobile app
├── docker-compose.prod.yml     # Production Docker setup
├── nginx.conf                  # Nginx configuration
└── .env.production.example     # Environment template
```

## 🔄 API Documentation

### Authentication
```bash
# Register Shipper
POST /api/v1/auth/register-shipper
Content-Type: application/json
{
  "name": "Company Name",
  "companyName": "LoadSetu Logistics",
  "phone": "+919876543210",
  "password": "SecurePass@123"
}

# Login
POST /api/v1/auth/login
Content-Type: application/json
{
  "phone": "+919876543210",
  "password": "SecurePass@123"
}
```

### Load Management
```bash
# Create Load
POST /api/v1/loads
Authorization: Bearer <token>
Content-Type: application/json
{
  "originName": "Bhopal",
  "originLat": 23.2599,
  "originLng": 77.4126,
  "destinationName": "Indore",
  "destLat": 22.7196,
  "destLng": 75.8577,
  "requiredCapacity": 10,
  "payoutInr": 15000,
  "pickupTime": "2026-06-01T10:00:00"
}

# Get My Loads
GET /api/v1/loads/my-loads
Authorization: Bearer <token>
```

### Truck Matching
```bash
# Get Matches for Load
GET /api/v1/matches/{loadId}
Authorization: Bearer <token>
```

## 🧪 Testing

### Run Backend Tests
```bash
cd vahansync-core-backend/vahansync
./mvnw test
```

### Run Frontend Tests
```bash
cd loadsetu-web
npm test
```

## 🚢 Deployment

### Production Deployment
1. Update environment variables in `.env.production`
2. Build and deploy:
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Health Monitoring
```bash
# Check all services
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# View logs
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f [service-name]
```

## 🔒 Security

- JWT-based authentication with secure token management
- Password hashing using BCrypt
- CORS configuration for API security
- Rate limiting on API endpoints
- SQL injection prevention via parameterized queries
- XSS protection headers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 👥 Team

Developed by the LoadSetu Engineering Team

## 📧 Contact

For questions or support, please contact: support@loadsetu.in

---

**Version**: 1.0.0  
**Last Updated**: May 2026
