# mobile-app/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose ports
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001

# Start the app
CMD ["npm", "start"]
