export const printStatus = {
  awaiting_marketplace_order: 'Awaiting match',
  needs_review: 'Needs review',
  verified: 'Verified by staff',
  print_ready: 'Ready to print',
  printing: 'Printing',
  packed: 'Packed',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
};

export const nextStage = {
  verified: ['print_ready', 'Release to print queue'],
  print_ready: ['printing', 'Start printing'],
  printing: ['packed', 'Mark packed'],
  packed: ['shipped', 'Record shipment'],
  shipped: ['completed', 'Mark completed'],
};

export const exceptionStages = {
  awaiting_marketplace_order: ['needs_review', 'cancelled'],
  needs_review: ['cancelled'],
  verified: ['cancelled', 'refunded'],
  print_ready: ['cancelled', 'refunded'],
  printing: ['refunded'],
  packed: ['refunded'],
  shipped: ['refunded'],
  completed: ['refunded'],
};

const dateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
});

export const manilaTime = value => dateTime.format(new Date(value));
export const stageLabel = value => printStatus[value] ?? (value === 'queued' ? 'Queued' : value);
export const humanize = value => value.split('_').join(' ');
export const reprintActive = job => ['queued', 'printing'].includes(job.status);
