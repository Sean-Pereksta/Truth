"""Create 22.05 kHz mono PCM cues for armor contact and local truce gestures."""
import array
import math
from pathlib import Path
import random
import sys
import wave


RATE = 22050
TAU = 2 * math.pi


def whistle(notes, duration, seed):
    rng = random.Random(seed)
    phase = 0.0
    breath = 0.0
    samples = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        value = 0.0
        breath = .76 * breath + .24 * rng.uniform(-1, 1)
        for start, length, low, high in notes:
            u = (t - start) / length
            if 0 <= u < 1:
                pitch = low + (high - low) * (u * u * (3 - 2 * u))
                phase += TAU * (pitch + 4 * math.sin(t * 33)) / RATE
                envelope = math.sin(math.pi * u) ** .82
                value = envelope * (.70 * math.sin(phase) + .09 * math.sin(2 * phase + .2) + .14 * breath)
        samples.append(value)
    return samples


def armor_contact(plated):
    rng = random.Random(731 if plated else 906)
    duration = .31 if plated else .22
    samples = []
    low = 0.0
    for i in range(int(duration * RATE)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low += .11 * (noise - low)
        thump = .50 * math.sin(TAU * (79 * t + 1.4 * (1 - math.exp(-42 * t)))) * math.exp(-33 * t)
        if plated:
            tap = .25 * math.sin(TAU * 486 * t) + .17 * math.sin(TAU * 941 * t) + .12 * math.sin(TAU * 1465 * t)
            u = max(0, t - .026)
            rattle = .21 * math.sin(TAU * 603 * u) * math.exp(-45 * u)
            hit = thump + tap * math.exp(-24 * t) + rattle + .32 * (noise-low) * math.exp(-130 * t)
        else:
            weave = .40 * math.exp(-38 * t) + .14 * math.exp(-65 * abs(t - .042))
            hit = thump + weave * (2.1 * low + .31 * noise)
        samples.append(hit * min(1, i / 24) * min(1, (duration - t) * 100))
    return samples


def write(directory, name, samples):
    gain = 25100 / max(abs(s) for s in samples)
    pcm = array.array("h", (round(sample * gain) for sample in samples))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(directory / (name + ".wav")), "wb") as file:
        file.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        file.writeframes(pcm.tobytes())


def create(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    write(directory, "truce_offer", whistle([(0, .17, 780, 1065), (.22, .22, 1065, 925)], .46, 11))
    write(directory, "truce_accept", whistle([(0, .13, 875, 780), (.17, .24, 780, 685)], .43, 23))
    write(directory, "woven_hit", armor_contact(False))
    write(directory, "plated_hit", armor_contact(True))


if __name__ == "__main__":
    create(sys.argv[1])
