FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite requires --host to be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]