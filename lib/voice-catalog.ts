export type VoiceGender = 'male' | 'female'

export const VOICE_CATALOG: Record<
  string,
  { label: string; description: string; gender: VoiceGender }
> = {
  raspy_lumberjack: {
    gender: 'male',
    label: 'Raspy Lumberjack',
    description:
      'A deep chest voice with a dry, weathered rasp on the vowels—think cold air and pine resin—speaking at a measured, slightly slow pace with audible breaths between clauses, relaxed jaw, minimal vibrato, and consonants that land soft but clear.',
  },
  npr_radio_host: {
    gender: 'male',
    label: 'NPR Radio Host',
    description:
      'Warm mid-range baritone with a polished, intimate broadcast closeness; steady pacing with gentle downward inflections at phrase ends, subtle smile in the tone, very controlled breath noise, and crisp but never shouty consonants.',
  },
  hyper_gamer_streamer: {
    gender: 'male',
    label: 'Hyper Gamer Streamer',
    description:
      'Bright, slightly nasal energy with fast micro-bursts of words, upward pitch lifts on excitement, quick inhales through the nose before hype moments, occasional staccato emphasis, and a playful half-yell that never quite breaks.',
  },
  warm_grandmother: {
    gender: 'female',
    label: 'Warm Grandmother',
    description:
      'Soft alto with pillowy, breath-forward tone and slow, reassuring rhythm; slightly airy on sibilants, gentle elongation of comforting words, quiet chuckles that sit above the breath line, and a cozy proximity like speaking beside your ear.',
  },
  crisp_documentary_narrator: {
    gender: 'male',
    label: 'Documentary Narrator',
    description:
      'Neutral, authoritative tenor with tight articulation and even spacing between phrases; dry mouth minimal, steady volume, slight forward placement in the mask, and declarative endings with no sing-song—pure PBS clarity.',
  },
  soft_asmr_whisperer: {
    gender: 'female',
    label: 'Soft ASMR Whisperer',
    description:
      'Close-mic intimacy with whisper-adjacent volume, long airy fricatives, very slow pacing, deliberate pauses, subtle lip smacks kept minimal, and a feather-light sibilance that stays consistent across sentences.',
  },
  upbeat_morning_show_host: {
    gender: 'female',
    label: 'Morning Show Host',
    description:
      'Bright, sunny head-voice forward placement with bouncy rhythm, quick friendly cadence, crisp dental consonants, infectious upward lilt on greetings, and controlled pep without shrillness—coffee-commercial optimism.',
  },
  gravelly_film_trailer_voice: {
    gender: 'male',
    label: 'Trailer Voice',
    description:
      'Low gravel with chest resonance and dramatic pauses; husky fry on low notes, slow heroic pacing, cinematic reverb-friendly tone, and punchy plosives that hit like a thud—epic but still intelligible.',
  },
}

export function buildVoicePrompt(voiceCharacterId: string, dialogue: string): string {
  const voice = VOICE_CATALOG[voiceCharacterId]
  if (!voice) throw new Error(`Unknown voice character: ${voiceCharacterId}`)
  return `Narrate in the voice of: ${voice.description}. Say exactly the following words and no others: "${dialogue}"`
}
