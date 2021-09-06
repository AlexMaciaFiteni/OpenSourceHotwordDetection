import time
import sys

from pixel_ring import pixel_ring
import mraa
import os

en = mraa.Gpio(12)
if os.geteuid() != 0 :
    time.sleep(1)
 
en.dir(mraa.DIR_OUT)
en.write(0)

pixel_ring.set_brightness(20)

print('[INFO]: LEDs ready, begin reading')
while True:
    data = raw_input("")
    if data == 'wakeup':
        pixel_ring.wakeup()
    elif data == 'listen':
        pixel_ring.listen()
    elif data == 'think':
        pixel_ring.think()
    elif data == 'speak':
        pixel_ring.speak()
    elif data == 'off':
        pixel_ring.off()
    elif data == 'stop':
        break
        
print('[INFO]: LED controller turned off')
pixel_ring.off()
time.sleep(1)
en.write(1)
