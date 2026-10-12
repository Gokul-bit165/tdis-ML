# Use an official Node runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install && chown -R node:node /usr/src/app

# Copy the rest of the application code
COPY --chown=node:node . .

# Run as non-root user (node image provides uid 1000)
USER node

# Expose port 8080
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
