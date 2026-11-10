/// Estimates a local monotonic deadline from a server sample taken between the
/// request and response. Network asymmetry can move the estimate by half the
/// difference between the outbound and inbound delays.
int? estimateRoomShutter({
  required int sentAt,
  required int receivedAt,
  required int serverNow,
  required int shutterAt,
}) {
  final roundTrip = receivedAt - sentAt;
  if (roundTrip > 1000) return null;
  final remaining = shutterAt - serverNow - roundTrip ~/ 2;
  return remaining < -150 ? null : receivedAt + remaining;
}
