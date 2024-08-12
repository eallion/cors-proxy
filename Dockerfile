# Use the official Bun image as the base image
FROM oven/bun:latest

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and bun.lockb files to the working directory
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 12712

# Command to run the application
CMD ["bun", "start"]
