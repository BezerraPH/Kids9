FROM node:20-slim

WORKDIR /usr/src/app

# Copiar arquivos de dependências primeiro para cache do Docker
COPY package*.json ./
RUN npm install

# Copiar restante do código da aplicação
COPY . .

EXPOSE 3000

# Executar aplicação
CMD ["npm", "start"]
