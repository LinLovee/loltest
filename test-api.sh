#!/bin/bash

echo "🧪 Тестирование Telegram Clone API"
echo "===================================="
echo ""

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"

# Функция для проверки
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

# 1. Проверка здоровья сервера
echo "1️⃣ Проверка сервера..."
curl -s "$API_URL/api/health" > /dev/null
check "Сервер запущен"
echo ""

# 2. Проверка статических файлов
echo "2️⃣ Проверка доступа к папке uploads..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/uploads/")
if [ "$STATUS" = "403" ] || [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Папка uploads доступна (код: $STATUS)${NC}"
else
    echo -e "${RED}❌ Папка uploads недоступна (код: $STATUS)${NC}"
fi
echo ""

# 3. Регистрация тестового пользователя
echo "3️⃣ Регистрация тестового пользователя..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser_$(date +%s)\",
    \"displayName\": \"Test User\",
    \"password\": \"password123\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Пользователь создан (ID: $USER_ID)${NC}"
else
    echo -e "${YELLOW}⚠️  Пользователь возможно уже существует${NC}"
fi
echo ""

# 4. Проверка загрузки файла (если есть токен)
if [ ! -z "$TOKEN" ]; then
    echo "4️⃣ Тестирование загрузки файла..."
    
    # Создаём тестовый файл
    echo "Test file content" > /tmp/test.txt
    
    # Создаём второго пользователя для получателя
    REGISTER2=$(curl -s -X POST "$API_URL/api/auth/register" \
      -H "Content-Type: application/json" \
      -d "{
        \"username\": \"receiver_$(date +%s)\",
        \"displayName\": \"Receiver\",
        \"password\": \"password123\"
      }")
    
    RECEIVER_ID=$(echo "$REGISTER2" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    
    if [ ! -z "$RECEIVER_ID" ]; then
        UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/messages/upload" \
          -H "Authorization: Bearer $TOKEN" \
          -F "file=@/tmp/test.txt" \
          -F "receiverId=$RECEIVER_ID" \
          -F "messageType=file")
        
        if echo "$UPLOAD_RESPONSE" | grep -q "file_url"; then
            FILE_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"file_url":"[^"]*' | cut -d'"' -f4)
            echo -e "${GREEN}✅ Файл загружен: $FILE_URL${NC}"
            
            # Проверяем доступность файла
            FULL_URL="$API_URL$FILE_URL"
            FILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FULL_URL")
            if [ "$FILE_STATUS" = "200" ]; then
                echo -e "${GREEN}✅ Файл доступен для скачивания${NC}"
            else
                echo -e "${RED}❌ Файл недоступен (код: $FILE_STATUS)${NC}"
                echo -e "${YELLOW}   URL: $FULL_URL${NC}"
            fi
        else
            echo -e "${RED}❌ Ошибка загрузки файла${NC}"
            echo "$UPLOAD_RESPONSE"
        fi
    else
        echo -e "${YELLOW}⚠️  Не удалось создать получателя${NC}"
    fi
    
    # Удаляем тестовый файл
    rm /tmp/test.txt
else
    echo -e "${YELLOW}⚠️  Пропускаем тест загрузки (нет токена)${NC}"
fi
echo ""

# 5. Итоги
echo "===================================="
echo "📊 Тестирование завершено"
echo ""
echo "Проверьте логи сервера для деталей."
echo "Если есть ошибки, смотрите ИНСТРУКЦИЯ.md"
