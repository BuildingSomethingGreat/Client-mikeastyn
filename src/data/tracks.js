// The catalogue. One entry per song; everything the player, the Buy button,
// the lyrics view and analytics need hangs off the track `id`.
//
// To add full-length audio later, set `src` to the full file and `previewLength` to null.
// To switch a Buy button on, set `buy.url` to the product link.
// To add lyrics, fill `lyrics.lines` with { t: seconds, text } and set `lyrics.synced: true`.

export const ARTIST = 'Mike Astyn';

export const tracks = [
  {
    id: 'not-going-back-live',
    title: 'Not Going Back (Live)',
    artist: 'Mike Astyn',
    credit: 'Single',
    year: 2025,
    art: '/art/not-going-back.webp',
    src: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7d/e9/fb/7de9fbce-a565-13b8-72bf-fc41066cad10/mzaf_15545560386970381447.plus.aac.p.m4a',
    previewLength: 30,
    fullLength: 275,
    apple: 'https://music.apple.com/us/album/not-going-back-live-single/1789263157',
    buy: { available: true, url: null },
    lyrics: null,
  },
  {
    id: 'silent-night',
    title: 'Silent Night',
    artist: 'Howard B Thy Name 7',
    feat: 'feat. Mike Astyn',
    credit: 'Feature',
    year: 2024,
    art: '/art/silent-night.webp',
    src: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ac/32/88/ac32881b-9810-2fd5-4a31-83bf4cd12c85/mzaf_13214080953459742875.plus.aac.p.m4a',
    previewLength: 30,
    fullLength: 207,
    apple: 'https://music.apple.com/us/album/silent-night-feat-mike-astyn-single/1787943462',
    buy: { available: false, url: null },
    // Traditional words (Joseph Mohr, English by J. F. Young, 1859; public domain).
    // Not timed to this recording, so the view paces them evenly.
    lyrics: {
      synced: false,
      note: 'Traditional words. This recording’s arrangement may differ.',
      lines: [
        { text: 'Silent night, holy night' },
        { text: 'All is calm, all is bright' },
        { text: 'Round yon Virgin Mother and Child' },
        { text: 'Holy Infant so tender and mild' },
        { text: 'Sleep in heavenly peace' },
        { text: 'Sleep in heavenly peace' },
      ],
    },
  },
  {
    id: 'here-i-am',
    title: 'Here I Am',
    artist: 'Marcus Williams',
    feat: 'feat. Mike Astyn',
    credit: 'Feature',
    year: 2020,
    art: '/art/here-i-am.webp',
    src: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/8d/f4/cc/8df4cc98-b98b-eebb-3de8-a645240ce1c1/mzaf_14098601084307489031.plus.aac.p.m4a',
    previewLength: 30,
    fullLength: 301,
    apple: 'https://music.apple.com/us/album/here-i-am-feat-mike-astyn/1519578905?i=1519579082',
    buy: { available: false, url: null },
    lyrics: null,
  },
  {
    id: 'til-i-die',
    title: 'Til I Die',
    artist: 'Mike Astyn',
    credit: 'Single',
    year: 2019,
    art: '/art/til-i-die.webp',
    src: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/e7/37/c4/e737c49b-dd59-2027-7586-14b6acb508b6/mzaf_9744322334625526488.plus.aac.p.m4a',
    previewLength: 30,
    fullLength: 298,
    apple: 'https://music.apple.com/us/album/til-i-die-single/1451817223',
    buy: { available: true, url: null },
    lyrics: null,
  },
];

export const trackById = (id) => tracks.find((t) => t.id === id) || null;

export const byline = (t) => (t.feat ? `${t.artist} ${t.feat}` : t.artist);

export const fmtTime = (s) => {
  const v = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};
