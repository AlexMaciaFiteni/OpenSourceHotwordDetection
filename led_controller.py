import time

from pixel_ring import pixel_ring
import mraa
import os

en = mraa.Gpio(12)
if os.geteuid() != 0 :
    time.sleep(1)
 
en.dir(mraa.DIR_OUT)
en.write(0)

pixel_ring.set_brightness(20)

if __name__ == '__main__':
  pixel_ring.wakeup()
  print('Potatoooo')
  time.sleep(4)
  pixel_ring.off()
  time.sleep(1)
en.write(1)
