# MeowQuest the Purr’d Reich — field controls

Inventory cards now include their own **Equip**, **Equip backup**, or **Use** buttons. Inspect a card to compare its details. Skills includes a painted illustration for each ability, two equipped slots, category tabs and a separate passive-training tab.

Interact with a cat using E / B. Choose a reply to talk, ask about a job, or access supplies. B goes back through the conversation; Escape / Start leaves it. Complete a field objective, follow the arrow to its named recipient, then choose **Finish quest**. A check-mark crest identifies ready turn-ins. The reward display lists what you earned and can mark your next contact. Speaking-only objectives complete as soon as the correct conversation happens.

Combat remembers action presses for up to 140 milliseconds near the end of a recovery or cooldown. This improves response without cancelling the current attack or changing cooldown duration.

The game supports two standard browser game controllers at the same time, keyboard and mouse, or one controller alongside a keyboard player. Gamepad support uses the browser's standard Gamepad API. Connect the controllers, open the game, and press a face button once so the browser can discover each device.

## Keyboard and mouse

| Action | Player 1 | Optional Player 2 keyboard |
|---|---|---|
| Move | W / A / S / D | Arrow keys |
| Aim | Mouse pointer | Movement direction |
| Shoot | Left mouse button | Number pad 0 |
| Melee | Right mouse button | Number pad 1 |
| Heavy strike | Hold Shift while striking | Hold number pad + while striking |
| Dodge | Space | Number pad 2 |
| Interact / revive | E | Number pad 3 |
| Primary tactical ability | Q | Number pad 4 |
| Secondary tactical ability | F | Number pad 5 |
| Grenade | G | Number pad 6 |
| Reload | R | Number pad 7 |
| Switch main / secondary firearm | Tab | Number pad 8 |
| Field medicine | C | Number pad 9 |
| Inventory | I | Use either player's menu |
| World map | M | Use either player's menu |
| Journal | J | Use either player's menu |
| Skill trees | K | Use either player's menu |
| Pause / return | Escape | Use either player's menu |

Use the numeric keypad with Num Lock enabled. The second keyboard layout shares the same physical keyboard; its movement direction also sets aim. A controller gives Player 2 independent twin-stick aim.

## Standard Xbox / PlayStation layout

| Action | Control |
|---|---|
| Move | Left stick |
| Aim / move your crosshair | Right stick |
| Shoot | RT / R2 |
| Melee | X / Square |
| Heavy strike | Hold X / Square for more than 0.45 seconds |
| Dodge | A / Cross |
| Interact / revive | B / Circle |
| Primary tactical ability | Y / Triangle |
| Secondary tactical ability | LT / L2 |
| Grenade | RB / R1 |
| Switch firearm | LB / L1 |
| Field medicine | D-pad up |
| Reload | D-pad down |
| Cycle unlocked primary abilities | D-pad left |
| Cycle unlocked secondary abilities | D-pad right |
| Inventory | View / Select |
| Toggle menu / resume | Start / Menu |

Aim remains in the last right-stick direction when the stick returns to center, including while moving. Before you first aim with the right stick, movement supplies a convenient initial facing direction. The right-stick magnitude controls how far the crosshair sits from your hero. Both players have their own aim, attacks, ammunition, ability cooldowns, and progression.

## Start a local co-op campaign

1. Choose a save slot and **New campaign**.
2. Select your hero and **Local co-op**.
3. With two controllers, the first and second detected controllers control Players 1 and 2. For keyboard + one controller, select the menu with the keyboard or mouse; that one controller controls Player 2.
4. Start the campaign. Player 2 can alternatively use the arrow keys and number pad.

For an existing solo adventure, press **Start** to open the Camp menu and select **Welcome Player 2**. Choose **Let Player 2 rest at camp** to return to one hero. Leaving co-op keeps the resting hero's equipment and skills in the campaign; rejoining restores that hero. **Start always toggles the menu during play**: press it once to open Camp, release it, then press it again to close the current menu and resume. Holding Start does not toggle repeatedly or change the number of heroes.

## Menus, equipment, and missions

- Use the D-pad / left stick to move the gold focus between buttons, NPC conversation choices, jobs, equipment cards, and settings. **A / Cross selects the focused control. B / Circle goes back**; from a conversation topic it returns to the opening conversation, then closes the dialogue. **Start closes any open field menu immediately**. Mouse, arrow keys, and Enter also operate menus.
- **LB / RB changes the visible tabs**: campaign tabs at the title; gear categories in Inventory and Supply; NPC conversation topics; mission categories in the Journal; keyboard-player tabs in Controls; and the top field-menu tabs elsewhere. The footer identifies the current tab group. To change the hero whose equipment or skills you are viewing, focus the explicit **Player 1 / Player 2** buttons and press A. Each controller maintains its own navigation focus.
- Inventory contains actual equipment icons and a comparison with the equipped item. Choose main or secondary firearm separately. The rebuilt **Skills** screen and Inventory **Abilities** category show all 24 tactical powers, their effects, requirements, and both equip slots. Learn the twelve new powers with skill points; the original twelve retain their level unlocks. Locked cards remain inspectable with a controller, and navigation scrolls the full list in either direction.
- Visit a friendly contact to discuss the region, accept and track a mission, browse supplies, or mark the nearest forge. Look for the **SAFE REFUGE** label in a peaceful settlement.
- Visit a forge to upgrade a firearm, reinforce armor, or craft and equip the Scout, Ranger, and Vanguard armor sets. The forge shows gold, scrap, rare-core costs, and commander requirements. Armor and firearms are earned through campaign progression.
- Open the map to see explored sectors. Click anywhere to set a waypoint, or use the controller-accessible list of discovered locations. Select a discovered friendly destination to reveal its travel option. Travel is unavailable during combat.
- Stand close to a fallen friend and interact to start reviving them. Stay nearby while the rescue completes.

## Follow a mission

Speak to a friendly cat and choose **Any work for us?** to see local dispatches. Each card names the assignment type, describes the actual objective, and shows its direction, distance, and rewards. Choose a job to accept and track it. The journal also provides **Accept & track** and **Show objective on map**. Viewing an objective on the map places a waypoint without starting an unaccepted assignment.

The lower-left field dispatch shows the tracked objective, its target, a compass arrow, and distance. The arrow uses world directions: north is up on the map. Complete the described task; rewards are granted when its conditions are met.

- **Escort:** meet the named ally, then stay near them and protect them along the route. The dispatch shows the ally's health and remaining distance to safety.
- **Defense:** reach the marked settlement and hold the defense area. The dispatch shows elapsed time, the required duration, and the attack wave. Remain inside the marked area while defending it.
- **Assassination:** follow the waypoint to the named enemy officer and defeat that target.
- **Bounty:** hunt the named wanted commander. The journal identifies the assignment and provides its target waypoint.

There are twelve tactical powers to discover as you gain levels. Select the small **Inventory → Abilities** hint in the HUD, or open Inventory and choose Abilities, to inspect every power and equip your primary and secondary slots. Locked powers show their required level; Airstrike and Medic Drop are available from the start.

## Firearm mechanics and forge tuning

Weapon details explain each firearm's mechanic. Heat weapons show a heat gauge and cooling state; charge weapons show charge strength while you hold fire and shoot when you release; heavy spinning barrels show their current spin-up speed. The HUD keeps these indicators beside that hero's ammunition.

At a forge, improve the equipped firearm to **+3** to unlock tuning. Power adds 20% damage with wider spread. Rapid adds 25% fire rate and quicker reloads. Tactical installs the firearm family's special behavior: ricochet pistol rounds, chain effects for SMGs and machine guns, piercing rifles, burning shotgun pellets, or guided rockets. Each tuning pattern costs **400 gold, 18 scrap, and one commander core** to craft for that firearm. Switching between patterns you already crafted is free while visiting a forge. The cards identify the installed pattern and disable options whose rank or supply requirements are unmet.

## Remapping and accessibility

Open **Controls** from the title or pause menu. Select **Player 1 keys** or **Player 2 keys**, choose a binding, and press a replacement key or mouse button. For a controller binding, press the replacement controller button. Escape cancels a pending remap. The controller layout applies to both controllers. A stick-swap button exchanges movement and aim sticks. **Restore default controls** restores both keyboard layouts and the standard controller mapping. Bindings are stored in this browser when browser storage is available.

Open **Settings** for graphics quality, rendering resolution, fullscreen, damage numbers, minimap, and separate music, effect, and interface volume. Fullscreen availability depends on the browser and whether the game is embedded in a permitted frame.

With a controller, move up or down to focus a setting. Left and right change selectors and volume sliders. For a checkbox, left turns it off and right turns it on; A also toggles it. Your setting changes apply immediately. Buttons used to close a menu must be released before they can trigger an in-world action.

## Saves and backups

There are three local campaign slots. The game saves during normal play and after progression changes; **Save campaign** and **Save & return to title** provide explicit save actions. A co-op slot contains both heroes and the shared kingdom state.

Use **Settings → Export campaign** to download a portable JSON backup. To restore one, choose the destination campaign slot on the title screen and open **Settings → Import campaign**. Importing during play replaces the current slot and restores the imported adventure. A valid backup exported by this game is required. Keep a separate backup before importing over a campaign you want to preserve.

Browser local storage is tied to the browser profile, site origin, and sometimes the local file path. Clearing site data or changing how you host the game can make old slots unavailable. Export backups before moving or reinstalling. When the browser refuses persistent storage, the game keeps saves for the current page session and displays a message recommending an export.

## Controller verification

Automated checks cover two simulated standard controllers controlling different players simultaneously, independent movement and aim, held and single-press actions, persistent aim, keyboard/mouse input, and Start opening and closing the menu once per press. Menu rendering, all ability loadouts, both keyboard remapping layouts, save round-trips, invalid imports, and unavailable-storage fallback are also checked.

Run `node tests/input-save.test.cjs` and `node tests/controller-navigation.test.cjs` from the extracted project folder. The navigation suite exercises every field menu, NPC topics and job selection, inventory grid selection and equipment actions, explicit hero buttons, contextual LB / RB tabs, settings focus restoration, Start toggling, and A / B suppression after a menu closes. Graphics selectors, volume limits, checkbox settings, keyboard/mouse rebinding, and saves are covered too.

Physical USB/Bluetooth controllers were not available in the development environment. Device-specific mappings, wireless reconnect behavior, and browser/driver combinations still require a real-device check. For a controller that is detected with a different button order, use the remapping screen. A current desktop browser with standard Gamepad API support is required.



Creature voices follow **Settings → Sound effects**. Nearby cats greet and murmur; mouse troops squeak on alert, attacks, injury and defeat. These calls fade with distance, pan with their position, and are limited to three simultaneous voices.

## Checkpoints, reviving and harpoons · 1.5

Entering a refuge or liberated outpost activates the latest party checkpoint. Solo death or a full-party defeat returns everyone there, restores surviving enemies and spends 5% of carried gold. Completed bosses and assignments remain complete. A single fallen co-op partner stays down: approach within 100 units, press E / B, and stay close while the visible revive bar fills. Moving away, attacking, taking damage or being dragged interrupts recovery. Fast travel requires both fighters standing.

A landed harpoon briefly pulls the struck fighter toward its attacker along a visible rope. Dodge the shot, break line of sight, or interrupt the attacker to avoid or end the pull. Terrain collision blocks dragging through walls.
