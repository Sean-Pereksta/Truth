"""Synthesize the arena's original mono sound bank. Output is standard PCM WAVE."""
import math
from pathlib import Path
import wave
import numpy as np

bank = Path(__file__).resolve().parents[2] / "Assets" / "Audio"
bank.mkdir(exist_ok=True)
rate = 22050
rng = np.random.default_rng(2406)

def render(name, length, voice):
    t = np.arange(int(length * rate)) / rate
    noise = rng.normal(0, 1, t.size)
    smooth = np.convolve(noise, np.ones(26) / 26, mode="same")
    wavelet = voice(t, noise, smooth)
    env = np.minimum(1, t * 210) * np.minimum(1, (length - t) * 95)
    audio = wavelet * env
    audio = np.int16(28000 * audio / max(.5, np.max(np.abs(audio))))
    with wave.open(str(bank / (name + ".wav")), "wb") as f:
        f.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        f.writeframes(audio.tobytes())

sin, pi, exp = np.sin, np.pi, np.exp
def note(t,f):return sin(2*pi*t*f)
def brass(t,base):
    center=2*pi*base*(t-.010*(1-exp(-t*15)))+.02*sin(t*21)
    return sum(sin(k*center)*(.54**(k-1)) for k in range(1,7))
render("horn",2.5,lambda t,n,s:(brass(t,130.8)+.66*brass(t,196.1))*(1-exp(-t*7))*exp(-1.17*t))
render("start",.72,lambda t,n,s:(note(t,261.6)+.45*note(t,392.0))*exp(-6*t))
render("warning",1.7,lambda t,n,s:(brass(t,164.8)+.65*brass(t,207.65))*(.62+.38*np.cos(t*8))*exp(-2.0*t))
render("victory",2.5,lambda t,n,s:sum((t>i*.3)*brass(np.maximum(0,t-i*.3),f)*exp(-2.7*np.maximum(0,t-i*.3)) for i,f in enumerate((220,277.2,329.6,440))))
render("cannon",1.6,lambda t,n,s:(sin(2*pi*(57*t+4*(1-exp(-t*10))))+.9*s)*exp(-4.8*t))
render("hit",.30,lambda t,n,s:(.52*n+.7*note(t,91)+.35*note(t,160))*exp(-24*t))
render("wood",.46,lambda t,n,s:(.3*n+note(t,178)+.6*note(t,415)+.2*note(t,880))*exp(-22*t))
render("guard",.62,lambda t,n,s:(.25*n+note(t,794)+.55*note(t,1282)+.41*note(t,1981))*exp(-14*t))
render("swing",.27,lambda t,n,s:s*np.sin(pi*t/.27)**2)
render("release",.32,lambda t,n,s:(s+note(t,410-390*t))*exp(-23*t))
render("step",.23,lambda t,n,s:(s+.24*note(t,72)+.11*n)*exp(-23*t))
render("splash",.45,lambda t,n,s:(s+.23*n+.14*note(t,210+580*t))*exp(-10*t))
render("rustle",.42,lambda t,n,s:(.24*n+s)*exp(-8*t)*(.7+.3*note(t,16)))
def forest(t,n,s):
    breeze=np.convolve(s,np.ones(67)/67,mode="same")*2*(.55+.28*note(t,.11)+.13*note(t,.39))
    for start,f in [(1.1,1830),(4.2,2400),(4.5,2700),(8.1,1600),(11,2370),(11.3,2190),(16.2,2120),(19,1850)]:
        u=t-start
        breeze+=((u>=0)&(u<.23))*.051*sin(2*pi*(f*u+410*u*u))*np.sin(pi*np.clip(u/.23,0,1))**2
    return breeze
render("forest",23,forest)
def current(t,n,s):
    ripples=np.convolve(n,np.ones(8)/8,mode="same")-s
    foam=.14*ripples*(1+.13*note(t,.49)+.09*note(t,.71))+.12*s
    for start in np.arange(.18,t[-1]-.2,.38):
        u=np.maximum(0,t-start); f=rng.uniform(390,780)
        foam+=(t>start)*.046*exp(-31*u)*sin(2*pi*(f*u-430*u*u))
    return foam
render("stream",8,current)
render("rain",8,lambda t,n,s:(.17*n+.19*s)*(.92+.08*note(t,.25)))
def crackles(t,n,s):
    v=.105*s
    for start in rng.uniform(0,t[-1],38):
        u=np.maximum(0,t-start);v+=(t>start)*n*rng.uniform(.07,.21)*exp(-u*rng.uniform(38,110))
    return v
render("camp",8,crackles)
render("hen",.54,lambda t,n,s:(.09*n+.31*note(t,1190+310*note(t,3.5)))*np.maximum(0,note(t,7))**2*exp(-3.7*t))
render("grazer",.48,lambda t,n,s:(.62*s+.20*brass(t,122-45*t))*(1-exp(-t*38))*exp(-8*t))
render("cast",.30,lambda t,n,s:(s+.17*note(t,310-370*t))*np.sin(pi*t/.30)**2)

# Short layered transients distinguish equipment, weapon travel, contact and deflection.
def pulse(t, start, attack, decay):
    u=np.maximum(0,t-start)
    return (t>=start)*(1-np.exp(-u/attack))*np.exp(-u/decay)

def tuned(t, start, tones, decay):
    u=np.maximum(0,t-start)
    return pulse(t,start,.0008,decay)*sum(amp*note(u,freq) for freq,amp in tones)

def knock(t, start, low, bend, decay):
    u=np.maximum(0,t-start)
    phase=2*pi*(low*u+bend*.022*(1-exp(-u/.022)))
    return np.sin(phase)*pulse(t,start,.0008,decay)

def textile(n):
    return np.convolve(n,np.ones(5)/5,mode="same")-np.convolve(n,np.ones(25)/25,mode="same")

def flesh(t,n,s,heavy=False):
    tap=knock(t,.001,70 if heavy else 113,108 if heavy else 120,.069 if heavy else .030)
    snap=textile(n)*pulse(t,.003,.0018,.018)
    foley=.28*tuned(t,.003,[(315,.87),(509,.35)],.015)
    if heavy:
        return .91*tap+.50*snap+foley+.49*knock(t,.026,86,66,.047)+.45*s*pulse(t,.029,.003,.046)
    return .72*tap+.80*snap+foley+.22*s*pulse(t,.013,.002,.025)

def point_hit(t,n,s,heavy=False):
    shaft=tuned(t,.002,[(379,1),(731,.42),(1195,.23)],.024 if heavy else .019)
    reb=tuned(t,.034,[(272,.45),(563,.27)],.023)
    return .54*shaft+.22*reb+.71*flesh(t,n,s,heavy)+.34*textile(n)*pulse(t,.012,.002,.021)

def thrust_air(t,n,s):
    sweep=np.sin(pi*np.clip(t/.17,0,1))**2.7
    high=textile(n)*(.12+.80*np.minimum(1,t/.13))
    return (s*1.25+high)*sweep+.14*tuned(t,.119,[(257,.8),(518,.25)],.019)

def parry_ring(t,n,s):
    impact=.42*textile(n)*pulse(t,.001,.0006,.013)
    bright=tuned(t,0,[(809,.95),(1394,.68),(2012,.37),(2957,.16)],.090)
    short=tuned(t,.016,[(669,.45),(1103,.49),(1701,.19)],.039)
    return impact+bright+short

def retrieve(t,n,s):
    leather=(.55*textile(n)+.7*s)*pulse(t,.002,.012,.046)
    buckle=tuned(t,.063,[(532,.90),(1081,.48),(1645,.33)],.025)
    lock=tuned(t,.120,[(740,.52),(1361,.30),(2039,.19)],.030)
    return leather+.65*buckle+.66*lock+.21*knock(t,.092,134,48,.022)

render("equip",.26,retrieve)
render("thrust",.22,thrust_air)
render("thrust_hit",.23,lambda t,n,s:point_hit(t,n,s,False))
render("thrust_heavy",.32,lambda t,n,s:point_hit(t,n,s,True))
render("hit_light",.18,lambda t,n,s:flesh(t,n,s,False))
render("hit_heavy",.32,lambda t,n,s:flesh(t,n,s,True))
render("parry",.48,parry_ring)

def storm_front(t,n,s):
    gust=np.convolve(s,np.ones(93)/93,mode="same")
    weather=(gust*2.6+.12*s)*(.68+.24*note(t,.23)+.08*note(t,.61))
    roll=np.zeros_like(t)
    for at in (2.1,2.53,3.4,9.1):
        u=np.maximum(0,t-at)
        roll+=pulse(t,at,.21,1.12)*(.23*np.sin(2*pi*(34*u+3*(1-exp(-u))))+.12*note(u,52))
    return weather+roll

render("storm",13,storm_front)
