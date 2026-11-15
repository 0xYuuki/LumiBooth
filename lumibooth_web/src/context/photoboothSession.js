import { normalizeCrop } from '../pages/user/photoCrop.js';

export const layouts = [
  { id: '1-photo', name: 'Single Photo', count: 1, columns: 1 },
  { id: '2-photo', name: 'Dual Strip', count: 2, columns: 1 },
  { id: '3-photo', name: 'Triple Strip', count: 3, columns: 1 },
  { id: '4-grid', name: '4-Grid Classic', count: 4, columns: 2 },
  { id: '6-grid', name: '6-Grid Wide', count: 6, columns: 2 },
];

export const remoteLayout = { id: 'remote-duo', name: 'Duo Strip', count: 3, columns: 1, photosPerCell: 2 };

export function requiredPhotos(layout) {
  return layout.count * (layout.photosPerCell ?? 1);
}

export function createSession(layout) {
  return { layout, photos: [], motions: [], designRevision: 0, frame: null, caption: null, signatureFont: null, stickers: [], output: null };
}

export function reviewItems(session) {
  return session.reviewItems ?? session.photos.map((photo, index) => ({
    photo, crop: session.crops?.[index], motion: session.motions[index] ?? null, name: `Photo ${index + 1}`, selected: true,
  }));
}

function updatePhotos(session, items) {
  const selected = items.filter((item) => item.selected);
  return {
    ...session,
    reviewItems: items,
    photos: selected.map((item) => item.photo),
    motions: selected.map((item) => item.motion),
    crops: selected.map((item) => normalizeCrop(item.crop)),
    designRevision: session.designRevision + 1,
    output: null,
  };
}

export function sessionReducer(session, action) {
  switch (action.type) {
    case 'start':
      return { ...createSession(action.layout), source: action.source ?? 'camera' };
    case 'remoteStart': {
      if (action.photos?.length !== requiredPhotos(remoteLayout) || !action.roomId) return session;
      return {
        ...createSession(remoteLayout),
        photos: action.photos,
        roomId: action.roomId,
        frame: action.frame,
        caption: 'MILES APART, SAME MOMENT',
      };
    }
    case 'reset':
      return null;
    case 'changeLayout': {
      if (!session) return session;
      if (session.layout.id === action.layout.id) return { ...session, manualLayout: true, source: action.source };
      let available = requiredPhotos(action.layout);
      const items = reviewItems(session).map((item) => ({ ...item, selected: item.selected && available-- > 0 }));
      return updatePhotos({ ...session, manualLayout: true, layout: action.layout, source: action.source }, items);
    }
    case 'capture':
      if (!session || !action.photo || reviewItems(session).length >= 12) {
        return session;
      }
      return updatePhotos(session, [...reviewItems(session), {
        photo: action.photo, motion: action.motion ?? null, name: 'Camera photo', selected: session.photos.length < requiredPhotos(session.layout),
      }]);
    case 'addGallery': {
      if (!session) return session;
      const items = reviewItems(session);
      const count = session.photos.length + Math.min(action.images.length, 12 - items.length);
      const layout = session.manualLayout ? session.layout : layouts.find((layout) => layout.count >= count) ?? layouts.at(-1);
      let available = requiredPhotos(layout) - session.photos.length;
      const added = action.images.slice(0, 12 - items.length).map((image) => ({
        photo: image.url, name: image.name, motion: null, selected: available-- > 0,
      }));
      return updatePhotos({ ...session, layout }, [...items, ...added]);
    }
    case 'reviewSelect': {
      if (!session) return session;
      const items = reviewItems(session);
      const item = items[action.index];
      if (!item || (!item.selected && session.photos.length >= requiredPhotos(session.layout))) return session;
      return updatePhotos(session, items.map((item, index) => index === action.index ? { ...item, selected: !item.selected } : item));
    }
    case 'reviewRemove':
      return session && updatePhotos(session, reviewItems(session).filter((_, index) => index !== action.index));
    case 'reviewMove': {
      if (!session) return session;
      const items = [...reviewItems(session)];
      const target = action.index + action.offset;
      if (!items[action.index] || target < 0 || target >= items.length) return session;
      const [item] = items.splice(action.index, 1);
      items.splice(target, 0, item);
      return updatePhotos(session, items);
    }
    case 'motionResult': {
      if (!session) return session;
      const matches = (motion) => motion?.id === action.id && motion.status === 'pending';
      if (!reviewItems(session).some((item) => matches(item.motion))) return session;
      const update = (motion) => matches(motion)
        ? { ...motion, status: action.gif ? 'ready' : 'unavailable', gif: action.gif }
        : motion;
      return {
        ...session,
        motions: session.motions.map(update),
        reviewItems: reviewItems(session).map((item) => ({ ...item, motion: update(item.motion) })),
      };
    }
    case 'discardMotion': {
      const statuses = action.pendingOnly ? ['pending'] : ['pending', 'ready'];
      if (!session || !reviewItems(session).some((item) => statuses.includes(item.motion?.status))) return session;
      const update = (motion) => statuses.includes(motion?.status)
        ? { ...motion, status: 'unavailable', gif: null } : motion;
      return {
        ...session,
        motions: session.motions.map(update),
        reviewItems: reviewItems(session).map((item) => ({ ...item, motion: update(item.motion) })),
      };
    }
    case 'crop': {
      if (!session || !session.photos[action.index]) return session;
      let selectedIndex = -1;
      return updatePhotos(session, reviewItems(session).map((item) => {
        if (item.selected) selectedIndex++;
        return item.selected && selectedIndex === action.index ? { ...item, crop: normalizeCrop(action.crop) } : item;
      }));
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
