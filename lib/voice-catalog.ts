export const VOICE_CATALOG: Record<string, { label: string; description: string }> = {
  woodland_gnome_scholar: {
    label: 'Woodland Gnome Scholar',
    description:
      'A cheerful, lightly raspy voice of an ancient woodland gnome who has been teaching forest creatures for three centuries, speaking with warm gravitas and a small happy chuckle at the end of sentences',
  },
  ocean_mermaid_sage: {
    label: 'Ocean Mermaid Sage',
    description:
      'A smooth, resonant voice of a deep-sea mermaid scholar, speaking with a gentle lilting cadence, as if each word is carried by a slow warm current beneath the waves',
  },
  sun_sprite_enthusiast: {
    label: 'Sun Sprite Enthusiast',
    description:
      'A bright, melodic voice of a tiny sun-sprite who vibrates with warm energy, speaking at a pace just slightly faster than human out of pure excited joy for sharing knowledge',
  },
  sky_guardian_wise: {
    label: 'Sky Guardian',
    description:
      'A gentle, airy voice of a cloud-weaving sky guardian who has watched civilizations rise and fall, speaking with patient cosmic calm and a soft echo like wind through mountain peaks',
  },
  mountain_giant_soft: {
    label: 'Mountain Giant',
    description:
      'A warm, low-rumbling voice of a kindly mountain giant who learned to speak softly after accidentally startling too many valley villages, now permanently hushed yet full of deep vibrant warmth',
  },
  crystal_cave_wizard: {
    label: 'Crystal Cave Wizard',
    description:
      'A crisp, slightly echoing voice of an ancient wizard who has lived inside a crystal cave so long that every word carries a faint harmonic resonance, always measured and mysteriously joyful',
  },
}

// Veo voice prompt builder
export function buildVoicePrompt(voiceCharacterId: string, dialogue: string): string {
  const voice = VOICE_CATALOG[voiceCharacterId]
  if (!voice) throw new Error(`Unknown voice character: ${voiceCharacterId}`)
  return `Narrate in the voice of: ${voice.description}. Say exactly the following words and no others: "${dialogue}"`
}
