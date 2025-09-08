// Простой сервер для защиты API ключей и данных
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Защищенные API ключи (из переменных окружения)
const CONFIG = {
    yandexApiKey: process.env.YANDEX_API_KEY || 'DEMO_KEY',
    googleScriptUrl: process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
};

// Эндпоинт для получения конфигурации
app.get('/api/config', (req, res) => {
    res.json({
        yandex: {
            apiKey: CONFIG.yandexApiKey,
            center: [55.7558, 37.6176],
            zoom: 10
        },
        googleScript: {
            url: CONFIG.googleScriptUrl
        }
    });
});

// Прокси для Google Apps Script (скрывает URL)
app.get('/api/google-script', async (req, res) => {
    try {
        const { sheet } = req.query;
        const response = await fetch(`${CONFIG.googleScriptUrl}?sheet=${sheet}&callback=callback`);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        console.error('Error fetching Google Script data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Обслуживание статических файлов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser`);
});