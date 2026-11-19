"""Render hollow plank footfalls and falling wooden fort pieces at the game's mix rate."""
import math
from pathlib import Path
import random
import sys
from armor_and_truce_audio import RATE, TAU, write


def plank(samples, start, strength, pitch, ringing, rng):
    offset = round(start * RATE)
    size = min(len(samples) - offset, round(5.5 * ringing * RATE))
    low_noise = 0
    for frame in range(size):
        t = frame / RATE
        ring = math.exp(-t / ringing)
        grain = rng.uniform(-1, 1)
        low_noise += .27 * (grain - low_noise)
        body = math.sin(TAU * (pitch * t + .32 * (1-math.exp(-55*t))))
        body += .47 * math.sin(TAU * pitch * 2.78 * t) * math.exp(-21*t)
        edge = .61 * grain * math.exp(-165*t) + .36 * low_noise * math.exp(-38*t)
        samples[offset+frame] += strength * min(1,frame/16) * (ring*body+edge)


def crack(samples, start, length, strength, rng):
    offset = round(start * RATE)
    noise = 0
    for frame in range(min(round(length*RATE),len(samples)-offset)):
        p = frame/(length*RATE)
        grain = rng.uniform(-1,1)
        noise += .35 * (grain-noise)
        fibers = .28 + .72 * math.sin(p*54+p*p*282)**6
        samples[offset+frame] += strength * math.sin(math.pi*p) * fibers * (grain - noise)


def create(folder):
    folder = Path(folder)
    folder.mkdir(parents=True,exist_ok=True)
    rng = random.Random(294871)
    step = [0.] * round(.31*RATE)
    plank(step,0,.64,128,.035,rng)
    plank(step,.038,.24,176,.042,rng)
    write(folder,"plank_step",step)
    for large, name in [(False,"timber_break"),(True,"timber_fall")]:
        audio = [0.] * round((1.22 if large else .64)*RATE)
        crack(audio,0,.14,.9,rng)
        for onset, strength in [(.035,.33),(.11,.46),(.29,.94),(.34,.49)]:
            plank(audio,onset,strength,rng.uniform(79,192),rng.uniform(.034,.068),rng)
        if large:
            crack(audio,.16,.34,.84,rng)
            for onset,strength in [(.41,.45),(.52,1.13),(.57,.68),(.65,.42),(.76,.33),(.91,.23)]:
                plank(audio,onset,strength,rng.uniform(56,163),rng.uniform(.045,.075),rng)
        write(folder,name,audio)


if __name__=="__main__":
    create(sys.argv[1])
