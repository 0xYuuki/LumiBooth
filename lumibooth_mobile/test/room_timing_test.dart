import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/room_timing.dart';

void main() {
  test(
    'different local clocks and asymmetric paths preserve the shutter target',
    () {
      const serverBase = 1794297600000;
      const target = serverBase + 5000;
      int estimate(int localBase, int outbound, int inbound) =>
          estimateRoomShutter(
            sentAt: localBase,
            receivedAt: localBase + outbound + inbound,
            serverNow: serverBase + outbound,
            shutterAt: target,
          )! -
          localBase +
          serverBase;

      final host = estimate(450, 20, 35);
      final guest = estimate(40520, 95, 35);
      expect(host - target, 8);
      expect(guest - target, -30);
      expect((host - guest).abs(), lessThanOrEqualTo(250));
    },
  );

  test('stale and very slow replies cannot schedule a late shot', () {
    expect(
      estimateRoomShutter(
        sentAt: 0,
        receivedAt: 80,
        serverNow: 10200,
        shutterAt: 10000,
      ),
      isNull,
    );
    expect(
      estimateRoomShutter(
        sentAt: 0,
        receivedAt: 1001,
        serverNow: 1000,
        shutterAt: 5000,
      ),
      isNull,
    );
  });
}
