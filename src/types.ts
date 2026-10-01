export interface NoteItem {
  id: string
  name: string
  solfege: string
  flatName: string
  flatSolfege: string
  semitoneOffset: number // 0 = C, 1 = C#, 2 = D ...
  isAccidental: boolean
}

export const ALL_NOTES: NoteItem[] = [
  { id: 'C', name: 'C', solfege: 'Dó', flatName: 'C', flatSolfege: 'Dó', semitoneOffset: 0, isAccidental: false },
  { id: 'C#', name: 'C#', solfege: 'Dó#', flatName: 'Db', flatSolfege: 'Réb', semitoneOffset: 1, isAccidental: true },
  { id: 'D', name: 'D', solfege: 'Ré', flatName: 'D', flatSolfege: 'Ré', semitoneOffset: 2, isAccidental: false },
  { id: 'D#', name: 'D#', solfege: 'Ré#', flatName: 'Eb', flatSolfege: 'Mib', semitoneOffset: 3, isAccidental: true },
  { id: 'E', name: 'E', solfege: 'Mi', flatName: 'E', flatSolfege: 'Mi', semitoneOffset: 4, isAccidental: false },
  { id: 'F', name: 'F', solfege: 'Fá', flatName: 'F', flatSolfege: 'Fá', semitoneOffset: 5, isAccidental: false },
  { id: 'F#', name: 'F#', solfege: 'Fá#', flatName: 'Gb', flatSolfege: 'Solb', semitoneOffset: 6, isAccidental: true },
  { id: 'G', name: 'G', solfege: 'Sol', flatName: 'G', flatSolfege: 'Sol', semitoneOffset: 7, isAccidental: false },
  { id: 'G#', name: 'G#', solfege: 'Sol#', flatName: 'Ab', flatSolfege: 'Láb', semitoneOffset: 8, isAccidental: true },
  { id: 'A', name: 'A', solfege: 'Lá', flatName: 'A', flatSolfege: 'Lá', semitoneOffset: 9, isAccidental: false },
  { id: 'A#', name: 'A#', solfege: 'Lá#', flatName: 'Bb', flatSolfege: 'Sib', semitoneOffset: 10, isAccidental: true },
  { id: 'B', name: 'B', solfege: 'Si', flatName: 'B', flatSolfege: 'Si', semitoneOffset: 11, isAccidental: false },
]

export const PRESETS = [
  { id: 'naturals', label: 'Naturais (C, D, E, F, G, A, B)', notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  { id: 'triad_c', label: 'Tríade Maior C (C, E, G)', notes: ['C', 'E', 'G'] },
  { id: 'pentatonic', label: 'Pentatônica (C, D, E, G, A)', notes: ['C', 'D', 'E', 'G', 'A'] },
  { id: 'all', label: 'Todas as 12 notas (Cromática)', notes: ALL_NOTES.map(n => n.id) },
]
