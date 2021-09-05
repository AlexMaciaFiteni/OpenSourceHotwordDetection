# Open Source Hotword Detection
Este repositorio contiene el código que se ejecuta en el dispositivo IoT SAM Device. Su principal funcionalidad es detectar en local una palabra de activación personalizada, y una vez detectada grabar una orden hasta que detecte silencio, para enviar dicha orden a un servicio de voz externo y reproducir su respuesta por los altavoces. Además, cambia los patrones de LEDs del dispositivo para indicar qué está haciendo en cada momento (hablando, esperando, etc…).

Se ha utilizado Snowboy en su versión para NodeJS, así como node-vad para la detección de silencio y pixel_ring para controlar los patrones de LEDs.
