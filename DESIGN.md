# Betty's It — Design Brief

A first-person horror-lite game designed by Sophie Schmid (age 10), built as a web-native prototype for iPad Safari. Dad is producing; Claude Code is engineering. Honor the design — it's her game.

## Premise
Betty is "it." She is an evil tagger hunting you through a big mansion with her baking supplies. You play as Not Betty. Finish your 10 tasks before the 5-minute timer runs out. When the timer expires, Betty hunts you relentlessly — and the final task begins.

## Tech constraints
- **Three.js via CDN importmap. No build step.** Plain `index.html` + ES modules. Every `git push` deploys via GitHub Pages.
- Target: iPad Safari, landscape. Must also run on desktop (WASD + mouse look) for testing.
- iOS audio requires a user gesture: the "Tap to begin" title screen unlocks the AudioContext.
- All art will be billboarded 2D sprites (transparent PNGs) supplied later. **Until then, use placeholder geometry** (gray boxes, colored planes) with labels. Structure the code so swapping in sprite textures is trivial (one asset manifest file).

## Screens
1. **Title screen**: "Betty's It" title (placeholder text until Sophie's lettering arrives), "Created by Sophie Schmid" underneath, "🎧 Headphones recommended", and "Tap to begin" (this tap unlocks audio).
2. **Game**: first-person view, HUD (timer, task checklist toggle, current task hint).
3. **Game over**: Betty caught you — "You disappear forever." Retry button.
4. **Victory**: you escaped with the knife. Play-again button.

## Controls
- **iPad**: left half of screen = virtual move stick (touch-drag), right half = look drag. On-screen "Interact" button appears when near an interactable.
- **Desktop**: WASD + pointer-lock mouse look, E or click to interact.

## The mansion
- Single floor plus an attic, laid out for a satisfying "full lap": rooms connected by hallways in a loop. Rooms (minimum): starting guest bedroom, kitchen, library, dining room, garden room, basement stairs/basement, attic stairs/attic, entry hall with front door.
- Doors: interactable, open/close. **Closed doors are safe — Betty cannot open doors.** Halls are dangerous.
- Keep geometry simple: box rooms, corridor segments, door frames. Dim lighting; final minute goes darker (flashlight task matters).

## Betty (the AI)
A billboarded sprite (placeholder: a red box with a face label) with three states:
1. **Roaming**: patrols hallways on a waypoint loop. Emits a positional **rumbling** sound — louder as she nears, muffled through closed doors. She cannot enter rooms with closed doors.
2. **Chasing**: triggered if she sees the player in a hallway (simple line-of-sight + distance cone), or permanently once the timer expires. She **screams** (looping chase audio) and pathfinds toward the player. Slightly slower than the player's max speed — the player should win footraces but feel terror.
3. **Capture**: within grab radius → screen-grab moment → game over. Be slightly generous to the player on the radius (tune for a 10-year-old).

## The 10 tasks
Shown as a checklist; mostly sequential with light flexibility. Interact prompts when near the object.
1. **Find the key and escape the guest bedroom** you start locked in.
2. **Sneak to the kitchen and grab a snack** — you need energy to outrun Betty later.
3. **Turn off the oven** — burning cookies; if ignored too long, the smoke alarm reveals your location (nice-to-have; can stub).
4. **Find the mansion map in the library** — reveals a minimap or layout hint.
5. **Run a full lap to the attic (furthest room)** — the front door key is hidden in an old trunk there.
6. **Steal a cookie off Betty's baking tray** — get close to Betty without being seen; she'll be distracted counting cookies during the finale (grants a head start).
7. **Unlock the back gate from the garden room** — opens the escape route for the finale.
8. **Grab the flashlight from the basement** — halls go dark in the final minute.
9. **Prop open the hallway doors along the escape path** — removes door-opening delays during the final chase.
10. **FINALE — Steal Betty's cooking knife and escape the mansion.** This task only begins after the 5-minute timer expires, so Betty is in permanent chase mode. Grab the knife (kitchen), sprint the prepared route, exit through the back gate. Escaping = victory.

## Timer
- 5:00 countdown, prominent in the HUD.
- Tasks 1–9 happen inside the window. Timer hitting 0:00 is not a loss — it's the finale trigger. If tasks 1–9 aren't done when time expires, the player can still attempt them, but Betty is now hunting (hard mode by natural consequence).

## Audio (the star of the show)
- Positional rumble for roaming Betty (Web Audio PannerNode), muffled lowpass through closed doors.
- Scream on chase trigger + chase loop.
- Door creaks, task-complete chime, heartbeat when Betty is within X meters.
- Background creepy music track: Dad will supply the file; wire up a slot for `music.mp3` with a volume that ducks under the scream.
- Use free placeholder SFX or synthesized tones until real assets arrive.

## Difficulty (tuned for a 10-year-old)
- Betty slower than player. Generous forgiveness on capture radius. Chase de-aggros if the player closes a door between them (she resumes roaming after a cooldown).
- Optional mercy mechanic if playtesting says it's too scary: hide under furniture in rooms.

## Asset pipeline (later)
A single `assets/manifest.js` mapping named slots → image/audio files: `betty_roam.png`, `betty_chase.png`, `knife.png`, `key.png`, `title.png`, portraits, door, window, wallpaper, gameover.png, victory.png, plus audio files. Placeholders render wherever a file is missing, so art can land incrementally.

## Milestones
1. Mansion + first-person controls (desktop, then touch) + doors.
2. Timer + task system with all 10 tasks stubbed.
3. Betty: roaming + audio + chase + capture.
4. Finale sequence + win/lose screens + title screen.
5. Polish: darkness curve, heartbeat, difficulty tuning, sprite swap-in.
