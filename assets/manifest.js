// Betty's It — asset manifest.
// Drop a file at any of these paths and the game uses it automatically;
// anywhere a file is missing, a labeled placeholder renders instead.
const B = 'assets/betty_sprites/', P = 'assets/prop_sprites/', E = 'assets/env_assets/';

export const MANIFEST = {
  images: {
    // screens
    title:        'assets/title.png',          // Sophie's hand lettering (pending)
    gameover:     'assets/gameover.png',       // (pending)
    victory:      'assets/victory.png',        // (pending)
    // Betty — directional views + animation frames
    betty_front:   B + 'betty_front.png',
    betty_side:    B + 'betty_side.png',       // drawn facing screen-left
    betty_back:    B + 'betty_back.png',
    betty_34front: B + 'betty_34front.png',
    betty_34back:  B + 'betty_34back.png',
    betty_idle:    B + 'betty_idle.png',
    betty_walk1:   B + 'betty_walk1.png',
    betty_walk2:   B + 'betty_walk2.png',
    betty_attack:  B + 'betty_attack.png',
    betty_hurt:    B + 'betty_hurt.png',       // unused for now
    betty_jump:    B + 'betty_jump.png',       // unused for now
    betty_victory: B + 'betty_victory.png',    // game-over screen art
    betty_death:   B + 'betty_death.png',      // unused for now
    betty_hero:    B + 'betty_hero.png',       // title screen art
    rolling_pin:   B + 'rolling_pin.png',
    effect_hit:    B + 'effect_hit.png',
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
