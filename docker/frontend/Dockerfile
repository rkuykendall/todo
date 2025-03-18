FROM node:18 AS build

# Set working directory
WORKDIR /app/frontend

# Define API domain argument and pass it as an environment variable
ARG API_DOMAIN
ENV VITE_API_DOMAIN=${API_DOMAIN}

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend with the API_DOMAIN variable injected
RUN VITE_API_DOMAIN=${API_DOMAIN} npm run build

# Use a lightweight Nginx server to serve the built app
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Expose the port
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
