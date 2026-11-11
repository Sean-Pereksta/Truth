(function () {
  'use strict';
  window.OW=window.OW||{};
  // Each entry contains a personal opening, a player question and answer,
  // followed by a second question and answer. Branches are authored below.
  const stories={
    'Captain Saffron':[
      'I was an orchard inspector before anyone called me Captain. I can spot a bruised apple at twenty paces. Troop movements took rather longer to learn.',
      'How did an orchard inspector become a captain?',
      'Ironwhisker requisitioned our winter apples. I hid the smallest ones in empty medicine crates. By spring, every village was sending me crates. Apparently that is how you become a supply officer.',
      'Do you miss the orchard?',
      'Every morning. I keep a list of trees that survived beside the casualty list. I need to remember what all this fighting is for. When we win, you are helping me prune. That is an order.'
    ],
    'Scout Juniper':[
      'Quiet feet, please. I am trying to hear whether the woodpecker is tapping three times or four. Three means rain. Four means my lookout is very bored.',
      'You use birds to send messages?',
      'Mostly my sister with a hollow branch. The occupiers searched for a radio for two weeks. She charged them a birdwatching fee when they passed her hide.',
      'Is your sister still out there?',
      'She refuses to leave the old canopy station. I used to call her reckless. Now I bring dry socks and pretend they are intelligence reports. Family is a terrible chain of command.'
    ],
    'Ranger Crag':[
      'That scar? A mountain goat. The uniform? A promotion. The goat was a much more convincing opponent.',
      'What happened with the goat?',
      'I tried to rescue it from a ledge. It had been perfectly happy there. It rescued me back down the cliff at considerable speed. Ask before you help someone; that was the lesson.',
      'Why stay in these mountains?',
      'My climbing partner is buried above the snow line. We planned to put a tea house on the summit. I have the kettle. I just need a peaceful enough world to carry it up.'
    ],
    'Medic Lumi':[
      'Sit still. I can have a conversation and check your pupils at the same time. Most soldiers manage neither.',
      'Were you always a medic?',
      'I repaired clocks. Tiny gears, steady paws, no spare parts: excellent preparation. My first patient said I had a terrible bedside manner. He came back to tell me on his own feet.',
      'Who looks after you?',
      'Grandma Mittens leaves soup at my door and claims she cooked too much. She has cooked exactly one extra bowl for ninety-three nights. I am not going to spoil her disguise.'
    ],
    'Trader Sol':[
      'Before we discuss prices: the little wooden camel is not for sale. Yes, everything else on this table has a price. No, that does not include the camel.',
      'Who carved the camel?',
      'My daughter. It has five legs because four seemed unreliable. She is across the desert with her grandmother. I carry every letter in a waterproof ammunition tin.',
      'What will you sell when this is over?',
      'Kites. Absurd, enormous, impractical kites. Something nobody can mistake for military equipment. My daughter can handle the structural engineering; she believes in redundancy.'
    ],
    'Harbormaster Reed':[
      'The harbor bell is five minutes slow. I know. Every boat in the marsh is five minutes slow with it. We are perfectly synchronized in our incompetence.',
      'Why not fix the bell?',
      'My father set it that way so late passengers could make the last ferry. The occupation printed schedules from the clock tower. We still have five minutes they cannot account for.',
      'Are those minutes enough to help?',
      'Enough for a family to board the wrong-looking boat. Enough to hide a medicine case under a net. Revolutions need grand speeches; people need five more minutes.'
    ],
    'Engineer Cinder':[
      'Do not lean on that pipe. It is either a steam return or my tea warmer. I am ninety percent certain which.',
      'Did you build this machinery?',
      'Some of it. Before the occupation, the furnaces made bridge parts. I know every valve we gave them, and every safety valve they removed. Breaking my own work feels stranger than I expected.',
      'Can the foundry be rebuilt?',
      'Of course. Machines are honest: give them the right pieces and they work. Getting everyone who used to work here back through the gate will be the difficult repair.'
    ],
    'Captain Dawn':[
      'I practice the victory speech whenever nobody is listening. So far it begins, “Well,” and then I have to sit down.',
      'What are you afraid to say?',
      'That I do not know how to lead people who are no longer fighting. Orders are easy. Asking someone what they want to do with a free morning is a much larger responsibility.',
      'What would you do with a free morning?',
      'Sleep until the kettle boils. Walk outside without counting exits. Find the person who first called me Captain and insist they use my name.'
    ],
    'Moth':['I draw the silhouettes of friendly aircraft in the margin of my notebook. There are no friendly aircraft yet. I am being prepared.','What do you draw besides aircraft?','Wings, mostly. My brother says a cat cannot fly. My brother also said the old radio could not work, and now it picks up his terrible singing from the next village.','Would you really try to fly?','After the war, with a parachute and an adult who knows what they are doing. I am adventurous, not an idiot. There is a difference; please tell my brother.'],
    'Marmalade':['The bread has not risen. Neither has morale. Fortunately I can do something about one of those before lunch.','What is the secret to your bread?','Patience, warm water, and refusing to discuss military matters near the dough. It can smell despair. That last part is not science, but my kitchen has rules.','Who taught you to bake?','My husband. He measured everything; I refuse to measure anything. We argued over a loaf every morning for forty years. I still set out his apron before I begin.'],
    'Nurse Fern':['I label every bandage drawer. Someone keeps changing “sterile” to “stylish.” I suspect a patient with far too much energy.','Why become a nurse here?','I was going to study plants in the capital. Then the road closed, and knowing which leaves stop a fever became more useful than knowing their Latin names.','Will you go back to studying?','Yes. And I am taking this whole notebook of field remedies. Someone should write down what village grandmothers know before another professor calls it a new discovery.'],
    'Professor Purr':['Please do not call these ruins primitive. They have survived longer than any building I have designed.','What did the ruins used to be?','A meeting place, I think. The same symbols face one another across the chamber. People remember weapons and kings; I would like to find where ordinary people talked.','How do you know a symbol is important?','Repetition and context. Count the marks. Look at which ones face the doorway. If a mechanism reacts, watch before trying again. Archaeology rewards attention more often than courage.'],
    'Miner Flint':['I can tell you which shift a tunnel was dug on by the pick marks. Night crews are sloppy. I was a night foreman, so I am allowed to say it.','What happened down the mine?','We heard rats moving behind a sealed gallery. Management called it settling stone. Stone does not steal your lunch or carry a fencing sword.','Do you want to go back underground?','With the others, and with a proper safety rope. I left a little brass canary on my locker. It belonged to my mentor. Silly thing to miss, but there it is.'],
    'Cartographer Pebble':['Maps are promises. This one promises a bridge that fell down last winter, so I am having an argument with it.','Why keep making maps during a war?','Because an unmarked safe path is only safe for the person who knows it. A family escaping at night deserves the same information as an officer.','Do you ever leave anything off a map?','People. Refuge names, hidden homes, anyone who asked me not to draw them. Accuracy is not the only kind of honesty.'],
    'Radio Cat Solstice':['If the radio whistles, that is interference. If it sings, that is my aunt. If it insults the commander, that is definitely not me.','Who is listening to your broadcasts?','I cannot know. That is the hard part. I read the weather, birthdays, missing-person notices. Sometimes somebody brings a reply written on a flour sack.','What do you say when there is no good news?','I say the truth, and then I play a song. Hope is not pretending things are fine. Sometimes it is merely proving somebody else is still awake.'],
    'Grandma Mittens':['You have the look of someone who thinks dinner is whatever fits in a pocket. Sit down before I become unreasonable.','Have you always lived here?','Seventy winters. I remember when the commander was an unpleasant little corporal. He borrowed a cup of sugar and never returned it. I have an exceptionally long memory.','What keeps you going?','People keep arriving hungry. As long as I can lift a pot, that gives me something useful to do. You can help by coming back alive and washing your bowl.'],
    'Pumpkeeper Fennel':['Listen: four knocks, then a hiss. Healthy pump. Three knocks means a cracked seal. Silence means I am about to have a very bad day.','Who taught you to listen to pumps?','My mother. She could hear a failing bearing through two walls. I thought she was magical until I inherited her wrench and discovered it was mostly being tired and paying attention.','What happens if the water stops?','We share what is stored, then fix what is broken. In that order. The occupiers always reverse it and wonder why nobody trusts them.'],
    'Archivist Sable':['The official history says this village surrendered without resistance. The burn marks on my archive suggest a spirited editorial disagreement.','What records did you save?','Births, recipes, council arguments, a dreadful play about a heroic turnip. Conquerors destroy the ordinary things first; those are what prove a place belonged to people.','Why save a dreadful play?','Because someone loved it enough to make three copies. Freedom must include the right to write terrible theater. I intend to defend that principle vigorously.'],
    'Doctor Willow':['That jar is medicine. This jar is lunch. The labels are very clear; the patients are less so.','Is marsh medicine different?','Damp ruins everything, so we learned to work with what grows here. My apprentice invented a waterproof bandage. She is fourteen and now impossible to impress.','Do you worry about your apprentice?','Constantly. I give her difficult work because she deserves a future larger than this infirmary. Being needed should not become a cage.'],
    'Lockkeeper Ripple':['The lock gates open on the hour. Except when they do not. Water is wonderfully indifferent to paperwork.','What are you hiding in the lock house?','A rowing shell. My team won the marsh regatta six years running. The authorities wanted the wood. I explained that dismantling it would upset the water pressure.','Would you race again?','Tomorrow, if the river were safe. Half my old rivals are in the resistance now. I intend to rescue them and then beat them quite mercilessly.'],
    'Welder Copper':['Please admire the weld, not the sparks. Everybody admires the sparks. The weld is what holds the bridge up.','What are you building?','A wheelchair with wide marsh tires. My nephew wants to join the fishing trips again. Every general asks for a stronger gun; he asked for a better way to get muddy.','Will it work?','Third prototype. The second turned beautifully but would not stop. We laughed about that after we fished it out of the pond. Progress is sometimes very wet.'],
    'Tinker Button':['My latest invention sorts screws by size. It also occasionally launches them. That feature is still in development.','Why build something like that now?','Because one day all this scrap becomes homes again. I want tools ready for that day. Also because sorting screws by paw is boring, and boredom is the mother of invention.','What is your best invention?','A kettle that turns itself off. Saved more eyebrows than any armor we have made. When we win, I am submitting it for a medal.'],
    'Agent Velvet':['You are three minutes late. I did not arrange a meeting; I just enjoy saying that to people.','Does anyone know your real name?','My mother, three old friends, and a dentist with absolutely no discretion. I am better at hiding documents than at being mysterious.','What do you miss about ordinary life?','Introducing myself without first deciding which version of me would be safest. When this ends, I want to be boring enough that nobody writes my name down.'],
    'Poet Patches':['I am looking for a rhyme for liberation. Everything I have so far sounds like a government pamphlet.','Why write poems during a war?','Because orders tell us where to go, and poems remind us there is someone going there. I write a verse for every name we bring home. The notebook is getting heavy.','Will you read one to me?','“Leave the lamp above the gate. / Let the kettle learn to wait. / Roads are long and night is wide. / Keep a little light inside.” That one is for whoever comes back last.']
  };
  const wayfinders={
    'Wayfinder Poppy':['I count milestones by the songs between them. I have a very accurate map and an appalling singing voice.','I learned every orchard lane taking bread to my grandmother. She insisted I arrive while it was warm. Fastest survey training in the kingdom.'],
    'Scout Hazel':['I grow beans in empty ammunition boxes. Practical symbolism, and excellent drainage.','The first plant survived a shelling and a week without rain. I cannot let a bean be the bravest creature in this village.'],
    'Wayfinder Bramble':['I name every fallen tree I use as a bridge. If it breaks, I know precisely whom to complain to.','Bertie was a magnificent oak. His replacement, Also Bertie, lacks confidence. Cross in single file.'],
    'Scout Fern':['Juniper handles the signals. I handle explaining that every strange noise is not an enemy signal.','I once called an entire patrol out over a snoring badger. The badger now outranks me in several unofficial documents.'],
    'Wayfinder Granite':['I collect smooth stones. Before you judge, try carrying a collection of rough ones all day.','Each one is from a pass I have brought someone safely through. This empty pocket is for the road home.'],
    'Scout Slate':['A good lookout notices what is missing. Today it is my lunch. This is clearly a matter of national security.','Crag took it. He leaves his climbing chalk on everything. I may not win the war today, but I shall solve this sandwich.'],
    'Wayfinder Flurry':['I sew bright thread into every trail marker. Snow hides paint; it cannot hide a determined tassel.','My first traveler was a child carrying a chicken under each arm. We made it. The chickens complained the entire way.'],
    'Scout Aurora':['I used to paint the northern lights. Now I paint camouflage. The colors are less interesting, but the reviews are excellent.','Someday I will paint this village with every window lit. I have already saved the yellow.'],
    'Wayfinder Saffron':['No relation to the Captain. I tell people that before they try to salute me or borrow money.','I guide caravans by the stars. My grandmother taught me their names; I renamed one after her because she was brighter than most of them.'],
    'Wayfinder Ripple':['Yes, there is also a Lockkeeper Ripple. No, we are not the same cat changing hats. Usually.','We are cousins. I handle the trails, she handles the boats. Between us, somebody gets you where you need to be.'],
    'Wayfinder Coal':['I carry a little jar of clean air from the hills. It is probably ordinary air by now. The idea is what matters.','My sister has never seen the high country. When the furnaces are quiet, I am taking her there before anyone gives me another assignment.'],
    'Wayfinder Starling':['I mark safe routes with a star and dangerous routes with two. This confuses officers who think more stars means better.','One of my maps got a classroom out through the blockade. The teacher sent it back covered in thank-you drawings. It is my best map, and entirely unreadable.']
  };
  function story(profile){
    const name=profile.name||'Resistance liaison';if(stories[name])return stories[name];
    if(!wayfinders[name]&&profile.dialogue?.length){
      const opening=profile.dialogue[0],advice=profile.dialogue[1]||profile.topics?.advice?.[0]||opening;
      return[opening,'What should I know about this place?',advice,'Who needs our help here?',profile.dialogue[2]||'The people who keep these roads and harbors alive. Ask about my work; there is a practical way you can help us today.'];
    }
    const own=wayfinders[name]||['I keep a small notebook of people who have reached the next refuge safely. There is room for your name.','The roads were places to meet friends once. I would like them to be that again.'];
    return[own[0],'How did you become a wayfinder?',own[1],'What do you want after the war?','A journey with no checkpoints, no false names, and no reason to hurry. Perhaps I will finally stop at all the places I keep telling travelers to walk past.'];
  }
  function build(profile,location,game,topic,memory={},node='start'){
    const s=story(profile),quests=game.questsForNpc?.(location)||(OW.Content.quests||[]).filter(q=>q.giverNpcId===location.id||(profile.questIds||[]).includes(q.id)),completed=quests.find(q=>game.completedQuests?.has(q.id)),accepted=quests.find(q=>game.acceptedQuests?.has(q.id)&&!game.completedQuests?.has(q.id));
    const cave=(game.world?.locations||[]).filter(l=>['cave','dungeon'].includes(l.type)&&l.region===location.region&&!l.cleared).sort((a,b)=>Math.hypot(a.x-location.x,a.y-location.y)-Math.hypot(b.x-location.x,b.y-location.y))[0];
    const known=memory.met,recall=completed?'You did what you said you would. I heard about '+completed.title+'. People here remember.':accepted?'I heard you took on '+accepted.title+'. Come back and tell me how it goes.':memory.tone==='kind'?'You said you would look out for us. I have been holding on to that.':memory.tone==='honest'?'Last time, you were honest about what you could promise. I appreciate that.':known?'Back again? Good. I was hoping we could finish our conversation.':'';
    const base=topic==='local'?(profile.topics?.local||[]):topic==='advice'?(profile.topics?.advice||[]):[];
    const coastalLead=OW.Content?.stormglass&&[3,4].includes(location.region)?'The east road is open: Keeper Nacre at Brinewatch Refuge has work on Stormglass Coast. Follow the coastal causeway south to Captain Coral at Crownrest Haven in the Sunken Crown Isles.':null;
    const route=cave?`There is an entrance at ${cave.name}. People hear movement behind the stone. If you go, watch the symbols and what changes when you touch the machinery. A wrong sequence may reset it.`:location.region>=8?(profile.topics?.advice?.[0]||profile.dialogue?.[1]||'Follow the marked coastal road to the next refuge. Ask its residents about their work.'):'We have searched every entrance I know. Ask in the next refuge; every region keeps its own secrets.';
    const choice=(id,label,next,extra={})=>({id,label,next,...extra});
    const graph={
      start:{lines:[...base,s[0]],choices:[choice('history',s[1],'history'),choice('listen','What is keeping you going?','heart'),choice('rumor','Heard anything about the caves?','route')]},
      history:{lines:[s[2]],choices:[choice('deeper',s[3],'heart'),choice('kind','I will look out for the people here.','kind',{tone:'kind'}),choice('honest','I cannot promise everything, but I will try.','honest',{tone:'honest'})]},
      heart:{lines:[s[4]],choices:[choice('kind','Then let us give you something to come home to.','kind',{tone:'kind'}),choice('honest','I am scared too. We will do what we can.','honest',{tone:'honest'}),choice('rumor','Tell me about the dangers nearby.','route')]},
      kind:{lines:[completed?'You already have. That matters more than another speech.':memory.tone==='kind'?'You keep saying that. I believe you. Just remember you are someone worth protecting too.':'Thank you. Do not make yourself a martyr on our account. A living friend is much more useful than a heroic story.'],choices:[choice('rumor','Give me a lead I can follow.','route'),choice('again','There was something else I wanted to ask.','start')]},
      honest:{lines:['Good. I trust an honest “I will try” more than a magnificent promise. We can be frightened and useful at the same time.'],choices:[choice('rumor','What should I watch for out there?','route'),choice('again','Tell me more about yourself.','start')]},
      route:{lines:[route,...(coastalLead?[coastalLead]:[]),'The supply shops carry local essentials. The unusual weapons are in the hands of unusual enemies. Bring back their equipment, and the forge can help you improve it.'],choices:[...(cave?[choice('mark','Show me the entrance on my map.','marked',{mark:cave.id})]:[]),choice('danger','How do I know when I am outmatched?','danger'),choice('again','Let us talk about something else.','start')]},
      danger:{lines:['Beyond the next regional pass, expect a sharp jump in enemy strength. Learn close to a refuge, bring medicine, and withdraw if ordinary patrols are tearing through your armor.','Rolling enemies protect themselves while moving. Wait until they stumble upright. Teleporters leave you a brief chance to move, and fencers commit to a line: escape sideways.'],choices:[choice('route','About that cave…','route'),choice('again','Thank you. Now, about you…','start')]},
      marked:{lines:[cave?`${cave.name} is marked. Take the road as far as it goes, then look for the entrance. The treasure is beyond the guardian; solve the chamber before you challenge it.`:'The location is on your map.','And come back with the story. I would like to know how this one ends.'],choices:[choice('again','I will. One more thing…','start'),choice('danger','One last piece of advice?','danger')]}
    };
    const followUp=completed&&game.questNextContact?.(completed),result=graph[node]||graph.start;
    return{...result,lines:node==='start'&&followUp?[...result.lines,followUp.text]:result.lines,recall:node==='start'?recall:'',relationship:completed?'A trusted friend':memory.tone==='kind'?'Your promise is remembered':memory.tone==='honest'?'Honesty is remembered':known?'A familiar face':'Getting acquainted',node:graph[node]?node:'start'};
  }
  OW.Conversations={build,stories,wayfinders};
})();
