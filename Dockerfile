# Use the official Node.js 16.x image as the base image
FROM node:16

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Set the command to run the application with nodemon
CMD ["npx", "nodemon", "--inspect=0.0.0.0:9229", "index.js"]

# Expose port 4000
EXPOSE 4000
