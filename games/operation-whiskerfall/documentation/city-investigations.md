# The occupied-city cases

Open the Field Journal and choose **Occupied-city investigations** to read either briefing. A locked case names the campaign milestone that opens the tram. **Pin the next campaign milestone** returns to the main dossier. Once you have clearance, the map leads to the right platform. Both heroes travel together.

| City | Clearance and approach | Investigation |
|---|---|---|
| Ironveil City | File **Last Car on the Siding** from Cinder Rail Depot. Board the freight tram in Ashford Refuge. | Meet Timekeeper Vela at the Union station shelter. Discover which shift vanished, follow its signal chain, then identify the freight car carrying the workers. [Ironveil briefing at 720p](media/ironveil-case.webp) |
| Blackglass Borough | Defeat the eight commanders and open the Blackglass courtyard through the dossier, or Continue a campaign that already earned Berlin clearance. Take the night tram from Dawnbridge. | Meet Choirmaster Ivo at the night tram shelter. Separate the false toll from the real bell, identify the relay operator and find a gap in the curfew patrol. [Blackglass briefing at 1080p](media/blackglass-case.webp) |

At the briefing shelter, press the field **Interact** binding and choose **Accept the investigation**. Each of the three clues has two physical sources. The journal gives both addresses and lets you pin either source. A circle marks the observation and a diamond marks the duplicate record. Use **Show district map** to see both.

* Stay at an observation for three seconds and out of the alerted watch’s sight. Moving away, taking damage or being spotted interrupts the current observation. Return to the lookout or recover the duplicate.
* At the record site, defeat its guards and interact again. A second hero brings an additional guard in Ironveil. Blackglass fields a pair even in solo play.
* Compare the details in the source and select a conclusion with Confirm. An incorrect conclusion keeps the record open. Back returns to the street. The player who inspected the source owns its controller replies.
* Each confirmed conclusion enters the case notebook immediately and survives retreat, defeat, save and Continue. Either hero can handle the next clue. Confirming a clue recalls that posting’s remaining record guards.
* Take the three conclusions to the extraction point. In Ironveil, the resistance pays each hero 360 coins and 18 scrap. Blackglass pays 480 coins and 18 scrap. The debrief includes a resting second hero and settles once.
* After reporting, the workers’ freight lift or the choir’s undercroft connects the briefing shelter and extraction point in both directions. Bring both heroes to either end and select the passage from the case file. Returning residents meet the party at extraction.

The two city cases keep separate records from the twelve canonical operations. Their rewards and permanent local routes stay available after the credits. The main ending returns the party to Dawnbridge.

## Walking the districts

Ironveil’s freight warehouses follow the rail sidings. Rows of workers’ homes face the canal, with five bridges leading to the market and clockmakers’ shops. In Blackglass the ministry faces a civic square, while the newspaper offices, radio exchange and embassy blocks open onto smaller lanes. Each city has four named quarters and 48 planned blocks. The street name and quarter appear in the HUD. The circular radar draws the street plan beneath both heroes and their waypoint.

Each city has 24 pedestrians. Eight named residents will stop to speak about their work and the neighborhood. The freight tram, night mail and lock barge run their own routes. Nearby civilians take shelter when they hear a gunshot or a watch whistle and resume their errands when the disturbance ends. The guard who hears the shot remembers its origin. Break the flashlight beam behind masonry, then leave that position to end the search.

[Ironveil canal crossing](media/ironveil-canal-crossing.webp) · [Blackglass civic square](media/blackglass-civic-streets.webp) · [Two heroes walking Ironveil](media/ironveil-street-walk.webm)

## Verification

Run `node tests/city-investigations.cjs` with Playwright and a local Chrome executable. Its 116 passing checks exercised both approaches for all six clues, incorrect deductions, a locally retried observation, physically guarded recovery, source ownership, both city gates and trams, extraction, the permanent return passage, save restoration and one-time payment to a resting partner. Travel between neighborhood sources, combat damage and the prerequisite main campaign were accelerated. Set `CITY_CAPTURE` to a directory to capture the live case windows at 1280 × 720 and 1920 × 1080.

The two-controller Chrome run used the epilogue and credits controls to return to Dawnbridge. Both heroes boarded the night tram, accepted the Blackglass investigation, pinned its first street lead and returned to Dawnbridge together. The fixture staged earned Berlin clearance and moved the heroes to the platforms and shelter. A separate chronological campaign run earned the prerequisite. Run `node tests/recon-pad-browser.cjs` and `node tests/recon-campaign.cjs` to repeat these checks.
