// Betty's It — asset manifest.
// Drop a file at any of these paths and the game uses it automatically;
// anywhere a file is missing, a labeled placeholder renders instead.
// NOTE (design v2): pixel Betty is retired. betty_* slots now point at the
// upcoming hand-drawn art in assets/ root; until those files land, canvas
// placeholders render. Environment/prop pixel art stays as temporary stand-ins.
const P = 'assets/prop_sprites/', E = 'assets/env_assets/';

export const MANIFEST = {
  images: {
    // screens (pending art)
    title:        'assets/title.png',
    gameover:     'assets/gameover.png',
    victory:      'assets/victory.png',
    // Betty — hand-drawn, single pose (chase pose later)
    betty_roam:   'assets/betty_roam.png',
    betty_chase:  'assets/betty_chase.png',     // lands later; roam pose reused until then
    betty_hero:   'assets/betty_hero.png',      // title art, pending
    betty_victory:'assets/betty_victory.png',   // game-over art, pending
    // first-person hands (drawing coming)
    hands:        'assets/hands.png',
    rolling_pin:  'assets/rolling_pin.png',     // held-item + pickup art, pending
    // task props (temporary pixel stand-ins)
    key:          P + 'key.png',
    cookie:       P + 'cookie.png',
    cookie_tray:  P + 'cookie_tray.png',
    oven:         P + 'oven.png',
    mansion_map:  P + 'mansion_map.png',
    trunk:        P + 'trunk.png',
    flashlight:   P + 'flashlight.png',
    back_gate:    P + 'back_gate.png',
    knife:        P + 'knife.png',
    // environment (temporary pixel stand-ins)
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
