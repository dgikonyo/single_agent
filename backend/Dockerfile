FROM node:22-alpine
WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install

# Copy the rest of the source
COPY . .

# In dev, we override this with 'npm run start:dev' in compose
CMD ["npm", "run", "start:dev"]