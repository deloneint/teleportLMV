
(function(){
    'use strict';
    

    const _0x4f5a = [
        '8fa26024-9a91-4eed-b529-4585b18b7ac8',
        'https://script.google.com/macros/s/AKfycbzeXgHYdT5IhGFoyUAHrGpe2IdU4bbU7tZ71uS5RXsNo7o5MAbLZ_HKDYG9WnQ3yD-V/exec'
    ];
    

    function _0x6b7c(str) {
        return str.split('').map((c, i) => 
            String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
        ).join('');
    }
    

    function _0x8d9e(str) {
        return str.split('').map((c, i) => 
            String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
        ).join('');
    }
    

    const _0xa1b2 = _0x4f5a.map(_0x6b7c);
    

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
    

    _0x4f5a.length = 0;
    _0xa1b2.length = 0;
    

    window.CONFIG = CONFIG;
})();
