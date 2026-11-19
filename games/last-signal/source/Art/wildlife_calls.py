"""Synthesize the territorial calls used by the three guardians, mono PCM at the mixer rate."""
import array
import math
from pathlib import Path
import random
import sys
import wave


def create(directory):
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    rate=22050
    for index,(name,frequency,length) in enumerate((('boar',82,.78),('cougar',167,.86),('wolf',113,1.03))):
        rng=random.Random(679+index);phase=0;noise=0;previous=.0;samples=array.array('h')
        for frame in range(int(length*rate)):
            t=frame/rate;p=t/length
            envelope=min(1,t/.028,(length-t)/.09)
            if name=='boar':
                envelope*=.25+.75*max(0,math.sin(2*math.pi*(t*3.1-.04)))
                pitch=frequency*(1-.13*p+.095*math.sin(t*31))
            elif name=='cougar':
                envelope*=.65+.35*math.sin(p*math.pi)
                pitch=frequency*(1+.48*math.sin(p*math.pi)-.28*p)
            else:
                envelope*=.35+.65*math.sin(p*math.pi)
                pitch=frequency*(1+.20*p+.06*math.sin(t*22))
            phase+=2*math.pi*pitch/rate
            noise=noise*.91+(rng.random()*2-1)*.09
            rasp=(math.sin(phase)+.64*math.sin(phase*2)+.41*math.sin(phase*3.02)+.20*math.sin(phase*5.01))
            rasp*=.76+.24*math.sin(phase*(.47 if name=='cougar' else .35))
            tone=rasp*.59+noise*(2.4 if name=='boar' else 1.7)
            previous=.27*previous+.73*tone
            samples.append(int(max(-1,min(1,math.tanh(previous)*envelope)) * 27700))
        with wave.open(str(directory/(name+'.wav')),'wb') as wav:
            wav.setparams((1,2,rate,0,'NONE','not compressed'));wav.writeframes(samples.tobytes())


if __name__=='__main__':
    create(sys.argv[1])
