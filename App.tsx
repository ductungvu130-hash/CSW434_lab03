import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import NativeNfc from './specs/NativeNfc';
import type {NfcStatus, NfcTagData} from './specs/NativeNfc';
import NativeCompass from './specs/NativeCompass';
import type {CompassReading, CompassStatus} from './specs/NativeCompass';

const directions = [
  'Bắc',
  'Đông Bắc',
  'Đông',
  'Đông Nam',
  'Nam',
  'Tây Nam',
  'Tây',
  'Tây Bắc',
];
const accuracyLabels = ['Chưa tin cậy', 'Thấp', 'Trung bình', 'Cao'];

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'nfc' | 'compass'>('nfc');
  const [nfcStatus, setNfcStatus] = useState<NfcStatus | null>(null);
  const [tag, setTag] = useState<NfcTagData | null>(null);
  const [mockText, setMockText] = useState('Xin chào Lab 3!');
  const [compassStatus, setCompassStatus] = useState<CompassStatus | null>(
    null,
  );
  const [reading, setReading] = useState<CompassReading | null>(null);
  const needle = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef<number | null>(null);
  const needleAngle = useRef(0);

  useEffect(() => {
    const tagSubscription = NativeNfc.onTagDiscovered(setTag);
    const nfcStatusSubscription = NativeNfc.onStatusChanged(setNfcStatus);
    const compassStatusSubscription =
      NativeCompass.onStatusChanged(setCompassStatus);
    const headingSubscription = NativeCompass.onHeadingChanged(value => {
      setReading(value);
      const previous = lastHeading.current;
      if (previous === null) {
        needleAngle.current = -value.heading;
      } else {
        const delta = ((value.heading - previous + 540) % 360) - 180;
        needleAngle.current -= delta;
      }
      lastHeading.current = value.heading;
      Animated.timing(needle, {
        toValue: needleAngle.current,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
    NativeNfc.startScanning();
    NativeCompass.start();
    return () => {
      NativeNfc.stopScanning();
      NativeCompass.stop();
      tagSubscription.remove();
      nfcStatusSubscription.remove();
      headingSubscription.remove();
      compassStatusSubscription.remove();
      needle.stopAnimation();
    };
  }, [needle]);

  const heading = reading ? Math.round(reading.heading) % 360 : null;
  const direction = reading
    ? directions[Math.round(reading.heading / 45) % 8]
    : 'Đang chờ cảm biến';
  const rotation = needle.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
    extrapolate: 'extend',
  });

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>LAB 3 · CẢM BIẾN ANDROID</Text>
          <Text style={styles.title}>
            {screen === 'nfc' ? 'Đọc thẻ NFC' : 'La bàn'}
          </Text>
        </View>
        <View style={styles.tabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: screen === 'nfc'}}
            onPress={() => setScreen('nfc')}
            style={[styles.tab, screen === 'nfc' && styles.selectedTab]}
          >
            <Text
              style={[
                styles.tabText,
                screen === 'nfc' && styles.selectedTabText,
              ]}
            >
              Bài 1 · NFC
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{selected: screen === 'compass'}}
            onPress={() => setScreen('compass')}
            style={[styles.tab, screen === 'compass' && styles.selectedTab]}
          >
            <Text
              style={[
                styles.tabText,
                screen === 'compass' && styles.selectedTabText,
              ]}
            >
              Bài 2 · La bàn
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {screen === 'nfc' ? (
            <>
              <View style={styles.card}>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.dot,
                      nfcStatus?.scanning && styles.activeDot,
                    ]}
                  />
                  <Text style={styles.cardTitle}>
                    {nfcStatus?.scanning ? 'Sẵn sàng quét' : 'Trạng thái NFC'}
                  </Text>
                </View>
                <Text style={styles.body}>
                  {nfcStatus?.message ?? 'Đang khởi động NFC…'}
                </Text>
                {nfcStatus?.available && !nfcStatus.enabled && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={() => NativeNfc.openSettings()}
                  >
                    <Text style={styles.buttonText}>Mở cài đặt NFC</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mock NDEF Record</Text>
                <Text style={styles.body}>
                  Nhập nội dung để thử đọc một bản ghi NDEF Text.
                </Text>
                <TextInput
                  accessibilityLabel="Nội dung NDEF mẫu"
                  style={styles.input}
                  value={mockText}
                  onChangeText={setMockText}
                  placeholder="Nội dung bản ghi"
                  placeholderTextColor="#8795A5"
                  multiline
                  maxLength={1000}
                />
                <Pressable
                  accessibilityRole="button"
                  style={[
                    styles.button,
                    !mockText.trim() && styles.disabledButton,
                  ]}
                  disabled={!mockText.trim()}
                  onPress={() => NativeNfc.mockNdefRecord(mockText)}
                >
                  <Text style={styles.buttonText}>Đọc NDEF mẫu</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Thông tin thẻ</Text>
                {tag ? (
                  <>
                    <Text style={styles.badge}>
                      {tag.mock ? 'DỮ LIỆU MẪU' : 'THẺ NFC THẬT'}
                    </Text>
                    <Text selectable style={styles.body}>
                      UID: {tag.id || 'Không có'}
                    </Text>
                    <Text selectable style={styles.body}>
                      Công nghệ: {tag.technologies.join(', ')}
                    </Text>
                    <Text style={styles.body}>
                      Số bản ghi NDEF: {tag.records.length}
                    </Text>
                    {tag.records.length === 0 && (
                      <Text style={styles.body}>
                        Thẻ không chứa thông điệp NDEF.
                      </Text>
                    )}
                    {tag.records.map((record, index) => (
                      <View key={`${tag.id}-${index}`} style={styles.record}>
                        <Text style={styles.recordLabel}>
                          BẢN GHI {index + 1} ·{' '}
                          {record.type || 'Không xác định'}
                        </Text>
                        <Text selectable style={styles.recordText}>
                          {record.text || '(Rỗng)'}
                        </Text>
                        <Text selectable style={styles.metadata}>
                          TNF: {record.tnf} · ID: {record.id || 'Không có'}
                        </Text>
                        <Text selectable style={styles.metadata}>
                          Payload (hex): {record.payload || '(Rỗng)'}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.body}>
                    Chưa có dữ liệu. Chạm thẻ NFC hoặc đọc bản ghi mẫu.
                  </Text>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.compassCard}>
                <Text style={styles.compassCaption}>HƯỚNG BẮC TỪ</Text>
                <View
                  style={styles.dial}
                  accessibilityLabel={`Hướng hiện tại: ${
                    heading ?? '--'
                  } độ, ${direction}`}
                >
                  {Array.from({length: 36}, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tickContainer,
                        {transform: [{rotate: `${index * 10}deg`}]},
                      ]}
                    >
                      <View
                        style={
                          index % 9 === 0
                            ? styles.cardinalTick
                            : index % 3 === 0
                            ? styles.majorTick
                            : styles.tick
                        }
                      />
                    </View>
                  ))}
                  <Text style={[styles.cardinal, styles.north]}>N</Text>
                  <Text style={[styles.cardinal, styles.east]}>E</Text>
                  <Text style={[styles.cardinal, styles.south]}>S</Text>
                  <Text style={[styles.cardinal, styles.west]}>W</Text>
                  {reading && (
                    <Animated.View
                      style={[styles.needle, {transform: [{rotate: rotation}]}]}
                    >
                      <View style={styles.needleNorth} />
                      <View style={styles.needleSouth} />
                    </Animated.View>
                  )}
                  <View style={styles.hub}>
                    <Text style={styles.heading}>
                      {heading === null ? '–' : `${heading}°`}
                    </Text>
                    <Text style={styles.direction}>{direction}</Text>
                  </View>
                </View>
                <Text style={styles.compassHint}>
                  {compassStatus?.message ?? 'Đang khởi động cảm biến…'}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Magnetometer</Text>
                <View style={styles.axes}>
                  {(['x', 'y', 'z'] as const).map(axis => (
                    <View key={axis} style={styles.axis}>
                      <Text style={styles.axisLabel}>{axis.toUpperCase()}</Text>
                      <Text style={styles.axisValue}>
                        {reading ? reading[axis].toFixed(1) : '–'}
                      </Text>
                      <Text style={styles.metadata}>µT</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.body}>
                  Độ chính xác:{' '}
                  {reading
                    ? accuracyLabels[reading.accuracy] ?? 'Không xác định'
                    : 'Đang chờ'}
                </Text>
                {reading && reading.accuracy < 2 && (
                  <Text style={styles.calibration}>
                    Di chuyển điện thoại theo hình số 8 để hiệu chuẩn, tránh xa
                    kim loại và nam châm.
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F3F7FC'},
  header: {paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20},
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: '#687E94',
    fontWeight: '700',
  },
  title: {fontSize: 30, fontWeight: '700', color: '#20364D', marginTop: 8},
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E5ECF5',
    borderRadius: 14,
    marginHorizontal: 24,
    padding: 4,
  },
  tab: {flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: 'center'},
  selectedTab: {backgroundColor: '#FFFFFF', elevation: 1},
  tabText: {fontSize: 14, fontWeight: '600', color: '#6A7D92'},
  selectedTabText: {color: '#234F79'},
  content: {padding: 24, gap: 18, paddingBottom: 36},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4EBF4',
    gap: 10,
  },
  cardTitle: {fontSize: 17, fontWeight: '700', color: '#20364D', flexShrink: 1},
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 9},
  dot: {width: 9, height: 9, borderRadius: 5, backgroundColor: '#A6B3C2'},
  activeDot: {backgroundColor: '#2F9C7B'},
  body: {fontSize: 14, color: '#607287', lineHeight: 22},
  input: {
    borderWidth: 1,
    borderColor: '#DCE5F0',
    backgroundColor: '#F8FAFD',
    color: '#20364D',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#284F77',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {opacity: 0.4},
  buttonText: {color: '#FFFFFF', fontWeight: '600', fontSize: 14},
  badge: {
    alignSelf: 'flex-start',
    color: '#2D6E97',
    backgroundColor: '#EAF3FC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  record: {padding: 14, backgroundColor: '#F3F7FC', borderRadius: 12, gap: 8},
  recordLabel: {
    fontSize: 11,
    color: '#647B93',
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  recordText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: '#20364D',
  },
  metadata: {fontSize: 12, color: '#7A8B9D', lineHeight: 19},
  compassCard: {alignItems: 'center', paddingVertical: 12, gap: 24},
  compassCaption: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#788BA1',
  },
  dial: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: '#E0E9F5',
    backgroundColor: '#EDF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickContainer: {
    position: 'absolute',
    width: 4,
    height: 252,
    alignItems: 'center',
  },
  tick: {width: 1, height: 6, backgroundColor: '#BAC9DA'},
  majorTick: {width: 2, height: 12, backgroundColor: '#879CB3'},
  cardinalTick: {width: 2, height: 16, backgroundColor: '#E16A59'},
  cardinal: {
    position: 'absolute',
    fontSize: 19,
    fontWeight: '600',
    color: '#5D7289',
  },
  north: {top: 34, color: '#DA514C'},
  east: {right: 36},
  south: {bottom: 34},
  west: {left: 32},
  needle: {position: 'absolute', width: 26, height: 202, alignItems: 'center'},
  needleNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 101,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#DA514C',
  },
  needleSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 101,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#7F9AB7',
  },
  hub: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#F9FBFF',
    borderWidth: 6,
    borderColor: '#E3ECFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  heading: {fontSize: 38, fontWeight: '700', color: '#2C445E'},
  direction: {fontSize: 13, color: '#6A7E94', textAlign: 'center'},
  compassHint: {
    fontSize: 14,
    color: '#6A7E94',
    lineHeight: 22,
    textAlign: 'center',
  },
  axes: {flexDirection: 'row', paddingVertical: 10},
  axis: {flex: 1, alignItems: 'center', gap: 5},
  axisLabel: {fontSize: 12, fontWeight: '700', color: '#738AA3'},
  axisValue: {fontSize: 24, fontWeight: '600', color: '#2C445E'},
  calibration: {fontSize: 13, color: '#AA7130', lineHeight: 21},
});

export default App;
