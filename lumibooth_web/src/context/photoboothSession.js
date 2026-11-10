export const layouts = [
  { id: '1-photo', name: 'Single Photo', count: 1, columns: 1 },
  { id: '2-photo', name: 'Dual Strip', count: 2, columns: 1 },
  { id: '3-photo', name: 'Triple Strip', count: 3, columns: 1 },
  { id: '4-grid', name: '4-Grid Classic', count: 4, columns: 2 },
  { id: '6-grid', name: '6-Grid Wide', count: 6, columns: 2 },
];

export function createSession(layout) {
  return { layout, photos: [], frame: null, stickers: [], output: null };
}

export function sessionReducer(session, action) {
  switch (action.type) {
    case 'start':
      return createSession(action.layout);
    case 'reset':
      return null;
    case 'capture':
      if (!session || !action.photo || session.photos.length >= session.layout.count) {
        return session;
      }
      return { ...session, photos: [...session.photos, action.photo] };
    case 'edit':
      return session && { ...session, ...action.changes, output: null };
    case 'export':
      return session === action.session ? { ...session, output: action.output } : session;
    default:
      return session;
  }
}
