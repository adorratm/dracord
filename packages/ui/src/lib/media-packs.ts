export const EMOJI_CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: 'smile',
    label: 'Yüzler',
    emojis: [
      '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😍',
      '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😎', '🤓', '🧐',
      '🤔', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐',
      '😯', '😪', '😫', '🥱', '😴', '😌', '😓', '😕', '🙁',
      '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶',
    ],
  },
  {
    id: 'gestures',
    label: 'İşaretler',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '👏', '🙌',
      '👐', '🤲', '🤝', '🙏', '💪', '🦾', '🖕', '✍️', '💅', '🤳',
    ],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    emojis: [
      '🦇', '🧛', '🩸', '🌙', '⭐', '✨', '🖤', '💜', '🔮', '🪦',
      '🕯️', '🐺', '🕷️', '🕸️', '🎃', '😈', '👿', '👻', '💀', '☠️',
    ],
  },
  {
    id: 'objects',
    label: 'Nesneler',
    emojis: [
      '🔥', '🎉', '🎊', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍',
      '💬', '📎', '📌', '🔔', '🎵', '🎮', '💻', '📱', '☕', '🍕',
    ],
  },
];

/** Turkish + English keywords for emoji search */
export const EMOJI_KEYWORDS: Record<string, string[]> = {
  '😀': ['mutlu', 'gülümse', 'smile', 'happy', 'grin'],
  '😁': ['sırıt', 'grin', 'mutlu'],
  '😂': ['güldür', 'lol', 'ağla gül', 'joy'],
  '🤣': ['kahkaha', 'rofl'],
  '😊': ['tatlı', 'blush', 'mutlu'],
  '😇': ['melek', 'angel', 'masum'],
  '🙂': ['hafif gülümseme', 'slight'],
  '🙃': ['ters', 'upside'],
  '😉': ['göz kırp', 'wink'],
  '😍': ['aşk', 'kalp göz', 'love'],
  '🤩': ['yıldız', 'starstruck'],
  '😘': ['öpücük', 'kiss'],
  '😗': ['öp', 'kiss'],
  '😋': ['lezzetli', 'yum'],
  '😛': ['dil', 'tongue'],
  '😜': ['göz kırp dil', 'wink tongue'],
  '🤪': ['çılgın', 'zany'],
  '😎': ['havalı', 'cool', 'güneş'],
  '🤓': ['inek', 'nerd'],
  '🧐': ['monokl', 'incele'],
  '🤔': ['düşün', 'hmm', 'think'],
  '😐': ['nötr', 'neutral'],
  '😑': ['ifadesiz', 'expressionless'],
  '😶': ['sessiz', 'sus'],
  '🙄': ['göz yuvarla', 'eyeroll'],
  '😏': ['sırıt', 'smirk'],
  '😣': ['rahatsız', 'persevere'],
  '😥': ['üzgün', 'sweat'],
  '😮': ['şaşkın', 'wow', 'open'],
  '🤐': ['fermuar', 'zipper'],
  '😯': ['şaşır', 'hushed'],
  '😪': ['uykulu', 'sleepy'],
  '😫': ['yorgun', 'tired'],
  '🥱': ['esne', 'yawn'],
  '😴': ['uyu', 'sleep', 'zzz'],
  '😌': ['rahat', 'relieved'],
  '😓': ['ter', 'cold sweat'],
  '😕': ['kafası karışık', 'confused'],
  '🙁': ['üzgün', 'frown'],
  '😢': ['ağla', 'cry', 'üzgün'],
  '😭': ['çok ağla', 'sob'],
  '😤': ['öfke', 'huff'],
  '😠': ['kızgın', 'angry'],
  '😡': ['öfkeli', 'rage', 'kızgın'],
  '🤬': ['küfür', 'swear'],
  '🤯': ['patladı', 'mind blown'],
  '😳': ['kızar', 'flushed'],
  '🥵': ['sıcak', 'hot'],
  '🥶': ['soğuk', 'cold', 'freeze'],
  '👍': ['beğen', 'like', 'evet', 'ok', 'thumbsup'],
  '👎': ['beğenme', 'dislike', 'hayır'],
  '👌': ['tamam', 'ok', 'perfect'],
  '✌️': ['zafer', 'peace', 'iki'],
  '🤞': ['şans', 'crossed'],
  '🤟': ['love you', 'aşk'],
  '🤘': ['rock', 'metal'],
  '🤙': ['ara beni', 'call'],
  '👈': ['sol', 'left'],
  '👉': ['sağ', 'right'],
  '👆': ['yukarı', 'up'],
  '👇': ['aşağı', 'down'],
  '☝️': ['işaret', 'point'],
  '✋': ['dur', 'el', 'stop', 'hand'],
  '🤚': ['el ters'],
  '🖐️': ['beş parmak'],
  '🖖': ['vulkan', 'spock'],
  '👋': ['selam', 'bye', 'wave', 'el salla'],
  '👏': ['alkış', 'clap'],
  '🙌': ['eller yukarı', 'hooray'],
  '👐': ['açık el'],
  '🤲': ['avuç'],
  '🤝': ['anlaşma', 'handshake', 'el sık'],
  '🙏': ['lütfen', 'teşekkür', 'dua', 'pray', 'thanks'],
  '💪': ['güç', 'kas', 'strong'],
  '🦾': ['robot kol'],
  '🖕': ['orta parmak'],
  '✍️': ['yaz', 'write'],
  '💅': ['oje', 'nails'],
  '🤳': ['selfie'],
  '🦇': ['yarasa', 'bat', 'dracula'],
  '🧛': ['vampir', 'vampire'],
  '🩸': ['kan', 'blood'],
  '🌙': ['ay', 'moon', 'gece'],
  '⭐': ['yıldız', 'star'],
  '✨': ['parıltı', 'sparkle'],
  '🖤': ['siyah kalp', 'black heart'],
  '💜': ['mor kalp', 'purple'],
  '🔮': ['kristal', 'crystal'],
  '🪦': ['mezar', 'grave'],
  '🕯️': ['mum', 'candle'],
  '🐺': ['kurt', 'wolf'],
  '🕷️': ['örümcek', 'spider'],
  '🕸️': ['ağ', 'web'],
  '🎃': ['balkabağı', 'halloween', 'pumpkin'],
  '😈': ['şeytan gülümse', 'smiling devil'],
  '👿': ['şeytan', 'imp'],
  '👻': ['hayalet', 'ghost'],
  '💀': ['kafatası', 'skull'],
  '☠️': ['korsan', 'poison'],
  '🔥': ['ateş', 'fire', 'hot'],
  '🎉': ['parti', 'party', 'kutlama'],
  '🎊': ['konfeti', 'confetti'],
  '❤️': ['kalp', 'aşk', 'heart', 'kırmızı'],
  '🧡': ['turuncu kalp'],
  '💛': ['sarı kalp'],
  '💚': ['yeşil kalp'],
  '💙': ['mavi kalp'],
  '🤍': ['beyaz kalp'],
  '💬': ['konuşma', 'chat', 'mesaj'],
  '📎': ['ataç', 'paperclip'],
  '📌': ['pin', 'iğne'],
  '🔔': ['zil', 'bildirim', 'bell'],
  '🎵': ['müzik', 'nota', 'music'],
  '🎮': ['oyun', 'game', 'console'],
  '💻': ['bilgisayar', 'laptop', 'pc'],
  '📱': ['telefon', 'phone', 'mobil'],
  '☕': ['kahve', 'coffee', 'çay'],
  '🍕': ['pizza'],
};

export function emojiMatchesQuery(emoji: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  if (emoji.includes(q)) return true;
  const keys = EMOJI_KEYWORDS[emoji] ?? [];
  return keys.some((k) => k.toLocaleLowerCase('tr-TR').includes(q));
}

export interface MediaPackItem {
  id: string;
  label: string;
  /** Unicode sticker or remote GIF/sticker URL */
  value: string;
  kind: 'gif' | 'sticker';
  preview?: string;
}

/** Curated GIFs (public CDN). No API key required. */
export const CURATED_GIFS: MediaPackItem[] = [
  {
    id: 'wave',
    label: 'El salla',
    kind: 'gif',
    value: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  },
  {
    id: 'clap',
    label: 'Alkış',
    kind: 'gif',
    value: 'https://media.giphy.com/media/7rj2ZgEhHNtbK/giphy.gif',
  },
  {
    id: 'party',
    label: 'Parti',
    kind: 'gif',
    value: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  {
    id: 'cat',
    label: 'Kedi',
    kind: 'gif',
    value: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  },
  {
    id: 'wow',
    label: 'Şaşkın',
    kind: 'gif',
    value: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  },
  {
    id: 'yes',
    label: 'Evet',
    kind: 'gif',
    value: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'no',
    label: 'Hayır',
    kind: 'gif',
    value: 'https://media.giphy.com/media/6Q2KA5ly49368/giphy.gif',
  },
  {
    id: 'love',
    label: 'Aşk',
    kind: 'gif',
    value: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  {
    id: 'dance',
    label: 'Dans',
    kind: 'gif',
    value: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
  },
  {
    id: 'coffee',
    label: 'Kahve',
    kind: 'gif',
    value: 'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',
  },
  {
    id: 'typing',
    label: 'Yazıyor',
    kind: 'gif',
    value: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGfc/giphy.gif',
  },
  {
    id: 'vampire',
    label: 'Vampire',
    kind: 'gif',
    value: 'https://media.giphy.com/media/xT0xeJpnW6k61nz1Au/giphy.gif',
  },
];

/** Large sticker-style packs — emoji + animated GIF/WebP URLs. */
export const STICKER_PACKS: { id: string; label: string; stickers: MediaPackItem[] }[] = [
  {
    id: 'dracula',
    label: 'Dracula',
    stickers: [
      ...['🦇', '🧛', '🩸', '🌙', '🖤', '💜'].map((emoji, i) => ({
        id: `dra-e-${i}`,
        label: emoji,
        value: emoji,
        kind: 'sticker' as const,
      })),
      {
        id: 'dra-bat-spin',
        label: 'Bat',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif',
      },
      {
        id: 'dra-moon',
        label: 'Ay',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
      },
      {
        id: 'dra-ghost',
        label: 'Hayalet',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/14uQ3cOFteDaU/giphy.gif',
      },
      {
        id: 'dra-sparkle',
        label: 'Parıltı',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
      },
      {
        id: 'dra-flame',
        label: 'Alev',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
      },
      {
        id: 'dra-heart',
        label: 'Kalp',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
      },
    ],
  },
  {
    id: 'react',
    label: 'Tepkiler',
    stickers: [
      ...['🔥', '✨', '💯', '✅', '👏', '❤️'].map((emoji, i) => ({
        id: `re-e-${i}`,
        label: emoji,
        value: emoji,
        kind: 'sticker' as const,
      })),
      {
        id: 're-clap',
        label: 'Alkış',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/7rj2ZgEhHNtbK/giphy.gif',
      },
      {
        id: 're-wow',
        label: 'Wow',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
      },
      {
        id: 're-party',
        label: 'Parti',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
      },
      {
        id: 're-yes',
        label: 'Evet',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
      },
      {
        id: 're-no',
        label: 'Hayır',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/12XMGIWtrFZBlu/giphy.gif',
      },
      {
        id: 're-wave',
        label: 'El salla',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
      },
    ],
  },
  {
    id: 'motion',
    label: 'Hareket',
    stickers: [
      {
        id: 'mo-cat',
        label: 'Kedi',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      },
      {
        id: 'mo-typing',
        label: 'Yazıyor',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGfc/giphy.gif',
      },
      {
        id: 'mo-dance',
        label: 'Dans',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
      },
      {
        id: 'mo-laugh',
        label: 'Gül',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
      },
      {
        id: 'mo-cry',
        label: 'Ağla',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/ROF8OQvDmxhdm/giphy.gif',
      },
      {
        id: 'mo-thumb',
        label: 'Beğen',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
      },
      {
        id: 'mo-vampire',
        label: 'Vampire',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/xT0xeJpnW6k61nz1Au/giphy.gif',
      },
      {
        id: 'mo-spark',
        label: 'Kıvılcım',
        kind: 'sticker',
        value: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
      },
    ],
  },
];

export function isMediaUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('data:image') || value.startsWith('/');
}

export function mediaItemMatchesQuery(item: { label: string; value: string }, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  if (item.label.toLocaleLowerCase('tr-TR').includes(q)) return true;
  if (item.value.toLocaleLowerCase('tr-TR').includes(q)) return true;
  if (emojiMatchesQuery(item.value, q)) return true;
  return false;
}
