/* The two leads in each row have physical field positions. The first points to
   a sheltered approach, the second to a working control or a witness. */
(function () {
  'use strict';
  const C = window.OW.Content;
  const assignments = {};
  function add(id, line) {
    const [left, right, clue, reply] = line.split('|');
    assignments[id] = {left, right, clue, reply};
  }
  function series(ids, lines) {
    const rows = lines.trim().split('\n');
    if (rows.length !== ids.length) throw Error('Incomplete field files for ' + ids[0]);
    ids.forEach((id, index) => add(id, rows[index].trim()));
  }
  const across = (first, last) => Array.from({length:8}, (_, i) => first + i + last);
  series(across('main_', '_0'), `
Orchard signal ridge|Hedgerow bell post|One raised lantern calls both orchard guards off the road.|Harvest crews are taking the apple carts out again.
Mossy toll arch|Pine resin tally|The blue toll tokens buy passage for loaded charcoal carts.|Fern Hollow’s charcoal burners can walk the road at dusk.
Crane gantry|Chalked counterweight|Fresh chalk draws a line from the crane to a boarded mountain road.|The first cart carried a school bell back over the pass.
Snowshoe overlook|Red mitten post|Every third sled ran empty to mislead the patrol.|The sled runners hung their red mittens above the gate.
Awning lookout|Broken clay seal|The last caravan was stopped for its water jars alone.|A potter set a blue cup at every place in the yard.
Heron hide|Half-submerged buoy|The flood shifted the ferry channel behind the depot.|Reed strung white buoys down the new channel.
Cooling gantry|Stamped axle|The rail lock feeds a repair shed full of civilian carts.|The first cart through was a child’s hand-painted wagon.
Bridge parapet|Stonecutters’ tally|Citadel patrols control the arches by counting footsteps.|A chalk procession of pawprints now crosses the bridge.
`);
  series(across('main_', '_1'), `
Split wagon tracks|Roadside dispatch box|The second axle belongs to a dispatch cart hiding in the flour train.|Poppy found the millers’ missing wages in the courier book.
Woodpecker hide|Pine pitch drum|An echo fools the forest guns into answering the wrong ridge.|The night watch can hear the owls again.
Scree shelf|Pulleys at the quarry|The lookout changes shifts when the quarry bell stops.|The lantern crew has hung a new lamp above the quarry.
Warm culvert|Thaw valve|Return water from the heaters shows which bunker is occupied.|Hot water reached the first bathhouse before sundown.
Low dune|Sundial vane|The false signal always falls one shadow short of noon.|The caravans have their midday signal back.
Dry weir|River chain|The patrol’s bell chain doubles back under the lock.|The first skiff carried seven bundles of clean linen.
Foundry catwalk|Switchyard semaphore|A forked signal plate sends loaded carts to a hidden siding.|The switchyard now brings copper to Cinder’s workshop.
Ruined cornice|Gatehouse tally|A royal stamp covers the entry orders of the missing couriers.|Dawn pinned the original names on the gatehouse wall.
`);
  series(across('main_', '_2'), `
Apple cart blind|Colonel’s relay book|Ironwhisker traded the missing couriers for relay staff.|Saffron recognized her sister’s little loop on a receipt.
Hollow alder|Bramble’s tree rings|Bramble’s bark masks carry the same knife nick as the false warrants.|Juniper freed the carver who cut the masks.
Wind-carved balcony|Flintfang’s slate|The mountain seals count crates by weight rather than number.|Crag can follow a missing crate into the lowlands.
Sheltered chimney|Whiteclaw’s coal slips|Whiteclaw paid for heat outside the garrison walls.|Lumi found shelter for the witness at the warming hall.
Trade canopy|Sirocco’s shadow print|The marshal’s stamp hides the coordinates of a second cistern.|Sol sent the well-diggers home with a copy of the marks.
Collapsed reed blind|Miretooth’s tide book|The admiral listed meetings at low tide under boat repairs.|Reed brought a missing pilot out before the next flood.
Foundry gallery|Geargnash’s calibration key|The director timed dispatch trains with a stolen shop key.|Cinder put the key back in its maker’s paw.
Blackbanner gallery|Vex’s double stamp|Vex’s orders carry two seals printed several days apart.|Velvet can finally put a name to the witness at Dawnbridge.
`);
  series(across('side_', '_0'), `
Beech hollow|Ochre handprint|Ochre dust falls outward where someone reopened the orchard burrow.|A farmer marked the cavern trail with yellow twine.
Fern arch|Glowcap spores|The footprints disappear where glowcaps brighten in the cave mouth.|Juniper taught the children to count glowcaps from the path.
Stone lintel|Miner’s boot nail|A square-headed nail pins an old survey to the quarry approach.|Pebble left a dry copy of the survey in the lodge.
Blue ice shelf|Soot in the snow|Soot underneath new ice marks a shelter warmer than the cliff.|The winter patrol marked a place to wait out blizzards.
Buried dome|Reed stylus|Sand funnels toward a vent beside the vanished observatory.|A mapmaker pressed the dome back into the oasis atlas.
Waterbird roost|Knotted reed|Reeds bend against the current outside the old channel.|Ripple marked the hidden landing for ferry crews.
Ash lip|Split firebrick|A draught pulls ash into an abandoned kiln under the works.|Button found a cool route under the rail spur.
Ivy cornice|Carved hinge|The iron leaves on the gate match a forgotten postern.|Dawn marked a civilian refuge on the wall map.
`);
  series(across('side_', '_1'), `
Flour-dusted hedge|Millers’ blue knot|Flour on the rope came from the mill’s emergency sacks.|The mill has enough meal for another week.
Beech hollow|Woven moss strap|The moss grows on the inside of a recently turned pack.|The tea room served its first full breakfast in days.
Quarry shadow|Copper boot cleat|An old cable carried rescue ropes under the ridge.|The quarry’s rescue harnesses are complete again.
Snow fence|Quilted bundle|A red quilt patch identifies the missing bedding crate.|Two families moved out of the cold corridor tonight.
Date palm blind|Hollow jar lid|A hollow lid keeps the water filters above the sand.|Fennel has spare filters for the caravan.
Net-drying rack|Whittled cork|The cork float belongs to a waterproof medicine chest.|The clinic put its medicine back on the shelves.
Boiler shade|Blue chalk cross|A blue cross means spare parts for the civilian line.|The shop bell rang as the last lathe restarted.
Carved lintel|Courier’s ribbon|A yellow ribbon marks the postmen’s emergency cache.|Dawn shared a fresh pencil with every messenger.
`);
  series(across('side_', '_2'), `
Willow screen|Miller Reed’s apron|The flour trail belongs to Reed and two orchard pickers.|Reed has gone back to milling for the harvest crews.
Root tunnel|Fenn’s bell rope|Fenn braided a scrap of bell rope into the cell grille.|Fenn rang the village bell by hand this morning.
Stone gallery|Alba’s pit tag|Alba scratched the quarry crew’s number on the lower gate.|Alba brought every miner’s tag home on one string.
Drifted shed|Purl’s quilt peg|Purl hid her sewing crew behind the snow fence.|The seamstresses have hung their first finished quilt.
Dry fountain|Tamar’s water token|Tamar counted her drivers by leaving one token outside each cell.|Tamar counted all the drivers into the shade.
Reed arch|Lark’s half-net|Lark let one net unravel to point out the skippers’ pen.|Lark is mending nets with her father on the bank.
Railway shelter|Copper’s red rag|The red rag in the grate belongs to Copper’s apprentice crew.|All three apprentices struck the workshop bell.
Postern stair|Nell’s letter seal|Nell passed a blank letter through the bars to mark the prison.|Nell is teaching new carriers how to fold a letter.
`);
  series(across('side_', '_3'), `
Rutted ridge|Flour wagon switch|A narrow wheel track beside the broad grooves marks the ration wagon.|The bakers split the recovered flour with Applewick.
Hollow tree|Pitch barrel mark|Fresh pitch drips from only the cart carrying lamp oil.|The bellkeeper filled the village lanterns.
Rock overhang|Copper brake shoe|The warm brake shoe identifies the steep quarry siding.|The mountain crew unloaded the climbing spikes by hand.
Snow wall|Red sled runner|The red runner rubs the snow blue when it carries heater cells.|A child warmed her paws on the first heater.
Sunshade|Ceramic cart seal|The only cracked blue seal belongs to the water train.|The drivers tipped a cup for the last wagoner.
Crane nest|Tide signal|The convoy waits for one falling-tide bell before moving the filters.|Clean river water reached the lower docks.
Rail bridge|Siding stamp|Stamped ballast identifies the line carrying the clinic boiler.|The new clinic has heat for its night shift.
Carved recess|Bridge tally block|The heavy wagon carries stolen evidence under a load of statues.|Velvet opened the crate in front of six witnesses.
`);
  series(across('side_', '_4'), `
Hayloft watch|Crooked apple brand|The Crabapple Gang wears the same split-apple patch on every coat.|Applewick’s orchard watch took down its curfew notice.
Mossy stile|Three pine cuts|The Pitch Runners score each meeting tree three times.|Fern Hollow reopened its path to the tea room.
Slate hollow|Copper bootprints|The Scree Dogs drag copper cleats over the mountain stones.|The stonecutters left a thank-you on the quarry gate.
Snow blind|Crooked ski trail|The Blue Runners use one patched ski, leaving a broken line.|Lamp oil reached the north shelters before dusk.
Shade ridge|Coin with a hole|The Copper Jackals pass holed coins between their patrols.|The caravan children can fetch water again.
Heron blind|Black cork float|The Black Cork crew marks its ambush pools with tarred floats.|Reed’s boats crossed without a night escort.
Dry flue|Split rivet|The Soot Company uses crushed rivets for patrol markers.|The smiths took down the black shutters.
Broken rampart|Tin crown|The Tin Kings leave stamped crowns wherever they collect a toll.|Dawnbridge melted the crowns into a public bell.
`);
  series(across('escort_', ''), `
Applewood stile|Courier’s spare basket|The bread cart can cover a courier crossing the orchard road.|The first letter reached a waiting sister.
Moss crossing|Bellkeeper’s pouch|The bell rope passes the safe side of the stream.|A reply was waiting on the tea-room sill.
Shelter cairn|Red medicine tin|The true medicine rattles softly in its padded tin.|The pass clinic painted a red paw above its door.
Snow alcove|Wool parcel|The heater cells sit inside quilts with a blue selvedge.|Lumi saved the warmest seat for the courier.
Canvas rest|Water ledger|The last water wagoner left a shaded fallback by the cistern.|The water reached the caravans cool.
Reed channel|Rush message tube|A hollow reed carries a message the tide cannot wash away.|A river pilot read a letter from her daughter.
Rail arch|Heatproof parcel|The forge package bears a pawprint in cooled blue wax.|Cinder opened the parcel with her old apprentice.
Stone shelter|Velvet’s satchel|The duplicate dispatch is sewn into the satchel’s lining.|The last courier hung her empty bag beside the bridge.
`);
  series(across('defend_', ''), `
Orchard fork|Wagon barricade|The upper fence screens the pickers while the lower road takes carts.|The harvest train rolled out under its own lanterns.
Footbridge shelter|Stream gate|The raiders cross where two roots hide the shallow water.|The bellkeeper reopened the stream lane.
Quarry ramp|Engineer’s jack|A wagon jack holds the quarry gate during the engineers’ retreat.|All five helmets hang beside the forge.
Snow courtyard|Windbreak stake|The northern wind hides the side road in blown snow.|Warm soup was waiting for the last sentry.
Water arch|Reservoir shade|The water carriers must cross the exposed lip of the reservoir.|Fennel chalked their names around the basin.
Dry bank|Ferry chain|The ferry stern turns broadside to the road while loading.|Ripple made the final crossing before fog set.
Workshop blind|Tool cart|The brick lane leaves the repair crew’s right side exposed.|The returning engineers brought the steam bell online.
Stone arch|Messenger screen|The last couriers need the relay bank clear until the bell.|Dawn took the last messenger across herself.
`);
  series(across('assassination_', ''), `
Stunted tree|Gristle’s chipped buckle|Gristle walks ahead of his guards to polish his buckle.|A farmhand recognized the buckle from a stolen coat.
Split oak|Thorn’s resin glove|Thorn leaves a sticky left print on every gate.|Juniper put the glove beside the false toll notice.
Quarry niche|Scree’s broken spur|Scree’s left spur catches on the slate before a charge.|Crag returned the stolen quarry pay.
Abandoned snow hut|Rime’s boot wrap|Rime wrapped only the right boot after falling on the ice.|Lumi posted safe passage on the ice road.
Dune hollow|Dustfang’s water token|Dustfang’s red water token hangs on a bent brass hook.|Tamar hung the token over the drinking trough.
Pollard willow|Murk’s oar notch|Murk counts his tolls with notches in a stolen oar.|The ferry crew sanded the toll marks away.
Coal chute|Rivet’s white gauntlet|Rivet wears the pale gauntlet of the foreman he replaced.|The original foreman put the gauntlet back on.
Stone buttress|Onyx’s glass ring|The flash beside the commander comes from Onyx’s carved ring.|Velvet entered the ring into evidence.
`);
  series(across('bounty_', ''), `
Cider press|Soot’s burnt orders|Soot carries his old orders in a scorched orchard book.|The orchard court received a complete tally of the thefts.
Root shelf|Nettle’s drawstring|Nettle changes direction when his seed pouch whistles.|The bellkeeper returned the pouch to its maker.
Slate shelf|Basalt’s slate badge|Basalt chipped his badge on the quarry stair.|Crag set the chip back into the quarry memorial.
Winter porch|Hoarfang’s frosted lens|Only Hoarfang’s spyglass makes a square patch in the frost.|Lumi gave the glass to the mountain lookout.
Adobe wall|Copperdune’s scales|Copperdune rigs his scales with a polished false weight.|The water sellers tested every scale in the bazaar.
Reed shelter|Bogclaw’s float|Bogclaw hides the river toll in a lead-weighted float.|The pilots paid for a new ferry rail.
Clinker heap|Crucible’s slag seal|The general’s seal contains a streak of green slag.|Cinder marked a smelter lot safe for civilian work.
Bridge embrasure|Nightiron’s black ribbon|Nightiron puts a black ribbon over the gate tally before each raid.|Dawn flew the pennant upside down for a safe crossing.
`);
  const vaultIds = Array.from({length:16}, (_,i) => 'vault_'+Math.floor(i/2)+'_'+i%2);
  series(vaultIds, `
Orchard relief|Cracked first rune|A small apple is cut into the first stone of the echo tale.|A traveling mason copied the undamaged mark.
Lamplit shelf|Split receiver|The receiver’s enamel has worn where the old beam struck.|The quarry lantern-maker repaired the lens.
Moss-stained mirror|Shutter hinge|The reflected moss is brightest beside the first receiver.|The bellkeeper framed the old reflector.
Moonmoss ledge|Trial bell|The first rush is easiest to read from the open center.|The watch lit a green candle for the survivors.
Aqueduct lip|Pressure dial|The mine’s lowest receiver fills while the side spillway is closed.|The quarry reopened its old wash basin.
Surveyor’s step|Linked star marks|A brass line joins neighboring stars beneath the chalk.|Pebble marked the night sky over the lodge.
Frosted star chart|Linked frost studs|The studs wired to a star also change when it is pressed.|A paper copy of the chart hangs in the warming hall.
Cold parapet|Aurora gong|The shelter nearest the gong leaves a clear retreat to the middle.|The winter watch named this lookout for its first keeper.
Buried fresco|Chipped echo rune|Wind scoured the plaster off the first carved symbol.|The engraver filled the missing lines with clay.
Shadow shelf|Sun mirror lock|The mirror faces the shaft when its stand casts the narrowest shadow.|The observatory reopened one shutter at noon.
Reed ledge|Tarnished mirror|A pale line in the silt marks the receiver’s old sightline.|A ferrymouse used the lens to light the shore.
Pier shelter|Watch bell|The outer boards funnel the first wave toward a single pier.|The river watch rang its bell across the mudflats.
Kiln overlook|Blackened gauge|The works discharge into the right-hand pipe before the center gate.|An apprentice drew the working pipes above his bench.
Ash-covered chart|Twin star terminals|White chalk spans the pair of terminals that change together.|Button sold a little sky globe for the clinic.
Stone gallery|Crown star chart|An unbroken brass wire links the center crown to its neighbors.|Velvet recovered the old royal sky register.
Bastion watch|Rally drum|The drum echoes from the wall behind the first attacking party.|The last resistance flag returned to the bridge.
`);
  const specials = `
main_berlin_final|Western document lift|Southern gatehouse order|The document lift carries a shutdown code for Whisker’s relay lanes.|The couriers read their own names at the Dawnbridge relay.
sabotage_0|Orchard pole shadow|Fuse inspector’s cloth|The alarm repeats only while all three red fuses carry current.|Moth wrapped the dead fuses in her old apple cloth.
delivery_0|Baker’s basket cloth|Warm loaf under the hedge|The heel is missing because Marmalade fed a hungry runaway.|Marmalade laughed. “Of course I saved you the crust.”
triage_1|Alder’s scarf|Sorrel’s medallion|The two scouts tied their scarves together before the patrol split them.|Fern set both scarves drying by the same window.
recon_1|Owl-feather blind|Twisted listening foil|The owl calls overlap at the west stone; the second voice is a recording.|The professor let the real owls finish their song.
demolition_2|Miner’s shelf|Cracked warning bell|The safety bell stands on the far side of the marked rockfall.|Flint carved a little bell over the reopened footpath.
recovery_2|Quartz outlook|Scratched survey clip|The three survey sheets share one torn triangular corner.|Pebble pressed the patched map flat under a teacup.
signal_3|Aurora shelter|Forked antenna tip|The middle dish bends toward the pale tail of the aurora.|Solstice heard a voice she knew through the last hiss.
delivery_3|Quilt-maker’s porch|Blue heater cell|Mittens signed the heater cells with the stitch from her first quilt.|Mittens tucked a quilt around the first family through the door.
recovery_4|Palm shadow|Wet pottery ring|A damp line between two dry rings proves the old well still feeds.|Fennel poured the first clean cup for the oldest driver.
infiltration_4|Shadowed ledger shelf|Two water seals|The false ledger has two dry seals; the real ink bled under a wet paw.|Sable returned a confiscated caravan permit to its owner.
triage_5|Raised reed bed|Double-knotted net|The smallest net was tied by the youngest of the three fishers.|Willow walked the youngest fisher home herself.
sabotage_5|Sluice keeper’s seat|Reverse-flow gauge|Two pressure needles must settle before the main lock can turn.|Ripple put a paper boat through the reopened lock.
demolition_6|Cool gallery|Stamping wheel|The large wheel stamps empty shell casings even after the furnace shuts.|Copper turned the last casing into a cup.
recovery_6|Ash-covered workbench|Blue winding wire|Blue winding wire is the part that makes the warning horn sing.|Button sounded the all-clear for the children below the works.
infiltration_7|Bridge shadow|Double-stamped gate slip|One stamp is older than the ink describing the supposedly fresh order.|Velvet asked the witness to sign her own account.
signal_7|Relay shelter|Worn song cylinder|The scratches fall silent just before the chorus begins.|Patches let the crowd sing the missing line.
camp_waves_0|Harvest wagon|Quartermaster’s bell|The wagons need the center lane clear between enemy waves.|The pickers returned pushing an empty cart for the wounded.
camp_waves_2|Ridge windbreak|Lantern keeper’s switch|The withdrawal light must stay visible while the captain circles the ridge.|Crag carried the last engineer’s lantern home.
camp_waves_4|Caravan shade|Last full water jar|The smallest jars belong to the drivers who cannot leave their animals.|Sol opened the gates for the thirsty teams.
camp_waves_6|Warm brick niche|Evacuation tally|The smith chalks a white paw for each family safely on the spur.|Cinder drew the last paw herself.
demolition_1|Sawmill belt guard|Feed wheel clutch|The upper drive feeds the saws; the lower two turn the carriage and hoist.|Juniper nailed the silent blade above a carpenter’s empty workbench.
demolition_3|Snowbound cable run|Relay switch box|Frost marks three conductors joined at the sheltered disconnect.|Lumi returned a battery blanket to the patrol that lost it.
demolition_5|Gantry overlooking the pumps|Feedwater gauge|Water backs up into the third engine after the first two stop.|Reed counted fish passing the dry military quay.
demolition_7|Shaded transformer|Searchlight breaker|Separate generators serve the wall, bridge and gatehouse lamps.|Dawn hung a civilian lantern in the dark gate.
stormglass_beacons|Seawall shelter|Salt-pitted lens|A salt trail across each lens shows which way the fog rolls in.|Nacre dimmed the shore lamps so the beacon stood clear.
stormglass_salvage|Hull shadow|Green wax crate seal|The waterproof green wax protects the signal lenses inside.|Pip fitted a rescued lens to the children’s weather glass.
stormglass_moorings|Quayside bollard|Frayed harpoon line|The same barbed rope blocks every boat leaving the quay.|Mira cut a length of free rope for each skipper.
stormglass_prison|Seaweed screen|Diver’s bell tally|A second bell note means the divers are still inside the prison.|The divers signed the salvage ledger in their own paws.
stormglass_convoy|Crown shoal|Load-line marker|A convoy riding low at the bow carries the lighthouse counterweights.|The lighthouse lamp started its slow turn at dusk.
stormglass_homecoming|Harbor lee|Saltwater lantern|The returning pilots read the lights by their spacing across the pier.|Fenn kept one lantern burning for late boats.
defense_stormglass_beacon|Beacon stair|Saltwind stores|The exposed stair empties alongside the beacon supply stack.|Nacre’s beacon guided the last northern ferry in.
defense_stormglass_rescue|Boat shelter|Patient roster|The last casualty needs a clear aisle to the rescue stores.|Brindle struck the final name from the stranded list.
defense_stormglass_lantern|Causeway recess|Oil handcart|Three short lantern poles mark the approach from the flooded ramp.|Mira rang the next ferry into the quiet harbor.
defense_sunkencrown_reeds|Reed mat hide|Anchor flag|The landing crew must turn the ferry before the reeds close behind it.|Coral helped the smallest family onto dry ground.
defense_sunkencrown_bell|Bell platform|Medicine sling|The handbell cord doubles as a stretcher sling in an emergency.|Fenn rang a gentle note for the children in the clinic.
defense_sunkencrown_evacuation|Pier lookout|Painted draft line|The last ferry can float only above the blue mark on the pier.|Pip left the last seat for the watch keeper.
invasion_orchard|Wagon hide|Harvest tally|The orchard crews left a medic flag at the safest fallback.|Saffron tied the harvest ribbon on the surviving cart.
invasion_frost|Lantern alcove|Evacuees’ quilt|A quilt with a brown corner marks the shelter the families chose.|Lumi hung the worn quilt in the reopened hall.
invasion_berlin|Bridge tower|Pennant register|Each resistance pennant signals a different reserve formation.|Dawn lifted every banner together when the road was clear.
hidden_gunsmith|Owl’s hollow|File marks on a receiver|Wick files a crescent into both halves of a matched receiver.|Wick let his old apprentice fire the first shot.
hidden_lastwatch|Watchtower parapet|Crooked shutter latch|The keeper opens the bent shutter to signal a safe return.|The defender set a second cup beside the watchtower lamp.
hidden_blackglass|Ember stair|Violet ribbon|Vesper knots the trailing end toward the next safe lookout.|Vesper tied the last ribbon around her route book.
rare_rimeglass|Stone pump crossing|Twin ice-blue gauges|The dry crossing sits above both lakes’ high-water marks.|Thistle left a spare regulator handle in the pump house.
rare_cindercoil|Cool valve path|Scorched bridge plate|The color of the bridge changes where each valve takes effect.|Brindle bolted a cold sample above the forge door.
rare_zephyr|Leeward terrace|Chipped vane silhouette|The carvings face into each terrace’s prevailing wind.|Sora rang a quiet homecoming note for the pilgrims.
rare_kraken|Pier alcove|Three-anchor knot|Each anchored line reaches a different stretch of flooded pier.|Pearl hung a tide chart where the youngest divers could read it.
`.trim().split('\n');
  for (const line of specials) {
    const split = line.indexOf('|');
    add(line.slice(0,split), line.slice(split+1));
  }
  const artByType = {liberate:0,boss:4,explore:9,cache:1,rescue:2,convoy:3,kill:4,escort:1,defend:5,assassination:4,bounty:4,sabotage:8,delivery:7,triage:2,recon:6,demolition:8,recovery:1,signal:0,infiltration:6,dungeon:9,campDefense:5,repair:12,invasion:5};
  for (const q of C.quests) {
    const a = assignments[q.id];
    if (!a) continue;
    a.art = artByType[q.type];
    if (q.type==='dungeon') a.art = q.id==='rare_kraken'?14:q.id==='rare_zephyr'?13:q.id.startsWith('rare_')?15:/Light/.test(q.title)?10:/Waterworks/.test(q.title)?11:/Starless/.test(q.title)?12:9;
  }
  C.fieldAssignments = assignments;
  C.fieldDefenses = {
    defend_0:{name:'Orchard fork',plan:'Hold the wagon lane for 15 seconds, shift to the hedgerow, then return for the last carts.',shifts:[[15,'left'],[30,'origin']]},
    defend_1:{name:'Root footbridge',plan:'Guard the work crew. At 20 seconds, ring the stream gate to release the crossing.',signal:20,command:'Release the stream gate'},
    defend_2:{name:'Quarry engineers',plan:'Stay close while the engineers carry their lifting jack up the ramp.',moving:'Quarry engineers'},
    defend_3:{name:'Covered passage',plan:'Stay in the lee of the windbreak. Heroes within 100 metres take 25% less damage.',shelter:true},
    defend_4:{name:'Water carriers',plan:'Walk beside the water carriers as they move from the reservoir into shade.',moving:'Water carriers'},
    defend_5:{name:'Ferry withdrawal',plan:'Hold the river chain, then cover the ferry crew at the rear landing after 25 seconds.',shifts:[[25,'rally']]},
    defend_6:{name:'Workshop evacuation',plan:'Cover the repair crew. At 18 seconds, use the tool cart to send the workers down the spur.',signal:18,command:'Release the tool cart'},
    defend_7:{name:'Bridge relay',plan:'Cover the first arch, cross for the messenger at 12 seconds, then hold the relay bank after 28.',shifts:[[12,'right'],[28,'rally']]}
  };
}());
