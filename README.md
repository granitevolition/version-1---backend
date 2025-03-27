# Version 1 Backend API

This is the backend API for the Version 1 user registration and management system. It provides authentication, user management, and text humanization services backed by PostgreSQL.

## Recent Fixes

We've recently improved database connectivity and error handling:

1. **Database Connection Management**
   - Fixed the database connectivity issues
   - Enhanced connection state tracking using getters
   - Added automatic connection recovery
   - Implemented periodic connection health checks

2. **Error Handling**
   - Added graceful degradation when database is unavailable
   - Improved error messages with specific details
   - Added retry logic for temporary failures

3. **Startup Process**
   - Restructured the server startup to work even when database is unavailable
   - Added proper migration handling with error recovery
   - Added missing table detection and creation

4. **API Health Endpoint**
   - Enhanced `/health` endpoint with detailed status information
   - Added database connectivity status monitoring
   - Improved environment information reporting

## Deployment

### Environment Variables

Create a `.env` file based on the provided `.env.example` with your specific configuration:

```
DATABASE_URL=postgresql://postgres:password@hostname:port/database
PORT=5000
NODE_ENV=production
```

### Database Setup

The application will automatically initialize the database on startup, creating all necessary tables:

1. `users` - User accounts and profiles
2. `user_sessions` - Session management
3. `humanize_logs` - Text humanization activity tracking
4. `humanize_usage_statistics` - User usage tracking
5. `humanize_usage_limits` - Service tier limitations

### Railway Deployment

For Railway deployment, ensure the PostgreSQL database is properly linked, and the environment variables are correctly set in the Railway dashboard.

## Troubleshooting

### Database Connection Issues

If you see "Database connection is not available" errors:

1. **Check Environment Variables**
   - Verify DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL is correctly set
   - The application tries these variables in order
   - The URL should have the format: `postgresql://username:password@hostname:port/database`

2. **Check PostgreSQL Connection**
   - Verify the PostgreSQL server is running
   - Ensure the database exists
   - Test the connection with `psql -U username -h hostname -p port database`

3. **Check Network Configuration**
   - Ensure the database service is accessible from the application
   - Verify firewall rules allow the connection
   - Check for VPN or network restrictions

4. **Connection Pooling**
   - The application uses connection pooling, which might require specific PostgreSQL configuration
   - Increase `max_connections` in PostgreSQL if needed

### API Endpoint Issues

For 404 errors or missing endpoints:

1. **Check API Paths**
   - All API endpoints are prefixed with `/api/v1/`
   - Example: `/api/v1/auth/login`

2. **CORS Issues**
   - The application has CORS protection enabled
   - Add your frontend domain to the ALLOWED_ORIGINS environment variable

### Logging Information

The server logs important events and errors. For deployment diagnostics, look for:

- "Database connected successfully at" - Indicates successful database connection
- "Server running on port" - Indicates the server has started
- "Database connection test failed" - Indicates connection issues
- "Error during database initialization" - Indicates migration problems

## API Endpoints

### Authentication

- `POST /api/v1/auth/login` - Log in with username and password
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/logout` - Log out (invalidate session)
- `GET /api/v1/auth/verify` - Verify session validity

### User Management

- `GET /api/v1/users/:id` - Get user details
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Humanization

- `POST /api/v1/humanize` - Humanize text
- `GET /api/v1/humanize/stats` - Get usage statistics
- `GET /api/v1/humanize/history` - Get usage history

### System

- `GET /health` - Get system health status
- `GET /debug-cors` - Debug CORS headers
- `GET /api/v1` - API information

## Database Schema

The database schema includes the following tables:

### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);
```

### user_sessions
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### humanize_logs
```sql
CREATE TABLE humanize_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_text TEXT NOT NULL,
  humanized_text TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  ai_score INTEGER,
  human_score INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  process_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature-name`
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
