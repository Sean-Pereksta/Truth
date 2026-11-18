'use strict';

// Original 16-bar race themes in track order. Each cell lasts one eighth note.
// A dot is a rest, a dash holds a note, and a slash splits a cell into two sixteenths.
window.AcornCourseScores={
  0:{
    title:"Cedar Canopy",bpm:166,beats:4,lead:"mandolin",answer:"brass",backing:"dulcimer",groove:"folk",
    bars:[
      ["G2 G3 B3 D4","D5/G5 A5 . G5/A5 B5 D6/B5 A5 G5"],
      ["D2 F#3 A3 D4","F#5 . A5 F#5/E5 D5 A4 B4/C#5 D5"],
      ["E2 G3 B3 E4","D5/G5 A5 B5 . E6 D6/B5 G5 A5/B5"],
      ["C3 G3 C4 E4","C6 A5/G5 E5 G5 . E5 D5/E5 C5"],
      ["G2 G3 B3 D4","D5/G5 A5 . G5/A5 B5 D6/B5 A5 G5"],
      ["B2 G3 B3 D4","G5 . B5 D6/B5 G5 B5 D6 E6/D6"],
      ["A2 G3 C4 E4","C6 B5/A5 G5 E5/G5 A5 . C6 A5"],
      ["D2 F#3 C4 D4","F#5/A5 C6 A5 F#5/E5 D5 . A4 B4/D5"],
      ["E2 G3 B3 E4","B4 E5 . G5/B5 E6 . B5 G5/E5"],
      ["C3 G3 C4 E4","C5 E5 G5 . C6 B5/A5 G5 E5"],
      ["A2 A3 C4 E4","A4 C5 . E5/A5 C6 . A5 G5/E5"],
      ["D2 F#3 A3 C4","F#5 A5 C6 . D6 C6/B5 A5 F#5/A5"],
      ["G2 G3 B3 D4","D5/G5 A5 . G5/A5 B5 D6 E6/D6 B5"],
      ["C3 G3 C4 E4","C6 G5/E5 G5 A5/G5 E5 C5 . E5/G5"],
      ["D2 F#3 A3 C4","F#5/A5 D6 C6 A5/G5 F#5 . A5 A5/F#5"],
      ["G2 G3 B3 D4","G5 - D5/B4 G4 B4 D5 . B4/C5"]
    ]
  },
  1:{
    title:"Bells in the Bamboo",bpm:176,beats:4,lead:"bell",answer:"synth",backing:"marimba",groove:"pan",
    bars:[
      ["E2 E3 G3 B3","B4/B4 . D5 E5/G5 . G5 E5 B4/D5"],
      ["D2 G3 A3 D4","D5 . A4/B4 D5 . A5 G5/E5 D5"],
      ["G2 G3 B3 D4","B4/D5 . G5 A5/B5 . D6 B5/G5 A5"],
      ["A2 E3 G3 B3","E5/G5 E5 . B4 D5/E5 . G5/E5 A4"],
      ["E2 E3 G3 B3","B4/B4 . D5 E5/G5 . G5 E5 B4/D5"],
      ["G2 G3 B3 D4","G5 . A5/B5 D6 . B5/D6 G6 E6/D6"],
      ["D2 G3 A3 D4","A5 G5/E5 D5 . A4/D5 G5 . A5"],
      ["E2 E3 G3 B3","B5/G5 E5 G5/E5 D5 . B4 E5 ./B4"],
      ["A2 E3 G3 B3","A4 . B4/E5 G5 . E5/B4 D5 E5"],
      ["E2 E3 G3 B3","G4/B4 D5 . E5 G5 . D5/E5 B4"],
      ["D2 G3 A3 D4","A4/D5 E5 G5 . A5/G5 E5 . D5/A4"],
      ["G2 G3 B3 D4","G5 . A5/B5 D6 B5 . A5/G5 E5/D5"],
      ["E2 E3 G3 B3","B4/B4 . D5 E5/G5 . G5 E5 B4/D5"],
      ["D2 G3 A3 D4","D5/E5 G5 . A5/D6 . D6 A5/G5 E5"],
      ["A2 E3 G3 B3","B5/A5 G5 . E5/G5 A5 . E5/D5 B4"],
      ["E2 E3 G3 B3","E5/G5 B5 E6 . B5/G5 E5 . ./E5"]
    ]
  },
  2:{
    title:"The Sluice Waltz",bpm:166,beats:3,lead:"reed",answer:"brass",backing:"dulcimer",groove:"waltz",
    bars:[
      ["F2 F3 A3 C4","A4/C5 F5 . F5/G5 E5 D5/C5"],
      ["C3 G3 Bb3 E4","G4/Bb4 E5 D5 E5/G5 F5 E5/C5"],
      ["Bb2 F3 Bb3 D4","F4/Bb4 D5 . F5/D5 C5 D5/F5"],
      ["C3 G3 Bb3 E4","E5/G5 Bb5 G5 E5/D5 C5 G4"],
      ["F2 F3 A3 C4","A4/C5 F5 . F5/G5 E5 D5/C5"],
      ["A2 F3 A3 C4","A4/C5 F5 A5 G5/F5 C6 A5"],
      ["G2 G3 Bb3 D4","Bb5/A5 G5 . D5/G5 A5 G5/D5"],
      ["C3 G3 Bb3 E4","Bb4/E5 G5 E5 D5/C5 Bb4 A4/G4"],
      ["D3 A3 D4 F4","D5 . F5/A5 D6 C6 A5/F5"],
      ["Bb2 F3 Bb3 D4","Bb4 . D5/F5 Bb5 A5 F5/D5"],
      ["G2 G3 Bb3 D4","G4/Bb4 D5 . F5/G5 Bb5 A5/G5"],
      ["C3 G3 Bb3 E4","E5/G5 Bb5 A5 G5/E5 D5 Bb4/G4"],
      ["F2 F3 A3 C4","A4/C5 F5 . F5/G5 A5 G5/F5"],
      ["Bb2 F3 Bb3 D4","F5/D5 Bb4 D5/F5 Bb5 F5 D5/Bb4"],
      ["C3 G3 Bb3 E4","G4/C5 E5 G5 Bb5/A5 G5 E5/C5"],
      ["F2 F3 A3 C4","F5 - C5/A4 F4 A4/C5 ./G4"]
    ]
  },
  3:{
    title:"The Red Ridge Run",bpm:186,beats:4,lead:"electric",answer:"fiddle",backing:"guitar",groove:"gallop",
    bars:[
      ["D2 A3 D4 F4","D5 . A4/C5 D5 D5/F5 E5 . C5/D5"],
      ["G2 G3 B3 D4","G5 E5/D5 . B4 D5/B4 A4 G4 B4/D5"],
      ["C3 G3 C4 E4","E5/G5 . E5 D5/C5 E5 G5 A5 G5/E5"],
      ["A2 A3 C4 E4","A5 A5/E5 D5 . C5/E5 A4 C5 ./E5"],
      ["D2 A3 D4 F4","D5 . A4/C5 D5 D5/F5 E5 F5/A5 C6"],
      ["G2 G3 B3 D4","G5/B5 A5 G5/E5 D5 . B4/D5 G5 A5/B5"],
      ["C3 G3 C4 E4","C6 B5/G5 E5 . E5/G5 A5 G5 E5/D5"],
      ["D2 A3 D4 F4","F5/E5 D5 . A4/C5 D5 F5 E5/D5 ./A4"],
      ["F2 A3 C4 F4","A4/C5 F5 . A5 G5/A5 C6 . A5"],
      ["G2 G3 B3 D4","B5 . A5/G5 D5 B4/D5 G5 E5/D5 B4"],
      ["A2 A3 C4 E4","E5/A5 C6 . B5/A5 E5 A5 C6 B5/A5"],
      ["G2 G3 B3 D4","B5/A5 G5 D5 . E5/D5 B4 G4 ./C5"],
      ["D2 A3 D4 F4","D5 . A4/C5 D5 D5/F5 E5 . C5/D5"],
      ["G2 G3 B3 D4","G5 E5/D5 B4 A4 . B4/D5 G5 B5/A5"],
      ["C3 G3 C4 E4","G5/E5 C5 E5/G5 A5 C6 B5/A5 G5 E5/C5"],
      ["D2 A3 D4 F4","D5/F5 A5 G5/F5 E5 D5 . A4/C5 ./C5"]
    ]
  },
  4:{
    title:"Skylight on the Salt",bpm:174,beats:4,lead:"synth",answer:"bell",backing:"marimba",groove:"glide",
    bars:[
      ["E2 G#3 B3 F#4","E5 - B4/E5 A#4 B4 D#5 E5/F#5 G#5"],
      ["F#2 A#3 C#4 E4","C#5 A#4 F#4/A#4 C#5 E5 . C#5 A#4/B4"],
      ["G#2 B3 D#4 F#4","B4 D#5 F#5 - G#5 F#5/D#5 E5 F#5"],
      ["B2 B3 D#4 F#4","D#5 B4 C#5/F#5 D#5 . F#4/B4 C#5 D#5"],
      ["E2 G#3 B3 F#4","E5 - B4/E5 A#4 B4 D#5 E5/F#5 B5"],
      ["F#2 A#3 C#4 E4","C#6 A#5 F#5/E5 C#5 . E5 F#5 A#5"],
      ["G#2 B3 D#4 F#4","B5 G#5 F#5/D#5 B4 D#5 F#5 B5 G#5"],
      ["E2 G#3 B3 F#4","F#5 E5 B4/C#5 B4 E5 - . ./G#4"],
      ["C#3 G#3 B3 E4","E4 G#4 B4 C#5/E5 G#5 E5 C#5 B4"],
      ["F#2 A#3 C#4 E4","A#4 C#5 E5 F#5/A#5 C#6 A#5 F#5 E5"],
      ["E2 G#3 B3 F#4","G#5 . F#5/E5 D#5 B4 C#5 D#5/E5 G#5"],
      ["D#2 B3 D#4 F#4","F#5 D#5 C#5/B4 F#4 B4 C#5 D#5 ./F#5"],
      ["E2 G#3 B3 F#4","E5 - B4/E5 A#4 B4 D#5 E5/F#5 B5"],
      ["F#2 A#3 C#4 E4","C#6 - A#5/F#5 C#5 E5 F#5/E5 C#5 A#4"],
      ["B2 A#3 D#4 F#4","B4 D#5 F#5/A#5 B5 A#5 F#5 E5 D#5/C#5"],
      ["E2 G#3 B3 F#4","E5 G#5 F#5/E5 B4 E5 - . B4/D#5"]
    ]
  },
  5:{
    title:"Clockwork in the Chimney",bpm:182,beats:3,lead:"hammer",answer:"brass",backing:"organ",groove:"stomp",
    bars:[
      ["C2 G3 C4 D#4","C5 ./G4 G4/C5 C#5 C5 D#5/C5"],
      ["G#2 G#3 C4 D#4","D#5 C5 G#4/C5 D#5 . G4"],
      ["C#3 G#3 C#4 F4","F5 D#5/C#5 G#4 C#5 F5/G#5 F5"],
      ["G2 G3 B3 D4","D5 G4/B4 D5 F5 D5/B4 G4"],
      ["C2 G3 C4 D#4","C5 ./G4 G4/C5 C#5 C5 G5"],
      ["G#2 G#3 C4 D#4","G#5 D#5 C5/G#4 C5 D#5 G5"],
      ["C#3 G#3 C#4 F4","F5 F5/G#5 C#6 G#5 F5 C#5"],
      ["G2 G3 B3 F4","G5 F5/D5 B4 D5 B4/G4 ."],
      ["F2 F3 G#3 C4","G#4 C5/Eb5 F5 . G#5 F5/Eb5"],
      ["D#2 G3 A#3 D#4","G5 . F5/D#5 A#4 G4 A#4/D#5"],
      ["C#3 G#3 C#4 F4","G#4 C#5 F5/G#5 C#6 . G#5/F5"],
      ["G2 G3 B3 F4","D5 F5/G5 F5 D5/B4 G4 B4"],
      ["C2 G3 C4 D#4","C5 ./G4 G4/C5 C#5 C5 D#5/C5"],
      ["G#2 G#3 C4 D#4","D#5 C5 A#4/G#4 C5 D#5 F5"],
      ["C#3 G#3 C#4 F4","F5 D#5/C#5 F5 G#5 F5/D#5 C#5"],
      ["G2 G3 B3 D4","D5 G4/B4 D5 F5/E5 D5 B4/G4"]
    ]
  },
  6:{
    title:"Rain on the Trestle",bpm:182,beats:4,lead:"whistle",answer:"electric",backing:"marimba",groove:"rush",
    bars:[
      ["D3 D4 F#4 A4","A5 - F#5/A5 B5 A5/B5 D6 C#6 B5"],
      ["C#3 E4 A4 B4","C#6 B5 A5/E5 F#5 A5 E5 F#5 G5/E5"],
      ["B2 D4 F#4 B4","F#5 A5/B5 D6 B5 A5/F#5 D5 E5 F#5"],
      ["G2 D4 G4 B4","G5 B5/A5 G5 E5 D5 G5 A5/B5 ./F#5"],
      ["F#2 A3 D4 F#4","A5 - F#5/A5 B5 A5/B5 D6 E6 D6"],
      ["E2 G3 D4 B4","E6 D6/B5 G5 B5 E6 . D6 B5/A5"],
      ["G2 B3 D4 G4","D6 B5 G5/A5 B5 A5 G5/E5 D5 B4"],
      ["A2 A3 C#4 E4","E5 F#5/A5 C#6 B5 A5 E5 F#5 A5"],
      ["B2 F#3 B3 D4","B4 B4/D5 F#5 . A5 F#5/E5 D5 F#5"],
      ["G2 G3 B3 D4","G5 E5/D5 B4 D5 E5 F#5/G5 B5 A5"],
      ["F#2 F#3 A3 C#4","C#5 E5/F#5 A5 B5 C#6 B5 A5 F#5"],
      ["A2 E3 G3 C#4","B5 A5/E5 G5 E5 D5 C#5 B4 C#5/E5"],
      ["D3 D4 F#4 A4","A5 - F#5/A5 B5 A5/B5 D6 C#6 B5"],
      ["G2 B3 D4 G4","D6 B5/G5 E5 D5 E5 G5 A5/B5 G5"],
      ["E2 G3 D4 B4","G5 B5/D6 E6 D6 B5/A5 G5 E5 F#5"],
      ["A2 G3 C#4 E4","E5 A5 C#6/B5 A5 G5/E5 C#5 D5 E5/F#5"]
    ]
  },
  7:{
    title:"Black Sand Breakers",bpm:194,beats:4,lead:"electric",answer:"organ",backing:"guitar",groove:"surf",
    bars:[
      ["E2 E3 G3 B3","E5 ./E5 E5 G5 F#5 E5/D5 E5 B4"],
      ["D2 D3 F#3 A3","E5 G5/A5 B5 A5 F#5 . A5 B5/D6"],
      ["C2 G3 C4 E4","C6 B5/G5 E5 D5 E5 . G5 E5"],
      ["B1 F#3 A3 D#4","F#5/F5 F#5 A5 F#5 D#5 B4/D#5 F#5 ./D#5"],
      ["E2 E3 G3 B3","E5 ./E5 E5 G5 F#5 E5/D5 E5 B4"],
      ["G2 G3 B3 D4","D5 E5/G5 B5 - G5 E5/D5 E5 G5"],
      ["C2 G3 C4 E4","C6 B5/G5 E5 G5 C6 E6/C6 B5 G5"],
      ["B1 F#3 A3 D#4","F#5 A5/B5 D#6 B5 A5 F#5/D#5 B4 ."],
      ["E2 E3 G3 B3","B4 - B4/C5 B4 G4/B4 E5 G5 E5"],
      ["F2 F3 A3 C4","C5 F5/E5 F5 A5 C6/A5 F5 E5 C5"],
      ["A2 A3 C4 E4","E5 ./E5 F5/E5 C5 A4/C5 E5 G5 A5"],
      ["B1 F#3 A3 D#4","D#5 F#5/A5 B5 D#6 B5/A5 F#5 D#5 B4"],
      ["E2 E3 G3 B3","E5 ./E5 E5 G5 F#5 E5/D5 E5 B4"],
      ["D2 D3 F#3 A3","F#5 G5/A5 B5 A5 B5/D6 B5 A5 F#5"],
      ["C2 G3 C4 E4","E5 G5/B5 C6 B5/A5 G5 E5 G5 E5"],
      ["B1 F#3 A3 D#4","F#5/F5 F#5 A5 F#5 D#5 B4/D#5 B4 D#5"]
    ]
  },
  8:{
    title:"Lanterns in the Lode",bpm:168,beats:4,lead:"marimba",answer:"reed",backing:"bell",groove:"pan",
    bars:[
      ["D2 A3 C4 F4","D5 ./C5 A4 C5/D5 F5 F5/E5 D5 A4"],
      ["G2 G3 B3 D4","./B4 D5 G5 E5/D5 B4 D5 E5 ."],
      ["F2 A3 C4 E4","F5 E5 C5 A4 C5/F5 A5 G5 F5/E5"],
      ["A2 G3 C4 E4","E5 D5/C5 . E5 G5 E5 C5 A4"],
      ["D2 A3 C4 F4","D5 ./C5 A4 C5/D5 F5 A5 F5 D5"],
      ["G2 G3 B3 D4","B5 A5 G5/F#5 E5 D5 ./B4 D5 G5"],
      ["E2 G3 B3 D4","E5 B4 D5/E5 G5 . E5 G5/B5 A5"],
      ["A2 A3 C#4 G4","G5 E5 C#5/E5 A5 . E5 C#5 E5"],
      ["Bb2 A3 D4 F4","F4 A4/C5 D5 . F5 A5 G5/F5 D5"],
      ["G2 G3 B3 D4","G4 B4/D5 G5 . E5 G5 D5/B4 A4"],
      ["D2 A3 C4 F4","A4 C5/D5 F5 E5 F5 A5 F5 D5/E5"],
      ["A2 G3 C#4 E4","G5 E5 C#5 E5/G5 A5 G5 E5/C#5 A4"],
      ["D2 A3 D4 F4","D5 ./C5 A4 C5/D5 F5 F5/E5 D5 F5"],
      ["G2 G3 B3 D4","B5 G5 A5/B5 D6 B5 A5 G5 E5/D5"],
      ["A2 G3 C#4 E4","C#5 E5/G5 A5 . Bb5/A5 G5 E5 C#5"],
      ["D2 A3 C4 F4","D5 A4 D5 F5/E5 D5 - . A4/C5"]
    ]
  },
  9:{
    title:"Waltz of the Kite Post",bpm:180,beats:3,lead:"fiddle",answer:"whistle",backing:"guitar",groove:"waltz",
    bars:[
      ["A2 A3 C#4 E4","E5 E5/F#5 E5 C#5 B4/C#5 A4"],
      ["E2 G#3 B3 E4","B4 D5/E5 G#5 . F#5 E5"],
      ["F#2 A3 C#4 E4","A5 A5/B5 A5 G#5 F#5/E5 C#5"],
      ["D3 A3 D4 F#4","F#5 E5/D5 A4 D5 F#5 A5"],
      ["A2 A3 C#4 E4","E5 E5/F#5 E5 C#5 B4/C#5 E5"],
      ["C#3 G#3 B3 E4","G#5 F#5/E5 C#5 E5 G#5 B5"],
      ["D3 A3 D4 F#4","A5 F#5/A5 D6 C#6 B5 A5"],
      ["E2 G#3 B3 D4","B5 G#5/F#5 E5 D5 B4 ."],
      ["F#2 A3 C#4 E4","C#5 F#5/A5 C#6 - A5 F#5"],
      ["B2 A3 D4 F#4","B4 D5/F#5 A5 B5 A5/F#5 D5"],
      ["D3 A3 C#4 F#4","A4 D5/F#5 A5 C#6 B5 A5"],
      ["E2 G#3 B3 D4","G#5 A5/G#5 F#5 E5 D5 B4"],
      ["A2 A3 C#4 E4","E5 E5/F#5 E5 C#5 B4/C#5 A4"],
      ["D3 A3 D4 F#4","F#5 A5/C#6 D6 - B5 A5"],
      ["E2 G#3 B3 D4","B5 G#5/E5 F#5 G#5 B5 D6"],
      ["A2 A3 C#4 E4","C#6 B5/A5 E5 C#5 A4 ./B4"]
    ]
  },
  10:{
    title:"Transit of the Moons",bpm:170,beats:4,lead:"synth",answer:"bell",backing:"organ",groove:"glide",
    bars:[
      ["Bb2 F3 A3 D4","Bb4 - D5 ./E5 F5 . A5 E5/F5"],
      ["C3 G3 C4 E4","G5 C6/B5 G5 . E5 G5/E5 D5 C5"],
      ["D3 A3 C4 F4","A4 D5/E5 F5 . A5 F5 E5/D5 C5"],
      ["A2 G3 C4 E4","C5 E5 G5 A5/G5 E5 . C5 E5"],
      ["Bb2 F3 A3 D4","Bb4 - D5 ./E5 F5 A5 Bb5 A5"],
      ["E2 G3 Bb3 D4","Bb5 A5/G5 E5 . D5 E5 G5 Bb5"],
      ["F2 A3 C4 E4","A5 G5/E5 F5 C5 E5 F5 G5 A5"],
      ["C3 G3 Bb3 E4","G5 E5/D5 C5 . Bb4 G4 C5/E5 G5"],
      ["G2 G3 Bb3 D4","D5 G5 ./A5 Bb5 - D6 Bb5/A5 G5"],
      ["D3 A3 C4 F4","A5 C6/A5 F5 D5 - F5 A5 F5/E5"],
      ["E2 G3 Bb3 D4","E5 G5/Bb5 D6 . E6 D6 Bb5/G5 E5"],
      ["C3 G3 Bb3 E4","C6 B5/Bb5 G5 . E5 Bb5 G5 E5/D5"],
      ["Bb2 F3 A3 D4","Bb4 - D5 ./E5 F5 . A5 Bb5"],
      ["C3 G3 C4 E4","G5 C6/D6 E6 D6 C6 G5/E5 G5 A5"],
      ["F2 A3 C4 E4","A5 C6/A5 F5 E5 C5 A4 C5/E5 F5"],
      ["Bb2 A3 D4 F4","D5 E5/F5 Bb5 A5/F5 D5 - A4 ./F4"]
    ]
  },
  11:{
    title:"Switchback Furnace",bpm:194,beats:4,lead:"electric",answer:"hammer",backing:"organ",groove:"gallop",
    bars:[
      ["E2 B3 E4 G4","E4 E4/F4 E4 . B4 E5/G5 E5 B4"],
      ["F2 A3 C4 E4","F5 E5/F5 C5 A4 C5 A4/G4 F4 G4"],
      ["G2 G3 B3 D4","G4 G4/A4 G4 B4 D5 G5/F#5 D5 B4"],
      ["B1 A3 B3 D#4","F#5 E5/D#5 B4 . D#5 F#5 A5 B5"],
      ["E2 B3 E4 G4","E4 E4/F4 E4 . B4 E5/G5 B5 G5"],
      ["F2 A3 C4 E4","A5 F5/E5 C5 F5 A5 C6/A5 G5 F5"],
      ["A2 A3 C4 E4","E5 E5/G5 E5 C5 A4 C5 E5/G5 A5"],
      ["B1 A3 B3 D#4","B5 A5/F#5 D#5 B4 B4/D#5 F#5 A5 ."],
      ["C3 G3 C4 E4","G4 C5/E5 G5 . C6 G5 E5/D5 C5"],
      ["A2 G3 C4 E4","A4 C5/E5 A5 . G5 E5 C5/B4 A4"],
      ["F2 A3 C4 F4","F5 A5/C6 F6 - E6/C6 A5 G5 F5"],
      ["B1 A3 D#4 F#4","F#5 G5/F#5 D#5 B4 F#4/B4 D#5 F#5 A5"],
      ["E2 B3 E4 G4","E4 E4/F4 E4 . B4 E5/G5 B5 D6"],
      ["F2 A3 C4 E4","F5 E5/F5 A5 C6 E6/D6 C6 A5 F5"],
      ["B1 A3 B3 D#4","F#5 F#5/G5 F#5 D#5 B4/D#5 F#5 A5 B5"],
      ["E2 B3 E4 G4","E6 B5/G5 E5 B4 G4 E4 - ./B4"]
    ]
  },
  12:{
    title:"Seven Ribbons",bpm:190,beats:4,lead:"brass",answer:"mandolin",backing:"bell",groove:"rush",
    bars:[
      ["C3 G3 C4 E4","C5 E5 G5 ./G5 A5 G5/E5 G5 C6"],
      ["A2 G3 C4 E4","C5 E5 A5 ./A5 B5 A5/G5 E5 G5"],
      ["D3 A3 C4 F#4","F#5 A5 D6 C6/B5 A5 ./F#5 E5 D5"],
      ["G2 G3 B3 D4","G5 G5/B5 D6 B5 A5 G5 D5 ./G4"],
      ["C3 G3 C4 E4","C5 E5 G5 ./G5 A5 G5/E5 G5 C6"],
      ["F2 A3 C4 E4","A5 G5/F5 C5 F5 A5 C6/A5 G5 F5"],
      ["D3 A3 C4 F4","F5 E5/D5 F5 A5 C6 A5/F5 E5 D5"],
      ["G2 G3 B3 F4","B5 A5/G5 F5 D5 B4 D5/F5 G5 ."],
      ["Eb3 G3 Bb3 D4","G5 Bb5/D6 Eb6 D6 Bb5 G5/F5 Eb5 Bb4"],
      ["Ab2 Ab3 C4 Eb4","Ab5 C6/Eb6 F6 Eb6 C6 Ab5/G5 Eb5 C5"],
      ["D3 A3 C4 F#4","A4 D5/F#5 A5 C6 B5 A5/F#5 D5 E5"],
      ["G2 G3 B3 F4","B5 A5/G5 F5 D5 B4 D5/F5 A5 B5"],
      ["C3 G3 C4 E4","C5 E5 G5 ./G5 A5 G5/E5 G5 C6"],
      ["F2 A3 C4 E4","A5 C6/A5 F5 C5 G5 F5/E5 C5 F5"],
      ["G2 G3 B3 F4","D5 G5/B5 D6 F6 E6/D6 C6 B5 A5/G5"],
      ["C3 G3 C4 E4","C6 B5/G5 E5 C5 G4 C5 - ./G4"]
    ]
  },
};
