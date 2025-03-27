# Backend API for User Registration

This repository contains a Node.js Express API for user registration that connects to a Postgres database.

## Features

- User registration endpoint (username/password)
- Password hashing with bcrypt
- Connection to Railway Postgres database
- Environment variable configuration

## Setup

1. Clone this repository
2. Install dependencies with `npm install`
3. Set up environment variables:
   ```
   POSTGRES_URL=postgresql://<username>:<password>@<host>:<port>/<database>
   PORT=3000
   ```
4. Run the development server with `npm run dev`

## API Endpoints

### POST /api/users/register

Register a new user.

**Request Body:**
```json
{
  "username": "example_user",
  "password": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "username": "example_user",
  "created_at": "2025-03-27T13:00:00.000Z"
}
```

## Deployment on Railway

This repository is configured for easy deployment on Railway:

1. Create a new service in Railway linked to this repository
2. Link to your Postgres database service
3. Railway will automatically deploy the API

## Connection to Frontend

The frontend repository should be configured to send requests to this backend API's registration endpoint.
