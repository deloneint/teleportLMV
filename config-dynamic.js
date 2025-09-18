
(function(){
    'use strict';
    

    const _0x4f5a = [
        'c9eabc14-1177-487d-b843-8d6efec4c648',
        'https://script.google.com/macros/s/AKfycbzxYa_xbvfCggNlk9jjav_SdnrPuVL8ZO03TtnlNinjbBS_-JsWy0QFJ6FTG6w6wASH/exec'
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
