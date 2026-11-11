# Co-op personal menus

Inventory and Skills have separate player-owned panels in local co-op. Both can be open at once; each keeps its own gear category, selected item, ability category, scroll position and controller focus. Player 1 uses the left panel and Player 2 the right. Narrow screens stack the two panels with independent scrolling.

Gameplay pauses while either personal panel is open. A hero who closes their panel waits safely for their teammate. The last panel closing resumes play. This prevents enemies or cooldown timers from advancing while players prepare.

| Input | Player 1 | Player 2 |
| --- | --- | --- |
| Open/toggle Inventory | I | Number-pad Divide |
| Open/toggle Skills | K | Number-pad Multiply |
| Move menu focus | WASD | Arrow keys |
| Select | Enter | Number-pad Enter |
| Close own panel | Backspace | Number-pad Subtract |

Each controller operates the hero assigned to it. View/Select opens or toggles that hero’s Inventory. When personal menus are visible, Y opens Skills; A selects, B or Start closes only that hero’s panel, and LB/RB changes categories. The Inventory/Skills buttons switch only their owning panel. A closed panel also has mouse buttons to open either menu. Player 2’s two new shortcuts can be remapped under Controls → Player 2 keys.

Escape and the shared Camp & settings button open the global menu. Open personal panels are suspended in place; returning restores both, including selections and scroll. Global shops and forges remain shared, but actions use the hero controlling them and refresh that hero’s requirements. Mouse users retain the existing player selector on those shared screens. Solo inventory and controls retain their existing behavior.

Equipment, learned abilities, passive training, skill points, ranks and ability cooldowns stay on each hero’s existing save record. Resting Player 2 keeps their own record and recovers it on rejoining. New Frost Breath and Aurora Well IDs remain in the normal learned-ability list and preserve their separate quest-claim ledger. Open overlays, focus references and scroll positions are transient and are cleared on campaign load/start; they are never stored on a hero or added to save data.

Implementation: `js/ui/coop-menus.js` and `css/coop-menus.css`, loaded after other UI extensions. Three optional input hooks route pad events, keyboard snapshots and native Enter suppression before the old shared menu handling. No changes to equipment or skill mutation methods are needed. Each personal view has a fixed owner, isolated host, unique accessibility IDs, and independent focus. Stale views cannot mutate heroes after load, rest, or rejoin.

Validation: `node tests/coop-menus.test.cjs` exercises the real UI and input handlers, mouse routing, two controller frames, keyboard confirmation, owner-specific learning/equipping/rank refunds, shared-menu suspension, save/export/import, cold-ability indices, reserve/rejoin, failed loads and solo compatibility. A small DOM model supplies element ownership, bubbling, selectors, focus and scroll state. Browser rendering has not been visually verified in this session.
