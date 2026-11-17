'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name), 'utf8'));
const sections = {
  occupied: ['Occupied cities', 'Walk the freight and canal streets of Ironveil and the ministry and newspaper districts of Blackglass.'],
  settlements: ['Settlements', 'Arrival paintings, restored landmarks and the small places between the main roads.'],
  activities: ['Town games', 'The boards, anglers, catches, freight and prizes at the five venues.'],
  inn: ['The Copper Minnow', 'The harbor tavern, its regulars and the three draw tables.'],
  motion: ['Animation sheets', 'Successive poses for weapons, fish, anglers, board pieces and tavern regulars.'],
  exhibits: ['Evidence and chambers', 'Inspect the clues and mechanisms the party encounters in the field.'],
  fieldFiles: ['Quest case files', 'The evidence painting and field contact brief for each of the 159 assignments.']
};
const groups = Object.fromEntries(Object.entries(sections).map(([id,[name,caption]])=>[id,{name,caption,entries:[]}]));
const townNames = ['Willow','Mossbell','Goat’s Rest','Snowhaven','Sundial Oasis','Ashford','Crownrest','Dawnbridge','Sluicecross','Kitehook','Boughhall','Waystation'];
const names = {
  'iron-front': 'Workers’ terraces|Clerks’ row|Corner grocery|Iron stair tenements|Freight warehouse|Engine depot|Union offices|Cooperage|Paper mill|Balcony lodging house|Forge shops|Hotel and newsagent|Old bakery|Emerald theater|Sorting arcades|Market sheds',
  'black-front': 'Newspaper offices|Printing works|Bindery apartments|Bookstore arcade|Embassy balconies|Corner hotel|Clockmakers’ shops|Diplomatic club|Glass-roof archive|Records office|Tram exchange|Tax hall|Florist’s conservatory|Velvet theater|Night mail hall|Barracks court',
  'urban-landmarks': 'Freight station|Covered market hall|Power substation|Canal lockhouse|Union meetinghouse|Riveted gasholder|Ministry dome|Cathedral of records|The night press|Radio exchange|Cypress fountain|Metro kiosk',
  'urban-floor': 'Rain-dark asphalt|Granite curbs|Herringbone brick|Sidewalk flagstones|Archive cobbles|Canal water',
  'city-facades': 'Twin-chimney factory|Boarding house|Freight customs hall|Station clocktower|Pharmacy|Marquee cinema|Firehouse|Laundry balconies|Slate ministry|Archive tower|Command hall|Radio exchange|Arched hotel|Newsroom|Courthouse|Checkpoint arcade',
  civic: 'Market canopy|Station clock|Apple cart|Tea stall|Fishmonger|Tram stop|Banner lamp|Postbox|Street café|Furnace crew|Freight tram|Fishing skiff',
  outposts: 'Applewick cider press|Fern Hollow herb loft|Highstone signal bell|Whitepine post cabin|Clover creamery|Fernlight bridge|Badger brazier|Warmhearth kitchen|Amber glass stall|Reedlight net shed|Ember Rest kiln|Last Lantern watch|Brinewatch light|Crescent beacon|Otter ferry',
  evidence: 'Orchard signal lamp|Violet seal|Bandaged scout|Split axle pin|Torn-ear officer|Barricade plans|Owl feather ledger|Flour basket|Belt wheel|Echo rune|Copper mirrors|Pressure gauge|Star chart|Bell vane|Tide anchor|Furnace valve',
  props: 'Scout|Warden|Signal lantern|Mouse tactician|Silver minnow|Copper carp|Spotted rockfish|Golden whisker-eel|Apple cart|Water cart|Machinery cart|Switch signal|Diamond kite|Swallowtail kite|Quarry gate|Paw trophy'
};
const sectionFor = {
  'city-facades':'occupied','city-plates':'occupied',civic:'occupied','iron-front':'occupied','black-front':'occupied','urban-landmarks':'occupied','urban-floor':'occupied',
  landmarks:'settlements',towns:'settlements',aftermath:'settlements',streets:'settlements',outposts:'settlements',homes:'settlements',
  venues:'activities',props:'activities',fishing:'activities',board:'activities',rewards:'activities',evidence:'exhibits',
  'bar-room':'inn','bar-art':'inn','bar-tables':'inn','bar-floor':'inn'
};
const title = id => id.replace(/[-_]/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
for (const file of ['district-atlas','street-atlas','atlas']){
  for (const row of read('assets/fieldwork/'+file+'.json')){
    const key=path.parse(row.path).name, suffix=Number(key.match(/-(\d+)$/)?.[1]), table=names[row.source];
    let label=Number.isInteger(suffix)&&table ? table.split('|')[suffix] : title(key);
    if (['homes','streets'].includes(row.source)) label=townNames[suffix]+(row.source==='homes'?' houses':' paving');
    const group=groups[sectionFor[row.source]];
    if (!group) throw Error('Unregistered gallery group '+row.source);
    group.entries.push([row.path,label,row.consumer]);
  }
}
for (const [key,description] of Object.entries({fish:'Four species in six swimming poses',shatter:'Both board sets breaking into fragments',gun:'Firearm grip and recoil sequences',melee:'Blade and heavy weapon motion',scout:'Both heroes moving and dodging',faces:'Four regulars with six facial expressions each',walk:'Tavern walk and conversation poses',anglers:'Two anglers casting and reeling'})){
  const manifest = ['faces','walk','anglers'].includes(key)?'street-motion':'motion-atlas';
  const row=read('assets/fieldwork/'+manifest+'.json')[key];
  groups.motion.entries.push([row.path,description,row.frames.length+' measured frames']);
}
groups.activities.entries.push(['assets/activities/venue-pieces.webp','Carved pieces and venue props','The playing pieces, lantern, tactician and quarry equipment']);
for (const row of read('assets/cases/atlas.json')){
  const [name,exhibit]=row.consumer.split(' · ');
  groups.fieldFiles.entries.push([row.path,name,exhibit]);
}
fs.writeFileSync(path.join(root,'data/fieldwork-gallery.js'),'// Generated by tools/export-fieldwork-gallery.cjs for offline viewing.\nwindow.FieldworkGallery = '+JSON.stringify(groups,null,2)+';\n');
