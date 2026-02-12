# 🚀 Инструкции по деплою

## Railway (Рекомендуется)

### Backend + Database

1. Создайте аккаунт на [Railway.app](https://railway.app)

2. Создайте новый проект и добавьте PostgreSQL:
   - Нажмите "New Project"
   - Выберите "Provision PostgreSQL"
   - Скопируйте DATABASE_URL из переменных окружения

3. Разверните Backend:
   - Нажмите "New Service" → "GitHub Repo"
   - Выберите репозиторий с вашим проектом
   - Root directory: `/backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

4. Добавьте переменные окружения:
```env
DATABASE_URL=<скопируйте из PostgreSQL сервиса>
JWT_SECRET=<сгенерируйте случайную строку>
PORT=3000
CLIENT_URL=<URL вашего frontend после деплоя>
```

5. Разверните и получите URL backend

### Frontend (Vercel/Netlify)

#### Vercel

1. Создайте аккаунт на [Vercel](https://vercel.com)

2. Импортируйте проект:
   - Нажмите "Import Project"
   - Выберите репозиторий
   - Root directory: `/frontend`
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

3. Добавьте переменную окружения:
```env
VITE_API_URL=<URL вашего backend из Railway>
```

4. Deploy!

#### Netlify

1. Создайте аккаунт на [Netlify](https://netlify.com)

2. Импортируйте проект:
   - "New site from Git"
   - Выберите репозиторий
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

3. Добавьте переменную окружения:
```env
VITE_API_URL=<URL вашего backend из Railway>
```

4. Deploy!

## Render

### Backend

1. Создайте аккаунт на [Render](https://render.com)

2. Создайте PostgreSQL базу:
   - Dashboard → New → PostgreSQL
   - Выберите бесплатный план
   - Скопируйте Internal Database URL

3. Создайте Web Service:
   - New → Web Service
   - Connect репозиторий
   - Root directory: `backend`
   - Environment: Node
   - Build command: `npm install`
   - Start command: `npm start`

4. Добавьте переменные окружения:
```env
DATABASE_URL=<Internal Database URL>
JWT_SECRET=<случайная строка>
CLIENT_URL=<URL frontend>
```

### Frontend

1. Создайте Static Site:
   - New → Static Site
   - Connect репозиторий
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

2. Добавьте переменную окружения:
```env
VITE_API_URL=<URL backend>
```

## Heroku (Устарело, но все еще работает)

### Backend

1. Установите Heroku CLI

2. Создайте приложение:
```bash
heroku create your-app-name
```

3. Добавьте PostgreSQL:
```bash
heroku addons:create heroku-postgresql:mini
```

4. Установите переменные:
```bash
heroku config:set JWT_SECRET=your-secret
heroku config:set CLIENT_URL=your-frontend-url
```

5. Deploy:
```bash
git subtree push --prefix backend heroku main
```

## VPS (Ubuntu)

### 1. Подключитесь к серверу:
```bash
ssh user@your-server-ip
```

### 2. Установите Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Установите PostgreSQL:
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql
CREATE DATABASE telegram_clone;
CREATE USER telegram_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE telegram_clone TO telegram_user;
\q
```

### 4. Установите Nginx:
```bash
sudo apt install nginx
```

### 5. Клонируйте проект:
```bash
git clone your-repo-url
cd your-repo
```

### 6. Настройте Backend:
```bash
cd backend
npm install
```

Создайте `.env`:
```env
DATABASE_URL=postgresql://telegram_user:your-password@localhost:5432/telegram_clone
JWT_SECRET=your-secret
PORT=3000
CLIENT_URL=https://yourdomain.com
```

### 7. Настройте PM2:
```bash
sudo npm install -g pm2
pm2 start server.js --name telegram-backend
pm2 startup
pm2 save
```

### 8. Настройте Frontend:
```bash
cd ../frontend
npm install
```

Создайте `.env`:
```env
VITE_API_URL=https://api.yourdomain.com
```

```bash
npm run build
```

### 9. Настройте Nginx:
```bash
sudo nano /etc/nginx/sites-available/telegram-clone
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    
    root /path/to/your-repo/frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/telegram-clone /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 10. Установите SSL (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

## Docker

### Backend Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: telegram_clone
      POSTGRES_USER: telegram_user
      POSTGRES_PASSWORD: your-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://telegram_user:your-password@postgres:5432/telegram_clone
      JWT_SECRET: your-secret
      CLIENT_URL: http://localhost
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

Запуск:
```bash
docker-compose up -d
```

## Проверка после деплоя

1. Откройте frontend URL
2. Зарегистрируйте аккаунт
3. Проверьте WebSocket подключение (статус "в сети")
4. Отправьте сообщение
5. Загрузите изображение/файл
6. Запишите голосовое сообщение

## Troubleshooting

### WebSocket не работает
- Убедитесь, что поддерживаются WebSocket на вашем хостинге
- Проверьте CORS настройки
- Проверьте правильность CLIENT_URL в backend

### Файлы не загружаются
- Проверьте права на папку `uploads/`
- Увеличьте лимит размера файла в Nginx/hosting
- Проверьте multer конфигурацию

### База данных не подключается
- Проверьте DATABASE_URL
- Убедитесь, что PostgreSQL запущен
- Проверьте firewall правила

---

**Удачного деплоя! 🚀**
