export const layouts = [
  { id: '1-photo', name: 'Single Photo', count: 1, columns: 1 },
  { id: '2-photo', name: 'Dual Strip', count: 2, columns: 1 },
  { id: '3-photo', name: 'Triple Strip', count: 3, columns: 1 },
  { id: '4-grid', name: '4-Grid Classic', count: 4, columns: 2 },
  { id: '6-grid', name: '6-Grid Wide', count: 6, columns: 2 },
];

export function createSession(layout) {
  return { layout, photos: [], motions: [], designRevision: 0, frame: null, caption: null, signatureFont: null, stickers: [], output: null };
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
      return {
        ...session,
        photos: [...session.photos, action.photo],
        motions: [...session.motions, action.motion ?? null],
        designRevision: session.designRevision + 1,
      };
    case 'motionResult': {
      const index = session?.motions.findIndex((motion) => motion?.id === action.id && motion.status === 'pending');
      if (index == null || index < 0) return session;
      const motions = [...session.motions];
      motions[index] = {
        ...motions[index],
        status: action.gif ? 'ready' : 'unavailable',
        gif: action.gif,
      };
      return { ...session, motions };
    }
    case 'discardMotion': {
      const statuses = action.pendingOnly ? ['pending'] : ['pending', 'ready'];
      if (!session?.motions.some((motion) => statuses.includes(motion?.status))) return session;
      return {
        ...session,
        motions: session.motions.map((motion) => statuses.includes(motion?.status)
          ? { ...motion, status: 'unavailable', gif: null }
          : motion),
      };
    }
    case 'edit':
      return session && {
        ...session,
        ...action.changes,
        designRevision: session.designRevision + 1,
        output: null,
      };
    case 'export':
      return session && action.session &&
        session.photos === action.session.photos && session.designRevision === action.session.designRevision
        ? { ...session, output: action.output }
        : session;
    default:
      return session;
  }
}
