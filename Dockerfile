FROM node:18-slim

# Install PostgreSQL client
RUN apt-get update \
    && apt-get install -y postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Set environment variables
ENV NODE_ENV production

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "run", "start:all"]