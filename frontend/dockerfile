# /frontend/Dockerfile

### STAGE 1: Build ###
# Use a Node image to build the app
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /

# Copy package files and install dependencies
# This leverages Docker's cache. 'npm install' only runs when these files change.
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Start the appliccation - when finished can replace with build
RUN npm start


### STAGE 2: Serve ###
# Use a lightweight Nginx image to serve the static files
FROM nginx:stable-alpine

# Copy the built files from the 'builder' stage
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx listens on port 80 by default
EXPOSE 80

# When the container starts, run Nginx
CMD ["nginx", "-g", "daemon off;"]