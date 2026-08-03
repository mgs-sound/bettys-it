// Betty's It — asset manifest (final art, smooth illustrations).
// Drop a file at any of these paths and the game uses it automatically;
// anywhere a file is missing, a placeholder renders instead.
const B = 'assets/betty/', HA = 'assets/hands/', P = 'assets/props/';
const E = 'assets/env/', F = 'assets/furniture/';

export const MANIFEST = {
  images: {
    // screens
    title:          'assets/title.png',          // Sophie's lettering (still pending)
    // Betty — always camera-facing; chase flipbook alternates a/b at 6fps
    betty_roam:     B + 'betty_roam.png',
    betty_chase_a:  B + 'betty_chase.png',
    betty_chase_b:  B + 'betty_chase_b.png',     // frame B pending; procedural-only until it lands
    betty_gameover: B + 'betty_gameover.png',    // game-over screen art
    // first-person hands — full overlay, swapped by held item
    hands_empty:      HA + 'hands_empty.png',
    hands_flashlight: HA + 'hands_flashlight.png',
    hands_knife:      HA + 'hands_knife.png',
    hands_pin:        HA + 'hands_pin.png',
    // task props
    key:          P + 'key.png',
    cookie:       P + 'cookie.png',
    cookie_tray:  P + 'cookie_tray.png',
    oven:         P + 'oven.png',
    mansion_map:  P + 'mansion_map.png',
    trunk:        P + 'trunk.png',
    flashlight:   P + 'flashlight.png',
    back_gate:    P + 'back_gate.png',
    knife:        P + 'knife.png',
    rolling_pin:  'assets/rolling_pin.png',      // pickup art pending (held view uses hands_pin)
    // furniture — flat planes with colliders
    bed:        F + 'bed.png',
    cabinet:    F + 'cabinet.png',
    dresser:    F + 'dresser.png',
    table:      F + 'table.png',
    chair:      F + 'chair.png',
    bookshelf:  F + 'bookshelf.png',
    // environment
    wallpaper:    E + 'wallpaper.png',
    floor_wood:   E + 'floor_wood.png',
    floor_carpet: E + 'floor_carpet.png',
    door:         E + 'door.png',
    window:       E + 'window.png',
    portrait_1:   E + 'portrait_1.png',
    portrait_2:   E + 'portrait_2.png',
    portrait_3:   E + 'portrait_3.png',
  },
  audio: {
    music:       'assets/music.mp3',        // Dad's creepy track — ducks under the scream
    rumble:      'assets/rumble.mp3',
    scream:      'assets/scream.mp3',
    chase:       'assets/chase.mp3',
  },
};
