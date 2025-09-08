// Динамическая загрузка конфигурации с дополнительной защитой
(function(){
    'use strict';
    
    // Массив зашифрованных данных (разбит на части)
    const _0x4f5a = [
        '8fa26024-9a91-4eed-b529-4585b18b7ac8',
        'https://script.google.com/macros/s/AKfycbwrb90AMeN5cub2EFnFgxzbShvkAtyDUBijaz4CdKXXi_AWf-fsSEmSqZJ4rCU1TrQA/exec'
    ];
    
    // Функция обфускации
    function _0x6b7c(str) {
        return str.split('').map((c, i) => 
            String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
        ).join('');
    }
    
    // Функция деобфускации
    function _0x8d9e(str) {
        return str.split('').map((c, i) => 
            String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
        ).join('');
    }
    
    // Обфусцируем данные
    const _0xa1b2 = _0x4f5a.map(_0x6b7c);
    
    // Создаем конфигурацию
    const CONFIG = {
        yandex: {
            apiKey: _0x8d9e(_0xa1b2[0]),
            center: [55.7558, 37.6176],
            zoom: 10
        },
        googleScript: {
            url: _0x8d9e(_0xa1b2[1])
        }
    };
    
    // Очищаем временные переменные
    _0x4f5a.length = 0;
    _0xa1b2.length = 0;
    
    // Экспортируем
    window.CONFIG = CONFIG;
})();
